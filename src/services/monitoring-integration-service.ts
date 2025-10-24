import { MonitoringService } from './monitoring-service';
import { CollectorService } from '../collectors/collector-service';
import { AnnotationService } from './annotation-service';
import { SchedulerService } from './scheduler-service';
import { JobQueueService } from './job-queue-service';
import { DatabaseConnection } from '../database/connection';
import { logger } from '../utils/logger';

/**
 * Integration service that connects monitoring with other system components
 */
export class MonitoringIntegrationService {
    private monitoringService: MonitoringService;
    private metricsInterval?: NodeJS.Timeout;
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(
        private db: DatabaseConnection,
        private collectorService?: CollectorService,
        private annotationService?: AnnotationService,
        private schedulerService?: SchedulerService,
        private queueService?: JobQueueService
    ) {
        this.monitoringService = new MonitoringService(db);
        this.setupEventListeners();
    }

    /**
     * Start monitoring integration
     */
    start(): void {
        this.monitoringService.start();

        // Start periodic metrics collection
        this.metricsInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 60000); // Every minute

        // Start periodic health checks
        this.healthCheckInterval = setInterval(() => {
            this.performHealthChecks();
        }, 300000); // Every 5 minutes

        logger.info('Monitoring integration service started');
    }

    /**
     * Stop monitoring integration
     */
    stop(): void {
        this.monitoringService.stop();

        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = undefined;
        }

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }

        logger.info('Monitoring integration service stopped');
    }

    /**
     * Get monitoring service instance
     */
    getMonitoringService(): MonitoringService {
        return this.monitoringService;
    }

    /**
     * Setup event listeners for system components
     */
    private setupEventListeners(): void {
        // Collection events
        if (this.collectorService) {
            this.collectorService.on('collection_started', (data) => {
                this.monitoringService.recordCollectionJob({
                    jobName: `collection_${data.engine}_${data.query}`,
                    querySet: data.category,
                    engine: data.engine,
                    status: 'started',
                    metadata: { query: data.query }
                });
            });

            this.collectorService.on('collection_completed', (data) => {
                this.monitoringService.recordCollectionJob({
                    jobName: `collection_${data.engine}_${data.query}`,
                    querySet: data.category,
                    engine: data.engine,
                    status: 'completed',
                    completedAt: new Date(),
                    durationSeconds: data.duration,
                    resultsCollected: data.resultsCount,
                    errorsEncountered: data.errors || 0,
                    metadata: { query: data.query, results: data.resultsCount }
                });
            });

            this.collectorService.on('collection_failed', (data) => {
                this.monitoringService.recordCollectionJob({
                    jobName: `collection_${data.engine}_${data.query}`,
                    querySet: data.category,
                    engine: data.engine,
                    status: 'failed',
                    completedAt: new Date(),
                    durationSeconds: data.duration,
                    errorsEncountered: 1,
                    errorMessage: data.error,
                    metadata: { query: data.query, error: data.error }
                });

                // Create alert for collection failure
                this.monitoringService.createAlert(
                    'error',
                    `Collection Failed - ${data.engine}`,
                    `Failed to collect results for query "${data.query}": ${data.error}`,
                    'collection_service',
                    { engine: data.engine, query: data.query, error: data.error }
                );
            });
        }

        // Annotation events
        if (this.annotationService) {
            this.annotationService.on('batch_started', (data) => {
                this.monitoringService.recordAnnotationJob({
                    batchId: data.batchId,
                    modelVersion: data.modelVersion,
                    status: 'started',
                    metadata: { batchSize: data.batchSize }
                });
            });

            this.annotationService.on('batch_completed', (data) => {
                this.monitoringService.recordAnnotationJob({
                    batchId: data.batchId,
                    modelVersion: data.modelVersion,
                    status: 'completed',
                    completedAt: new Date(),
                    durationSeconds: data.duration,
                    resultsProcessed: data.processed,
                    successfulAnnotations: data.successful,
                    failedAnnotations: data.failed,
                    averageConfidence: data.averageConfidence,
                    metadata: {
                        batchSize: data.batchSize,
                        successRate: data.successful / data.processed
                    }
                });
            });

            this.annotationService.on('batch_failed', (data) => {
                this.monitoringService.recordAnnotationJob({
                    batchId: data.batchId,
                    modelVersion: data.modelVersion,
                    status: 'failed',
                    completedAt: new Date(),
                    durationSeconds: data.duration,
                    errorMessage: data.error,
                    metadata: { batchSize: data.batchSize, error: data.error }
                });

                // Create alert for annotation failure
                this.monitoringService.createAlert(
                    'error',
                    'Annotation Batch Failed',
                    `Annotation batch ${data.batchId} failed: ${data.error}`,
                    'annotation_service',
                    { batchId: data.batchId, error: data.error }
                );
            });
        }

        // Scheduler events
        if (this.schedulerService) {
            this.schedulerService.on('job_failed', (data) => {
                this.monitoringService.createAlert(
                    'warning',
                    'Scheduled Job Failed',
                    `Scheduled job "${data.jobName}" failed: ${data.error}`,
                    'scheduler_service',
                    { jobName: data.jobName, error: data.error }
                );
            });
        }

        // Queue events
        if (this.queueService) {
            this.queueService.on('queue_backup', (data) => {
                this.monitoringService.createAlert(
                    'warning',
                    'Queue Backup Detected',
                    `Queue "${data.queueName}" has ${data.size} pending jobs`,
                    'queue_service',
                    { queueName: data.queueName, queueSize: data.size }
                );
            });
        }
    }

    /**
     * Collect system metrics from all components
     */
    private async collectSystemMetrics(): Promise<void> {
        try {
            // Get collection metrics
            const collectionSuccessRates = await this.monitoringService.getCollectionSuccessRates();
            const overallSuccessRate = Object.values(collectionSuccessRates).length > 0
                ? Object.values(collectionSuccessRates).reduce((a, b) => a + b, 0) / Object.values(collectionSuccessRates).length
                : 0;

            // Get annotation metrics
            const annotationMetrics = await this.monitoringService.getAnnotationQueueMetrics();

            // Get total collected results (last 24 hours)
            const totalCollectedResult = await this.db.query(`
                SELECT COUNT(*) as total_collected
                FROM search_results 
                WHERE collected_at >= NOW() - INTERVAL '24 hours'
            `);
            const totalCollected = parseInt(totalCollectedResult.rows[0].total_collected);

            // Simulate scheduler and queue metrics (would be real in production)
            const schedulerMetrics = {
                totalJobs: 10,
                enabledJobs: 8,
                activeExecutions: this.schedulerService ? 2 : 0,
                failureRate: 0.05,
            };

            const queueMetrics = {
                pending: annotationMetrics.queueSize,
                running: 3, // Simulated
                throughput: annotationMetrics.processingRate,
                averageProcessingTime: 45, // Simulated
            };

            const systemMetrics = {
                timestamp: new Date(),
                scheduler: schedulerMetrics,
                queue: queueMetrics,
                collection: {
                    successRate: overallSuccessRate,
                    totalCollected,
                    errorRate: 1 - overallSuccessRate,
                },
                annotation: annotationMetrics,
            };

            // Record metrics
            this.monitoringService.recordMetrics(systemMetrics);
            await this.monitoringService.persistMetrics(systemMetrics);

        } catch (error) {
            logger.error('Failed to collect system metrics', { error });
        }
    }

    /**
     * Perform health checks on all components
     */
    private async performHealthChecks(): Promise<void> {
        try {
            // Database health check
            const dbStartTime = Date.now();
            try {
                await this.db.query('SELECT 1');
                const dbResponseTime = Date.now() - dbStartTime;

                const dbHealthResult = {
                    component: 'database',
                    status: dbResponseTime < 100 ? 'healthy' as const : 'degraded' as const,
                    message: dbResponseTime < 100 ? 'Database responding normally' : 'Database response slow',
                    responseTime: dbResponseTime,
                };

                this.monitoringService.updateHealthCheck(dbHealthResult);
                await this.monitoringService.persistHealthCheck(dbHealthResult);
            } catch (error) {
                const dbHealthResult = {
                    component: 'database',
                    status: 'unhealthy' as const,
                    message: `Database connection failed: ${error}`,
                    responseTime: Date.now() - dbStartTime,
                };

                this.monitoringService.updateHealthCheck(dbHealthResult);
                await this.monitoringService.persistHealthCheck(dbHealthResult);
            }

            // Collection service health check
            if (this.collectorService) {
                const collectionStartTime = Date.now();
                try {
                    // Check recent collection activity
                    const result = await this.db.query(`
                        SELECT 
                            COUNT(*) as total_results,
                            COUNT(DISTINCT engine) as active_engines,
                            MAX(collected_at) as last_collection
                        FROM search_results 
                        WHERE collected_at >= NOW() - INTERVAL '24 hours'
                    `);

                    const collectionResponseTime = Date.now() - collectionStartTime;
                    const data = result.rows[0];
                    const totalResults = parseInt(data.total_results);
                    const activeEngines = parseInt(data.active_engines);

                    let status: 'healthy' | 'degraded' | 'unhealthy';
                    let message: string;

                    if (!data.last_collection) {
                        status = 'unhealthy';
                        message = 'No recent collection activity';
                    } else if (activeEngines < 4) {
                        status = 'degraded';
                        message = `Only ${activeEngines}/4 engines active`;
                    } else if (totalResults < 100) {
                        status = 'degraded';
                        message = 'Low collection volume';
                    } else {
                        status = 'healthy';
                        message = `${totalResults} results from ${activeEngines} engines`;
                    }

                    const collectionHealthResult = {
                        component: 'collection',
                        status,
                        message,
                        responseTime: collectionResponseTime,
                        metadata: { totalResults, activeEngines },
                    };

                    this.monitoringService.updateHealthCheck(collectionHealthResult);
                    await this.monitoringService.persistHealthCheck(collectionHealthResult);
                } catch (error) {
                    const collectionHealthResult = {
                        component: 'collection',
                        status: 'unhealthy' as const,
                        message: `Collection health check failed: ${error}`,
                        responseTime: Date.now() - collectionStartTime,
                    };

                    this.monitoringService.updateHealthCheck(collectionHealthResult);
                    await this.monitoringService.persistHealthCheck(collectionHealthResult);
                }
            }

            // Annotation service health check
            if (this.annotationService) {
                const annotationStartTime = Date.now();
                try {
                    const annotationMetrics = await this.monitoringService.getAnnotationQueueMetrics();
                    const annotationResponseTime = Date.now() - annotationStartTime;

                    let status: 'healthy' | 'degraded' | 'unhealthy';
                    let message: string;

                    if (annotationMetrics.queueSize > 1000) {
                        status = 'unhealthy';
                        message = `High queue backlog: ${annotationMetrics.queueSize} pending`;
                    } else if (annotationMetrics.queueSize > 500) {
                        status = 'degraded';
                        message = `Moderate queue backlog: ${annotationMetrics.queueSize} pending`;
                    } else {
                        status = 'healthy';
                        message = `Queue healthy: ${annotationMetrics.queueSize} pending`;
                    }

                    const annotationHealthResult = {
                        component: 'annotation',
                        status,
                        message,
                        responseTime: annotationResponseTime,
                        metadata: annotationMetrics,
                    };

                    this.monitoringService.updateHealthCheck(annotationHealthResult);
                    await this.monitoringService.persistHealthCheck(annotationHealthResult);
                } catch (error) {
                    const annotationHealthResult = {
                        component: 'annotation',
                        status: 'unhealthy' as const,
                        message: `Annotation health check failed: ${error}`,
                        responseTime: Date.now() - annotationStartTime,
                    };

                    this.monitoringService.updateHealthCheck(annotationHealthResult);
                    await this.monitoringService.persistHealthCheck(annotationHealthResult);
                }
            }

        } catch (error) {
            logger.error('Failed to perform health checks', { error });
        }
    }
}