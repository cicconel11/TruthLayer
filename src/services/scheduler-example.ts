import { DatabaseConnection } from '../database/connection';
import { CollectorService } from '../collectors/collector-service';
import { QueryManagementService } from './query-management-service';
import { AnnotationQueueService } from './annotation-queue-service';
import { MetricsAggregationService } from './metrics-aggregation-service';
import { SchedulerService } from './scheduler-service';
import { JobQueueService } from './job-queue-service';
import { MonitoringService } from './monitoring-service';
import { AnnotationPipeline } from './annotation-pipeline';
import { logger } from '../utils/logger';

/**
 * Example usage of the scheduler service
 */
export class SchedulerExample {
    private db: DatabaseConnection;
    private collectorService: CollectorService;
    private queryManagementService: QueryManagementService;
    private annotationQueueService: AnnotationQueueService;
    private metricsService: MetricsAggregationService;
    private schedulerService: SchedulerService;
    private jobQueueService: JobQueueService;
    private monitoringService: MonitoringService;

    constructor() {
        // Initialize database connection
        this.db = new DatabaseConnection();

        // Initialize services
        this.collectorService = new CollectorService(this.db);
        this.queryManagementService = new QueryManagementService(this.db);
        this.metricsService = new MetricsAggregationService(this.db);

        // Initialize annotation pipeline and queue service
        const annotationPipeline = new AnnotationPipeline();
        this.annotationQueueService = new AnnotationQueueService(
            annotationPipeline,
            // Would need SearchResultRepository here
            {} as any
        );

        // Initialize job queue service
        this.jobQueueService = new JobQueueService({
            concurrency: 5,
            maxRetries: 3,
            retryDelay: 5000,
            jobTimeout: 300000 // 5 minutes
        });

        // Initialize monitoring service
        this.monitoringService = new MonitoringService();

        // Initialize scheduler service
        this.schedulerService = new SchedulerService(
            this.db,
            this.collectorService,
            this.queryManagementService,
            this.annotationQueueService,
            this.metricsService
        );

        this.setupEventHandlers();
    }

    /**
     * Start all services
     */
    async start(): Promise<void> {
        try {
            logger.info('Starting TruthLayer scheduler system');

            // Start services in order
            await this.db.connect();
            this.jobQueueService.start();
            this.monitoringService.start();
            this.annotationQueueService.start();
            await this.schedulerService.start();

            logger.info('TruthLayer scheduler system started successfully');

        } catch (error) {
            logger.error('Failed to start scheduler system', { error });
            throw error;
        }
    }

    /**
     * Stop all services
     */
    async stop(): Promise<void> {
        try {
            logger.info('Stopping TruthLayer scheduler system');

            // Stop services in reverse order
            await this.schedulerService.stop();
            this.annotationQueueService.stop();
            this.monitoringService.stop();
            await this.jobQueueService.stop();
            await this.db.disconnect();

            logger.info('TruthLayer scheduler system stopped successfully');

        } catch (error) {
            logger.error('Failed to stop scheduler system', { error });
            throw error;
        }
    }

    /**
     * Add custom collection job
     */
    addCustomCollectionJob(): void {
        this.schedulerService.addJob(
            'custom-health-collection',
            'Custom Health Query Collection',
            'Collect results for health-related queries during flu season',
            '0 8 * * 1,3,5', // Monday, Wednesday, Friday at 8 AM
            async () => {
                logger.info('Executing custom health collection');

                // Add seasonal health queries
                await this.queryManagementService.addSeasonalQueries('daily-core');

                // Trigger collection for health category
                const healthQueries = await this.queryManagementService.getQueriesForExecution(
                    'health-seasonal',
                    25,
                    'category-balanced'
                );

                logger.info('Custom health collection completed', {
                    queriesProcessed: healthQueries.length
                });
            }
        );
    }

    /**
     * Monitor system health
     */
    monitorSystemHealth(): void {
        // Set up health monitoring
        this.monitoringService.on('alert_critical', ({ alert }) => {
            logger.error('CRITICAL ALERT', {
                title: alert.title,
                message: alert.message,
                source: alert.source
            });

            // In a real system, this would send notifications
            // (email, Slack, PagerDuty, etc.)
        });

        this.monitoringService.on('alert_error', ({ alert }) => {
            logger.error('ERROR ALERT', {
                title: alert.title,
                message: alert.message,
                source: alert.source
            });
        });

        // Record system metrics every 5 minutes
        setInterval(() => {
            this.recordSystemMetrics();
        }, 5 * 60 * 1000);
    }

