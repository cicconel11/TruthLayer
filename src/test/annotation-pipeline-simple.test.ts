import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnnotationPipeline, AnnotationPipelineConfig } from '../services/annotation-pipeline';
import { AnnotationServiceInterface } from '../services/annotation-service';
import { SearchResultRepository, AnnotationRepository, QueryRepository } from '../database/repositories';
import { SearchResult, Query } from '../database/models';
import { AnnotationResponse } from '../types/annotation';

// Simple mock implementations
const mockAnnotationService: AnnotationServiceInterface = {
    annotateResult: vi.fn().mockResolvedValue({
        domainType: 'news',
        factualScore: 0.8,
        confidenceScore: 0.9,
        reasoning: 'Test reasoning'
    } as AnnotationResponse),
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
    findMany: vi.fn()
} as unknown as SearchResultRepository;

const mockAnnotationRepo = {
    findByResultId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({})
} as unknown as AnnotationRepository;

const mockQueryRepo = {
    findById: vi.fn().mockResolvedValue({
        id: 'test-query-1',
        text: 'test query',
        category: 'test',
        created_at: new Date(),
        updated_at: new Date()
    } as Query)
} as unknown as QueryRepository;

describe('AnnotationPipeline - Core Functionality', () => {
    let pipeline: AnnotationPipeline;

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

    beforeEach(() => {
        vi.clearAllMocks();

        const config: AnnotationPipelineConfig = {
            maxConcurrentJobs: 1,
            maxRetries: 1,
            retryDelayMs: 50,
            retryBackoffMultiplier: 1,
            maxRetryDelayMs: 100,
            cacheMaxSize: 10,
            cacheTtlMs: 1000,
            batchSize: 2,
            processingIntervalMs: 50,
            enableCaching: true,
            enableBatching: false // Disable batching for simpler tests
        };

        pipeline = new AnnotationPipeline(
            mockAnnotationService,
            mockSearchResultRepo,
            mockAnnotationRepo,
            mockQueryRepo,
            config
        );
    });

    it('should create pipeline instance', () => {
        expect(pipeline).toBeDefined();
        expect(pipeline.getStats().queueSize).toBe(0);
    });

    it('should enqueue search result', async () => {
        const resultId = await pipeline.enqueue(mockSearchResult);

        expect(resultId).toBe(mockSearchResult.id);
        expect(pipeline.getStats().queueSize).toBe(1);
    });

    it('should start and stop pipeline', () => {
        pipeline.start();
        expect(pipeline['isRunning']).toBe(true);

        pipeline.stop();
        expect(pipeline['isRunning']).toBe(false);
    });

    it('should provide queue statistics', () => {
        const stats = pipeline.getStats();

        expect(stats).toHaveProperty('totalProcessed');
        expect(stats).toHaveProperty('queueSize');
        expect(stats).toHaveProperty('cacheSize');
        expect(typeof stats.totalProcessed).toBe('number');
    });

    it('should provide queue status', async () => {
        await pipeline.enqueue(mockSearchResult);

        const status = pipeline.getQueueStatus();

        expect(status).toHaveProperty('total');
        expect(status).toHaveProperty('pending');
        expect(status).toHaveProperty('processing');
        expect(status.total).toBe(1);
    });

    it('should clear cache', () => {
        pipeline.clearCache();
        expect(pipeline.getStats().cacheSize).toBe(0);
    });

    it('should clear queue', async () => {
        await pipeline.enqueue(mockSearchResult);
        expect(pipeline.getStats().queueSize).toBe(1);

        pipeline.clearQueue();
        expect(pipeline.getStats().queueSize).toBe(0);
    });

    it('should skip already annotated results', async () => {
        // Mock existing annotation
        vi.mocked(mockAnnotationRepo.findByResultId).mockResolvedValueOnce({
            id: 'existing-annotation',
            result_id: mockSearchResult.id,
            domain_type: 'news',
            factual_score: 0.8,
            confidence_score: 0.9,
            reasoning: 'Existing annotation',
            model_version: 'v1.0.0',
            annotated_at: new Date()
        });

        const resultId = await pipeline.enqueue(mockSearchResult);

        expect(resultId).toBe(mockSearchResult.id);
        expect(pipeline.getStats().queueSize).toBe(0); // Should not be queued
    });

    it('should handle batch enqueue', async () => {
        const searchResults = [
            { ...mockSearchResult, id: 'result-1' },
            { ...mockSearchResult, id: 'result-2' }
        ];

        const queuedIds = await pipeline.enqueueBatch(searchResults);

        expect(queuedIds).toHaveLength(2);
        expect(pipeline.getStats().queueSize).toBe(2);
    });
});