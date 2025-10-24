import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { DatabaseConnection } from '../database/connection';
import { DataIntegrityService } from './data-integrity-service';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert definition
 */
export interface Alert {
    id: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    timestamp: Date;
    source: string;
    metadata?: Record<string, any>;
    acknowledged?: boolean;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    responseTime?: number;
    metadata?: Record<string, any>;
}

/**
 * System metrics
 */
export interface SystemMetrics {
    timestamp: Date;
    scheduler: {
        totalJobs: number;
        enabledJobs: number;
        activeExecutions: number;
        failureRate: number;
    };
    queue: {
        pending: number;
        running: number;
        throughput: number;
        averageProcessingTime: number;
    };
    collection: {
        successRate: number;
        totalCollected: number;
        errorRate: number;
    };
    annotation: {
        queueSize: number;
        processingRate: number;
        errorRate: number;
    };
}

/**
 * Monitoring and alerting service
 */
export class MonitoringService extends EventEmitter {
    private alerts: Map<string, Alert> = new Map();
    private healthChecks: Map<string, HealthCheckResult> = new Map();
    private metrics: SystemMetrics[] = [];
    private isMonitoring = false;
    private monitoringInterval?: NodeJS.Timeout;
    private db: DatabaseConnection;
    private integrityService: DataIntegrityService;