    /**
     * Setup event handlers for monitoring and alerting
     */
    private setupEventHandlers(): void {
        // Scheduler events
        this.schedulerService.on('job_failed', ({ job, error }) => {
            this.monitoringService.createAlert(
                'error',
                `Scheduled Job Failed: ${job.name}`,
                `Job ${job.id} failed: ${error}`,
                'scheduler',
                { jobId: job.id, jobName: job.name }
            );
        });

        this.schedulerService.on('critical_job_failed', ({ job, error }) => {
            this.monitoringService.createAlert(
                'critical',
                `Critical Job Failed: ${job.name}`,
                `Critical job ${job.id} failed: ${error}`,
                'scheduler',
                { jobId: job.id, jobName: job.name }
            );
        });

        this.schedulerService.on('stuck_executions_detected', ({ stuckExecutions }) => {
            this.monitoringService.createAlert(
                'warning',
                'Stuck Job Executions Detected',
                `${stuckExecutions.length} job executions appear to be stuck`,
                'scheduler',
                { stuckCount: stuckExecutions.length }
            );
        });

        // Job queue events
        this.jobQueueService.on('job_failed', ({ job, error }) => {
            this.monitoringService.createAlert(
                'warning',
                `Queue Job Failed: ${job.type}`,
                `Job ${job.id} failed after ${job.attempts} attempts: ${error}`,
                'job_queue',
                { jobId: job.id, jobType: job.type, attempts: job.attempts }
            );
        });

        // Annotation queue events
        this.annotationQueueService.on('annotation_failed', ({ searchResult, error }) => {
            this.monitoringService.createAlert(
                'warning',
                'Annotation Processing Failed',
                `Failed to annotate search result: ${error}`,
                'annotation_queue',
                { resultId: searchResult.id }
            );
        });

        // Monitoring service health checks
        this.monitoringService.on('perform_health_checks', () => {
            this.performHealthChecks();
        });
    }

    /**
     * Perform health checks on all components
     */
    private async performHealthChecks(): Promise<void> {
        // Database health check
        try {
            const start = Date.now();
            await this.db.query('SELECT 1');
            const responseTime = Date.now() - start;

            this.monitoringService.updateHealthCheck({
                component: 'database',
                status: responseTime < 1000 ? 'healthy' : 'degraded',
                responseTime,
                message: responseTime < 1000 ? 'Database responsive' : 'Database slow'
            });
        } catch (error) {
            this.monitoringService.updateHealthCheck({
                component: 'database',
                status: 'unhealthy',
                message: `Database connection failed: ${error}`
            });
        }

        // Scheduler health check
        const schedulerStats = this.schedulerService.getSchedulerStats();
        this.monitoringService.updateHealthCheck({
            component: 'scheduler',
            status: schedulerStats.enabledJobs > 0 ? 'healthy' : 'degraded',
            message: `${schedulerStats.enabledJobs} jobs enabled, ${schedulerStats.activeExecutions} active`,
            metadata: schedulerStats
        });

        // Job queue health check
        const queueStats = this.jobQueueService.getStats();
        this.monitoringService.updateHealthCheck({
            component: 'job_queue',
            status: queueStats.pending < 1000 ? 'healthy' : 'degraded',
            message: `${queueStats.pending} pending, ${queueStats.running} running`,
            metadata: queueStats
        });
    }

    /**
     * Record current system metrics
     */
    private recordSystemMetrics(): void {
        const schedulerStats = this.schedulerService.getSchedulerStats();
        const queueStats = this.jobQueueService.getStats();

        this.monitoringService.recordMetrics({
            timestamp: new Date(),
            scheduler: {
                totalJobs: schedulerStats.totalJobs,
                enabledJobs: schedulerStats.enabledJobs,
                activeExecutions: schedulerStats.activeExecutions,
                failureRate: schedulerStats.totalRuns > 0
                    ? schedulerStats.totalFailures / schedulerStats.totalRuns
                    : 0
            },
            queue: {
                pending: queueStats.pending,
                running: queueStats.running,
                throughput: queueStats.throughput,
                averageProcessingTime: queueStats.averageProcessingTime
            },
            collection: {
                successRate: 0.95, // Would be calculated from actual collection stats
                totalCollected: 0, // Would be calculated from database
                errorRate: 0.05
            },
            annotation: {
                queueSize: queueStats.pending, // Simplified
                processingRate: queueStats.throughput,
                errorRate: 0.02
            }
        });
    }

    /**
     * Get system status dashboard data
     */
    getSystemStatus(): {
        health: any;
        scheduler: any;
        queue: any;
        alerts: any[];
        metrics: any[];
    } {
        return {
            health: this.monitoringService.getSystemHealth(),
            scheduler: this.schedulerService.getSchedulerStats(),
            queue: this.jobQueueService.getStats(),
            alerts: this.monitoringService.getAlerts(),
            metrics: this.monitoringService.getMetrics(24)
        };
    }
}

// Example usage
if (require.main === module) {
    const example = new SchedulerExample();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully');
        await example.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully');
        await example.stop();
        process.exit(0);
    });

    // Start the system
    example.start()
        .then(() => {
            logger.info('TruthLayer scheduler system is running');

            // Add custom jobs
            example.addCustomCollectionJob();

            // Start monitoring
            example.monitorSystemHealth();
        })
        .catch((error) => {
            logger.error('Failed to start system', { error });
            process.exit(1);
        });
}