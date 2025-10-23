import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { CollectorService } from '../collectors/collector-service';
import { QueryManagementService } from './query-management-service';
import { AnnotationQueueService } from './annotation-queue-service';
import { MetricsAggregationService } from './metrics-aggregation-service';
import { DatabaseConnection } from '../database/connection';
import { ScheduleConfig, QueryCategory } from '../types/query';
import { CollectionRequest } from '../types/search-result';

/**
 * Job definition for scheduled tasks
 */
export interface ScheduledJob {
    id: string;
    name: string;
    description: string;
    cronExpression: string;
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
    runCount: number;
    failureCount: number;
    lastError?: string;
    task: () => Promise<void>;
    cronTask?: cron.ScheduledTask;
}

/**
 * Job execution context
 */
export interface JobExecutionContext {
    jobId: string;
    startTime: Date;
    status: 'running' | 'completed' | 'failed';
    duration?: number;
    error?: string;
    metadata?: Record<string, any>;
}

/**
 * Collection job configuration
 */
export interface CollectionJobConfig {
    querySetId: string;
    engines: string[];
    queryCount: number;
    rotationStrategy: string;
    priority: 'low' | 'normal' | 'high';
}

/**
 * Automated scheduling service for data collection and processing
 */
export class SchedulerService extends EventEmitter {
    private jobs: Map<string, ScheduledJob> = new Map();
    private activeExecutions: Map<string, JobExecutionContext> = new Map();
    private isRunning = false;

    constructor(
        private db: DatabaseConnection,
        private collectorService: CollectorService,
        private queryManagementService: QueryManagementService,
        private annotationQueueService: AnnotationQueueService,
        private metricsService: MetricsAggregationService
    ) {
        super();
        this.setupDefaultJobs();
    }

    /**
     * Start the scheduler service
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Scheduler service is already running');
            return;
        }

        logger.info('Starting scheduler service');

        try {
            // Initialize query management service
            await this.queryManagementService.initialize();

            // Start all enabled jobs
            for (const job of this.jobs.values()) {
                if (job.enabled) {
                    await this.startJob(job.id);
                }
            }

            this.isRunning = true;
            logger.info('Scheduler service started successfully');
            this.emit('started');

        } catch (error) {
            logger.error('Failed to start scheduler service', { error });
            throw error;
        }
    }

    /**
     * Stop the scheduler service
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Scheduler service is not running');
            return;
        }

        logger.info('Stopping scheduler service');

        // Stop all jobs
        for (const job of this.jobs.values()) {
            if (job.cronTask) {
                job.cronTask.stop();
            }
        }

        // Wait for active executions to complete (with timeout)
        await this.waitForActiveExecutions(30000); // 30 second timeout

        this.isRunning = false;
        logger.info('Scheduler service stopped');
        this.emit('stopped');
    }

    /**
     * Add a new scheduled job
     */
    addJob(
        id: string,
        name: string,
        description: string,
        cronExpression: string,
        task: () => Promise<void>,
        enabled = true
    ): void {
        if (this.jobs.has(id)) {
            throw new Error(`Job with ID ${id} already exists`);
        }

        const job: ScheduledJob = {
            id,
            name,
            description,
            cronExpression,
            enabled,
            runCount: 0,
            failureCount: 0,
            task
        };

        this.jobs.set(id, job);

        if (enabled && this.isRunning) {
            this.startJob(id);
        }

        logger.info('Added scheduled job', {
            id,
            name,
            cronExpression,
            enabled
        });

        this.emit('job_added', { job });
    }

    /**
     * Remove a scheduled job
     */
    removeJob(id: string): boolean {
        const job = this.jobs.get(id);
        if (!job) {
            return false;
        }

        // Stop the job if it's running
        if (job.cronTask) {
            job.cronTask.stop();
        }

        this.jobs.delete(id);

        logger.info('Removed scheduled job', { id, name: job.name });
        this.emit('job_removed', { jobId: id });

        return true;
    }

