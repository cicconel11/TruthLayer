import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

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

    constructor(
        private config: {
            alertRetentionHours: number;
            metricsRetentionHours: number;
            healthCheckInterval: number;
        } = {
                alertRetentionHours: 168, // 7 days
                metricsRetentionHours: 72, // 3 days
                healthCheckInterval: 60000 // 1 minute
            }
    ) {
        super();
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
}