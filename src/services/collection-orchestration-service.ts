import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { CollectorService } from '../collectors/collector-service';
import { QueryManagementService } from './query-management-service';
import { JobQueueService } from './job-queue-service';
import { DatabaseConnection } from '../database/connection';
import { CollectionRequest } from '../types/search-result';
import { QueryCategory } from '../types/query';

/**
 * Collection cycle configuration
 */
export interface CollectionCycleConfig {
    id: string;
    name: string;
    description: string;
    querySetId: string;
    engines: Array<'google' | 'bing' | 'perplexity' | 'brave'>;
    queryCount: number;
    rotationStrategy: string;
    priority: 'low' | 'normal' | 'high';
    retryAttempts: number;
    retryDelay: number;
    timeout: number;
}

/**
 * Collection cycle execution context
 */
export interface CollectionCycleExecution {
    id: string;
    cycleId: string;
    startedAt: Date;
    completedAt?: Date;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: {
        totalQueries: number;
        completedQueries: number;
        failedQueries: number;
        totalResults: number;
        successfulEngines: Record<string, number>;
        failedEngines: Record<string, number>;
    };
    errors: string[];
    metadata?: Record<string, any>;
}

/**
 * Collection job data for queue processing
 */
interface CollectionJobData {
    cycleExecutionId: string;
    request: CollectionRequest;
    attempt: number;
    maxAttempts: number;
}

/**
 * Recovery strategy for failed collections
 */
export interface RecoveryStrategy {
    name: string;
    description: string;
    shouldRecover(error: Error, attempt: number): boolean;
    getRecoveryDelay(attempt: number): number;
    modifyRequest?(request: CollectionRequest, attempt: number): CollectionRequest;
}

/**
 * Collection orchestration service for coordinating multi-engine data collection
 */
export class CollectionOrchestrationService extends EventEmitter {
    private cycles: Map<string, CollectionCycleConfig> = new Map();
    private executions: Map<string, CollectionCycleExecution> = new Map();
    private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
    private isRunning = false;

    constructor(
        private db: DatabaseConnection, // TODO: Use for database operations
        private collectorService: CollectorService,
        private queryManagementService: QueryManagementService,
        private jobQueueService: JobQueueService
    ) {
        super();
        this.setupRecoveryStrategies();
        this.setupJobProcessors();
    }

    /**
     * Initialize the orchestration service
     */
    async initialize(): Promise<void> {
        logger.info('Initializing collection orchestration service');

        try {
            // Initialize dependencies
            await this.queryManagementService.initialize();

            // Start job queue if not already running
            if (!this.jobQueueService.getStats().total) {
                this.jobQueueService.start();
            }

            // Setup default collection cycles
            this.setupDefaultCycles();

            this.isRunning = true;
            logger.info('Collection orchestration service initialized successfully');
            this.emit('initialized');

        } catch (error) {
            logger.error('Failed to initialize collection orchestration service', { error });
            throw error;
        }
    }

    /**
     * Shutdown the orchestration service
     */
    async shutdown(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        logger.info('Shutting down collection orchestration service');

        this.isRunning = false;

        // Cancel all pending executions
        for (const execution of this.executions.values()) {
            if (execution.status === 'pending' || execution.status === 'running') {
                execution.status = 'cancelled';
                this.emit('cycle_cancelled', { execution });
            }
        }

        logger.info('Collection orchestration service shut down');
        this.emit('shutdown');
    }

    /**
     * Register a collection cycle configuration
     */
    registerCollectionCycle(config: CollectionCycleConfig): void {
        this.cycles.set(config.id, config);
        logger.info('Registered collection cycle', {
            id: config.id,
            name: config.name,
            querySetId: config.querySetId,
            engines: config.engines
        });
        this.emit('cycle_registered', { config });
    }

