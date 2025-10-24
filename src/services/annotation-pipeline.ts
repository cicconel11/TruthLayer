import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { AnnotationServiceInterface } from './annotation-service';
import { SearchResultRepository, AnnotationRepository, QueryRepository } from '../database/repositories';
import { SearchResult, CreateAnnotationRequest } from '../database/models';
import { AnnotationRequest, AnnotationResponse } from '../types/annotation';
import { createHash } from 'crypto';

/**
 * Queue item for annotation processing
 */
export interface AnnotationQueueItem {
    id: string;
    searchResult: SearchResult;
    priority: 'low' | 'normal' | 'high';
    retryCount: number;
    maxRetries: number;
    createdAt: Date;
    lastAttemptAt?: Date;
    error?: string;
}

/**
 * Cache entry for annotation results
 */
export interface AnnotationCacheEntry {
    contentHash: string;
    annotation: AnnotationResponse;
    modelVersion: string;
    cachedAt: Date;
    hitCount: number;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
    totalProcessed: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    totalRetries: number;
    totalFailures: number;
    averageProcessingTime: number;
    queueSize: number;
    cacheSize: number;
}

/**
 * Pipeline configuration
 */
export interface AnnotationPipelineConfig {
    maxConcurrentJobs: number;
    maxRetries: number;
    retryDelayMs: number;
    retryBackoffMultiplier: number;
    maxRetryDelayMs: number;
    cacheMaxSize: number;
    cacheTtlMs: number;
    batchSize: number;
    processingIntervalMs: number;
    enableCaching: boolean;
    enableBatching: boolean;
}

/**
 * Default pipeline configuration
 */
const DEFAULT_CONFIG: AnnotationPipelineConfig = {
    maxConcurrentJobs: 3,
    maxRetries: 3,
    retryDelayMs: 1000,
    retryBackoffMultiplier: 2,
    maxRetryDelayMs: 30000,
    cacheMaxSize: 10000,
    cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
    batchSize: 5,
    processingIntervalMs: 5000,
    enableCaching: true,
    enableBatching: true
};

/**
 * Annotation processing pipeline with queue, caching, and retry logic
 */
export class AnnotationPipeline extends EventEmitter {
    private queue: Map<string, AnnotationQueueItem> = new Map();
    private cache: Map<string, AnnotationCacheEntry> = new Map();
    private queryCache?: Map<string, string>;
    private processing: Set<string> = new Set();
    private stats: PipelineStats = {
        totalProcessed: 0,
        totalCacheHits: 0,
        totalCacheMisses: 0,
        totalRetries: 0,
        totalFailures: 0,
        averageProcessingTime: 0,
        queueSize: 0,
        cacheSize: 0
    };
    private processingTimer?: NodeJS.Timeout;
    private isRunning = false;
    private processingTimes: number[] = [];
    private config: AnnotationPipelineConfig;

