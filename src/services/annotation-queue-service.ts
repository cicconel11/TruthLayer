import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { AnnotationPipeline } from './annotation-pipeline';
import { SearchResultRepository } from '../database/repositories';
import { SearchResult, SearchResultFilter } from '../database/models';

/**
 * Service for managing annotation queue operations
 */
export class AnnotationQueueService extends EventEmitter {
    constructor(
        private pipeline: AnnotationPipeline,
        private searchResultRepo: SearchResultRepository
    ) {
        super();
        this.setupPipelineEventHandlers();
    }

    /**
     * Start the annotation queue service
     */
    start(): void {
        this.pipeline.start();
        logger.info('Annotation queue service started');
        this.emit('started');
    }

    /**
     * Stop the annotation queue service
     */
    stop(): void {
        this.pipeline.stop();
        logger.info('Annotation queue service stopped');
        this.emit('stopped');
    }

    /**
     * Queue search results for annotation
     */
    async queueSearchResults(
        searchResults: SearchResult[],
        priority: 'low' | 'normal' | 'high' = 'normal'
    ): Promise<string[]> {
        logger.info('Queueing search results for annotation', {
            count: searchResults.length,
            priority
        });

        const queuedIds = await this.pipeline.enqueueBatch(searchResults, priority);

        logger.info('Search results queued for annotation', {
            totalResults: searchResults.length,
            queuedCount: queuedIds.length,
            failedCount: searchResults.length - queuedIds.length
        });

        this.emit('queued', {
            searchResults,
            queuedIds,
            priority
        });

        return queuedIds;
    }

    /**
     * Queue unannotated search results from database
     */
    async queueUnannotatedResults(
        filter: SearchResultFilter = {},
        priority: 'low' | 'normal' | 'high' = 'normal',
        batchSize = 100
    ): Promise<number> {
        logger.info('Queueing unannotated search results from database', {
            filter,
            priority,
            batchSize
        });

        let totalQueued = 0;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            // Get unannotated search results
            const searchFilter: SearchResultFilter = {
                ...filter,
                has_annotation: false
            };

            const searchResults = await this.searchResultRepo.findMany(
                searchFilter,
                batchSize,
                offset
            );

            if (searchResults.length === 0) {
                hasMore = false;
                break;
            }

            // Queue the batch
            const queuedIds = await this.queueSearchResults(searchResults, priority);
            totalQueued += queuedIds.length;

            logger.debug('Queued batch of unannotated results', {
                batchSize: searchResults.length,
                queuedCount: queuedIds.length,
                totalQueued,
                offset
            });

            offset += batchSize;

            // If we got fewer results than batch size, we're done
            if (searchResults.length < batchSize) {
                hasMore = false;
            }
        }

        logger.info('Completed queueing unannotated search results', {
            totalQueued,
            filter,
            priority
        });

        this.emit('batch_queued', {
            totalQueued,
            filter,
            priority
        });

