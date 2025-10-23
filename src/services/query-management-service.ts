import { QueryService } from './query-service';
import { DatabaseConnection } from '../database/connection';
import { QuerySet, ScheduleConfig, QueryExecution, QueryCategory } from '../types/query';
import { Query as DbQuery } from '../database/models';
import { logger } from '../utils/logger';

/**
 * Query execution status tracking
 */
interface QueryExecutionTracker {
    id: string;
    querySetId: string;
    scheduledAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: 'scheduled' | 'running' | 'completed' | 'failed';
    queryCount: number;
    successCount: number;
    failureCount: number;
    errors: string[];
}

/**
 * Query rotation strategy
 */
export interface QueryRotationStrategy {
    name: string;
    description: string;
    selectQueries(queries: DbQuery[], count: number, lastSelected?: string[]): DbQuery[];
}

/**
 * Round-robin rotation strategy
 */
export class RoundRobinRotation implements QueryRotationStrategy {
    name = 'round-robin';
    description = 'Cycles through queries in order, ensuring even distribution';

    private lastIndex = 0;

    selectQueries(queries: DbQuery[], count: number, lastSelected?: string[]): DbQuery[] {
        if (queries.length === 0) return [];

        const selected: DbQuery[] = [];
        const availableQueries = [...queries];

        // Remove recently selected queries to avoid immediate repetition
        if (lastSelected && lastSelected.length > 0) {
            const recentIds = new Set(lastSelected);
            const nonRecent = availableQueries.filter(q => !recentIds.has(q.id));

            // Use non-recent queries if available, otherwise use all
            if (nonRecent.length >= count) {
                availableQueries.splice(0, availableQueries.length, ...nonRecent);
            }
        }

        // Select queries starting from last index
        for (let i = 0; i < count && availableQueries.length > 0; i++) {
            const index = (this.lastIndex + i) % availableQueries.length;
            selected.push(availableQueries[index]);
        }

        // Update last index for next rotation
        this.lastIndex = (this.lastIndex + count) % availableQueries.length;

        return selected;
    }
}

/**
 * Random rotation strategy
 */
export class RandomRotation implements QueryRotationStrategy {
    name = 'random';
    description = 'Randomly selects queries with bias against recently used ones';

    selectQueries(queries: DbQuery[], count: number, lastSelected?: string[]): DbQuery[] {
        if (queries.length === 0) return [];

        const selected: DbQuery[] = [];
        const availableQueries = [...queries];

        // Create weighted selection based on recency
        const recentIds = new Set(lastSelected || []);
        const weights = availableQueries.map(q => recentIds.has(q.id) ? 0.3 : 1.0);

        for (let i = 0; i < count && availableQueries.length > 0; i++) {
            const selectedIndex = this.weightedRandomSelect(weights);
            selected.push(availableQueries[selectedIndex]);

            // Remove selected query and its weight
            availableQueries.splice(selectedIndex, 1);
            weights.splice(selectedIndex, 1);
        }

        return selected;
    }

    private weightedRandomSelect(weights: number[]): number {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < weights.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return i;
            }
        }

        return weights.length - 1;
    }
}

/**
 * Category-balanced rotation strategy
 */
export class CategoryBalancedRotation implements QueryRotationStrategy {
    name = 'category-balanced';
    description = 'Ensures equal representation from each category';

    selectQueries(queries: DbQuery[], count: number, lastSelected?: string[]): DbQuery[] {
        if (queries.length === 0) return [];

        // Group queries by category
        const categorizedQueries: Record<string, DbQuery[]> = {};
        queries.forEach(query => {
            const category = query.category || 'general';
            if (!categorizedQueries[category]) {
                categorizedQueries[category] = [];
            }
            categorizedQueries[category].push(query);
        });

        const categories = Object.keys(categorizedQueries);
        const queriesPerCategory = Math.ceil(count / categories.length);
        const selected: DbQuery[] = [];
        const recentIds = new Set(lastSelected || []);

        // Select queries from each category
        for (const category of categories) {
            const categoryQueries = categorizedQueries[category];

            // Prefer non-recent queries
            const nonRecent = categoryQueries.filter(q => !recentIds.has(q.id));
            const sourceQueries = nonRecent.length > 0 ? nonRecent : categoryQueries;

            // Randomly select from category
            const shuffled = this.shuffleArray(sourceQueries);
            const categorySelected = shuffled.slice(0, Math.min(queriesPerCategory, shuffled.length));

            selected.push(...categorySelected);

            if (selected.length >= count) break;
        }

        return selected.slice(0, count);
    }

    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

/**
 * Query management service for handling rotation, scheduling, and execution tracking
 */
export class QueryManagementService {
    private queryService: QueryService;
    private executionTrackers: Map<string, QueryExecutionTracker> = new Map();
    private rotationStrategies: Map<string, QueryRotationStrategy> = new Map();
    private queryHistory: Map<string, string[]> = new Map(); // querySetId -> recent query IDs

