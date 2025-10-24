/**
 * Example usage of the Annotation Pipeline system
 * 
 * This file demonstrates how to set up and use the annotation processing pipeline
 * with queue management, caching, and retry logic.
 */

import { DatabaseConnection } from '../database/connection';
import { createAnnotationService } from './annotation-service';
import { createAnnotationPipeline } from './annotation-pipeline-factory';
import { AnnotationQueueService } from './annotation-queue-service';
import { RepositoryFactory } from '../database/repositories';
import { loadConfig } from '../utils/config-loader';
import { logger, errorToLogContext } from '../utils/logger';

async function exampleAnnotationPipelineUsage() {
    // Load configuration
    const config = loadConfig();

    // Initialize database connection
    const db = new DatabaseConnection({
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        username: config.database.username,
        password: config.database.password,
        ssl: config.database.ssl
    });

    await db.connect();

    // Create annotation service
    const annotationService = createAnnotationService({
        provider: 'openai',
        apiKey: config.annotation.apiKey,
        model: config.annotation.model || 'gpt-4',
        temperature: 0.1,
        maxTokens: config.annotation.maxTokens,
        batchSize: 5,
        rateLimits: {
            requestsPerMinute: 60,
            tokensPerMinute: 90000
        }
    });

    // Create annotation pipeline with custom configuration
    const pipeline = createAnnotationPipeline(db, annotationService, {
        maxConcurrentJobs: 3,
        maxRetries: 3,
        retryDelayMs: 2000,
        retryBackoffMultiplier: 2,
        maxRetryDelayMs: 30000,
        cacheMaxSize: 5000,
        cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
        batchSize: 5,
        processingIntervalMs: 10000, // 10 seconds
        enableCaching: true,
        enableBatching: true
    });

    // Create repository factory for database operations
    const repositoryFactory = new RepositoryFactory(db);
    const searchResultRepo = repositoryFactory.createSearchResultRepository();

    // Create queue service
    const queueService = new AnnotationQueueService(pipeline, searchResultRepo);

    // Set up event handlers
    setupEventHandlers(queueService);

    // Start the annotation pipeline
    queueService.start();

    try {
        // Example 1: Queue all unannotated search results
        logger.info('Queueing all unannotated search results...');
        const totalQueued = await queueService.queueUnannotatedResults();
        logger.info(`Queued ${totalQueued} search results for annotation`);

        // Example 2: Queue results from a specific engine
        logger.info('Queueing Google search results from last 7 days...');
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const googleQueued = await queueService.queueResultsByEngine('google', 'normal', {
            from: sevenDaysAgo
        });
        logger.info(`Queued ${googleQueued} Google search results`);

        // Example 3: Queue high priority results for immediate processing
        logger.info('Queueing high priority results...');
        const highPriorityQueued = await queueService.queueUnannotatedResults(
            { collected_after: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
            'high'
        );
        logger.info(`Queued ${highPriorityQueued} high priority results`);

        // Example 4: Monitor processing progress
        const monitoringInterval = setInterval(() => {
            const stats = queueService.getQueueStats();
            const estimate = queueService.estimateProcessingTime();

            logger.info('Pipeline Status:', {
                queueSize: stats.queue.total,
                processing: stats.queue.processing,
                pending: stats.queue.pending,
                failed: stats.queue.failed,
                totalProcessed: stats.pipeline.totalProcessed,
                cacheHits: stats.pipeline.totalCacheHits,
                cacheMisses: stats.pipeline.totalCacheMisses,
                estimatedMinutesRemaining: estimate.estimatedMinutes
            });

            // Stop monitoring when queue is empty
            if (stats.queue.pending === 0) {
                clearInterval(monitoringInterval);
                logger.info('All items processed, stopping monitoring');
            }
        }, 30000); // Every 30 seconds

        // Example 5: Wait for processing to complete (in a real application, you might not want to block)
        await waitForProcessingComplete(queueService);

        logger.info('Annotation processing completed successfully');

    } catch (error) {
        logger.error('Error in annotation pipeline example:', errorToLogContext(error));
    } finally {
        // Clean up
        queueService.stop();
        await db.close();
    }
}

/**
 * Set up event handlers for monitoring pipeline operations
 */
function setupEventHandlers(queueService: AnnotationQueueService) {
    queueService.on('started', () => {
        logger.info('Annotation queue service started');
    });

    queueService.on('stopped', () => {
        logger.info('Annotation queue service stopped');
    });

    queueService.on('annotation_processed', (data) => {
        logger.debug('Annotation completed:', {
            resultId: data.searchResult.id,
            url: data.searchResult.url,
            domainType: data.annotation.domainType,
            factualScore: data.annotation.factualScore,
            processingTimeMs: data.processingTime
        });
    });

    queueService.on('annotation_cached', (data) => {
        logger.debug('Annotation served from cache:', {
            resultId: data.searchResult.id,
            url: data.searchResult.url,
            domainType: data.annotation.domainType
        });
    });

    queueService.on('annotation_retry', (data) => {
        logger.warn('Annotation retry scheduled:', {
            resultId: data.searchResult.id,
            url: data.searchResult.url,
            attempt: data.attempt,
            error: data.error,
            nextRetryInMs: data.nextRetryIn
        });
    });

    queueService.on('annotation_failed', (data) => {
        logger.error('Annotation failed permanently:', {
            resultId: data.searchResult.id,
            url: data.searchResult.url,
            totalAttempts: data.totalAttempts,
            finalError: data.error
        });
    });

    queueService.on('pipeline_error', (error) => {
        logger.error('Pipeline error occurred:', error);
    });

    queueService.on('queued', (data) => {
        logger.info('Search results queued:', {
            count: data.searchResults.length,
            priority: data.priority,
            queuedIds: data.queuedIds.length
        });
    });

    queueService.on('batch_queued', (data) => {
        logger.info('Batch queued:', {
            totalQueued: data.totalQueued,
            filter: data.filter,
            priority: data.priority
        });
    });
}

/**
 * Wait for processing to complete (with timeout)
 */
async function waitForProcessingComplete(
    queueService: AnnotationQueueService,
    timeoutMs = 30 * 60 * 1000 // 30 minutes
): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            const stats = queueService.getQueueStats();

            // Check if processing is complete
            if (stats.queue.pending === 0 && stats.queue.processing === 0) {
                clearInterval(checkInterval);
                resolve();
                return;
            }

            // Check for timeout
            if (Date.now() - startTime > timeoutMs) {
                clearInterval(checkInterval);
                reject(new Error('Processing timeout exceeded'));
                return;
            }
        }, 5000); // Check every 5 seconds
    });
}