    /**
     * Execute a collection cycle
     */
    async executeCollectionCycle(cycleId: string): Promise<string> {
        const config = this.cycles.get(cycleId);
        if (!config) {
            throw new Error(`Collection cycle not found: ${cycleId}`);
        }

        if (!this.isRunning) {
            throw new Error('Collection orchestration service is not running');
        }

        const executionId = this.generateExecutionId();
        const execution: CollectionCycleExecution = {
            id: executionId,
            cycleId,
            startedAt: new Date(),
            status: 'pending',
            progress: {
                totalQueries: 0,
                completedQueries: 0,
                failedQueries: 0,
                totalResults: 0,
                successfulEngines: {},
                failedEngines: {}
            },
            errors: []
        };

        this.executions.set(executionId, execution);

        logger.info('Starting collection cycle execution', {
            executionId,
            cycleId,
            config: {
                name: config.name,
                querySetId: config.querySetId,
                engines: config.engines,
                queryCount: config.queryCount
            }
        });

        this.emit('cycle_started', { execution, config });

        // Execute the cycle asynchronously
        this.executeCycleAsync(execution, config).catch(error => {
            logger.error('Collection cycle execution failed', {
                executionId,
                cycleId,
                error
            });
        });

        return executionId;
    }

    /**
     * Cancel a collection cycle execution
     */
    cancelCollectionCycle(executionId: string): boolean {
        const execution = this.executions.get(executionId);
        if (!execution) {
            return false;
        }

        if (execution.status === 'completed' || execution.status === 'failed') {
            return false;
        }

        execution.status = 'cancelled';
        execution.completedAt = new Date();

        logger.info('Cancelled collection cycle execution', {
            executionId,
            cycleId: execution.cycleId
        });

        this.emit('cycle_cancelled', { execution });
        return true;
    }

    /**
     * Get collection cycle execution status
     */
    getExecutionStatus(executionId: string): CollectionCycleExecution | null {
        return this.executions.get(executionId) || null;
    }

    /**
     * Get all executions for a cycle
     */
    getCycleExecutions(cycleId: string): CollectionCycleExecution[] {
        return Array.from(this.executions.values())
            .filter(execution => execution.cycleId === cycleId)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }

    /**
     * Get active executions
     */
    getActiveExecutions(): CollectionCycleExecution[] {
        return Array.from(this.executions.values())
            .filter(execution => execution.status === 'running' || execution.status === 'pending');
    }

    /**
     * Get orchestration statistics
     */
    getOrchestrationStats(): {
        totalCycles: number;
        activeExecutions: number;
        completedExecutions: number;
        failedExecutions: number;
        totalQueriesProcessed: number;
        totalResultsCollected: number;
        averageExecutionTime: number;
        successRate: number;
    } {
        const executions = Array.from(this.executions.values());
        const completedExecutions = executions.filter(e => e.status === 'completed');
        const failedExecutions = executions.filter(e => e.status === 'failed');

        const totalQueriesProcessed = executions.reduce(
            (sum, e) => sum + e.progress.completedQueries + e.progress.failedQueries, 0
        );

        const totalResultsCollected = executions.reduce(
            (sum, e) => sum + e.progress.totalResults, 0
        );

        const executionTimes = completedExecutions
            .filter(e => e.completedAt)
            .map(e => e.completedAt!.getTime() - e.startedAt.getTime());

        const averageExecutionTime = executionTimes.length > 0
            ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
            : 0;

        const successRate = executions.length > 0
            ? completedExecutions.length / executions.length
            : 0;

        return {
            totalCycles: this.cycles.size,
            activeExecutions: this.getActiveExecutions().length,
            completedExecutions: completedExecutions.length,
            failedExecutions: failedExecutions.length,
            totalQueriesProcessed,
            totalResultsCollected,
            averageExecutionTime,
            successRate
        };
    }

    /**
     * Retry failed collection jobs
     */
    async retryFailedCollections(executionId: string): Promise<void> {
        const execution = this.executions.get(executionId);
        if (!execution || execution.status !== 'failed') {
            throw new Error('Execution not found or not in failed state');
        }

        const config = this.cycles.get(execution.cycleId);
        if (!config) {
            throw new Error('Collection cycle configuration not found');
        }

        logger.info('Retrying failed collection execution', {
            executionId,
            cycleId: execution.cycleId,
            failedQueries: execution.progress.failedQueries
        });

        // Reset execution status
        execution.status = 'pending';
        execution.errors = [];
        execution.progress.failedQueries = 0;

        // Re-execute the cycle
        await this.executeCycleAsync(execution, config);
    }

