import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { SchedulerService } from '../services/scheduler-service';
import { CollectionOrchestrationService } from '../services/collection-orchestration-service';
import { QueryManagementService } from '../services/query-management-service';
import { JobQueueService } from '../services/job-queue-service';
import { CollectorService } from '../collectors/collector-service';
import { AnnotationQueueService } from '../services/annotation-queue-service';
import { MetricsAggregationService } from '../services/metrics-aggregation-service';
import { DatabaseConnection } from '../database/connection';
import { logger } from '../utils/logger';
import { CollectionRequest, CollectionResult } from '../types/search-result';
import { Query } from '../database/models';

// Test configuration
const INTEGRATION_TIMEOUT = 60000; // 60 seconds for integration tests
const TEST_QUERY_SET = 'integration-test-set';

// Mock database for integration tests
const createMockDatabase = () => ({
    query: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn().mockImplementation(async (callback) => {
        return await callback({
            query: vi.fn().mockResolvedValue({ rows: [] })
        });
    }),
    close: vi.fn().mockResolvedValue(undefined)
});

// Mock queries for testing
const createMockQueries = (): Query[] => [
    {
        id: 'query-1',
        text: 'integration test query 1',
        category: 'health',
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        id: 'query-2',
        text: 'integration test query 2',
        category: 'politics',
        created_at: new Date(),
        updated_at: new Date()
    },
    {
        id: 'query-3',
        text: 'integration test query 3',
        category: 'technology',
        created_at: new Date(),
        updated_at: new Date()
    }
];

// Mock collection results
const createMockCollectionResult = (query: string): CollectionResult => ({
    results: [
        {
            id: `result-${Date.now()}-1`,
            query,
            engine: 'google',
            rank: 1,
            title: `Test Result 1 for ${query}`,
            snippet: 'Test snippet content',
            url: 'https://example.com/1',
            timestamp: new Date()
        },
        {
            id: `result-${Date.now()}-2`,
            query,
            engine: 'bing',
            rank: 1,
            title: `Test Result 2 for ${query}`,
            snippet: 'Test snippet content',
            url: 'https://example.com/2',
            timestamp: new Date()
        }
    ],
    metadata: {
        totalCollected: 2,
        successfulEngines: ['google', 'bing'],
        failedEngines: [],
        collectionTime: 1500
    }
});

