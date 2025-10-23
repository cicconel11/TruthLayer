import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SchedulerService } from '../services/scheduler-service';
import { JobQueueService } from '../services/job-queue-service';
import { MonitoringService } from '../services/monitoring-service';
import { DatabaseConnection } from '../database/connection';
import { CollectorService } from '../collectors/collector-service';
import { QueryManagementService } from '../services/query-management-service';
import { AnnotationQueueService } from '../services/annotation-queue-service';
import { MetricsAggregationService } from '../services/metrics-aggregation-service';

// Mock all dependencies
vi.mock('../database/connection');
vi.mock('../collectors/collector-service');
vi.mock('../services/query-management-service');
vi.mock('../services/annotation-queue-service');
vi.mock('../services/metrics-aggregation-service');

describe('SchedulerService', () => {
    let schedulerService: SchedulerService;
    let mockDb: DatabaseConnection;
    let mockCollectorService: CollectorService;
    let mockQueryManagementService: QueryManagementService;
    let mockAnnotationQueueService: AnnotationQueueService;
    let mockMetricsService: MetricsAggregationService;

    beforeEach(() => {
        // Create mock instances
        mockDb = new DatabaseConnection();
        mockCollectorService = new CollectorService();
        mockQueryManagementService = new QueryManagementService(mockDb);
        mockAnnotationQueueService = {} as AnnotationQueueService;
        mockMetricsService = new MetricsAggregationService(mockDb);

        // Mock the initialize method
        vi.mocked(mockQueryManagementService.initialize).mockResolvedValue();

        schedulerService = new SchedulerService(
            mockDb,
            mockCollectorService,
            mockQueryManagementService,
            mockAnnotationQueueService,
            mockMetricsService
        );
    });

    afterEach(async () => {
        if (schedulerService) {
            await schedulerService.stop();
        }
    });

    describe('Basic Operations', () => {
        it('should initialize with default jobs', () => {
            const jobs = schedulerService.getAllJobsStatus();
            expect(jobs.length).toBeGreaterThan(0);

            // Check for expected default jobs
            const jobNames = jobs.map(job => job.name);
            expect(jobNames).toContain('Daily Core Query Collection');
            expect(jobNames).toContain('Weekly Extended Query Collection');
            expect(jobNames).toContain('Annotation Processing');
            expect(jobNames).toContain('Metrics Computation');
        });

        it('should start and stop successfully', async () => {
            await expect(schedulerService.start()).resolves.not.toThrow();
            await expect(schedulerService.stop()).resolves.not.toThrow();
        });

        it('should not start twice', async () => {
            await schedulerService.start();

            // Starting again should not throw but should log a warning
            await expect(schedulerService.start()).resolves.not.toThrow();
        });
    });

    describe('Job Management', () => {
        it('should add custom jobs', () => {
            const initialJobCount = schedulerService.getAllJobsStatus().length;

            schedulerService.addJob(
                'test-job',
                'Test Job',
                'A test job for unit testing',
                '0 0 * * *',
                async () => {
                    // Test job implementation
                }
            );

            const jobs = schedulerService.getAllJobsStatus();
            expect(jobs.length).toBe(initialJobCount + 1);

            const testJob = jobs.find(job => job.id === 'test-job');
            expect(testJob).toBeDefined();
            expect(testJob?.name).toBe('Test Job');
            expect(testJob?.cronExpression).toBe('0 0 * * *');
        });

        it('should remove jobs', () => {
            schedulerService.addJob(
                'removable-job',
                'Removable Job',
                'A job that will be removed',
                '0 0 * * *',
                async () => { }
            );

            const beforeRemoval = schedulerService.getAllJobsStatus().length;
            const removed = schedulerService.removeJob('removable-job');

            expect(removed).toBe(true);
            expect(schedulerService.getAllJobsStatus().length).toBe(beforeRemoval - 1);
        });

        it('should enable and disable jobs', async () => {
            schedulerService.addJob(
                'toggle-job',
                'Toggle Job',
                'A job for testing enable/disable',
                '0 0 * * *',
                async () => { },
                false // Start disabled
            );

            let job = schedulerService.getJobStatus('toggle-job');
            expect(job?.enabled).toBe(false);

            await schedulerService.enableJob('toggle-job');
            job = schedulerService.getJobStatus('toggle-job');
            expect(job?.enabled).toBe(true);

            schedulerService.disableJob('toggle-job');
            job = schedulerService.getJobStatus('toggle-job');
            expect(job?.enabled).toBe(false);
        });

        it('should manually trigger jobs', async () => {
            let executed = false;

            schedulerService.addJob(
                'manual-job',
                'Manual Job',
                'A job for manual triggering',
                '0 0 * * *',
                async () => {
                    executed = true;
                }
            );

            await schedulerService.triggerJob('manual-job');
            expect(executed).toBe(true);
        });
    });

    describe('Job Statistics', () => {
        it('should provide scheduler statistics', () => {
            const stats = schedulerService.getSchedulerStats();

            expect(stats).toHaveProperty('totalJobs');
            expect(stats).toHaveProperty('enabledJobs');
            expect(stats).toHaveProperty('activeExecutions');
            expect(stats).toHaveProperty('totalRuns');
            expect(stats).toHaveProperty('totalFailures');
            expect(stats).toHaveProperty('uptime');

            expect(typeof stats.totalJobs).toBe('number');
            expect(typeof stats.enabledJobs).toBe('number');
            expect(typeof stats.activeExecutions).toBe('number');
        });

        it('should track job execution counts', async () => {
            let executionCount = 0;

            schedulerService.addJob(
                'counter-job',
                'Counter Job',
                'A job that counts executions',
                '0 0 * * *',
                async () => {
                    executionCount++;
                }
            );

            await schedulerService.triggerJob('counter-job');
            await schedulerService.triggerJob('counter-job');

            const job = schedulerService.getJobStatus('counter-job');
            expect(job?.runCount).toBe(2);
            expect(executionCount).toBe(2);
        });

        it('should track job failures', async () => {
            schedulerService.addJob(
                'failing-job',
                'Failing Job',
                'A job that always fails',
                '0 0 * * *',
                async () => {
                    throw new Error('Test failure');
                }
            );

            // The triggerJob method doesn't throw errors, it catches them internally
            // and updates the job's failure count
            await schedulerService.triggerJob('failing-job');

            const job = schedulerService.getJobStatus('failing-job');
            expect(job?.failureCount).toBe(1);
            expect(job?.lastError).toBe('Test failure');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid cron expressions', () => {
            expect(() => {
                schedulerService.addJob(
                    'invalid-cron-job',
                    'Invalid Cron Job',
                    'A job with invalid cron expression',
                    'invalid-cron',
                    async () => { }
                );
            }).not.toThrow(); // Adding should not throw, but starting might
        });

        it('should handle duplicate job IDs', () => {
            schedulerService.addJob(
                'duplicate-job',
                'First Job',
                'First job with this ID',
                '0 0 * * *',
                async () => { }
            );

            expect(() => {
                schedulerService.addJob(
                    'duplicate-job',
                    'Second Job',
                    'Second job with same ID',
                    '0 0 * * *',
                    async () => { }
                );
            }).toThrow();
        });

        it('should handle non-existent job operations', async () => {
            expect(schedulerService.removeJob('non-existent')).toBe(false);
            expect(await schedulerService.enableJob('non-existent')).toBe(false);
            expect(schedulerService.disableJob('non-existent')).toBe(false);
            expect(schedulerService.getJobStatus('non-existent')).toBeNull();

            await expect(schedulerService.triggerJob('non-existent')).rejects.toThrow();
        });
    });
});