    /**
     * Execute collection cycle asynchronously
     */
    private async executeCycleAsync(
        execution: CollectionCycleExecution,
        config: CollectionCycleConfig
    ): Promise<void> {
        try {
            execution.status = 'running';

            // Get queries for execution
            const queries = await this.queryManagementService.getQueriesForExecution(
                config.querySetId,
                config.queryCount,
                config.rotationStrategy
            );

            execution.progress.totalQueries = queries.length;

            logger.info('Retrieved queries for collection cycle', {
                executionId: execution.id,
                queryCount: queries.length,
                querySetId: config.querySetId
            });

            // Create collection requests
            const collectionRequests: CollectionRequest[] = queries.map(query => ({
                query: query.text,
                engines: config.engines,
                maxResults: 20,
                category: query.category as QueryCategory
            }));

            // Queue collection jobs
            const jobIds: string[] = [];
            for (const request of collectionRequests) {
                const jobId = this.jobQueueService.addJob(
                    'collection',
                    {
                        cycleExecutionId: execution.id,
                        request,
                        attempt: 1,
                        maxAttempts: config.retryAttempts
                    } as CollectionJobData,
                    {
                        priority: config.priority,
                        maxAttempts: config.retryAttempts
                    }
                );
                jobIds.push(jobId);
            }

            execution.metadata = { jobIds };

            logger.info('Queued collection jobs', {
                executionId: execution.id,
                jobCount: jobIds.length,
                priority: config.priority
            });

            // Wait for all jobs to complete
            await this.waitForJobsCompletion(jobIds, config.timeout);

            // Finalize execution
            if (execution.progress.failedQueries > 0) {
                execution.status = 'failed';
                execution.errors.push(`${execution.progress.failedQueries} queries failed to collect`);
            } else {
                execution.status = 'completed';
            }

            execution.completedAt = new Date();

            const duration = execution.completedAt.getTime() - execution.startedAt.getTime();

            logger.info('Collection cycle execution completed', {
                executionId: execution.id,
                cycleId: execution.cycleId,
                status: execution.status,
                duration,
                progress: execution.progress
            });

            this.emit('cycle_completed', { execution, config });

        } catch (error) {
            execution.status = 'failed';
            execution.completedAt = new Date();
            execution.errors.push(error instanceof Error ? error.message : String(error));

            logger.error('Collection cycle execution failed', {
                executionId: execution.id,
                cycleId: execution.cycleId,
                error
            });

            this.emit('cycle_failed', { execution, config, error });
        }
    }

    /**
     * Wait for job completion with timeout
     */
    private async waitForJobsCompletion(jobIds: string[], timeoutMs: number): Promise<void> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const pendingJobs = jobIds.filter(jobId => {
                const job = this.jobQueueService.getJob(jobId);
                return job && (job.status === 'pending' || job.status === 'running');
            });

            if (pendingJobs.length === 0) {
                return; // All jobs completed
            }

