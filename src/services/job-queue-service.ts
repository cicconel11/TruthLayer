import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

/**
 * Job queue item
 */
export interface QueueJob<T = any> {
    id: string;
    type: string;
    priority: 'low' | 'normal' | 'high';
    data: T;
    createdAt: Date;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    attempts: number;
    maxAttempts: number;
    error?: string;
    result?: any;
}

/**
 * Job processor function
 */
export type JobProcessor<T = any> = (job: QueueJob<T>) => Promise<any>;

/**
 * Queue configuration
 */
export interface QueueConfig {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
    jobTimeout: number;
}

/**
 * Job queue statistics
 */
export interface QueueStats {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
    throughput: number; // jobs per minute
    averageProcessingTime: number;
}

/**
 * Job queue service for managing concurrent tasks
 */
export class JobQueueService extends EventEmitter {
    private jobs: Map<string, QueueJob> = new Map();
    private processors: Map<string, JobProcessor> = new Map();
    private runningJobs: Set<string> = new Set();
    private isProcessing = false;
    private processingInterval?: NodeJS.Timeout;
    private stats = {
        totalProcessed: 0,
        totalFailed: 0,
        processingTimes: [] as number[]
    };

    constructor(private config: QueueConfig) {
        super();
    }

    /**
     * Start the job queue processing
     */
    start(): void {
        if (this.isProcessing) {
            logger.warn('Job queue is already processing');
            return;
        }

        this.isProcessing = true;
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, 1000);

        logger.info('Job queue service started', {
            concurrency: this.config.concurrency,
            maxRetries: this.config.maxRetries
        });