    /**
     * Enable a job
     */
    async enableJob(id: string): Promise<boolean> {
        const job = this.jobs.get(id);
        if (!job) {
            return false;
        }

        job.enabled = true;

        if (this.isRunning) {
            await this.startJob(id);
        }

        logger.info('Enabled job', { id, name: job.name });
        this.emit('job_enabled', { jobId: id });

        return true;
    }

    /**
     * Disable a job
     */
    disableJob(id: string): boolean {
        const job = this.jobs.get(id);
        if (!job) {
            return false;
        }

        job.enabled = false;

        if (job.cronTask) {
            job.cronTask.stop();
            job.cronTask = undefined;
        }

        logger.info('Disabled job', { id, name: job.name });
        this.emit('job_disabled', { jobId: id });

        return true;
    }

    /**
     * Manually trigger a job execution
     */
    async triggerJob(id: string): Promise<void> {
        const job = this.jobs.get(id);
        if (!job) {
            throw new Error(`Job not found: ${id}`);
        }

        logger.info('Manually triggering job', { id, name: job.name });
        await this.executeJob(job);
    }

    /**
     * Get job status and statistics
     */
    getJobStatus(id: string): ScheduledJob | null {
        const job = this.jobs.get(id);
        if (!job) {
            return null;
        }

        // Calculate next run time if job is scheduled
        if (job.cronTask && job.enabled) {
            try {
                // This is a simplified calculation - node-cron doesn't expose next run time directly
                job.nextRun = new Date(Date.now() + 60000); // Placeholder
            } catch (error) {
                logger.warn('Failed to calculate next run time', { jobId: id, error });
            }
        }

        return { ...job };
    }

    /**
     * Get all jobs status
     */
    getAllJobsStatus(): ScheduledJob[] {
        return Array.from(this.jobs.values()).map(job => this.getJobStatus(job.id)!);
    }

    /**
     * Get active executions
     */
    getActiveExecutions(): JobExecutionContext[] {
        return Array.from(this.activeExecutions.values());
    }

    /**
     * Get scheduler statistics
     */
    getSchedulerStats(): {
        totalJobs: number;
        enabledJobs: number;
        activeExecutions: number;
        totalRuns: number;
        totalFailures: number;
        uptime: number;
    } {
        const jobs = Array.from(this.jobs.values());

        return {
            totalJobs: jobs.length,
            enabledJobs: jobs.filter(job => job.enabled).length,
            activeExecutions: this.activeExecutions.size,
            totalRuns: jobs.reduce((sum, job) => sum + job.runCount, 0),
            totalFailures: jobs.reduce((sum, job) => sum + job.failureCount, 0),
            uptime: this.isRunning ? Date.now() : 0
        };
    }

    /**
     * Setup default collection and processing jobs
     */
    private setupDefaultJobs(): void {
        // Daily core query collection (every day at 2 AM)
        this.addJob(
            'daily-core-collection',
            'Daily Core Query Collection',
            'Collect search results for core benchmark queries across all engines',
            '0 2 * * *',
            () => this.executeDailyCollection()
        );

        // Weekly extended query collection (Sundays at 3 AM)
        this.addJob(
            'weekly-extended-collection',
            'Weekly Extended Query Collection',
            'Collect search results for extended query set',
            '0 3 * * 0',
            () => this.executeWeeklyCollection()
        );

        // Daily annotation processing (every 4 hours)
        this.addJob(
            'annotation-processing',
            'Annotation Processing',
            'Process queued search results through annotation pipeline',
            '0 */4 * * *',
            () => this.executeAnnotationProcessing()
        );

        // Daily metrics computation (every day at 6 AM)
        this.addJob(
            'metrics-computation',
            'Metrics Computation',
            'Compute bias metrics and update aggregations',
            '0 6 * * *',
            () => this.executeMetricsComputation()
        );

        // Weekly cleanup (Sundays at 1 AM)
        this.addJob(
            'weekly-cleanup',
            'Weekly Cleanup',
            'Clean up old execution history and temporary data',
            '0 1 * * 0',
            () => this.executeWeeklyCleanup()
        );

        // Health check (every 15 minutes)
        this.addJob(
            'health-check',
            'System Health Check',
            'Monitor system health and alert on issues',
            '*/15 * * * *',
            () => this.executeHealthCheck()
        );
    }