            await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
        }

        logger.warn('Timeout waiting for collection jobs to complete', {
            timeoutMs,
            remainingJobs: jobIds.filter(jobId => {
                const job = this.jobQueueService.getJob(jobId);
                return job && (job.status === 'pending' || job.status === 'running');
            }).length
        });
    }

    /**
     * Setup job processors for collection tasks
     */
    private setupJobProcessors(): void {
        this.jobQueueService.registerProcessor<CollectionJobData>(
            'collection',
            async (job) => {
                const { cycleExecutionId, request, attempt } = job.data;
                const execution = this.executions.get(cycleExecutionId);

                if (!execution) {
                    throw new Error(`Execution not found: ${cycleExecutionId}`);
                }

                logger.debug('Processing collection job', {
                    jobId: job.id,
                    executionId: cycleExecutionId,
                    query: request.query,
                    engines: request.engines,
                    attempt
                });

                try {
                    // Execute collection
                    const result = await this.collectorService.collectResults(request);

                    // Update execution progress
                    execution.progress.completedQueries++;
                    execution.progress.totalResults += result.results.length;

                    // Update engine statistics
                    for (const engine of result.metadata.successfulEngines) {
                        execution.progress.successfulEngines[engine] =
                            (execution.progress.successfulEngines[engine] || 0) + 1;
                    }

                    for (const engine of result.metadata.failedEngines) {
                        execution.progress.failedEngines[engine] =
                            (execution.progress.failedEngines[engine] || 0) + 1;
                    }

                    logger.debug('Collection job completed successfully', {
                        jobId: job.id,
                        executionId: cycleExecutionId,
                        query: request.query,
                        resultsCollected: result.results.length,
                        successfulEngines: result.metadata.successfulEngines,
                        failedEngines: result.metadata.failedEngines
                    });

                    this.emit('query_collected', { execution, request, result });

                    return result;

                } catch (error) {
                    execution.progress.failedQueries++;
                    execution.errors.push(`Query "${request.query}": ${error instanceof Error ? error.message : String(error)}`);

                    logger.error('Collection job failed', {
                        jobId: job.id,
                        executionId: cycleExecutionId,
                        query: request.query,
                        attempt,
                        error
                    });

                    this.emit('query_failed', { execution, request, error });

                    throw error;
                }
            }
        );
    }

    /**
     * Setup recovery strategies
     */
    private setupRecoveryStrategies(): void {
        // Exponential backoff strategy
        this.recoveryStrategies.set('exponential-backoff', {
            name: 'exponential-backoff',
            description: 'Exponential backoff with jitter for transient failures',
            shouldRecover: (error: Error, attempt: number) => {
                // Retry on network errors, timeouts, and rate limits
                const retryableErrors = [
                    'timeout',
                    'network',
                    'rate limit',
                    'connection',
                    'captcha'
                ];

                const errorMessage = error.message.toLowerCase();
                return attempt < 3 && retryableErrors.some(keyword =>
                    errorMessage.includes(keyword)
                );
            },
            getRecoveryDelay: (attempt: number) => {
                const baseDelay = 1000; // 1 second
                const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 1000; // Up to 1 second jitter
                return exponentialDelay + jitter;
            }
        });

        // Engine rotation strategy
        this.recoveryStrategies.set('engine-rotation', {
            name: 'engine-rotation',
            description: 'Rotate to different engines on persistent failures',
            shouldRecover: (error: Error, attempt: number) => {
                return attempt < 2 && error.message.includes('blocked');
            },
            getRecoveryDelay: () => 5000, // 5 second delay
            modifyRequest: (request: CollectionRequest, _attempt: number) => {
                // Rotate engines on retry
                const availableEngines = ['google', 'bing', 'perplexity', 'brave'] as const;
                const currentEngines = request.engines;
                const alternativeEngines = availableEngines.filter(
                    engine => !currentEngines.includes(engine)
                );

                if (alternativeEngines.length > 0) {
                    return {
                        ...request,
                        engines: [alternativeEngines[0]] // Use first alternative
                    };
                }

                return request;
            }
        });
    }

    /**
     * Setup default collection cycles
     */
    private setupDefaultCycles(): void {
        // Daily core collection cycle
        this.registerCollectionCycle({
            id: 'daily-core',
            name: 'Daily Core Collection',
            description: 'Daily collection of core benchmark queries',
            querySetId: 'daily-core',
            engines: ['google', 'bing', 'perplexity', 'brave'],
            queryCount: 50,
            rotationStrategy: 'category-balanced',
            priority: 'high',
            retryAttempts: 3,
            retryDelay: 5000,
            timeout: 30 * 60 * 1000 // 30 minutes
        });

        // Weekly extended collection cycle
        this.registerCollectionCycle({
            id: 'weekly-extended',
            name: 'Weekly Extended Collection',
            description: 'Weekly collection of extended query set',
            querySetId: 'weekly-extended',
            engines: ['google', 'bing', 'perplexity', 'brave'],
            queryCount: 200,
            rotationStrategy: 'round-robin',
            priority: 'normal',
            retryAttempts: 2,
            retryDelay: 10000,
            timeout: 2 * 60 * 60 * 1000 // 2 hours
        });

        // Health monitoring collection cycle
        this.registerCollectionCycle({
            id: 'health-monitoring',
            name: 'Health Monitoring Collection',
            description: 'Frequent collection for system health monitoring',
            querySetId: 'health-monitoring',
            engines: ['google', 'bing'],
            queryCount: 10,
            rotationStrategy: 'random',
            priority: 'low',
            retryAttempts: 1,
            retryDelay: 2000,
            timeout: 5 * 60 * 1000 // 5 minutes
        });
    }

    /**
     * Generate unique execution ID
     */
    private generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up old executions
     */
    cleanupOldExecutions(olderThanDays: number = 7): number {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        let removedCount = 0;
        for (const [executionId, execution] of this.executions) {
            if (execution.startedAt < cutoffDate &&
                (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled')) {
                this.executions.delete(executionId);
                removedCount++;
            }
        }

        logger.info('Cleaned up old executions', { removedCount, olderThanDays });
        return removedCount;
    }
}