describe('JobQueueService', () => {
    let jobQueueService: JobQueueService;

    beforeEach(() => {
        jobQueueService = new JobQueueService({
            concurrency: 2,
            maxRetries: 3,
            retryDelay: 1000,
            jobTimeout: 5000
        });
    });

    afterEach(async () => {
        if (jobQueueService) {
            await jobQueueService.stop();
        }
    });

    describe('Basic Operations', () => {
        it('should start and stop successfully', () => {
            expect(() => jobQueueService.start()).not.toThrow();
            expect(() => jobQueueService.stop()).not.toThrow();
        });

        it('should register job processors', () => {
            const processor = vi.fn().mockResolvedValue('result');

            expect(() => {
                jobQueueService.registerProcessor('test-job', processor);
            }).not.toThrow();
        });

        it('should add jobs to queue', () => {
            const jobId = jobQueueService.addJob('test-job', { data: 'test' });

            expect(typeof jobId).toBe('string');
            expect(jobId).toMatch(/^job_/);

            const job = jobQueueService.getJob(jobId);
            expect(job).toBeDefined();
            expect(job?.type).toBe('test-job');
            expect(job?.status).toBe('pending');
        });
    });

    describe('Job Processing', () => {
        it('should process jobs when started', async () => {
            const processor = vi.fn().mockResolvedValue('success');
            jobQueueService.registerProcessor('process-job', processor);

            jobQueueService.start();

            const jobId = jobQueueService.addJob('process-job', { test: true });

            // Wait for processing - increase timeout and check job status
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check if the job was processed by looking at its status
            const job = jobQueueService.getJob(jobId);
            expect(job?.status).toBe('completed');
            expect(processor).toHaveBeenCalled();
        });

        it('should provide queue statistics', () => {
            jobQueueService.addJob('stat-job', { data: 'test' });
            jobQueueService.addJob('stat-job', { data: 'test2' });

            const stats = jobQueueService.getStats();

            expect(stats).toHaveProperty('pending');
            expect(stats).toHaveProperty('running');
            expect(stats).toHaveProperty('completed');
            expect(stats).toHaveProperty('failed');
            expect(stats).toHaveProperty('total');
            expect(stats).toHaveProperty('throughput');
            expect(stats).toHaveProperty('averageProcessingTime');

            expect(stats.pending).toBeGreaterThan(0);
        });
    });
});

