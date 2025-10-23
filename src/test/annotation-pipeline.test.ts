import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnnotationPipeline, AnnotationPipelineConfig } from '../services/annotation-pipeline';
import { AnnotationQueueService } from '../services/annotation-queue-service';
import { AnnotationServiceInterface } from '../services/annotation-service';
import { SearchResultRepository, AnnotationRepository, QueryRepository } from '../database/repositories';
import { SearchResult, Query } from '../database/models';
import { AnnotationResponse } from '../types/annotation';

// Mock dependencies
const mockAnnotationService: AnnotationServiceInterface = {
    annotateResult: vi.fn(),
    batchAnnotate: vi.fn(),
    getPromptVersion: vi.fn().mockReturnValue('v1.0.0'),
    validateAnnotation: vi.fn().mockReturnValue(true),
    getFactualScoringRubric: vi.fn().mockReturnValue([]),
    getQualityAssuranceThresholds: vi.fn().mockReturnValue({}),
    getRubricMatch: vi.fn().mockReturnValue(null),
    performQualityAssurance: vi.fn().mockReturnValue({
        passed: true,
        requiresHumanReview: false,
        issues: [],
        recommendations: []
    })
};

const mockSearchResultRepo = {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn()
} as unknown as SearchResultRepository;

const mockAnnotationRepo = {
    findByResultId: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn()
} as unknown as AnnotationRepository;

const mockQueryRepo = {
    findById: vi.fn()
} as unknown as QueryRepository;