    /**
     * Start a specific job
     */
    private async startJob(id: string): Promise<void> {
        const job = this.jobs.get(id);
        if (!job || !job.enabled) {
            return;
        }

        try {
            // Validate cron expression
            if (!cron.validate(job.cronExpression)) {
                throw new Error(`Invalid cron expression: ${job.cronExpression}`);
            }

            // Create and start cron task
            job.cronTask = cron.schedule(
                job.cronExpression,
                () => this.executeJob(job),
                {
                    scheduled: false,
                    timezone: 'UTC'
                }
            );

            job.cronTask.start();

            logger.info('Started job', {
                id,
                name: job.name,
                cronExpression: job.cronExpression
            });

        } catch (error) {
            logger.error('Failed to start job', { id, name: job.name, error });
            throw error;
        }
    }

    /**
     * Execute a job with error handling and tracking
     */
    private async executeJob(job: ScheduledJob): Promise<void> {
        const executionId = randomUUID();
        const context: JobExecutionContext = {
            jobId: job.id,
            startTime: new Date(),
            status: 'running'
        };

        this.activeExecutions.set(executionId, context);

        logger.info('Starting job execution', {
            jobId: job.id,
            jobName: job.name,
            executionId
        });

        this.emit('job_started', { job, executionId, context });

        try {
            await job.task();

            context.status = 'completed';
            context.duration = Date.now() - context.startTime.getTime();

            job.runCount++;
            job.lastRun = new Date();

            logger.info('Job execution completed', {
                jobId: job.id,
                jobName: job.name,
                executionId,
                duration: context.duration
            });

            this.emit('job_completed', { job, executionId, context });

        } catch (error) {
            context.status = 'failed';
            context.duration = Date.now() - context.startTime.getTime();
            context.error = error instanceof Error ? error.message : String(error);

            job.failureCount++;
            job.lastError = context.error;

            logger.error('Job execution failed', {
                jobId: job.id,
                jobName: job.name,
                executionId,
                duration: context.duration,
                error: context.error
            });

            this.emit('job_failed', { job, executionId, context, error });

            // Alert on critical job failures
            if (this.isCriticalJob(job.id)) {
                this.emit('critical_job_failed', { job, error });
            }
        } finally {
            this.activeExecutions.delete(executionId);
        }
    }

    /**
     * Execute daily core query collection
     */
    private async executeDailyCollection(): Promise<void> {
        logger.info('Starting daily core query collection');

        const config: CollectionJobConfig = {
            querySetId: 'daily-core',
            engines: ['google', 'bing', 'perplexity', 'brave'],
            queryCount: 50,
            rotationStrategy: 'category-balanced',
            priority: 'high'
        };

        await this.executeCollectionJob(config);
    }

    /**
     * Execute weekly extended query collection
     */
    private async executeWeeklyCollection(): Promise<void> {
        logger.info('Starting weekly extended query collection');

        const config: CollectionJobConfig = {
            querySetId: 'weekly-extended',
            engines: ['google', 'bing', 'perplexity', 'brave'],
            queryCount: 200,
            rotationStrategy: 'round-robin',
            priority: 'normal'
        };

        await this.executeCollectionJob(config);
    }

    /**
     * Execute collection job with the given configuration
     */
    private async executeCollectionJob(config: CollectionJobConfig): Promise<void> {
        try {
            // Get queries for execution
            const queries = await this.queryManagementService.getQueriesForExecution(
                config.querySetId,
                config.queryCount,
                config.rotationStrategy
            );

            logger.info('Retrieved queries for collection', {
                querySetId: config.querySetId,
                queryCount: queries.length
            });

            // Create collection requests
            const collectionRequests: CollectionRequest[] = queries.map(query => ({
                query: query.text,
                engines: config.engines,
                maxResults: 20,
                category: query.category as QueryCategory
            }));

            // Execute bulk collection
            const results = await this.collectorService.bulkCollectResults(collectionRequests);

            // Queue results for annotation
            let totalQueued = 0;
            for (const result of results) {
                const queuedIds = await this.annotationQueueService.queueSearchResults(
                    result.results,
                    config.priority
                );
                totalQueued += queuedIds.length;
            }

            logger.info('Collection job completed', {
                querySetId: config.querySetId,
                queriesProcessed: results.length,
                totalResultsCollected: results.reduce((sum, r) => sum + r.results.length, 0),
                totalQueuedForAnnotation: totalQueued
            });

        } catch (error) {
            logger.error('Collection job failed', {
                querySetId: config.querySetId,
                error
            });
            throw error;
        }
    }