describe('MonitoringService', () => {
    let monitoringService: MonitoringService;

    beforeEach(() => {
        monitoringService = new MonitoringService();
    });

    afterEach(() => {
        if (monitoringService) {
            monitoringService.stop();
        }
    });

    describe('Basic Operations', () => {
        it('should start and stop successfully', () => {
            expect(() => monitoringService.start()).not.toThrow();
            expect(() => monitoringService.stop()).not.toThrow();
        });

        it('should create alerts', () => {
            const alertId = monitoringService.createAlert(
                'warning',
                'Test Alert',
                'This is a test alert',
                'test-source'
            );

            expect(typeof alertId).toBe('string');
            expect(alertId).toMatch(/^alert_/);

            const alerts = monitoringService.getAlerts();
            expect(alerts.length).toBe(1);
            expect(alerts[0].title).toBe('Test Alert');
            expect(alerts[0].severity).toBe('warning');
        });

        it('should acknowledge alerts', () => {
            const alertId = monitoringService.createAlert(
                'error',
                'Acknowledgeable Alert',
                'This alert can be acknowledged',
                'test-source'
            );

            const acknowledged = monitoringService.acknowledgeAlert(alertId, 'test-user');
            expect(acknowledged).toBe(true);

            const alert = monitoringService.getAlerts().find(a => a.id === alertId);
            expect(alert?.acknowledged).toBe(true);
            expect(alert?.acknowledgedBy).toBe('test-user');
        });
    });

    describe('Health Monitoring', () => {
        it('should update health checks', () => {
            monitoringService.updateHealthCheck({
                component: 'database',
                status: 'healthy',
                message: 'Database is responsive',
                responseTime: 50
            });

            const healthChecks = monitoringService.getHealthChecks();
            expect(healthChecks.length).toBe(1);
            expect(healthChecks[0].component).toBe('database');
            expect(healthChecks[0].status).toBe('healthy');
        });

        it('should provide system health status', () => {
            monitoringService.updateHealthCheck({
                component: 'service1',
                status: 'healthy'
            });

            monitoringService.updateHealthCheck({
                component: 'service2',
                status: 'degraded'
            });

            const systemHealth = monitoringService.getSystemHealth();
            expect(systemHealth.status).toBe('degraded');
            expect(systemHealth.components.length).toBe(2);
        });
    });

    describe('Metrics Recording', () => {
        it('should record system metrics', () => {
            const metrics = {
                timestamp: new Date(),
                scheduler: {
                    totalJobs: 5,
                    enabledJobs: 4,
                    activeExecutions: 1,
                    failureRate: 0.1
                },
                queue: {
                    pending: 10,
                    running: 2,
                    throughput: 5,
                    averageProcessingTime: 1000
                },
                collection: {
                    successRate: 0.95,
                    totalCollected: 1000,
                    errorRate: 0.05
                },
                annotation: {
                    queueSize: 50,
                    processingRate: 10,
                    errorRate: 0.02
                }
            };

            monitoringService.recordMetrics(metrics);

            const recordedMetrics = monitoringService.getMetrics(1);
            expect(recordedMetrics.length).toBe(1);
            expect(recordedMetrics[0].scheduler.totalJobs).toBe(5);
        });
    });
});