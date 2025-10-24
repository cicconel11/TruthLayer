import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonitoringService } from '../services/monitoring-service';
import { DatabaseConnection } from '../database/connection';

// Mock database connection
const mockDb = {
    query: async (sql: string, params?: any[]) => {
        // Mock responses for different queries
        if (sql.includes('INSERT INTO system_health_checks')) {
            return { rows: [] };
        }
        if (sql.includes('INSERT INTO system_alerts')) {
            return { rows: [] };
        }
        if (sql.includes('INSERT INTO system_performance_metrics')) {
            return { rows: [] };
        }
        if (sql.includes('INSERT INTO collection_job_executions')) {
            return { rows: [{ id: 'test-job-id' }] };
        }
        if (sql.includes('INSERT INTO annotation_job_executions')) {
            return { rows: [{ id: 'test-annotation-id' }] };
        }
        if (sql.includes('COUNT(*) as total_attempts')) {
            return {
                rows: [
                    { engine: 'google', total_attempts: 100, successful_collections: 95 },
                    { engine: 'bing', total_attempts: 100, successful_collections: 90 }
                ]
            };
        }
        if (sql.includes('COUNT(*) as queue_size')) {
            return { rows: [{ queue_size: 150 }] };
        }
        if (sql.includes('COUNT(*) as recent_annotations')) {
            return {
                rows: [{
                    recent_annotations: 45,
                    low_confidence_count: 5
                }]
            };
        }
        return { rows: [] };
    }
} as unknown as DatabaseConnection;

describe('MonitoringService', () => {
    let monitoringService: MonitoringService;

    beforeEach(() => {
        monitoringService = new MonitoringService(mockDb);
    });

    afterEach(() => {
        monitoringService.stop();
    });

    it('should create and manage alerts', () => {
        const alertId = monitoringService.createAlert(
            'warning',
            'Test Alert',
            'This is a test alert message',
            'test_source',
            { testData: true }
        );

        expect(alertId).toBeDefined();
        expect(typeof alertId).toBe('string');

        const alerts = monitoringService.getAlerts();
        expect(alerts).toHaveLength(1);
        expect(alerts[0].title).toBe('Test Alert');
        expect(alerts[0].severity).toBe('warning');
        expect(alerts[0].acknowledged).toBeFalsy();
    });

    it('should acknowledge alerts', () => {
        const alertId = monitoringService.createAlert(
            'error',
            'Critical Alert',
            'Critical system error',
            'system'
        );

        const acknowledged = monitoringService.acknowledgeAlert(alertId, 'test-user');
        expect(acknowledged).toBe(true);

        const alerts = monitoringService.getAlerts();
        expect(alerts[0].acknowledged).toBe(true);
        expect(alerts[0].acknowledgedBy).toBe('test-user');
    });

    it('should filter alerts by severity', () => {
        monitoringService.createAlert('info', 'Info Alert', 'Info message', 'test');
        monitoringService.createAlert('warning', 'Warning Alert', 'Warning message', 'test');
        monitoringService.createAlert('error', 'Error Alert', 'Error message', 'test');

        const warningAlerts = monitoringService.getAlerts('warning');
        expect(warningAlerts).toHaveLength(1);
        expect(warningAlerts[0].severity).toBe('warning');

        const errorAlerts = monitoringService.getAlerts('error');
        expect(errorAlerts).toHaveLength(1);
        expect(errorAlerts[0].severity).toBe('error');
    });

    it('should update health check results', () => {
        const healthResult = {
            component: 'database',
            status: 'healthy' as const,
            message: 'Database is responding normally',
            responseTime: 45,
            metadata: { connectionPool: 'active' }
        };

        monitoringService.updateHealthCheck(healthResult);

        const healthChecks = monitoringService.getHealthChecks();
        expect(healthChecks).toHaveLength(1);
        expect(healthChecks[0].component).toBe('database');
        expect(healthChecks[0].status).toBe('healthy');
    });

    it('should calculate system health status', () => {
        // Add healthy components
        monitoringService.updateHealthCheck({
            component: 'database',
            status: 'healthy',
            message: 'OK'
        });

        monitoringService.updateHealthCheck({
            component: 'collection',
            status: 'healthy',
            message: 'OK'
        });

        let systemHealth = monitoringService.getSystemHealth();
        expect(systemHealth.status).toBe('healthy');
        expect(systemHealth.summary).toBe('All components healthy');

        // Add degraded component
        monitoringService.updateHealthCheck({
            component: 'annotation',
            status: 'degraded',
            message: 'Slow response'
        });

        systemHealth = monitoringService.getSystemHealth();
        expect(systemHealth.status).toBe('degraded');
        expect(systemHealth.summary).toBe('1 component(s) degraded');

        // Add unhealthy component
        monitoringService.updateHealthCheck({
            component: 'queue',
            status: 'unhealthy',
            message: 'Connection failed'
        });

        systemHealth = monitoringService.getSystemHealth();
        expect(systemHealth.status).toBe('unhealthy');
        expect(systemHealth.summary).toBe('1 component(s) unhealthy');
    });

    it('should record and retrieve system metrics', () => {
        const metrics = {
            timestamp: new Date(),
            scheduler: {
                totalJobs: 10,
                enabledJobs: 8,
                activeExecutions: 2,
                failureRate: 0.05
            },
            queue: {
                pending: 150,
                running: 3,
                throughput: 60,
                averageProcessingTime: 45
            },
            collection: {
                successRate: 0.95,
                totalCollected: 1000,
                errorRate: 0.05
            },
            annotation: {
                queueSize: 150,
                processingRate: 45,
                errorRate: 0.1
            }
        };

        monitoringService.recordMetrics(metrics);

        const retrievedMetrics = monitoringService.getMetrics(1);
        expect(retrievedMetrics).toHaveLength(1);
        expect(retrievedMetrics[0].scheduler.totalJobs).toBe(10);
        expect(retrievedMetrics[0].collection.successRate).toBe(0.95);
    });

    it('should get collection success rates', async () => {
        const successRates = await monitoringService.getCollectionSuccessRates(24);

        expect(successRates).toHaveProperty('google');
        expect(successRates).toHaveProperty('bing');
        expect(successRates.google).toBe(0.95);
        expect(successRates.bing).toBe(0.90);
    });

    it('should get annotation queue metrics', async () => {
        const queueMetrics = await monitoringService.getAnnotationQueueMetrics();

        expect(queueMetrics.queueSize).toBe(150);
        expect(queueMetrics.processingRate).toBe(45);
        expect(queueMetrics.errorRate).toBeCloseTo(0.111, 2); // 5/45
    });

    it('should record collection job execution', async () => {
        const jobId = await monitoringService.recordCollectionJob({
            jobName: 'test-collection',
            querySet: 'health',
            engine: 'google',
            status: 'completed',
            resultsCollected: 20,
            errorsEncountered: 1
        });

        expect(jobId).toBe('test-job-id');
    });

    it('should record annotation job execution', async () => {
        const jobId = await monitoringService.recordAnnotationJob({
            batchId: 'batch-123',
            modelVersion: 'gpt-4-turbo',
            status: 'completed',
            resultsProcessed: 100,
            successfulAnnotations: 95,
            failedAnnotations: 5,
            averageConfidence: 0.87
        });

        expect(jobId).toBe('test-annotation-id');
    });
});