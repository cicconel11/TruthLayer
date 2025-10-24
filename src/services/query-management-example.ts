import { DatabaseConnection } from '../database/connection';
import { QueryService, QueryManagementService } from './index';
import { logger, errorToLogContext } from '../utils/logger';

/**
 * Example usage of the query management system
 */
export class QueryManagementExample {
    private queryService: QueryService;
    private queryManagementService: QueryManagementService;

    constructor(private db: DatabaseConnection) { // TODO: Use db for query operations
        this.queryService = new QueryService(db);
        this.queryManagementService = new QueryManagementService(db);
    }

    /**
     * Demonstrate basic query management functionality
     */
    async demonstrateBasicUsage(): Promise<void> {
        logger.info('=== Query Management System Demo ===');

        try {
            // Initialize the system
            await this.queryManagementService.initialize();

            // Get query statistics
            const stats = await this.queryService.getQueryStatistics();
            logger.info('Query statistics by category:', stats);

            // Get daily query set
            const dailyQueries = await this.queryService.getDailyQuerySet();
            logger.info('Daily query set:', {
                count: dailyQueries.length,
                categories: this.getCategoryCounts(dailyQueries)
            });

            // Get weekly query set
            const weeklyQueries = await this.queryService.getWeeklyQuerySet();
            logger.info('Weekly query set:', {
                count: weeklyQueries.length,
                categories: this.getCategoryCounts(weeklyQueries)
            });

            // Get seasonal queries
            const seasonalQueries = await this.queryService.getSeasonalQueries();
            logger.info('Seasonal queries for current season:', seasonalQueries);

        } catch (error) {
            logger.error('Demo failed:', errorToLogContext(error));
            throw error;
        }
    }

    /**
     * Demonstrate query rotation strategies
     */
    async demonstrateRotationStrategies(): Promise<void> {
        logger.info('=== Query Rotation Strategies Demo ===');

        const querySetId = 'demo-daily-set';
        const queryCount = 10;

        // Get available rotation strategies
        const strategies = this.queryManagementService.getAvailableRotationStrategies();
        logger.info('Available rotation strategies:', strategies);

        // Test each rotation strategy
        for (const strategy of strategies) {
            logger.info(`Testing ${strategy.name} strategy:`);

            const queries = await this.queryManagementService.getQueriesForExecution(
                querySetId,
                queryCount,
                strategy.name
            );

            logger.info(`Selected ${queries.length} queries:`, {
                strategy: strategy.name,
                queries: queries.map(q => ({ id: q.id, text: q.text, category: q.category }))
            });
        }
    }

    /**
     * Demonstrate execution tracking
     */
    async demonstrateExecutionTracking(): Promise<void> {
        logger.info('=== Execution Tracking Demo ===');

        const querySetId = 'demo-execution-set';
        const scheduledAt = new Date(Date.now() + 60000); // 1 minute from now
        const queryCount = 5;

        try {
            // Schedule execution
            const executionId = await this.queryManagementService.scheduleQueryExecution(
                querySetId,
                scheduledAt,
                queryCount
            );

            logger.info('Scheduled execution:', { executionId, scheduledAt });

            // Start execution
            await this.queryManagementService.startQueryExecution(executionId);
            logger.info('Started execution');

            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Complete execution with some results
            await this.queryManagementService.completeQueryExecution(
                executionId,
                4, // success count
                1, // failure count
                ['Failed to scrape one query due to rate limiting']
            );

            // Get execution status
            const status = this.queryManagementService.getExecutionStatus(executionId);
            logger.info('Final execution status:', { status: status || 'unknown' });

            // Get execution history
            const history = this.queryManagementService.getExecutionHistory(querySetId);
            logger.info('Execution history:', {
                querySetId,
                historyCount: history.length,
                latestExecution: history[0]
            });

        } catch (error) {
            logger.error('Execution tracking demo failed:', errorToLogContext(error));
        }
    }

    /**
     * Demonstrate seasonal and event-driven queries
     */
    async demonstrateSeasonalAndEventQueries(): Promise<void> {
        logger.info('=== Seasonal and Event-Driven Queries Demo ===');

        try {
            // Add seasonal queries
            const querySetId = 'demo-seasonal-set';
            await this.queryManagementService.addSeasonalQueries(querySetId);

            // Trigger event-driven queries for different events
            const events = ['election', 'pandemic', 'naturalDisaster', 'economicCrisis'] as const;

            for (const eventType of events) {
                logger.info(`Triggering ${eventType} queries...`);
                await this.queryManagementService.triggerEventDrivenQueries(eventType, querySetId);
            }

            // Get rotation statistics
            const rotationStats = this.queryManagementService.getRotationStatistics(querySetId);
            logger.info('Rotation statistics:', rotationStats);

        } catch (error) {
            logger.error('Seasonal and event queries demo failed:', errorToLogContext(error));
        }
    }

    /**
     * Demonstrate query set creation and scheduling
     */
    async demonstrateQuerySetCreation(): Promise<void> {
        logger.info('=== Query Set Creation Demo ===');

        try {
            // Get some health queries
            const healthQueries = await this.queryService.getQueriesByCategory('health', 10);

            if (healthQueries.length > 0) {
                // Create a custom query set
                const querySet = await this.queryService.createQuerySet(
                    'Health Focus Set',
                    'Focused set of health-related queries for specialized analysis',
                    healthQueries.map(q => q.id),
                    {
                        frequency: 'daily',
                        time: '14:00',
                        enabled: true
                    }
                );

                logger.info('Created custom query set:', {
                    id: querySet.id,
                    name: querySet.name,
                    queryCount: querySet.queries.length,
                    schedule: querySet.schedule
                });

                // Calculate next execution time
                const nextExecution = this.queryService.getNextExecutionTime(querySet.schedule);
                logger.info('Next scheduled execution:', nextExecution);

                // Validate the query set
                const isValid = this.queryService.validateQuerySet(querySet);
                logger.info('Query set validation:', { isValid });
            }

        } catch (error) {
            logger.error('Query set creation demo failed:', errorToLogContext(error));
        }
    }

    /**
     * Run all demonstrations
     */
    async runAllDemos(): Promise<void> {
        logger.info('Starting comprehensive query management demo...');

        try {
            await this.demonstrateBasicUsage();
            await this.demonstrateRotationStrategies();
            await this.demonstrateExecutionTracking();
            await this.demonstrateSeasonalAndEventQueries();
            await this.demonstrateQuerySetCreation();

            logger.info('All demos completed successfully!');

        } catch (error) {
            logger.error('Demo suite failed:', errorToLogContext(error));
            throw error;
        }
    }

    /**
     * Helper method to count queries by category
     */
    private getCategoryCounts(queries: any[]): Record<string, number> {
        const counts: Record<string, number> = {};

        queries.forEach(query => {
            const category = query.category || 'unknown';
            counts[category] = (counts[category] || 0) + 1;
        });

        return counts;
    }
}

/**
 * Example function to run the demo
 */
export async function runQueryManagementDemo(db: DatabaseConnection): Promise<void> {
    const demo = new QueryManagementExample(db);
    await demo.runAllDemos();
}