describe('AnnotationPipeline', () => {
    let pipeline: AnnotationPipeline;
    let config: AnnotationPipelineConfig;

    const mockSearchResult: SearchResult = {
        id: 'test-result-1',
        query_id: 'test-query-1',
        engine: 'google',
        rank: 1,
        title: 'Test Article Title',
        snippet: 'This is a test article snippet',
        url: 'https://example.com/article',
        collected_at: new Date(),
        content_hash: 'test-hash',
        raw_html_path: undefined
    };

    const mockQuery: Query = {
        id: 'test-query-1',
        text: 'test query',
        category: 'test',
        created_at: new Date(),
        updated_at: new Date()
    };

    const mockAnnotationResponse: AnnotationResponse = {
        domainType: 'news',
        factualScore: 0.8,
        confidenceScore: 0.9,
        reasoning: 'Test reasoning for annotation'
    };

    beforeEach(() => {
        vi.clearAllMocks();

        config = {
            maxConcurrentJobs: 2,
            maxRetries: 2,
            retryDelayMs: 100,
            retryBackoffMultiplier: 2,
            maxRetryDelayMs: 1000,
            cacheMaxSize: 100,
            cacheTtlMs: 60000,
            batchSize: 3,
            processingIntervalMs: 100,
            enableCaching: true,
            enableBatching: true
        };

        pipeline = new AnnotationPipeline(
            mockAnnotationService,
            mockSearchResultRepo,
            mockAnnotationRepo,
            mockQueryRepo,
            config
        );

        // Setup default mocks
        vi.mocked(mockQueryRepo.findById).mockResolvedValue(mockQuery);
        vi.mocked(mockAnnotationRepo.findByResultId).mockResolvedValue(null);
        vi.mocked(mockAnnotationRepo.create).mockResolvedValue({} as any);
        vi.mocked(mockAnnotationService.annotateResult).mockResolvedValue(mockAnnotationResponse);
    });

    afterEach(() => {
        pipeline.stop();
    });

    describe('Basic Pipeline Operations', () => {
        it('should start and stop pipeline', () => {
            expect(pipeline.getStats().queueSize).toBe(0);

            pipeline.start();
            expect(pipeline['isRunning']).toBe(true);

            pipeline.stop();
            expect(pipeline['isRunning']).toBe(false);
        });

        it('should enqueue search result for annotation', async () => {
            const resultId = await pipeline.enqueue(mockSearchResult);

            expect(resultId).toBe(mockSearchResult.id);
            expect(pipeline.getStats().queueSize).toBe(1);
            expect(mockAnnotationRepo.findByResultId).toHaveBeenCalledWith(mockSearchResult.id);
        });

        it('should skip already annotated results', async () => {
            const existingAnnotation = {
                id: 'existing-annotation',
                result_id: mockSearchResult.id,
                domain_type: 'news' as const,
                factual_score: 0.8,
                confidence_score: 0.9,
                reasoning: 'Existing annotation',
                model_version: 'v1.0.0',
                annotated_at: new Date()
            };

            vi.mocked(mockAnnotationRepo.findByResultId).mockResolvedValue(existingAnnotation);

            const resultId = await pipeline.enqueue(mockSearchResult);

            expect(resultId).toBe(mockSearchResult.id);
            expect(pipeline.getStats().queueSize).toBe(0); // Should not be queued
        });

        it('should enqueue multiple results in batch', async () => {
            const searchResults = [
                { ...mockSearchResult, id: 'result-1' },
                { ...mockSearchResult, id: 'result-2' },
                { ...mockSearchResult, id: 'result-3' }
            ];

            const queuedIds = await pipeline.enqueueBatch(searchResults);

            expect(queuedIds).toHaveLength(3);
            expect(pipeline.getStats().queueSize).toBe(3);
        });
    });

    describe('Caching', () => {
        it('should cache annotation results', async () => {
            pipeline.start();

            // First result should be processed
            await pipeline.enqueue(mockSearchResult);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 200));

            // Second identical result should use cache
            const duplicateResult = { ...mockSearchResult, id: 'duplicate-result' };
            await pipeline.enqueue(duplicateResult);

            const stats = pipeline.getStats();
            expect(stats.totalCacheHits).toBeGreaterThan(0);
        });

        it('should respect cache TTL', async () => {
            const shortTtlConfig = { ...config, cacheTtlMs: 50 };
            const shortTtlPipeline = new AnnotationPipeline(
                mockAnnotationService,
                mockSearchResultRepo,
                mockAnnotationRepo,
                mockQueryRepo,
                shortTtlConfig
            );

            shortTtlPipeline.start();

            await shortTtlPipeline.enqueue(mockSearchResult);

            // Wait for cache to expire
            await new Promise(resolve => setTimeout(resolve, 100));

            const duplicateResult = { ...mockSearchResult, id: 'duplicate-result' };
            await shortTtlPipeline.enqueue(duplicateResult);

            const stats = shortTtlPipeline.getStats();
            expect(stats.totalCacheMisses).toBe(2); // Both should be cache misses

            shortTtlPipeline.stop();
        });

        it('should clear cache when requested', async () => {
            await pipeline.enqueue(mockSearchResult);

            expect(pipeline.getStats().cacheSize).toBeGreaterThan(0);

            pipeline.clearCache();

            expect(pipeline.getStats().cacheSize).toBe(0);
        });
    });

    describe('Retry Logic', () => {
        it('should retry failed annotations', async () => {
            const error = new Error('API failure');
            vi.mocked(mockAnnotationService.annotateResult)
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce(mockAnnotationResponse);

            pipeline.start();

            let retryEmitted = false;
            pipeline.on('retry', () => {
                retryEmitted = true;
            });

            await pipeline.enqueue(mockSearchResult);

            // Wait for processing and retry
            await new Promise(resolve => setTimeout(resolve, 300));

            expect(retryEmitted).toBe(true);
            expect(pipeline.getStats().totalRetries).toBeGreaterThan(0);
        });

        it('should fail permanently after max retries', async () => {
            const error = new Error('Persistent API failure');
            vi.mocked(mockAnnotationService.annotateResult).mockRejectedValue(error);

            pipeline.start();

            let failedEmitted = false;
            pipeline.on('failed', () => {
                failedEmitted = true;
            });

            await pipeline.enqueue(mockSearchResult);

            // Wait for all retry attempts
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(failedEmitted).toBe(true);
            expect(pipeline.getStats().totalFailures).toBeGreaterThan(0);
        });
    });

    describe('Batch Processing', () => {
        it('should process items in batches when enabled', async () => {
            vi.mocked(mockAnnotationService.batchAnnotate).mockResolvedValue({
                responses: [mockAnnotationResponse, mockAnnotationResponse, mockAnnotationResponse],
                batchId: 'test-batch',
                processedAt: new Date(),
                totalProcessed: 3,
                errors: []
            });

            pipeline.start();

            const searchResults = [
                { ...mockSearchResult, id: 'result-1' },
                { ...mockSearchResult, id: 'result-2' },
                { ...mockSearchResult, id: 'result-3' }
            ];

            await pipeline.enqueueBatch(searchResults);

            // Wait for batch processing
            await new Promise(resolve => setTimeout(resolve, 200));

            expect(mockAnnotationService.batchAnnotate).toHaveBeenCalled();
        });

        it('should handle batch processing errors gracefully', async () => {
            const batchError = new Error('Batch processing failed');
            vi.mocked(mockAnnotationService.batchAnnotate).mockRejectedValue(batchError);

            pipeline.start();

            const searchResults = [
                { ...mockSearchResult, id: 'result-1' },
                { ...mockSearchResult, id: 'result-2' },
                { ...mockSearchResult, id: 'result-3' }
            ];

            await pipeline.enqueueBatch(searchResults);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 200));

            // Should fall back to individual processing
            expect(pipeline.getStats().totalRetries).toBeGreaterThan(0);
        });
    });

    describe('Queue Management', () => {
        it('should prioritize high priority items', async () => {
            const lowPriorityResult = { ...mockSearchResult, id: 'low-priority' };
            const highPriorityResult = { ...mockSearchResult, id: 'high-priority' };

            await pipeline.enqueue(lowPriorityResult, 'low');
            await pipeline.enqueue(highPriorityResult, 'high');

            const queueStatus = pipeline.getQueueStatus();
            expect(queueStatus.byPriority.high).toBe(1);
            expect(queueStatus.byPriority.low).toBe(1);
        });

        it('should provide accurate queue statistics', async () => {
            const searchResults = [
                { ...mockSearchResult, id: 'result-1' },
                { ...mockSearchResult, id: 'result-2' }
            ];

            await pipeline.enqueueBatch(searchResults);

            const stats = pipeline.getStats();
            const queueStatus = pipeline.getQueueStatus();

            expect(stats.queueSize).toBe(2);
            expect(queueStatus.total).toBe(2);
            expect(queueStatus.pending).toBe(2);
        });

        it('should clear queue when requested', async () => {
            await pipeline.enqueue(mockSearchResult);

            expect(pipeline.getStats().queueSize).toBe(1);

            pipeline.clearQueue();

            expect(pipeline.getStats().queueSize).toBe(0);
        });
    });
});