        this.emit('started');
    }

    /**
     * Stop the job queue processing
     */
    async stop(): Promise<void> {
        if (!this.isProcessing) {
            logger.warn('Job queue is not processing');
            return;
        }

        this.isProcessing = false;

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = undefined;
        }

        // Wait for running jobs to complete
        await this.waitForRunningJobs(30000); // 30 second timeout

        logger.info('Job queue service stopped');
        this.emit('stopped');
    }

    /**
     * Register a job processor
     */
    registerProcessor<T>(jobType: string, processor: JobProcessor<T>): void {
        this.processors.set(jobType, processor);
        logger.info('Registered job processor', { jobType });
    }

    /**
     * Add a job to the queue
     */
    addJob<T>(
        type: string,
        data: T,
        options: {
            priority?: 'low' | 'normal' | 'high';
            scheduledAt?: Date;
            maxAttempts?: number;
        } = {}
    ): string {
        const jobId = this.generateJobId();

        const job: QueueJob<T> = {
            id: jobId,
            type,
            priority: options.priority || 'normal',
            data,
            createdAt: new Date(),
            scheduledAt: options.scheduledAt,
            status: 'pending',
            attempts: 0,
            maxAttempts: options.maxAttempts || this.config.maxRetries
        };

        this.jobs.set(jobId, job);

        logger.debug('Added job to queue', {
            jobId,
            type,
            priority: job.priority,
            scheduledAt: job.scheduledAt
        });

        this.emit('job_added', { job });

        return jobId;
    }

    /**
     * Cancel a job
     */
    cancelJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }

        if (job.status === 'running') {
            logger.warn('Cannot cancel running job', { jobId });
            return false;
        }

        job.status = 'cancelled';
        logger.info('Cancelled job', { jobId, type: job.type });
        this.emit('job_cancelled', { job });

        return true;
    }

    /**
     * Get job status
     */
    getJob(jobId: string): QueueJob | null {
        return this.jobs.get(jobId) || null;
    }

    /**
     * Get jobs by status
     */
    getJobsByStatus(status: QueueJob['status']): QueueJob[] {
        return Array.from(this.jobs.values()).filter(job => job.status === status);
    }

    /**
     * Get jobs by type
     */
    getJobsByType(type: string): QueueJob[] {
        return Array.from(this.jobs.values()).filter(job => job.type === type);
    }

    /**
     * Get queue statistics
     */
    getStats(): QueueStats {
        const jobs = Array.from(this.jobs.values());
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Calculate throughput (jobs completed in last minute)
        const recentCompletions = jobs.filter(
            job => job.completedAt && job.completedAt.getTime() > oneMinuteAgo
        ).length;

        // Calculate average processing time
        const avgProcessingTime = this.stats.processingTimes.length > 0
            ? this.stats.processingTimes.reduce((sum, time) => sum + time, 0) / this.stats.processingTimes.length
            : 0;

        return {
            pending: jobs.filter(job => job.status === 'pending').length,
            running: jobs.filter(job => job.status === 'running').length,
            completed: jobs.filter(job => job.status === 'completed').length,
            failed: jobs.filter(job => job.status === 'failed').length,
            total: jobs.length,
            throughput: recentCompletions,
            averageProcessingTime: avgProcessingTime
        };
    }

    /**
     * Clear completed and failed jobs
     */
    clearCompletedJobs(olderThanHours = 24): number {
        const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
        let removedCount = 0;

        for (const [jobId, job] of this.jobs) {
            if (
                (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
                job.createdAt.getTime() < cutoffTime
            ) {
                this.jobs.delete(jobId);
                removedCount++;
            }
        }

        logger.info('Cleared completed jobs', { removedCount, olderThanHours });
        return removedCount;
    }

    /**
     * Process the job queue
     */
    private async processQueue(): Promise<void> {
        if (!this.isProcessing) {
            return;
        }

        // Check if we can process more jobs
        const availableSlots = this.config.concurrency - this.runningJobs.size;
        if (availableSlots <= 0) {
            return;
        }

        // Get pending jobs sorted by priority and creation time
        const pendingJobs = this.getPendingJobs();
        if (pendingJobs.length === 0) {
            return;
        }

        // Process jobs up to available slots
        const jobsToProcess = pendingJobs.slice(0, availableSlots);

        for (const job of jobsToProcess) {
            this.processJob(job);
        }
    }

    /**
     * Get pending jobs sorted by priority and schedule
     */
    private getPendingJobs(): QueueJob[] {
        const now = new Date();

        return Array.from(this.jobs.values())
            .filter(job => {
                // Only pending jobs
                if (job.status !== 'pending') {
                    return false;
                }

                // Check if scheduled time has passed
                if (job.scheduledAt && job.scheduledAt > now) {
                    return false;
                }

                return true;
            })
            .sort((a, b) => {
                // Sort by priority first
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) {
                    return priorityDiff;
                }

                // Then by creation time (FIFO)
                return a.createdAt.getTime() - b.createdAt.getTime();
            });
    }

    /**
     * Process a single job
     */
    private async processJob(job: QueueJob): Promise<void> {
        const processor = this.processors.get(job.type);
        if (!processor) {
            logger.error('No processor found for job type', {
                jobId: job.id,
                type: job.type
            });
            job.status = 'failed';
            job.error = `No processor found for job type: ${job.type}`;
            this.emit('job_failed', { job });
            return;
        }

        job.status = 'running';
        job.startedAt = new Date();
        job.attempts++;
        this.runningJobs.add(job.id);

        logger.debug('Processing job', {
            jobId: job.id,
            type: job.type,
            attempt: job.attempts
        });

        this.emit('job_started', { job });

        try {
            // Set up timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Job timeout after ${this.config.jobTimeout}ms`));
                }, this.config.jobTimeout);
            });

            // Process job with timeout
            const result = await Promise.race([
                processor(job),
                timeoutPromise
            ]);

            // Job completed successfully
            job.status = 'completed';
            job.completedAt = new Date();
            job.result = result;

            const processingTime = job.completedAt.getTime() - job.startedAt!.getTime();
            this.updateProcessingStats(processingTime);

            logger.debug('Job completed successfully', {
                jobId: job.id,
                type: job.type,
                processingTime
            });

            this.emit('job_completed', { job, result });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            job.error = errorMessage;

            logger.error('Job processing failed', {
                jobId: job.id,
                type: job.type,
                attempt: job.attempts,
                error: errorMessage
            });

            // Check if we should retry
            if (job.attempts < job.maxAttempts) {
                // Schedule retry
                job.status = 'pending';
                job.scheduledAt = new Date(Date.now() + this.config.retryDelay);

                logger.info('Job scheduled for retry', {
                    jobId: job.id,
                    attempt: job.attempts,
                    nextAttempt: job.scheduledAt
                });

                this.emit('job_retry', { job, error });
            } else {
                // Max attempts reached
                job.status = 'failed';
                job.completedAt = new Date();

                logger.error('Job failed permanently', {
                    jobId: job.id,
                    type: job.type,
                    totalAttempts: job.attempts
                });

                this.emit('job_failed', { job, error });
            }
        } finally {
            this.runningJobs.delete(job.id);
        }
    }

    /**
     * Update processing statistics
     */
    private updateProcessingStats(processingTime: number): void {
        this.stats.totalProcessed++;
        this.stats.processingTimes.push(processingTime);

        // Keep only last 100 processing times for average calculation
        if (this.stats.processingTimes.length > 100) {
            this.stats.processingTimes = this.stats.processingTimes.slice(-100);
        }
    }

    /**
     * Wait for running jobs to complete
     */
    private async waitForRunningJobs(timeoutMs: number): Promise<void> {
        const startTime = Date.now();

        while (this.runningJobs.size > 0 && (Date.now() - startTime) < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.runningJobs.size > 0) {
            logger.warn('Timeout waiting for running jobs to complete', {
                remainingJobs: this.runningJobs.size
            });
        }
    }

    /**
     * Generate unique job ID
     */
    private generateJobId(): string {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}