    constructor(private db: DatabaseConnection) {
        this.queryService = new QueryService(db);

        // Initialize rotation strategies
        this.rotationStrategies.set('round-robin', new RoundRobinRotation());
        this.rotationStrategies.set('random', new RandomRotation());
        this.rotationStrategies.set('category-balanced', new CategoryBalancedRotation());
    }

    /**
     * Initialize the query management system
     */
    async initialize(): Promise<void> {
        logger.info('Initializing query management system');

        try {
            // Initialize benchmark queries
            await this.queryService.initializeBenchmarkQueries();

            // Create default query sets
            await this.queryService.createDefaultQuerySets();

            logger.info('Query management system initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize query management system', { error });
            throw error;
        }
    }

    /**
     * Get queries for execution using rotation strategy
     */
    async getQueriesForExecution(
        querySetId: string,
        count: number,
        rotationStrategy: string = 'category-balanced'
    ): Promise<DbQuery[]> {
        const strategy = this.rotationStrategies.get(rotationStrategy);
        if (!strategy) {
            throw new Error(`Unknown rotation strategy: ${rotationStrategy}`);
        }

        // Get all available queries (this would normally come from a stored query set)
        const allQueries = await this.getAllQueriesForSet(querySetId);

        // Get recent query history to avoid repetition
        const recentQueries = this.queryHistory.get(querySetId) || [];

        // Select queries using the strategy
        const selectedQueries = strategy.selectQueries(allQueries, count, recentQueries);

        // Update query history
        const selectedIds = selectedQueries.map(q => q.id);
        this.updateQueryHistory(querySetId, selectedIds);

        logger.info('Selected queries for execution', {
            querySetId,
            strategy: rotationStrategy,
            count: selectedQueries.length,
            selectedIds
        });

        return selectedQueries;
    }

    /**
     * Schedule query execution
     */
    async scheduleQueryExecution(
        querySetId: string,
        scheduledAt: Date,
        queryCount: number
    ): Promise<string> {
        const executionId = crypto.randomUUID();

        const tracker: QueryExecutionTracker = {
            id: executionId,
            querySetId,
            scheduledAt,
            status: 'scheduled',
            queryCount,
            successCount: 0,
            failureCount: 0,
            errors: []
        };

        this.executionTrackers.set(executionId, tracker);

        logger.info('Scheduled query execution', {
            executionId,
            querySetId,
            scheduledAt,
            queryCount
        });

        return executionId;
    }

    /**
     * Start query execution
     */
    async startQueryExecution(executionId: string): Promise<void> {
        const tracker = this.executionTrackers.get(executionId);
        if (!tracker) {
            throw new Error(`Execution tracker not found: ${executionId}`);
        }

        tracker.status = 'running';
        tracker.startedAt = new Date();

        logger.info('Started query execution', {
            executionId,
            querySetId: tracker.querySetId,
            startedAt: tracker.startedAt
        });
    }

    /**
     * Complete query execution
     */
    async completeQueryExecution(
        executionId: string,
        successCount: number,
        failureCount: number,
        errors: string[] = []
    ): Promise<void> {
        const tracker = this.executionTrackers.get(executionId);
        if (!tracker) {
            throw new Error(`Execution tracker not found: ${executionId}`);
        }

        tracker.status = failureCount > 0 ? 'failed' : 'completed';
        tracker.completedAt = new Date();
        tracker.successCount = successCount;
        tracker.failureCount = failureCount;
        tracker.errors = errors;

        const duration = tracker.completedAt.getTime() - (tracker.startedAt?.getTime() || tracker.scheduledAt.getTime());

        logger.info('Completed query execution', {
            executionId,
            querySetId: tracker.querySetId,
            status: tracker.status,
            duration,
            successCount,
            failureCount,
            errorCount: errors.length
        });
    }