describe('AnnotationQueueService', () => {
    let queueService: AnnotationQueueService;
    let pipeline: AnnotationPipeline;

    beforeEach(() => {
        vi.clearAllMocks();

        pipeline = new AnnotationPipeline(
            mockAnnotationService,
            mockSearchResultRepo,
            mockAnnotationRepo,
            mockQueryRepo
        );

        queueService = new AnnotationQueueService(pipeline, mockSearchResultRepo);

        // Setup default mocks for queue service tests
        vi.mocked(mockQueryRepo.findById).mockResolvedValue(mockQuery);
        vi.mocked(mockAnnotationRepo.findByResultId).mockResolvedValue(null);
        vi.mocked(mockAnnotationRepo.create).mockResolvedValue({} as any);
        vi.mocked(mockAnnotationService.annotateResult).mockResolvedValue(mockAnnotationResponse);
    });

    afterEach(() => {
        queueService.stop();
    });

    describe('Service Operations', () => {
        it('should start and stop service', () => {
            queueService.start();
            expect(pipeline['isRunning']).toBe(true);

            queueService.stop();
            expect(pipeline['isRunning']).toBe(false);
        });

        it('should queue search results', async () => {
            const searchResults = [mockSearchResult];

            const queuedIds = await queueService.queueSearchResults(searchResults);

            expect(queuedIds).toHaveLength(1);
            expect(queuedIds[0]).toBe(mockSearchResult.id);
        });

        it('should queue unannotated results from database', async () => {
            const mockResults = [
                { ...mockSearchResult, id: 'result-1' },
                { ...mockSearchResult, id: 'result-2' }
            ];

            vi.mocked(mockSearchResultRepo.findMany).mockResolvedValue(mockResults);

            const totalQueued = await queueService.queueUnannotatedResults();

            expect(totalQueued).toBe(2);
            expect(mockSearchResultRepo.findMany).toHaveBeenCalledWith(
                { has_annotation: false },
                100,
                0
            );
        });

        it('should queue results by query ID', async () => {
            const mockResults = [mockSearchResult];
            vi.mocked(mockSearchResultRepo.findMany).mockResolvedValue(mockResults);

            const queuedIds = await queueService.queueResultsByQuery('test-query-1');

            expect(queuedIds).toHaveLength(1);
            expect(mockSearchResultRepo.findMany).toHaveBeenCalledWith({
                query_id: 'test-query-1',
                has_annotation: false
            });
        });

        it('should queue results by engine', async () => {
            const mockResults = [mockSearchResult];
            vi.mocked(mockSearchResultRepo.findMany).mockResolvedValue(mockResults);

            const totalQueued = await queueService.queueResultsByEngine('google');

            expect(totalQueued).toBe(1);
        });
    });

    describe('Statistics and Monitoring', () => {
        it('should provide queue statistics', () => {
            const stats = queueService.getQueueStats();

            expect(stats).toHaveProperty('pipeline');
            expect(stats).toHaveProperty('queue');
            expect(stats.pipeline).toHaveProperty('totalProcessed');
            expect(stats.queue).toHaveProperty('total');
        });

        it('should estimate processing time', () => {
            const estimate = queueService.estimateProcessingTime();

            expect(estimate).toHaveProperty('estimatedMinutes');
            expect(estimate).toHaveProperty('queueSize');
            expect(estimate).toHaveProperty('averageProcessingTime');
        });
    });

    describe('Event Handling', () => {
        it('should emit events for pipeline operations', async () => {
            const events: string[] = [];

            queueService.on('started', () => events.push('started'));
            queueService.on('pipeline_started', () => events.push('pipeline_started'));

            queueService.start();

            // Wait a bit for events to be emitted
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(events).toContain('started');
        });

        it('should handle pipeline errors', async () => {
            let errorReceived: Error | null = null;

            queueService.on('pipeline_error', (error) => {
                errorReceived = error;
            });

            // Simulate pipeline error
            pipeline.emit('error', new Error('Test error'));

            // Wait a bit for event to be processed
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(errorReceived).toBeInstanceOf(Error);
            expect(errorReceived?.message).toBe('Test error');
        });
    });
});