    constructor(
        private annotationService: AnnotationServiceInterface,
        private searchResultRepo: SearchResultRepository, // TODO: Use for search result operations
        private annotationRepo: AnnotationRepository,
        private queryRepo: QueryRepository,
        config?: Partial<AnnotationPipelineConfig>
    ) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.setupEventHandlers();
    }

    /**
     * Start the annotation pipeline
     */
    start(): void {
        if (this.isRunning) {
            logger.warn('Annotation pipeline is already running');
            return;
        }

        this.isRunning = true;
        this.processingTimer = setInterval(() => {
            this.processQueue().catch(error => {
                logger.error('Error in queue processing cycle', { error: error.message });
                this.emit('error', error);
            });
        }, this.config.processingIntervalMs);

        logger.info('Annotation pipeline started', {
            config: this.config,
            queueSize: this.queue.size,
            cacheSize: this.cache.size
        });

        this.emit('started');
    }

    /**
     * Stop the annotation pipeline
     */
    stop(): void {
        if (!this.isRunning) {
            logger.warn('Annotation pipeline is not running');
            return;
        }

        this.isRunning = false;
        if (this.processingTimer) {
            clearInterval(this.processingTimer);
            this.processingTimer = undefined;
        }

        logger.info('Annotation pipeline stopped', {
            queueSize: this.queue.size,
            processingCount: this.processing.size,
            stats: this.stats
        });

        this.emit('stopped');
    }

    /**
     * Add search result to annotation queue
     */
    async enqueue(searchResult: SearchResult, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string> {
        // Check if already annotated
        const existingAnnotation = await this.annotationRepo.findByResultId(searchResult.id);
        if (existingAnnotation) {
            logger.debug('Search result already annotated, skipping', { resultId: searchResult.id });
            return searchResult.id;
        }

        // Check cache first
        const contentHash = this.generateContentHash(searchResult);
        const cachedEntry = this.getCachedAnnotation(contentHash);

        if (cachedEntry) {
            logger.debug('Found cached annotation, applying directly', {
                resultId: searchResult.id,
                contentHash
            });

            await this.saveCachedAnnotation(searchResult, cachedEntry.annotation);
            this.stats.totalCacheHits++;
            this.emit('cached', { searchResult, annotation: cachedEntry.annotation });
            return searchResult.id;
        }

        // Add to queue if not cached
        const queueItem: AnnotationQueueItem = {
            id: searchResult.id,
            searchResult,
            priority,
            retryCount: 0,
            maxRetries: this.config.maxRetries,
            createdAt: new Date()
        };

        this.queue.set(searchResult.id, queueItem);
        this.updateStats();

        logger.debug('Added search result to annotation queue', {
            resultId: searchResult.id,
            priority,
            queueSize: this.queue.size
        });

        this.emit('queued', { searchResult, priority });
        return searchResult.id;
    }

    /**
     * Add multiple search results to queue
     */
    async enqueueBatch(searchResults: SearchResult[], priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string[]> {
        const queuedIds: string[] = [];

        for (const searchResult of searchResults) {
            try {
                const id = await this.enqueue(searchResult, priority);
                queuedIds.push(id);
            } catch (error) {
                logger.error('Failed to enqueue search result', {
                    resultId: searchResult.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        logger.info('Batch enqueue completed', {
            totalResults: searchResults.length,
            queuedCount: queuedIds.length,
            failedCount: searchResults.length - queuedIds.length
        });

        return queuedIds;
    }

    /**
     * Process the annotation queue
     */
    private async processQueue(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        // Get items ready for processing
        const readyItems = this.getReadyQueueItems();
        if (readyItems.length === 0) {
            return;
        }

        // Limit concurrent processing
        const availableSlots = this.config.maxConcurrentJobs - this.processing.size;
        const itemsToProcess = readyItems.slice(0, availableSlots);

        if (itemsToProcess.length === 0) {
            return;
        }

        logger.debug('Processing queue items', {
            readyItems: readyItems.length,
            availableSlots,
            processing: itemsToProcess.length
        });

        // Process items (batch or individual)
        if (this.config.enableBatching && itemsToProcess.length >= this.config.batchSize) {
            await this.processBatch(itemsToProcess.slice(0, this.config.batchSize));
        } else {
            // Process individual items
            const promises = itemsToProcess.map(item => this.processItem(item));
            await Promise.allSettled(promises);
        }
    }

    /**
     * Get queue items ready for processing
     */
    private getReadyQueueItems(): AnnotationQueueItem[] {
        const now = new Date();
        const items = Array.from(this.queue.values())
            .filter(item => {
                // Skip if already processing
                if (this.processing.has(item.id)) {
                    return false;
                }

                // Skip if max retries exceeded
                if (item.retryCount >= item.maxRetries) {
                    return false;
                }

                // Check retry delay
                if (item.lastAttemptAt) {
                    const retryDelay = this.calculateRetryDelay(item.retryCount);
                    const nextAttemptTime = new Date(item.lastAttemptAt.getTime() + retryDelay);
                    if (now < nextAttemptTime) {
                        return false;
                    }
                }

                return true;
            })
            .sort((a, b) => {
                // Sort by priority, then by creation time
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) {
                    return priorityDiff;
                }
                return a.createdAt.getTime() - b.createdAt.getTime();
            });

        return items;
    }

    /**
     * Process a single queue item
     */
    private async processItem(item: AnnotationQueueItem): Promise<void> {
        const startTime = Date.now();
        this.processing.add(item.id);
        item.lastAttemptAt = new Date();
        item.retryCount++;

        try {
            logger.debug('Processing annotation item', {
                resultId: item.id,
                attempt: item.retryCount,
                maxRetries: item.maxRetries
            });

            // Create annotation request
            const request: AnnotationRequest = {
                title: item.searchResult.title,
                snippet: item.searchResult.snippet || '',
                url: item.searchResult.url,
                query: await this.getQueryText(item.searchResult.query_id)
            };

            // Process annotation
            const response = await this.annotationService.annotateResult(request);

            // Cache the result
            if (this.config.enableCaching) {
                const contentHash = this.generateContentHash(item.searchResult);
                this.cacheAnnotation(contentHash, response);
            }

            // Save to database
            await this.saveAnnotation(item.searchResult, response);

            // Remove from queue
            this.queue.delete(item.id);
            this.processing.delete(item.id);

            // Update stats
            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime);
            this.stats.totalProcessed++;
            this.stats.totalCacheMisses++;

            logger.info('Annotation completed successfully', {
                resultId: item.id,
                processingTimeMs: processingTime,
                domainType: response.domainType,
                factualScore: response.factualScore
            });

            this.emit('processed', {
                searchResult: item.searchResult,
                annotation: response,
                processingTime
            });

        } catch (error) {
            this.processing.delete(item.id);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            item.error = errorMessage;

            logger.error('Annotation processing failed', {
                resultId: item.id,
                attempt: item.retryCount,
                maxRetries: item.maxRetries,
                error: errorMessage
            });

            // Check if should retry
            if (item.retryCount < item.maxRetries) {
                const retryDelay = this.calculateRetryDelay(item.retryCount);
                logger.info('Scheduling retry for annotation', {
                    resultId: item.id,
                    nextAttempt: item.retryCount + 1,
                    retryDelayMs: retryDelay
                });

                this.stats.totalRetries++;
                this.emit('retry', {
                    searchResult: item.searchResult,
                    error: errorMessage,
                    attempt: item.retryCount,
                    nextRetryIn: retryDelay
                });
            } else {
                // Max retries exceeded, remove from queue
                this.queue.delete(item.id);
                this.stats.totalFailures++;

                logger.error('Annotation failed permanently after max retries', {
                    resultId: item.id,
                    totalAttempts: item.retryCount,
                    finalError: errorMessage
                });

                this.emit('failed', {
                    searchResult: item.searchResult,
                    error: errorMessage,
                    totalAttempts: item.retryCount
                });
            }
        }

        this.updateStats();
    }

    /**
     * Process items in batch
     */
    private async processBatch(items: AnnotationQueueItem[]): Promise<void> {
        const startTime = Date.now();

        // Mark items as processing
        items.forEach(item => {
            this.processing.add(item.id);
            item.lastAttemptAt = new Date();
            item.retryCount++;
        });

        try {
            logger.debug('Processing annotation batch', {
                batchSize: items.length,
                resultIds: items.map(item => item.id)
            });

            // Create batch request
            const requests: AnnotationRequest[] = await Promise.all(
                items.map(async item => ({
                    title: item.searchResult.title,
                    snippet: item.searchResult.snippet || '',
                    url: item.searchResult.url,
                    query: await this.getQueryText(item.searchResult.query_id)
                }))
            );

            // Process batch
            const batchResponse = await this.annotationService.batchAnnotate({
                requests,
                batchId: `batch_${Date.now()}`
            });

            // Process results
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const response = batchResponse.responses[i];

                if (response) {
                    try {
                        // Cache and save
                        if (this.config.enableCaching) {
                            const contentHash = this.generateContentHash(item.searchResult);
                            this.cacheAnnotation(contentHash, response);
                        }

                        await this.saveAnnotation(item.searchResult, response);

                        // Remove from queue
                        this.queue.delete(item.id);
                        this.stats.totalProcessed++;
                        this.stats.totalCacheMisses++;

                        this.emit('processed', {
                            searchResult: item.searchResult,
                            annotation: response,
                            processingTime: Date.now() - startTime
                        });

                    } catch (saveError) {
                        logger.error('Failed to save batch annotation result', {
                            resultId: item.id,
                            error: saveError instanceof Error ? saveError.message : 'Unknown error'
                        });
                        // Handle as individual failure
                        this.handleItemFailure(item, saveError instanceof Error ? saveError.message : 'Save failed');
                    }
                } else {
                    // Handle missing response
                    this.handleItemFailure(item, 'No response in batch result');
                }

                this.processing.delete(item.id);
            }

            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime);

            logger.info('Batch annotation completed', {
                batchSize: items.length,
                processingTimeMs: processingTime,
                errors: batchResponse.errors.length
            });

        } catch (error) {
            // Handle batch failure - retry items individually
            const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';

            logger.error('Batch annotation failed, handling items individually', {
                batchSize: items.length,
                error: errorMessage
            });

            items.forEach(item => {
                this.processing.delete(item.id);
                this.handleItemFailure(item, errorMessage);
            });
        }

        this.updateStats();
    }

    /**
     * Handle individual item failure
     */
    private handleItemFailure(item: AnnotationQueueItem, errorMessage: string): void {
        item.error = errorMessage;

        if (item.retryCount < item.maxRetries) {
            this.stats.totalRetries++;
            this.emit('retry', {
                searchResult: item.searchResult,
                error: errorMessage,
                attempt: item.retryCount,
                nextRetryIn: this.calculateRetryDelay(item.retryCount)
            });
        } else {
            this.queue.delete(item.id);
            this.stats.totalFailures++;
            this.emit('failed', {
                searchResult: item.searchResult,
                error: errorMessage,
                totalAttempts: item.retryCount
            });
        }
    }

    /**
     * Generate content hash for caching
     */
    private generateContentHash(searchResult: SearchResult): string {
        const content = `${searchResult.title}|${searchResult.snippet || ''}|${searchResult.url}`;
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Get cached annotation
     */
    private getCachedAnnotation(contentHash: string): AnnotationCacheEntry | null {
        const entry = this.cache.get(contentHash);
        if (!entry) {
            return null;
        }

        // Check TTL
        const now = new Date();
        const age = now.getTime() - entry.cachedAt.getTime();
        if (age > this.config.cacheTtlMs) {
            this.cache.delete(contentHash);
            return null;
        }

        // Update hit count
        entry.hitCount++;
        return entry;
    }

    /**
     * Cache annotation result
     */
    private cacheAnnotation(contentHash: string, annotation: AnnotationResponse): void {
        // Check cache size limit
        if (this.cache.size >= this.config.cacheMaxSize) {
            this.evictOldestCacheEntries();
        }

        const entry: AnnotationCacheEntry = {
            contentHash,
            annotation,
            modelVersion: this.annotationService.getPromptVersion(),
            cachedAt: new Date(),
            hitCount: 0
        };

        this.cache.set(contentHash, entry);
    }

    /**
     * Evict oldest cache entries when limit is reached
     */
    private evictOldestCacheEntries(): void {
        const entries = Array.from(this.cache.entries())
            .sort(([, a], [, b]) => a.cachedAt.getTime() - b.cachedAt.getTime());

        const toEvict = Math.floor(this.config.cacheMaxSize * 0.1); // Evict 10%
        for (let i = 0; i < toEvict && i < entries.length; i++) {
            this.cache.delete(entries[i][0]);
        }

        logger.debug('Evicted old cache entries', {
            evicted: toEvict,
            cacheSize: this.cache.size
        });
    }

    /**
     * Save cached annotation to database
     */
    private async saveCachedAnnotation(searchResult: SearchResult, annotation: AnnotationResponse): Promise<void> {
        const annotationData: CreateAnnotationRequest = {
            result_id: searchResult.id,
            domain_type: annotation.domainType,
            factual_score: annotation.factualScore,
            confidence_score: annotation.confidenceScore,
            reasoning: annotation.reasoning,
            model_version: this.annotationService.getPromptVersion()
        };

        await this.annotationRepo.create(annotationData);
    }

    /**
     * Save annotation to database
     */
    private async saveAnnotation(searchResult: SearchResult, annotation: AnnotationResponse): Promise<void> {
        const annotationData: CreateAnnotationRequest = {
            result_id: searchResult.id,
            domain_type: annotation.domainType,
            factual_score: annotation.factualScore,
            confidence_score: annotation.confidenceScore,
            reasoning: annotation.reasoning,
            model_version: this.annotationService.getPromptVersion()
        };

        await this.annotationRepo.create(annotationData);
    }

    /**
     * Get query text by ID
     */
    private async getQueryText(queryId: string): Promise<string> {
        // Use a simple cache for query texts to avoid repeated database calls
        if (!this.queryCache) {
            this.queryCache = new Map();
        }

        if (this.queryCache.has(queryId)) {
            return this.queryCache.get(queryId)!;
        }

        try {
            const query = await this.queryRepo.findById(queryId);
            const queryText = query?.text || 'Unknown query';
            this.queryCache.set(queryId, queryText);
            return queryText;
        } catch (error) {
            logger.error('Failed to get query text', { queryId, error });
            return 'Unknown query';
        }
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay(retryCount: number): number {
        const baseDelay = this.config.retryDelayMs;
        const backoffDelay = baseDelay * Math.pow(this.config.retryBackoffMultiplier, retryCount - 1);
        const jitter = Math.random() * 0.1 * backoffDelay; // Add 10% jitter
        return Math.min(backoffDelay + jitter, this.config.maxRetryDelayMs);
    }

    /**
     * Update processing time statistics
     */
    private updateProcessingStats(processingTime: number): void {
        this.processingTimes.push(processingTime);

        // Keep only last 100 processing times for average calculation
        if (this.processingTimes.length > 100) {
            this.processingTimes = this.processingTimes.slice(-100);
        }

        this.stats.averageProcessingTime =
            this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
    }

    /**
     * Update general statistics
     */
    private updateStats(): void {
        this.stats.queueSize = this.queue.size;
        this.stats.cacheSize = this.cache.size;
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        this.on('error', (error) => {
            logger.error('Annotation pipeline error', { error: error.message });
        });

        // Clean up failed items periodically
        setInterval(() => {
            this.cleanupFailedItems();
        }, 60000); // Every minute

        // Clean up expired cache entries periodically
        setInterval(() => {
            this.cleanupExpiredCache();
        }, 300000); // Every 5 minutes
    }

    /**
     * Clean up items that have exceeded max retries
     */
    private cleanupFailedItems(): void {
        const failedItems = Array.from(this.queue.values())
            .filter(item => item.retryCount >= item.maxRetries);

        failedItems.forEach(item => {
            this.queue.delete(item.id);
            logger.warn('Cleaned up failed queue item', {
                resultId: item.id,
                retryCount: item.retryCount,
                error: item.error
            });
        });

        if (failedItems.length > 0) {
            this.updateStats();
        }
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupExpiredCache(): void {
        const now = new Date();
        let cleanedCount = 0;

        for (const [hash, entry] of this.cache.entries()) {
            const age = now.getTime() - entry.cachedAt.getTime();
            if (age > this.config.cacheTtlMs) {
                this.cache.delete(hash);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.debug('Cleaned up expired cache entries', {
                cleaned: cleanedCount,
                cacheSize: this.cache.size
            });
            this.updateStats();
        }
    }

    /**
     * Get current pipeline statistics
     */
    getStats(): PipelineStats {
        this.updateStats();
        return { ...this.stats };
    }

    /**
     * Get queue status
     */
    getQueueStatus(): {
        total: number;
        processing: number;
        pending: number;
        failed: number;
        byPriority: Record<string, number>;
    } {
        const items = Array.from(this.queue.values());
        const failed = items.filter(item => item.retryCount >= item.maxRetries);
        const byPriority = items.reduce((acc, item) => {
            acc[item.priority] = (acc[item.priority] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            total: this.queue.size,
            processing: this.processing.size,
            pending: this.queue.size - this.processing.size - failed.length,
            failed: failed.length,
            byPriority
        };
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
        this.updateStats();
        logger.info('Annotation cache cleared');
    }

    /**
     * Clear queue
     */
    clearQueue(): void {
        this.queue.clear();
        this.processing.clear();
        this.updateStats();
        logger.info('Annotation queue cleared');
    }
}