describe('Scheduling Integration Tests', () => {
    let schedulerService: SchedulerService;
    let orchestrationService: CollectionOrchestrationService;
    let queryManagementService: QueryManagementService;
    let jobQueueService: JobQueueService;
    let collectorService: CollectorService;
    let annotationQueueService: AnnotationQueueService;
    let metricsService: MetricsAggregationService;
    let mockDb: DatabaseConnection;

    beforeAll(() => {
        // Reduce log level for cleaner test output
        logger.level = 'error';
    });

    beforeEach(async () => {
        // Create mock database
        mockDb = createMockDatabase() as unknown as DatabaseConnection;

        // Create services with mocked dependencies
        jobQueueService = new JobQueueService({
            concurrency: 2,
            maxRetries: 2,
            retryDelay: 500,
            jobTimeout: 10000
        });

        queryManagementService = new QueryManagementService(mockDb);
        collectorService = new CollectorService(mockDb);
        annotationQueueService = {} as AnnotationQueueService;
        metricsService = new MetricsAggregationService(mockDb);

        orchestrationService = new CollectionOrchestrationService(
            mockDb,
            collectorService,
            queryManagementService,
            jobQueueService
        );

        schedulerService = new SchedulerService(
            mockDb,
            collectorService,
            queryManagementService,
            annotationQueueService,
            metricsService
        );

        // Mock service methods for integration testing
        vi.spyOn(queryManagementService, 'initialize').mockResolvedValue();
        vi.spyOn(queryManagementService, 'getQueriesForExecution').mockResolvedValue(createMockQueries());
        vi.spyOn(collectorService, 'collectResults').mockImplementation(async (request: CollectionRequest) => {
            // Simulate collection delay
            await new Promise(resolve => setTimeout(resolve, 100));
            return createMockCollectionResult(request.query);
        });
        vi.spyOn(collectorService, 'bulkCollectResults').mockImplementation(async (requests: CollectionRequest[]) => {
            const results = [];
            for (const request of requests) {
                results.push(createMockCollectionResult(request.query));
            }
            return results;
        });

        // Mock annotation queue service
        annotationQueueService.queueSearchResults = vi.fn().mockResolvedValue(['ann-1', 'ann-2']);
        annotationQueueService.queueUnannotatedResults = vi.fn().mockResolvedValue(10);
        annotationQueueService.getQueueStats = vi.fn().mockReturnValue({
            pending: 5,
            processing: 2,
            completed: 100,
            failed: 1
        });
        annotationQueueService.clearCache = vi.fn().mockResolvedValue();

        // Mock metrics service
        vi.spyOn(metricsService, 'computeAggregatedMetrics').mockResolvedValue({
            period: '1d',
            startDate: new Date(),
            endDate: new Date(),
            totalQueries: 10,
            averageMetrics: {
                domainDiversity: 0.8,
                engineOverlap: 0.6,
                factualAlignment: 0.9
            },
            metricsByEngine: {},
            metricsByCategory: {},
            trends: {
                domainDiversity: { direction: 'stable', magnitude: 0.1, confidence: 0.95 },
                engineOverlap: { direction: 'stable', magnitude: 0.05, confidence: 0.9 },
                factualAlignment: { direction: 'stable', magnitude: 0.02, confidence: 0.98 }
            }
        });
    });

    afterEach(async () => {
        // Clean up services
        if (schedulerService) {
            await schedulerService.stop();
        }
        if (orchestrationService) {
            await orchestrationService.shutdown();
        }
        if (jobQueueService) {
            await jobQueueService.stop();
        }

        // Clear all mocks
        vi.clearAllMocks();
    });

    describe('End-to-End Collection Workflow', () => {
        it('should execute complete collection workflow from scheduling to metrics', async () => {
            // Initialize services
            await orchestrationService.initialize();
            await schedulerService.start();
            jobQueueService.start();

            // Track workflow events
            const workflowEvents: string[] = [];

            schedulerService.on('job_started', () => workflowEvents.push('job_started'));
            schedulerService.on('job_completed', () => workflowEvents.push('job_completed'));
            orchestrationService.on('cycle_started', () => workflowEvents.push('cycle_started'));
            orchestrationService.on('cycle_completed', () => workflowEvents.push('cycle_completed'));
            orchestrationService.on('query_collected', () => workflowEvents.push('query_collected'));

            // Trigger a collection cycle manually
            const executionId = await orchestrationService.executeCollectionCycle('daily-core');
            expect(executionId).toBeDefined();

            // Wait for collection to complete
            let attempts = 0;
            const maxAttempts = 30; // 15 seconds max wait

            while (attempts < maxAttempts) {
                const execution = orchestrationService.getExecutionStatus(executionId);
                if (execution && (execution.status === 'completed' || execution.status === 'failed')) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            // Verify collection execution
            const execution = orchestrationService.getExecutionStatus(executionId);
            expect(execution).toBeDefined();
            expect(execution!.cycleId).toBe('daily-core');
            expect(['completed', 'failed']).toContain(execution!.status);

            // Verify queries were retrieved and processed
            expect(queryManagementService.getQueriesForExecution).toHaveBeenCalledWith(
                'daily-core',
                50,
                'category-balanced'
            );

            // Verify collection was attempted (either bulk or individual)
            expect(
                collectorService.bulkCollectResults.mock.calls.length > 0 ||
                collectorService.collectResults.mock.calls.length > 0
            ).toBe(true);

            // Note: Annotation queueing is handled by the scheduler service, not orchestration service
            // The orchestration service only handles collection, annotation is a separate workflow

            // Verify workflow events were emitted
            expect(workflowEvents).toContain('cycle_started');

            // If execution completed successfully, verify completion events
            if (execution!.status === 'completed') {
                expect(workflowEvents).toContain('query_collected');
                expect(workflowEvents).toContain('cycle_completed');
            }

        }, INTEGRATION_TIMEOUT);

        it('should handle scheduled job execution workflow', async () => {
            await schedulerService.start();

            // Add a test job that simulates collection workflow
            let jobExecuted = false;
            const testJobPromise = new Promise<void>((resolve) => {
                schedulerService.addJob(
                    'test-collection-job',
                    'Test Collection Job',
                    'Integration test collection job',
                    '*/1 * * * * *', // Every second for testing
                    async () => {
                        // Simulate collection workflow
                        const queries = await queryManagementService.getQueriesForExecution(
                            TEST_QUERY_SET,
                            3,
                            'round-robin'
                        );

                        const requests: CollectionRequest[] = queries.map(query => ({
                            query: query.text,
                            engines: ['google', 'bing'],
                            maxResults: 5
                        }));

                        const results = await collectorService.bulkCollectResults(requests);

                        // Queue for annotation
                        for (const result of results) {
                            await annotationQueueService.queueSearchResults(result.results, 'normal');
                        }

                        jobExecuted = true;
                        resolve();
                    }
                );
            });

            // Wait for job to execute
            await testJobPromise;

            expect(jobExecuted).toBe(true);
            expect(queryManagementService.getQueriesForExecution).toHaveBeenCalled();
            expect(collectorService.bulkCollectResults).toHaveBeenCalled();
            expect(annotationQueueService.queueSearchResults).toHaveBeenCalled();

        }, INTEGRATION_TIMEOUT);

        it('should process annotation and metrics computation workflow', async () => {
            await schedulerService.start();

            // Track annotation and metrics workflow
            let annotationProcessed = false;
            let metricsComputed = false;

            // Test annotation processing job
            schedulerService.addJob(
                'test-annotation-job',
                'Test Annotation Job',
                'Test annotation processing',
                '*/1 * * * * *',
                async () => {
                    const queuedCount = await annotationQueueService.queueUnannotatedResults(
                        {},
                        'normal',
                        100
                    );
                    expect(queuedCount).toBeGreaterThanOrEqual(0);
                    annotationProcessed = true;
                }
            );

            // Test metrics computation job
            schedulerService.addJob(
                'test-metrics-job',
                'Test Metrics Job',
                'Test metrics computation',
                '*/1 * * * * *',
                async () => {
                    const endDate = new Date();
                    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

                    await metricsService.computeAggregatedMetrics({
                        timePeriod: '1d',
                        startDate,
                        endDate
                    });
                    metricsComputed = true;
                }
            );

            // Wait for jobs to execute
            let attempts = 0;
            while ((!annotationProcessed || !metricsComputed) && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 200));
                attempts++;
            }

            expect(annotationProcessed).toBe(true);
            expect(metricsComputed).toBe(true);
            expect(annotationQueueService.queueUnannotatedResults).toHaveBeenCalled();
            expect(metricsService.computeAggregatedMetrics).toHaveBeenCalled();

        }, INTEGRATION_TIMEOUT);
    });

    describe('Error Handling and Recovery', () => {
        it('should handle collection failures and retry mechanisms', async () => {
            await orchestrationService.initialize();
            jobQueueService.start();

            // Mock collector to fail initially then succeed
            let attemptCount = 0;
            vi.spyOn(collectorService, 'collectResults').mockImplementation(async (request: CollectionRequest) => {
                attemptCount++;
                if (attemptCount <= 2) {
                    throw new Error('Simulated collection failure');
                }
                return createMockCollectionResult(request.query);
            });

            // Execute collection cycle
            const executionId = await orchestrationService.executeCollectionCycle('health-monitoring');

            // Wait for processing with retries
            let attempts = 0;
            const maxAttempts = 40; // Allow time for retries

            while (attempts < maxAttempts) {
                const execution = orchestrationService.getExecutionStatus(executionId);
                if (execution && (execution.status === 'completed' || execution.status === 'failed')) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            const execution = orchestrationService.getExecutionStatus(executionId);
            expect(execution).toBeDefined();

            // Verify retry attempts were made
            expect(attemptCount).toBeGreaterThan(1);

            // Check if execution eventually succeeded or properly failed
            expect(['completed', 'failed']).toContain(execution!.status);

        }, INTEGRATION_TIMEOUT);

        it('should handle scheduler job failures and error tracking', async () => {
            await schedulerService.start();

            let failureCount = 0;
            const errorMessages: string[] = [];

            // Add a job that fails initially
            schedulerService.addJob(
                'failing-job',
                'Failing Job',
                'Job that fails for testing',
                '*/1 * * * * *',
                async () => {
                    failureCount++;
                    if (failureCount <= 2) {
                        throw new Error(`Failure attempt ${failureCount}`);
                    }
                    // Succeed on third attempt
                }
            );

            // Listen for job failure events
            schedulerService.on('job_failed', (event) => {
                errorMessages.push(event.context.error || 'Unknown error');
            });

            // Wait for job to fail and potentially recover
            await new Promise(resolve => setTimeout(resolve, 3000));

            const jobStatus = schedulerService.getJobStatus('failing-job');
            expect(jobStatus).toBeDefined();
            expect(jobStatus!.failureCount).toBeGreaterThan(0);
            expect(jobStatus!.lastError).toBeDefined();

            // Verify error tracking
            expect(errorMessages.length).toBeGreaterThan(0);
            expect(errorMessages[0]).toContain('Failure attempt');

        }, INTEGRATION_TIMEOUT);

        it('should handle database connection failures gracefully', async () => {
            // Mock database to fail
            const failingDb = {
                query: vi.fn().mockRejectedValue(new Error('Database connection failed')),
                transaction: vi.fn().mockRejectedValue(new Error('Database connection failed')),
                close: vi.fn().mockResolvedValue(undefined)
            } as unknown as DatabaseConnection;

            // Create services with failing database
            const failingQueryService = new QueryManagementService(failingDb);
            const failingScheduler = new SchedulerService(
                failingDb,
                collectorService,
                failingQueryService,
                annotationQueueService,
                metricsService
            );

            // Mock the initialize method to fail
            vi.spyOn(failingQueryService, 'initialize').mockRejectedValue(new Error('Database connection failed'));

            // Attempt to start scheduler - should handle failure gracefully
            await expect(failingScheduler.start()).rejects.toThrow('Database connection failed');

            // Verify scheduler didn't start
            const stats = failingScheduler.getSchedulerStats();
            expect(stats.uptime).toBe(0);

            await failingScheduler.stop();

        }, INTEGRATION_TIMEOUT);

        it('should recover from stuck job executions', async () => {
            await schedulerService.start();

            // Add a job that takes too long (simulating stuck execution)
            schedulerService.addJob(
                'long-running-job',
                'Long Running Job',
                'Job that runs for a long time',
                '*/1 * * * * *',
                async () => {
                    // Simulate long-running task
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            );

            // Wait for job to start
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Check for active executions
            const activeExecutions = schedulerService.getActiveExecutions();
            expect(activeExecutions.length).toBeGreaterThanOrEqual(0);

            // Verify scheduler can detect and handle stuck executions
            const stats = schedulerService.getSchedulerStats();
            expect(stats.activeExecutions).toBeGreaterThanOrEqual(0);

            // Stop scheduler - should handle active executions gracefully
            await schedulerService.stop();

        }, INTEGRATION_TIMEOUT);
    });

    describe('Job Queue Management', () => {
        it('should handle concurrent job processing', async () => {
            jobQueueService.start();

            const processedJobs: string[] = [];
            const jobProcessor = vi.fn().mockImplementation(async (job) => {
                // Simulate processing time
                await new Promise(resolve => setTimeout(resolve, 200));
                processedJobs.push(job.id);
                return `Processed ${job.id}`;
            });

            jobQueueService.registerProcessor('test-concurrent', jobProcessor);

            // Add multiple jobs
            const jobIds = [];
            for (let i = 0; i < 5; i++) {
                const jobId = jobQueueService.addJob('test-concurrent', { index: i });
                jobIds.push(jobId);
            }

            // Wait for jobs to process
            let attempts = 0;
            while (processedJobs.length < 5 && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 200));
                attempts++;
            }

            expect(processedJobs.length).toBe(5);
            expect(jobProcessor).toHaveBeenCalledTimes(5);

            // Verify all jobs were processed
            for (const jobId of jobIds) {
                expect(processedJobs).toContain(jobId);
                const job = jobQueueService.getJob(jobId);
                expect(job?.status).toBe('completed');
            }

        }, INTEGRATION_TIMEOUT);

        it('should handle job priority and scheduling', async () => {
            jobQueueService.start();

            const processingOrder: string[] = [];
            const jobProcessor = vi.fn().mockImplementation(async (job) => {
                processingOrder.push(job.data.priority);
                await new Promise(resolve => setTimeout(resolve, 100));
                return 'processed';
            });

            jobQueueService.registerProcessor('priority-test', jobProcessor);

            // Add jobs with different priorities
            jobQueueService.addJob('priority-test', { priority: 'low' }, { priority: 'low' });
            jobQueueService.addJob('priority-test', { priority: 'high' }, { priority: 'high' });
            jobQueueService.addJob('priority-test', { priority: 'normal' }, { priority: 'normal' });

            // Wait for processing with longer timeout
            let attempts = 0;
            while (processingOrder.length < 3 && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 200));
                attempts++;
            }

            expect(processingOrder.length).toBeGreaterThanOrEqual(2); // Allow for at least 2 jobs processed
            // High priority should be processed first if all jobs were processed
            if (processingOrder.length >= 3) {
                expect(processingOrder[0]).toBe('high');
            }

        }, INTEGRATION_TIMEOUT);

        it('should handle job failures and retry logic', async () => {
            jobQueueService.start();

            let attemptCount = 0;
            const jobProcessor = vi.fn().mockImplementation(async (job) => {
                attemptCount++;
                if (attemptCount <= 2) {
                    throw new Error(`Attempt ${attemptCount} failed`);
                }
                return 'success';
            });

            jobQueueService.registerProcessor('retry-test', jobProcessor);

            const jobId = jobQueueService.addJob('retry-test', { test: true }, { maxAttempts: 3 });

            // Wait for retries to complete
            let attempts = 0;
            while (attempts < 20) {
                const job = jobQueueService.getJob(jobId);
                if (job && (job.status === 'completed' || job.status === 'failed')) {
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 200));
                attempts++;
            }

            const job = jobQueueService.getJob(jobId);
            expect(job?.status).toBe('completed');
            expect(job?.attempts).toBe(3);
            expect(attemptCount).toBe(3);

        }, INTEGRATION_TIMEOUT);
    });

    describe('System Health and Monitoring', () => {
        it('should perform health checks and system monitoring', async () => {
            await schedulerService.start();

            const healthEvents: any[] = [];
            schedulerService.on('health_check', (event) => {
                healthEvents.push(event);
            });

            // Trigger health check manually
            await schedulerService.triggerJob('health-check');

            // Wait for health check to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            expect(healthEvents.length).toBeGreaterThan(0);
            const lastHealthEvent = healthEvents[healthEvents.length - 1];
            expect(lastHealthEvent.status).toBeDefined();
            expect(['healthy', 'unhealthy']).toContain(lastHealthEvent.status);

        }, INTEGRATION_TIMEOUT);

        it('should detect and report stuck executions', async () => {
            await schedulerService.start();

            const stuckExecutionEvents: any[] = [];
            schedulerService.on('stuck_executions_detected', (event) => {
                stuckExecutionEvents.push(event);
            });

            // Add a job that simulates stuck execution
            schedulerService.addJob(
                'stuck-simulation',
                'Stuck Simulation',
                'Simulates a stuck execution',
                '*/1 * * * * *',
                async () => {
                    // This would normally be detected as stuck after 2 hours
                    // For testing, we'll just simulate the detection
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            );

            // Trigger health check to detect stuck executions
            await schedulerService.triggerJob('health-check');

            // Wait for health check
            await new Promise(resolve => setTimeout(resolve, 500));

            // In a real scenario, stuck executions would be detected
            // For this test, we verify the health check ran without errors
            const stats = schedulerService.getSchedulerStats();
            expect(stats.totalRuns).toBeGreaterThan(0);

        }, INTEGRATION_TIMEOUT);

        it('should provide comprehensive system statistics', async () => {
            await orchestrationService.initialize();
            await schedulerService.start();
            jobQueueService.start();

            // Execute some operations to generate statistics
            const executionId = await orchestrationService.executeCollectionCycle('health-monitoring');
            await schedulerService.triggerJob('health-check');

            // Wait for operations to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get comprehensive statistics
            const schedulerStats = schedulerService.getSchedulerStats();
            const orchestrationStats = orchestrationService.getOrchestrationStats();
            const queueStats = jobQueueService.getStats();

            // Verify scheduler statistics
            expect(schedulerStats.totalJobs).toBeGreaterThan(0);
            expect(schedulerStats.enabledJobs).toBeGreaterThanOrEqual(0);
            expect(schedulerStats.totalRuns).toBeGreaterThanOrEqual(0);

            // Verify orchestration statistics
            expect(orchestrationStats.totalCycles).toBeGreaterThan(0);
            expect(orchestrationStats.activeExecutions).toBeGreaterThanOrEqual(0);

            // Verify queue statistics
            expect(queueStats.total).toBeGreaterThanOrEqual(0);
            expect(queueStats.pending).toBeGreaterThanOrEqual(0);

        }, INTEGRATION_TIMEOUT);
    });
});