    constructor(
        db: DatabaseConnection,
        private config: {
            alertRetentionHours: number;
            metricsRetentionHours: number;
            healthCheckInterval: number;
            integrityCheckInterval?: number;
        } = {
                alertRetentionHours: 168, // 7 days
                metricsRetentionHours: 72, // 3 days
                healthCheckInterval: 60000, // 1 minute
                integrityCheckInterval: 3600000 // 1 hour
            }
    ) {
        super();
        this.db = db;
        this.integrityService = new DataIntegrityService(db);
    }
    /**
        * Start monitoring service
        */
    start(): void {
        if (this.isMonitoring) {
            logger.warn('Monitoring service is already running');
            return;
        }

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.performHealthChecks();
            this.cleanupOldData();
        }, this.config.healthCheckInterval);

        logger.info('Monitoring service started');
        this.emit('started');
    }

    /**
     * Stop monitoring service
     */
    stop(): void {
        if (!this.isMonitoring) {
            logger.warn('Monitoring service is not running');
            return;
        }

        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }

        logger.info('Monitoring service stopped');
        this.emit('stopped');
    }

    /**
     * Create an alert
     */
    createAlert(
        severity: AlertSeverity,
        title: string,
        message: string,
        source: string,
        metadata?: Record<string, any>
    ): string {
        const alertId = this.generateAlertId();

        const alert: Alert = {
            id: alertId,
            severity,
            title,
            message,
            timestamp: new Date(),
            source,
            metadata
        };

        this.alerts.set(alertId, alert);

        logger.warn('Alert created', {
            alertId,
            severity,
            title,
            source
        });

        this.emit('alert_created', { alert });
        this.emit(`alert_${severity}`, { alert });

        return alertId;
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
        const alert = this.alerts.get(alertId);
        if (!alert) {
            return false;
        }

        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = acknowledgedBy;

        logger.info('Alert acknowledged', {
            alertId,
            acknowledgedBy,
            title: alert.title
        });

        this.emit('alert_acknowledged', { alert });
        return true;
    }

    /**
     * Get alerts by severity
     */
    getAlerts(severity?: AlertSeverity, acknowledged?: boolean): Alert[] {
        return Array.from(this.alerts.values())
            .filter(alert => {
                if (severity && alert.severity !== severity) {
                    return false;
                }
                if (acknowledged !== undefined && alert.acknowledged !== acknowledged) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Record system metrics
     */
    recordMetrics(metrics: SystemMetrics): void {
        this.metrics.push(metrics);

        // Keep only recent metrics
        const cutoffTime = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);
        this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);

        this.emit('metrics_recorded', { metrics });
        this.checkAlertConditions(metrics);
    }

    /**
     * Get system metrics
     */
    getMetrics(hours = 24): SystemMetrics[] {
        const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
        return this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
    }

    /**
     * Update health check result
     */
    updateHealthCheck(result: HealthCheckResult): void {
        this.healthChecks.set(result.component, result);

        logger.debug('Health check updated', {
            component: result.component,
            status: result.status,
            responseTime: result.responseTime
        });

        this.emit('health_check_updated', { result });

        if (result.status === 'unhealthy') {
            this.createAlert(
                'error',
                `Component Unhealthy: ${result.component}`,
                result.message || 'Component health check failed',
                'health_check',
                { component: result.component, ...result.metadata }
            );
        }
    }

    /**
     * Get all health check results
     */
    getHealthChecks(): HealthCheckResult[] {
        return Array.from(this.healthChecks.values());
    }

    /**
     * Get overall system health status
     */
    getSystemHealth(): {
        status: 'healthy' | 'degraded' | 'unhealthy';
        components: HealthCheckResult[];
        summary: string;
    } {
        const components = this.getHealthChecks();

        if (components.length === 0) {
            return {
                status: 'unhealthy',
                components: [],
                summary: 'No health checks available'
            };
        }

        const unhealthyCount = components.filter(c => c.status === 'unhealthy').length;
        const degradedCount = components.filter(c => c.status === 'degraded').length;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        let summary: string;

        if (unhealthyCount > 0) {
            status = 'unhealthy';
            summary = `${unhealthyCount} component(s) unhealthy`;
        } else if (degradedCount > 0) {
            status = 'degraded';
            summary = `${degradedCount} component(s) degraded`;
        } else {
            status = 'healthy';
            summary = 'All components healthy';
        }

        return { status, components, summary };
    }

    /**
     * Perform health checks
     */
    private performHealthChecks(): void {
        this.emit('perform_health_checks');
    }

    /**
     * Check for alert conditions based on metrics
     */
    private checkAlertConditions(metrics: SystemMetrics): void {
        // High failure rate alert
        if (metrics.scheduler.failureRate > 0.2) {
            this.createAlert(
                'warning',
                'High Scheduler Failure Rate',
                `Scheduler failure rate is ${(metrics.scheduler.failureRate * 100).toFixed(1)}%`,
                'scheduler_metrics',
                { failureRate: metrics.scheduler.failureRate }
            );
        }

        // Queue backup alert
        if (metrics.queue.pending > 1000) {
            this.createAlert(
                'warning',
                'Queue Backup',
                `${metrics.queue.pending} jobs pending in queue`,
                'queue_metrics',
                { pendingJobs: metrics.queue.pending }
            );
        }

        // Low collection success rate
        if (metrics.collection.successRate < 0.8) {
            this.createAlert(
                'error',
                'Low Collection Success Rate',
                `Collection success rate is ${(metrics.collection.successRate * 100).toFixed(1)}%`,
                'collection_metrics',
                { successRate: metrics.collection.successRate }
            );
        }

        // High annotation error rate
        if (metrics.annotation.errorRate > 0.1) {
            this.createAlert(
                'warning',
                'High Annotation Error Rate',
                `Annotation error rate is ${(metrics.annotation.errorRate * 100).toFixed(1)}%`,
                'annotation_metrics',
                { errorRate: metrics.annotation.errorRate }
            );
        }
    }

    /**
     * Clean up old alerts and metrics
     */
    private cleanupOldData(): void {
        const alertCutoff = Date.now() - (this.config.alertRetentionHours * 60 * 60 * 1000);
        const metricsCutoff = Date.now() - (this.config.metricsRetentionHours * 60 * 60 * 1000);

        // Clean up old alerts
        let removedAlerts = 0;
        for (const [alertId, alert] of this.alerts) {
            if (alert.timestamp.getTime() < alertCutoff) {
                this.alerts.delete(alertId);
                removedAlerts++;
            }
        }

        // Clean up old metrics
        const initialMetricsCount = this.metrics.length;
        this.metrics = this.metrics.filter(m => m.timestamp.getTime() > metricsCutoff);
        const removedMetrics = initialMetricsCount - this.metrics.length;

        if (removedAlerts > 0 || removedMetrics > 0) {
            logger.debug('Cleaned up old monitoring data', {
                removedAlerts,
                removedMetrics
            });
        }
    }

    /**
     * Generate unique alert ID
     */
    private generateAlertId(): string {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Persist health check result to database
     */
    async persistHealthCheck(result: HealthCheckResult): Promise<void> {
        try {
            await this.db.query(`
                INSERT INTO system_health_checks (component, status, message, response_time, metadata)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                result.component,
                result.status,
                result.message,
                result.responseTime,
                JSON.stringify(result.metadata || {})
            ]);
        } catch (error) {
            logger.error('Failed to persist health check result', { error, result });
        }
    }

    /**
     * Persist alert to database
     */
    async persistAlert(alert: Alert): Promise<void> {
        try {
            await this.db.query(`
                INSERT INTO system_alerts (alert_id, severity, title, message, source, metadata, acknowledged)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (alert_id) DO UPDATE SET
                    acknowledged = EXCLUDED.acknowledged,
                    acknowledged_by = EXCLUDED.acknowledged_by,
                    acknowledged_at = EXCLUDED.acknowledged_at
            `, [
                alert.id,
                alert.severity,
                alert.title,
                alert.message,
                alert.source,
                JSON.stringify(alert.metadata || {}),
                alert.acknowledged || false
            ]);
        } catch (error) {
            logger.error('Failed to persist alert', { error, alert });
        }
    }

    /**
     * Persist system metrics to database
     */
    async persistMetrics(metrics: SystemMetrics): Promise<void> {
        try {
            const metricsToInsert = [
                { type: 'scheduler', name: 'total_jobs', value: metrics.scheduler.totalJobs, unit: 'count' },
                { type: 'scheduler', name: 'enabled_jobs', value: metrics.scheduler.enabledJobs, unit: 'count' },
                { type: 'scheduler', name: 'active_executions', value: metrics.scheduler.activeExecutions, unit: 'count' },
                { type: 'scheduler', name: 'failure_rate', value: metrics.scheduler.failureRate, unit: 'percentage' },
                { type: 'queue', name: 'pending', value: metrics.queue.pending, unit: 'count' },
                { type: 'queue', name: 'running', value: metrics.queue.running, unit: 'count' },
                { type: 'queue', name: 'throughput', value: metrics.queue.throughput, unit: 'rate' },
                { type: 'queue', name: 'average_processing_time', value: metrics.queue.averageProcessingTime, unit: 'seconds' },
                { type: 'collection', name: 'success_rate', value: metrics.collection.successRate, unit: 'percentage' },
                { type: 'collection', name: 'total_collected', value: metrics.collection.totalCollected, unit: 'count' },
                { type: 'collection', name: 'error_rate', value: metrics.collection.errorRate, unit: 'percentage' },
                { type: 'annotation', name: 'queue_size', value: metrics.annotation.queueSize, unit: 'count' },
                { type: 'annotation', name: 'processing_rate', value: metrics.annotation.processingRate, unit: 'rate' },
                { type: 'annotation', name: 'error_rate', value: metrics.annotation.errorRate, unit: 'percentage' },
            ];

            for (const metric of metricsToInsert) {
                await this.db.query(`
                    INSERT INTO system_performance_metrics (metric_type, metric_name, metric_value, unit, recorded_at)
                    VALUES ($1, $2, $3, $4, $5)
                `, [metric.type, metric.name, metric.value, metric.unit, metrics.timestamp]);
            }
        } catch (error) {
            logger.error('Failed to persist system metrics', { error, metrics });
        }
    }

    /**
     * Record collection job execution
     */
    async recordCollectionJob(execution: {
        jobName: string;
        querySet?: string;
        engine?: string;
        status: 'started' | 'running' | 'completed' | 'failed' | 'timeout';
        startedAt?: Date;
        completedAt?: Date;
        durationSeconds?: number;
        resultsCollected?: number;
        errorsEncountered?: number;
        errorMessage?: string;
        metadata?: Record<string, any>;
    }): Promise<string> {
        try {
            const result = await this.db.query(`
                INSERT INTO collection_job_executions (
                    job_name, query_set, engine, status, started_at, completed_at, 
                    duration_seconds, results_collected, errors_encountered, error_message, metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING id
            `, [
                execution.jobName,
                execution.querySet,
                execution.engine,
                execution.status,
                execution.startedAt || new Date(),
                execution.completedAt,
                execution.durationSeconds,
                execution.resultsCollected || 0,
                execution.errorsEncountered || 0,
                execution.errorMessage,
                JSON.stringify(execution.metadata || {})
            ]);

            return result.rows[0].id;
        } catch (error) {
            logger.error('Failed to record collection job execution', { error, execution });
            throw error;
        }
    }

    /**
     * Record annotation job execution
     */
    async recordAnnotationJob(execution: {
        batchId: string;
        modelVersion: string;
        status: 'started' | 'running' | 'completed' | 'failed' | 'timeout';
        startedAt?: Date;
        completedAt?: Date;
        durationSeconds?: number;
        resultsProcessed?: number;
        successfulAnnotations?: number;
        failedAnnotations?: number;
        averageConfidence?: number;
        errorMessage?: string;
        metadata?: Record<string, any>;
    }): Promise<string> {
        try {
            const result = await this.db.query(`
                INSERT INTO annotation_job_executions (
                    batch_id, model_version, status, started_at, completed_at, 
                    duration_seconds, results_processed, successful_annotations, 
                    failed_annotations, average_confidence, error_message, metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
            `, [
                execution.batchId,
                execution.modelVersion,
                execution.status,
                execution.startedAt || new Date(),
                execution.completedAt,
                execution.durationSeconds,
                execution.resultsProcessed || 0,
                execution.successfulAnnotations || 0,
                execution.failedAnnotations || 0,
                execution.averageConfidence,
                execution.errorMessage,
                JSON.stringify(execution.metadata || {})
            ]);

            return result.rows[0].id;
        } catch (error) {
            logger.error('Failed to record annotation job execution', { error, execution });
            throw error;
        }
    }

    /**
     * Get collection success rates by engine
     */
    async getCollectionSuccessRates(hours = 24): Promise<Record<string, number>> {
        try {
            const result = await this.db.query(`
                SELECT 
                    engine,
                    COUNT(*) as total_attempts,
                    COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as successful_collections
                FROM search_results 
                WHERE collected_at >= NOW() - INTERVAL '${hours} hours'
                GROUP BY engine
            `);

            const successRates: Record<string, number> = {};
            for (const row of result.rows) {
                const totalAttempts = parseInt(row.total_attempts);
                const successfulCollections = parseInt(row.successful_collections);
                successRates[row.engine] = totalAttempts > 0 ? successfulCollections / totalAttempts : 0;
            }

            return successRates;
        } catch (error) {
            logger.error('Failed to get collection success rates', { error });
            return {};
        }
    }

    /**
     * Get annotation queue metrics
     */
    async getAnnotationQueueMetrics(): Promise<{
        queueSize: number;
        processingRate: number;
        errorRate: number;
    }> {
        try {
            const queueResult = await this.db.query(`
                SELECT COUNT(*) as queue_size
                FROM search_results sr
                LEFT JOIN annotations a ON sr.id = a.result_id
                WHERE a.id IS NULL 
                  AND sr.collected_at >= NOW() - INTERVAL '7 days'
            `);

            const rateResult = await this.db.query(`
                SELECT 
                    COUNT(*) as recent_annotations,
                    COUNT(CASE WHEN confidence_score < 0.5 THEN 1 END) as low_confidence_count
                FROM annotations 
                WHERE annotated_at >= NOW() - INTERVAL '1 hour'
            `);

            const queueSize = parseInt(queueResult.rows[0].queue_size);
            const recentAnnotations = parseInt(rateResult.rows[0].recent_annotations);
            const lowConfidenceCount = parseInt(rateResult.rows[0].low_confidence_count);
            const errorRate = recentAnnotations > 0 ? lowConfidenceCount / recentAnnotations : 0;

            return {
                queueSize,
                processingRate: recentAnnotations, // Per hour
                errorRate,
            };
        } catch (error) {
            logger.error('Failed to get annotation queue metrics', { error });
            return {
                queueSize: 0,
                processingRate: 0,
                errorRate: 0,
            };
        }
    }

    /**
     * Perform data integrity checks and create alerts for issues
     */
    async performDataIntegrityChecks(): Promise<void> {
        try {
            logger.info('Starting data integrity checks');

            // Run comprehensive validation
            const validation = await this.integrityService.validateDataIntegrity({
                checkHashes: true,
                checkSchema: true,
                checkDuplicates: true,
                batchSize: 500
            });

            // Create alerts for validation issues
            if (!validation.isValid) {
                this.createAlert(
                    'error',
                    'Data Integrity Validation Failed',
                    `Found ${validation.errors.length} critical data integrity issues`,
                    'data_integrity',
                    {
                        errorCount: validation.errors.length,
                        warningCount: validation.warnings.length,
                        statistics: validation.statistics
                    }
                );
            }

            // Alert for high number of missing hashes
            if (validation.statistics.missingHashes > 100) {
                this.createAlert(
                    'warning',
                    'High Number of Missing Content Hashes',
                    `${validation.statistics.missingHashes} search results are missing content hashes`,
                    'data_integrity',
                    { missingHashes: validation.statistics.missingHashes }
                );
            }

            // Alert for schema violations
            if (validation.statistics.schemaViolations > 0) {
                this.createAlert(
                    'error',
                    'Schema Validation Failures',
                    `${validation.statistics.schemaViolations} records have schema violations`,
                    'data_integrity',
                    { schemaViolations: validation.statistics.schemaViolations }
                );
            }

            // Alert for high duplicate rate
            const duplicateRate = validation.statistics.totalRecords > 0
                ? validation.statistics.duplicateRecords / validation.statistics.totalRecords
                : 0;

            if (duplicateRate > 0.1) { // More than 10% duplicates
                this.createAlert(
                    'warning',
                    'High Duplicate Content Rate',
                    `${(duplicateRate * 100).toFixed(1)}% of records are duplicates`,
                    'data_integrity',
                    {
                        duplicateRate,
                        duplicateRecords: validation.statistics.duplicateRecords,
                        totalRecords: validation.statistics.totalRecords
                    }
                );
            }

            // Update health check for data integrity
            this.updateHealthCheck({
                component: 'data_integrity',
                status: validation.isValid ? 'healthy' : 'unhealthy',
                message: validation.isValid
                    ? 'All data integrity checks passed'
                    : `${validation.errors.length} integrity issues found`,
                metadata: {
                    validationResult: validation,
                    lastChecked: new Date()
                }
            });

            logger.info('Data integrity checks completed', {
                isValid: validation.isValid,
                errorCount: validation.errors.length,
                warningCount: validation.warnings.length
            });

        } catch (error) {
            logger.error('Data integrity checks failed', { error });

            this.createAlert(
                'critical',
                'Data Integrity Check System Failure',
                'Unable to perform data integrity validation',
                'data_integrity',
                { error: error instanceof Error ? error.message : 'Unknown error' }
            );

            this.updateHealthCheck({
                component: 'data_integrity',
                status: 'unhealthy',
                message: 'Data integrity check system failure',
                metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
        }
    }

    /**
     * Check collection completeness for recent queries
     */
    async checkRecentCollectionCompleteness(hours = 24): Promise<void> {
        try {
            logger.info('Checking collection completeness for recent queries', { hours });

            // Get recent queries
            const recentQueries = await this.db.query(`
                SELECT DISTINCT q.id, q.text
                FROM queries q
                JOIN search_results sr ON q.id = sr.query_id
                WHERE sr.collected_at >= NOW() - INTERVAL '${hours} hours'
                LIMIT 50
            `);

            let incompleteQueries = 0;
            const expectedEngines = ['google', 'bing', 'perplexity', 'brave'];

            for (const query of recentQueries.rows) {
                const completeness = await this.integrityService.checkCollectionCompleteness(
                    query.id,
                    expectedEngines,
                    20
                );

                if (!completeness.isComplete) {
                    incompleteQueries++;

                    // Create alert for severely incomplete collections
                    if (completeness.coveragePercentage < 50) {
                        this.createAlert(
                            'warning',
                            'Incomplete Collection Detected',
                            `Query "${query.text}" has only ${completeness.coveragePercentage.toFixed(1)}% coverage`,
                            'collection_completeness',
                            {
                                queryId: query.id,
                                queryText: query.text,
                                coveragePercentage: completeness.coveragePercentage,
                                missingEngines: completeness.missingEngines,
                                issues: completeness.issues
                            }
                        );
                    }
                }
            }

            // Update health check for collection completeness
            const completenessRate = recentQueries.rows.length > 0
                ? (recentQueries.rows.length - incompleteQueries) / recentQueries.rows.length
                : 1;

            this.updateHealthCheck({
                component: 'collection_completeness',
                status: completenessRate >= 0.8 ? 'healthy' : completenessRate >= 0.6 ? 'degraded' : 'unhealthy',
                message: `${(completenessRate * 100).toFixed(1)}% of recent queries have complete collections`,
                metadata: {
                    totalQueries: recentQueries.rows.length,
                    incompleteQueries,
                    completenessRate,
                    lastChecked: new Date()
                }
            });

            logger.info('Collection completeness check completed', {
                totalQueries: recentQueries.rows.length,
                incompleteQueries,
                completenessRate
            });

        } catch (error) {
            logger.error('Collection completeness check failed', { error });

            this.updateHealthCheck({
                component: 'collection_completeness',
                status: 'unhealthy',
                message: 'Collection completeness check failed',
                metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
        }
    }

    /**
     * Check annotation coverage for recent search results
     */
    async checkAnnotationCoverage(hours = 24): Promise<void> {
        try {
            logger.info('Checking annotation coverage for recent results', { hours });

            const coverage = await this.integrityService.checkAnnotationCoverage({
                collectedAfter: new Date(Date.now() - hours * 60 * 60 * 1000)
            });

            // Create alerts for low coverage
            if (coverage.coveragePercentage < 80) {
                this.createAlert(
                    'warning',
                    'Low Annotation Coverage',
                    `Only ${coverage.coveragePercentage.toFixed(1)}% of recent results are annotated`,
                    'annotation_coverage',
                    {
                        coveragePercentage: coverage.coveragePercentage,
                        totalResults: coverage.totalResults,
                        annotatedResults: coverage.annotatedResults,
                        missingAnnotations: coverage.missingAnnotations.length,
                        incompleteAnnotations: coverage.incompleteAnnotations.length
                    }
                );
            }

            // Alert for high number of incomplete annotations
            if (coverage.incompleteAnnotations.length > 50) {
                this.createAlert(
                    'warning',
                    'High Number of Incomplete Annotations',
                    `${coverage.incompleteAnnotations.length} annotations are missing required fields`,
                    'annotation_coverage',
                    { incompleteAnnotations: coverage.incompleteAnnotations.length }
                );
            }

            // Update health check for annotation coverage
            this.updateHealthCheck({
                component: 'annotation_coverage',
                status: coverage.coveragePercentage >= 80 ? 'healthy' :
                    coverage.coveragePercentage >= 60 ? 'degraded' : 'unhealthy',
                message: `${coverage.coveragePercentage.toFixed(1)}% annotation coverage`,
                metadata: {
                    coverageResult: coverage,
                    lastChecked: new Date()
                }
            });

            logger.info('Annotation coverage check completed', {
                coveragePercentage: coverage.coveragePercentage,
                totalResults: coverage.totalResults,
                issues: coverage.issues.length
            });

        } catch (error) {
            logger.error('Annotation coverage check failed', { error });

            this.updateHealthCheck({
                component: 'annotation_coverage',
                status: 'unhealthy',
                message: 'Annotation coverage check failed',
                metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
            });
        }
    }

    /**
     * Auto-generate missing content hashes
     */
    async autoGenerateMissingHashes(): Promise<void> {
        try {
            logger.info('Auto-generating missing content hashes');

            const result = await this.integrityService.generateMissingContentHashes(100);

            if (result.updated > 0) {
                logger.info('Generated missing content hashes', {
                    processed: result.processed,
                    updated: result.updated,
                    errors: result.errors.length
                });

                // Create info alert about hash generation
                this.createAlert(
                    'info',
                    'Content Hashes Generated',
                    `Generated ${result.updated} missing content hashes`,
                    'data_integrity',
                    {
                        processed: result.processed,
                        updated: result.updated,
                        errorCount: result.errors.length
                    }
                );
            }

            if (result.errors.length > 0) {
                this.createAlert(
                    'warning',
                    'Hash Generation Errors',
                    `Failed to generate ${result.errors.length} content hashes`,
                    'data_integrity',
                    { errors: result.errors }
                );
            }

        } catch (error) {
            logger.error('Auto hash generation failed', { error });

            this.createAlert(
                'error',
                'Hash Generation System Failure',
                'Unable to auto-generate missing content hashes',
                'data_integrity',
                { error: error instanceof Error ? error.message : 'Unknown error' }
            );
        }
    }

    /**
     * Get data integrity metrics for dashboard
     */
    async getDataIntegrityMetrics(): Promise<{
        validation: {
            isValid: boolean;
            errorCount: number;
            warningCount: number;
            statistics: any;
        };
        completeness: {
            averageCoverage: number;
            incompleteQueries: number;
        };
        coverage: {
            annotationCoverage: number;
            missingAnnotations: number;
            incompleteAnnotations: number;
        };
        duplicates: {
            duplicateGroups: number;
            totalDuplicates: number;
        };
    }> {
        try {
            // Get validation results
            const validation = await this.integrityService.validateDataIntegrity({
                checkHashes: true,
                checkSchema: true,
                checkDuplicates: true,
                batchSize: 500
            });

            // Get annotation coverage
            const coverage = await this.integrityService.checkAnnotationCoverage({
                collectedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            });

            // Get duplicates
            const duplicates = await this.integrityService.findDuplicateResults();

            // Get recent queries completeness (simplified)
            // TODO: Use recent queries for completeness calculation
            // const recentQueries = await this.db.query(`
            //     SELECT COUNT(DISTINCT q.id) as total_queries
            //     FROM queries q
            //     JOIN search_results sr ON q.id = sr.query_id
            //     WHERE sr.collected_at >= NOW() - INTERVAL '24 hours'
            // `);

            return {
                validation: {
                    isValid: validation.isValid,
                    errorCount: validation.errors.length,
                    warningCount: validation.warnings.length,
                    statistics: validation.statistics
                },
                completeness: {
                    averageCoverage: 85, // Placeholder - would need more complex calculation
                    incompleteQueries: 0 // Placeholder
                },
                coverage: {
                    annotationCoverage: coverage.coveragePercentage,
                    missingAnnotations: coverage.missingAnnotations.length,
                    incompleteAnnotations: coverage.incompleteAnnotations.length
                },
                duplicates: {
                    duplicateGroups: duplicates.duplicateGroups.length,
                    totalDuplicates: duplicates.totalDuplicates
                }
            };

        } catch (error) {
            logger.error('Failed to get data integrity metrics', { error });
            throw error;
        }
    }
}