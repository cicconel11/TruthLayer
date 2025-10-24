import { CollectionOrchestrationService } from './collection-orchestration-service';
import { CollectorService } from '../collectors/collector-service';
import { QueryManagementService } from './query-management-service';
import { JobQueueService } from './job-queue-service';
import { DatabaseConnection } from '../database/connection';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config-loader';

/**
 * Example usage of the Collection Orchestration Service
 */
async function demonstrateCollectionOrchestration() {
    logger.info('Starting Collection Orchestration Service demonstration');

    // Initialize dependencies
    const config = getConfig();
    const db = new DatabaseConnection(config.database);
    await db.connect();

    const collectorService = new CollectorService(db);
    const queryManagementService = new QueryManagementService(db);

    // Configure job queue for collection processing
    const jobQueueService = new JobQueueService({
        concurrency: 3, // Process 3 collection jobs concurrently
        maxRetries: 3,
        retryDelay: 5000,
        jobTimeout: 5 * 60 * 1000 // 5 minute timeout per job
    });

    // Initialize orchestration service
    const orchestrationService = new CollectionOrchestrationService(
        db,
        collectorService,
        queryManagementService,
        jobQueueService
    );

    // Set up event listeners for monitoring
    setupEventListeners(orchestrationService);

    try {
        // Initialize the service
        await orchestrationService.initialize();

        // Example 1: Execute a daily core collection cycle
        logger.info('=== Example 1: Daily Core Collection ===');
        const dailyExecutionId = await orchestrationService.executeCollectionCycle('daily-core');
        logger.info('Started daily collection cycle', { executionId: dailyExecutionId });

        // Monitor execution progress
        await monitorExecution(orchestrationService, dailyExecutionId);

        // Example 2: Execute a health monitoring collection
        logger.info('=== Example 2: Health Monitoring Collection ===');
        const healthExecutionId = await orchestrationService.executeCollectionCycle('health-monitoring');
        logger.info('Started health monitoring collection', { executionId: healthExecutionId });

        // Monitor execution progress
        await monitorExecution(orchestrationService, healthExecutionId);

        // Example 3: Register and execute a custom collection cycle
        logger.info('=== Example 3: Custom Collection Cycle ===');

        orchestrationService.registerCollectionCycle({
            id: 'custom-tech-focus',
            name: 'Technology Focus Collection',
            description: 'Custom collection focusing on technology queries',
            querySetId: 'daily-core', // Reuse existing query set
            engines: ['google', 'perplexity'], // Only use Google and Perplexity
            queryCount: 20,
            rotationStrategy: 'category-balanced',
            priority: 'normal',
            retryAttempts: 2,
            retryDelay: 3000,
            timeout: 15 * 60 * 1000 // 15 minutes
        });

        const customExecutionId = await orchestrationService.executeCollectionCycle('custom-tech-focus');
        logger.info('Started custom collection cycle', { executionId: customExecutionId });

        // Monitor execution progress
        await monitorExecution(orchestrationService, customExecutionId);

        // Example 4: Demonstrate retry functionality
        logger.info('=== Example 4: Retry Failed Collections ===');

        // Get executions and find any failed ones
        const allExecutions = [dailyExecutionId, healthExecutionId, customExecutionId];
        for (const executionId of allExecutions) {
            const execution = orchestrationService.getExecutionStatus(executionId);
            if (execution && execution.status === 'failed') {
                logger.info('Retrying failed execution', { executionId });
                await orchestrationService.retryFailedCollections(executionId);
                await monitorExecution(orchestrationService, executionId);
            }
        }

        // Example 5: Display orchestration statistics
        logger.info('=== Example 5: Orchestration Statistics ===');
        const stats = orchestrationService.getOrchestrationStats();
        logger.info('Orchestration statistics', stats);

        // Example 6: Demonstrate cancellation
        logger.info('=== Example 6: Collection Cancellation ===');

        const cancelExecutionId = await orchestrationService.executeCollectionCycle('weekly-extended');
        logger.info('Started execution for cancellation demo', { executionId: cancelExecutionId });

        // Wait a bit then cancel
        await new Promise(resolve => setTimeout(resolve, 5000));
        const cancelled = orchestrationService.cancelCollectionCycle(cancelExecutionId);
        logger.info('Cancellation result', { executionId: cancelExecutionId, cancelled });

        // Example 7: Clean up old executions
        logger.info('=== Example 7: Cleanup Old Executions ===');
        const cleanedCount = orchestrationService.cleanupOldExecutions(1); // Clean executions older than 1 day
        logger.info('Cleaned up old executions', { cleanedCount });

    } catch (error) {
        logger.error('Demonstration failed', { error });
    } finally {
        // Cleanup
        await orchestrationService.shutdown();
        await jobQueueService.stop();
        await collectorService.cleanup();
        await db.close();

        logger.info('Collection Orchestration Service demonstration completed');
    }
}