/**
 * Example of processing specific search results
 */
async function processSpecificResults() {
    // This example shows how to process specific search results
    // rather than queuing all unannotated results

    const config = loadConfig();
    const db = new DatabaseConnection(config.database);
    await db.connect();

    const annotationService = createAnnotationService(config.annotation);
    const pipeline = createAnnotationPipeline(db, annotationService);

    const repositoryFactory = new RepositoryFactory(db);
    const searchResultRepo = repositoryFactory.createSearchResultRepository();
    const queueService = new AnnotationQueueService(pipeline, searchResultRepo);

    queueService.start();

    try {
        // Get specific search results (e.g., from a particular query)
        const searchResults = await searchResultRepo.findMany({
            query_id: 'specific-query-id',
            has_annotation: false
        }, 50); // Limit to 50 results

        if (searchResults.length > 0) {
            logger.info(`Found ${searchResults.length} unannotated results to process`);

            // Queue them with high priority
            const queuedIds = await queueService.queueSearchResults(searchResults, 'high');

            logger.info(`Queued ${queuedIds.length} results for high priority processing`);

            // Wait for completion
            await waitForProcessingComplete(queueService);
        } else {
            logger.info('No unannotated results found for the specified query');
        }

    } finally {
        queueService.stop();
        await db.close();
    }
}

// Export functions for use in other modules
export {
    exampleAnnotationPipelineUsage,
    processSpecificResults,
    setupEventHandlers,
    waitForProcessingComplete
};

// Run example if this file is executed directly
if (require.main === module) {
    exampleAnnotationPipelineUsage()
        .then(() => {
            logger.info('Example completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Example failed:', error);
            process.exit(1);
        });
}