    /**
     * Execute annotation processing
     */
    private async executeAnnotationProcessing(): Promise<void> {
        logger.info('Starting annotation processing');

        try {
            // Queue unannotated results with normal priority
            const queuedCount = await this.annotationQueueService.queueUnannotatedResults(
                {},
                'normal',
                500 // Process up to 500 results per batch
            );

            logger.info('Annotation processing completed', {
                queuedCount
            });

        } catch (error) {
            logger.error('Annotation processing failed', { error });
            throw error;
        }
    }

    /**
     * Execute metrics computation
     */
    private async executeMetricsComputation(): Promise<void> {
        logger.info('Starting metrics computation');

        try {
            // Compute metrics for the last 24 hours
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

            await this.metricsService.computeMetricsForPeriod(startDate, endDate);

            logger.info('Metrics computation completed', {
                startDate,
                endDate
            });

        } catch (error) {
            logger.error('Metrics computation failed', { error });
            throw error;
        }
    }

    /**
     * Execute weekly cleanup
     */
    private async executeWeeklyCleanup(): Promise<void> {
        logger.info('Starting weekly cleanup');

        try {
            // Clean up old execution history
            this.queryManagementService.cleanupExecutionHistory(30);

            // Clear old annotation cache entries
            this.annotationQueueService.clearCache();

            logger.info('Weekly cleanup completed');

        } catch (error) {
            logger.error('Weekly cleanup failed', { error });
            throw error;
        }
    }

    /**
     * Execute health check
     */
    private async executeHealthCheck(): Promise<void> {
        try {
            // Check database connection
            await this.db.query('SELECT 1');

            // Check annotation queue status
            const queueStats = this.annotationQueueService.getQueueStats();

            // Check for stuck jobs
            const stuckExecutions = this.getStuckExecutions();

            if (stuckExecutions.length > 0) {
                logger.warn('Detected stuck job executions', {
                    stuckCount: stuckExecutions.length,
                    executions: stuckExecutions.map(e => ({
                        jobId: e.jobId,
                        startTime: e.startTime,
                        duration: Date.now() - e.startTime.getTime()
                    }))
                });

                this.emit('stuck_executions_detected', { stuckExecutions });
            }

            // Emit health status
            this.emit('health_check', {
                status: 'healthy',
                queueStats,
                stuckExecutions: stuckExecutions.length
            });

        } catch (error) {
            logger.error('Health check failed', { error });
            this.emit('health_check', {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Wait for active executions to complete
     */
    private async waitForActiveExecutions(timeoutMs: number): Promise<void> {
        const startTime = Date.now();

        while (this.activeExecutions.size > 0 && (Date.now() - startTime) < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.activeExecutions.size > 0) {
            logger.warn('Timeout waiting for active executions to complete', {
                remainingExecutions: this.activeExecutions.size
            });
        }
    }

    /**
     * Check if a job is critical (failures should trigger alerts)
     */
    private isCriticalJob(jobId: string): boolean {
        const criticalJobs = [
            'daily-core-collection',
            'weekly-extended-collection',
            'metrics-computation'
        ];
        return criticalJobs.includes(jobId);
    }

    /**
     * Get executions that have been running too long
     */
    private getStuckExecutions(): JobExecutionContext[] {
        const maxDuration = 2 * 60 * 60 * 1000; // 2 hours
        const now = Date.now();

        return Array.from(this.activeExecutions.values()).filter(
            execution => (now - execution.startTime.getTime()) > maxDuration
        );
    }
}