        return totalQueued;
    }

    /**
     * Queue search results by query ID
     */
    async queueResultsByQuery(
        queryId: string,
        priority: 'low' | 'normal' | 'high' = 'normal'
    ): Promise<string[]> {
        logger.info('Queueing search results by query ID', { queryId, priority });

        const searchResults = await this.searchResultRepo.findMany({
            query_id: queryId,
            has_annotation: false
        });

        if (searchResults.length === 0) {
            logger.info('No unannotated search results found for query', { queryId });
            return [];
        }

        const queuedIds = await this.queueSearchResults(searchResults, priority);

        logger.info('Queued search results by query ID', {
            queryId,
            totalResults: searchResults.length,
            queuedCount: queuedIds.length
        });

        return queuedIds;
    }

    /**
     * Queue search results by engine
     */
    async queueResultsByEngine(
        engine: 'google' | 'bing' | 'perplexity' | 'brave',
        priority: 'low' | 'normal' | 'high' = 'normal',
        dateRange?: { from?: Date; to?: Date }
    ): Promise<number> {
        logger.info('Queueing search results by engine', { engine, priority, dateRange });

        const filter: SearchResultFilter = {
            engine,
            has_annotation: false
        };

        if (dateRange?.from) {
            filter.collected_after = dateRange.from;
        }

        if (dateRange?.to) {
            filter.collected_before = dateRange.to;
        }

        const totalQueued = await this.queueUnannotatedResults(filter, priority);

        logger.info('Completed queueing search results by engine', {
            engine,
            totalQueued,
            dateRange
        });

        return totalQueued;
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        return {
            pipeline: this.pipeline.getStats(),
            queue: this.pipeline.getQueueStatus()
        };
    }

    /**
     * Clear annotation cache
     */
    clearCache(): void {
        this.pipeline.clearCache();
        logger.info('Annotation cache cleared');
        this.emit('cache_cleared');
    }

    /**
     * Clear annotation queue
     */
    clearQueue(): void {
        this.pipeline.clearQueue();
        logger.info('Annotation queue cleared');
        this.emit('queue_cleared');
    }

    /**
     * Process high priority items immediately
     */
    async processHighPriorityItems(): Promise<void> {
        logger.info('Processing high priority annotation items');

        // This will be handled by the pipeline's internal processing
        // We just emit an event to indicate high priority processing was requested
        this.emit('high_priority_requested');
    }

    /**
     * Setup event handlers for pipeline events
     */
    private setupPipelineEventHandlers(): void {
        this.pipeline.on('started', () => {
            this.emit('pipeline_started');
        });

        this.pipeline.on('stopped', () => {
            this.emit('pipeline_stopped');
        });

        this.pipeline.on('processed', (data) => {
            logger.debug('Annotation processed', {
                resultId: data.searchResult.id,
                domainType: data.annotation.domainType,
                factualScore: data.annotation.factualScore,
                processingTime: data.processingTime
            });

            this.emit('annotation_processed', data);
        });

        this.pipeline.on('cached', (data) => {
            logger.debug('Annotation served from cache', {
                resultId: data.searchResult.id,
                domainType: data.annotation.domainType
            });

            this.emit('annotation_cached', data);
        });

        this.pipeline.on('retry', (data) => {
            logger.warn('Annotation retry scheduled', {
                resultId: data.searchResult.id,
                attempt: data.attempt,
                error: data.error,
                nextRetryIn: data.nextRetryIn
            });

            this.emit('annotation_retry', data);
        });

        this.pipeline.on('failed', (data) => {
            logger.error('Annotation failed permanently', {
                resultId: data.searchResult.id,
                totalAttempts: data.totalAttempts,
                error: data.error
            });

            this.emit('annotation_failed', data);
        });

        this.pipeline.on('error', (error) => {
            logger.error('Pipeline error', { error: error.message });
            this.emit('pipeline_error', error);
        });
    }

    /**
     * Get processing status for specific search result
     */
    async getProcessingStatus(searchResultId: string): Promise<{
        status: 'not_queued' | 'queued' | 'processing' | 'completed' | 'failed';
        annotation?: any;
        queuePosition?: number;
        error?: string;
    }> {
        // Check if already annotated
        const existingAnnotation = await this.searchResultRepo.findById(searchResultId);
        if (!existingAnnotation) {
            return { status: 'not_queued' };
        }

        // Check pipeline queue status
        // TODO: Use queue status for queue management logic
        // const queueStatus = this.pipeline.getQueueStatus();

        // This is a simplified implementation - in a real system you might want
        // to track individual item status more precisely
        return {
            status: 'queued', // Simplified for now
            queuePosition: 0 // Would need to implement proper queue position tracking
        };
    }

    /**
     * Estimate processing time for current queue
     */
    estimateProcessingTime(): {
        estimatedMinutes: number;
        queueSize: number;
        averageProcessingTime: number;
    } {
        const stats = this.pipeline.getStats();
        const queueStatus = this.pipeline.getQueueStatus();

        const estimatedMinutes = queueStatus.pending > 0
            ? (queueStatus.pending * stats.averageProcessingTime) / (1000 * 60)
            : 0;

        return {
            estimatedMinutes: Math.ceil(estimatedMinutes),
            queueSize: queueStatus.pending,
            averageProcessingTime: stats.averageProcessingTime
        };
    }
}