/**
 * Set up event listeners for monitoring orchestration events
 */
function setupEventListeners(orchestrationService: CollectionOrchestrationService) {
    orchestrationService.on('initialized', () => {
        logger.info('🚀 Orchestration service initialized');
    });

    orchestrationService.on('cycle_started', ({ execution, config }) => {
        logger.info('📋 Collection cycle started', {
            executionId: execution.id,
            cycleName: config.name,
            queryCount: config.queryCount,
            engines: config.engines
        });
    });

    orchestrationService.on('query_collected', ({ execution, request, result }) => {
        logger.info('✅ Query collected successfully', {
            executionId: execution.id,
            query: request.query,
            resultsCount: result.results.length,
            successfulEngines: result.metadata.successfulEngines,
            failedEngines: result.metadata.failedEngines
        });
    });

    orchestrationService.on('query_failed', ({ execution, request, error }) => {
        logger.warn('❌ Query collection failed', {
            executionId: execution.id,
            query: request.query,
            error: error instanceof Error ? error.message : String(error)
        });
    });

    orchestrationService.on('cycle_completed', ({ execution, config }) => {
        const duration = execution.completedAt!.getTime() - execution.startedAt.getTime();
        logger.info('🎉 Collection cycle completed', {
            executionId: execution.id,
            cycleName: config.name,
            status: execution.status,
            durationMs: duration,
            durationFormatted: `${Math.round(duration / 1000)}s`,
            progress: execution.progress
        });
    });

    orchestrationService.on('cycle_failed', ({ execution, config, error }) => {
        logger.error('💥 Collection cycle failed', {
            executionId: execution.id,
            cycleName: config.name,
            error: error instanceof Error ? error.message : String(error),
            progress: execution.progress,
            errors: execution.errors
        });
    });

    orchestrationService.on('cycle_cancelled', ({ execution }) => {
        logger.info('🛑 Collection cycle cancelled', {
            executionId: execution.id,
            progress: execution.progress
        });
    });
}

/**
 * Monitor execution progress until completion
 */
async function monitorExecution(
    orchestrationService: CollectionOrchestrationService,
    executionId: string
): Promise<void> {
    logger.info('Monitoring execution progress', { executionId });

    let execution = orchestrationService.getExecutionStatus(executionId);
    if (!execution) {
        logger.error('Execution not found', { executionId });
        return;
    }

    // Monitor until completion
    while (execution.status === 'pending' || execution.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds

        execution = orchestrationService.getExecutionStatus(executionId);
        if (!execution) {
            logger.error('Execution disappeared during monitoring', { executionId });
            break;
        }

        // Log progress update
        const progressPercent = execution.progress.totalQueries > 0
            ? Math.round((execution.progress.completedQueries / execution.progress.totalQueries) * 100)
            : 0;

        logger.info('Execution progress update', {
            executionId,
            status: execution.status,
            progress: `${progressPercent}%`,
            completed: execution.progress.completedQueries,
            failed: execution.progress.failedQueries,
            total: execution.progress.totalQueries,
            results: execution.progress.totalResults
        });
    }

    // Final status
    if (execution) {
        const duration = execution.completedAt
            ? execution.completedAt.getTime() - execution.startedAt.getTime()
            : Date.now() - execution.startedAt.getTime();

        logger.info('Execution monitoring completed', {
            executionId,
            finalStatus: execution.status,
            durationMs: duration,
            durationFormatted: `${Math.round(duration / 1000)}s`,
            finalProgress: execution.progress,
            errors: execution.errors.length > 0 ? execution.errors : undefined
        });
    }
}

/**
 * Demonstrate advanced orchestration features
 */
async function demonstrateAdvancedFeatures() {
    logger.info('=== Advanced Orchestration Features ===');

    // This would be called separately to show advanced features
    // like custom recovery strategies, complex scheduling, etc.

    logger.info('Advanced features demonstration would include:');
    logger.info('- Custom recovery strategies');
    logger.info('- Complex scheduling patterns');
    logger.info('- Dynamic query set management');
    logger.info('- Performance optimization');
    logger.info('- Error pattern analysis');
    logger.info('- Resource usage monitoring');
}

// Export the demonstration function
export {
    demonstrateCollectionOrchestration,
    demonstrateAdvancedFeatures,
    setupEventListeners,
    monitorExecution
};

// Run demonstration if this file is executed directly
if (require.main === module) {
    demonstrateCollectionOrchestration()
        .then(() => process.exit(0))
        .catch(error => {
            logger.error('Demonstration failed', { error });
            process.exit(1);
        });
}