    /**
     * Get execution status
     */
    getExecutionStatus(executionId: string): QueryExecutionTracker | null {
        return this.executionTrackers.get(executionId) || null;
    }

    /**
     * Get all execution trackers for a query set
     */
    getExecutionHistory(querySetId: string): QueryExecutionTracker[] {
        return Array.from(this.executionTrackers.values())
            .filter(tracker => tracker.querySetId === querySetId)
            .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
    }

    /**
     * Clean up old execution trackers
     */
    cleanupExecutionHistory(olderThanDays: number = 30): void {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const toRemove: string[] = [];

        for (const [id, tracker] of this.executionTrackers) {
            if (tracker.scheduledAt < cutoffDate) {
                toRemove.push(id);
            }
        }

        toRemove.forEach(id => this.executionTrackers.delete(id));

        logger.info('Cleaned up execution history', {
            removedCount: toRemove.length,
            cutoffDate
        });
    }

    /**
     * Get query rotation statistics
     */
    getRotationStatistics(querySetId: string): {
        totalQueries: number;
        recentlyUsed: number;
        availableForRotation: number;
        historyLength: number;
    } {
        const recentQueries = this.queryHistory.get(querySetId) || [];

        return {
            totalQueries: 0, // Would be calculated from stored query set
            recentlyUsed: recentQueries.length,
            availableForRotation: 0, // Would be calculated
            historyLength: recentQueries.length
        };
    }

    /**
     * Reset query rotation history
     */
    resetRotationHistory(querySetId: string): void {
        this.queryHistory.delete(querySetId);
        logger.info('Reset rotation history', { querySetId });
    }

    /**
     * Get available rotation strategies
     */
    getAvailableRotationStrategies(): Array<{ name: string; description: string }> {
        return Array.from(this.rotationStrategies.values()).map(strategy => ({
            name: strategy.name,
            description: strategy.description
        }));
    }

    /**
     * Update query history for rotation tracking
     */
    private updateQueryHistory(querySetId: string, selectedIds: string[]): void {
        const maxHistorySize = 100; // Keep last 100 query IDs

        let history = this.queryHistory.get(querySetId) || [];
        history.push(...selectedIds);

        // Trim history to max size
        if (history.length > maxHistorySize) {
            history = history.slice(-maxHistorySize);
        }

        this.queryHistory.set(querySetId, history);
    }

    /**
     * Get all queries for a query set (placeholder - would integrate with stored query sets)
     */
    private async getAllQueriesForSet(querySetId: string): Promise<DbQuery[]> {
        // For now, return queries based on query set type
        if (querySetId.includes('daily')) {
            return this.queryService.getDailyQuerySet();
        } else if (querySetId.includes('weekly')) {
            return this.queryService.getWeeklyQuerySet();
        } else {
            // Default to daily set
            return this.queryService.getDailyQuerySet();
        }
    }

    /**
     * Add seasonal queries to rotation
     */
    async addSeasonalQueries(querySetId: string): Promise<void> {
        const seasonalQueries = await this.queryService.getSeasonalQueries();

        // This would normally add to a stored query set
        logger.info('Added seasonal queries to rotation', {
            querySetId,
            seasonalQueryCount: seasonalQueries.length,
            queries: seasonalQueries
        });
    }

    /**
     * Trigger event-driven query addition
     */
    async triggerEventDrivenQueries(
        eventType: 'election' | 'pandemic' | 'naturalDisaster' | 'economicCrisis',
        querySetId?: string
    ): Promise<void> {
        const eventQueries = await this.queryService.addEventDrivenQueries(eventType);

        logger.info('Triggered event-driven queries', {
            eventType,
            querySetId,
            addedQueryCount: eventQueries.length,
            queryIds: eventQueries.map(q => q.id)
        });
    }
}