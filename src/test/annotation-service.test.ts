import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIAnnotationService, createAnnotationService } from '../services/annotation-service';
import { AnnotationConfig } from '../types/config';
import { AnnotationRequest, BatchAnnotationRequest } from '../types/annotation';

// Mock OpenAI with a simple mock
const mockOpenAICreate = vi.fn();
vi.mock('openai', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: mockOpenAICreate
                }
            }
        }))
    };
});

// Mock logger
vi.mock('../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('AnnotationService', () => {
    let config: AnnotationConfig;
    let service: OpenAIAnnotationService;

    beforeEach(() => {
        config = {
            provider: 'openai',
            apiKey: 'test-api-key',
            model: 'gpt-3.5-turbo',
            temperature: 0.1,
            maxTokens: 1000,
            batchSize: 5,
            rateLimits: {
                requestsPerMinute: 60,
                tokensPerMinute: 10000
            }
        };

        // Reset mocks
        vi.clearAllMocks();
        mockOpenAICreate.mockClear();

        service = new OpenAIAnnotationService(config);
    });

    describe('annotateResult', () => {
        it('should annotate a single search result successfully', async () => {
            const request: AnnotationRequest = {
                title: 'Climate Change Research Shows Rising Temperatures',
                snippet: 'New study from MIT reveals significant temperature increases...',
                url: 'https://mit.edu/climate-study',
                query: 'climate change research'
            };

            // Mock domain classification response
            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'academic' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: '0.9' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('academic');
            expect(result.factualScore).toBe(0.9);
            expect(result.confidenceScore).toBeGreaterThan(0);
            expect(result.confidenceScore).toBeLessThanOrEqual(1);
            expect(result.reasoning).toContain('academic');
            expect(mockOpenAICreate).toHaveBeenCalledTimes(2);
        });

        it('should handle invalid domain classification gracefully', async () => {
            const request: AnnotationRequest = {
                title: 'Test Title',
                snippet: 'Test snippet',
                url: 'https://example.com',
                query: 'test query'
            };

            // Mock invalid domain response
            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'invalid-domain' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: '0.5' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('commercial'); // Default fallback
            expect(result.factualScore).toBe(0.5);
        });

        it('should handle invalid factual score gracefully', async () => {
            const request: AnnotationRequest = {
                title: 'Test Title',
                snippet: 'Test snippet',
                url: 'https://example.com',
                query: 'test query'
            };

            // Mock responses
            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'news' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'invalid-score' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('news');
            expect(result.factualScore).toBe(0.5); // Default fallback
        });
    });

    describe('batchAnnotate', () => {
        it('should process batch annotation requests', async () => {
            const requests: AnnotationRequest[] = [
                {
                    title: 'News Article 1',
                    snippet: 'Breaking news about...',
                    url: 'https://news.com/article1',
                    query: 'breaking news'
                },
                {
                    title: 'Academic Paper',
                    snippet: 'Research findings show...',
                    url: 'https://university.edu/paper',
                    query: 'research findings'
                }
            ];

            const batchRequest: BatchAnnotationRequest = {
                requests,
                batchId: 'test-batch-123',
                priority: 'normal'
            };

            // Mock responses for each request (2 calls per request)
            mockOpenAICreate
                .mockResolvedValueOnce({ choices: [{ message: { content: 'news' } }] })
                .mockResolvedValueOnce({ choices: [{ message: { content: '0.8' } }] })
                .mockResolvedValueOnce({ choices: [{ message: { content: 'academic' } }] })
                .mockResolvedValueOnce({ choices: [{ message: { content: '0.9' } }] });

            const result = await service.batchAnnotate(batchRequest);

            expect(result.batchId).toBe('test-batch-123');
            expect(result.totalProcessed).toBe(2);
            expect(result.responses).toHaveLength(2);
            expect(result.responses[0].domainType).toBe('news');
            expect(result.responses[1].domainType).toBe('academic');
            expect(result.errors).toHaveLength(0);
        });

        it('should handle partial failures in batch processing', async () => {
            const requests: AnnotationRequest[] = [
                {
                    title: 'Valid Request',
                    snippet: 'Valid content',
                    url: 'https://example.com/valid',
                    query: 'valid query'
                },
                {
                    title: 'Failing Request',
                    snippet: 'This will fail',
                    url: 'https://example.com/fail',
                    query: 'failing query'
                }
            ];

            const batchRequest: BatchAnnotationRequest = {
                requests,
                batchId: 'test-batch-456'
            };

            // Mock first request success, second request failure at annotateResult level
            mockOpenAICreate
                .mockResolvedValueOnce({ choices: [{ message: { content: 'news' } }] })
                .mockResolvedValueOnce({ choices: [{ message: { content: '0.7' } }] });

            // Mock the annotateResult method to throw an error for the second request
            const originalAnnotateResult = service.annotateResult;
            vi.spyOn(service, 'annotateResult').mockImplementation(async (req) => {
                if (req.url.includes('fail')) {
                    throw new Error('Simulated annotation failure');
                }
                return originalAnnotateResult.call(service, req);
            });

            const result = await service.batchAnnotate(batchRequest);

            expect(result.totalProcessed).toBe(2);
            expect(result.responses).toHaveLength(2);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Failed to annotate');

            // Second response should be fallback values
            expect(result.responses[1].domainType).toBe('commercial');
            expect(result.responses[1].factualScore).toBe(0.5);
            expect(result.responses[1].confidenceScore).toBe(0.1);
        });
    });

    describe('validateAnnotation', () => {
        it('should validate correct annotation responses', () => {
            const validResponse = {
                domainType: 'news' as const,
                factualScore: 0.8,
                confidenceScore: 0.9,
                reasoning: 'Classified as news domain based on recognized news source. High factual reliability (0.8) due to authoritative source. High confidence in classification based on clear domain indicators.'
            };

            expect(service.validateAnnotation(validResponse)).toBe(true);
        });

        it('should reject invalid domain types', () => {
            const invalidResponse = {
                domainType: 'invalid' as any,
                factualScore: 0.8,
                confidenceScore: 0.9,
                reasoning: 'Valid reasoning'
            };

            expect(service.validateAnnotation(invalidResponse)).toBe(false);
        });

        it('should reject out-of-range scores', () => {
            const invalidResponse = {
                domainType: 'news' as const,
                factualScore: 1.5, // Invalid
                confidenceScore: 0.9,
                reasoning: 'Valid reasoning'
            };

            expect(service.validateAnnotation(invalidResponse)).toBe(false);
        });

        it('should reject empty reasoning', () => {
            const invalidResponse = {
                domainType: 'news' as const,
                factualScore: 0.8,
                confidenceScore: 0.9,
                reasoning: '' // Invalid
            };

            expect(service.validateAnnotation(invalidResponse)).toBe(false);
        });
    });

    describe('getPromptVersion', () => {
        it('should return current prompt version', () => {
            expect(service.getPromptVersion()).toBe('v1.0.0');
        });
    });

    describe('enhanced domain classification', () => {
        it('should classify government domains correctly', async () => {
            const request: AnnotationRequest = {
                title: 'CDC Guidelines for Public Health',
                snippet: 'Official guidelines from the Centers for Disease Control...',
                url: 'https://cdc.gov/guidelines',
                query: 'health guidelines'
            };

            // Mock domain classification response
            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'government' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: '0.9' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('government');
            expect(result.reasoning).toContain('government');
            expect(result.reasoning).toContain('.gov domain');
            expect(result.confidenceScore).toBeGreaterThan(0.8); // Should be high confidence for .gov
        });

        it('should classify academic domains correctly', async () => {
            const request: AnnotationRequest = {
                title: 'Research Study on Climate Change',
                snippet: 'Peer-reviewed research from MIT shows...',
                url: 'https://mit.edu/research/climate',
                query: 'climate research'
            };

            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'academic' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: '0.95' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('academic');
            expect(result.reasoning).toContain('academic');
            expect(result.reasoning).toContain('.edu domain');
            expect(result.confidenceScore).toBeGreaterThan(0.8);
        });

        it('should use URL-based fallback when LLM fails', async () => {
            const request: AnnotationRequest = {
                title: 'Breaking News Story',
                snippet: 'Latest developments in...',
                url: 'https://cnn.com/news/story',
                query: 'breaking news'
            };

            // Mock LLM failure
            mockOpenAICreate.mockRejectedValueOnce(new Error('API Error'));

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('news'); // Should fallback to URL-based classification
            expect(result.reasoning).toContain('news');
        });

        it('should handle social media platforms correctly', async () => {
            const request: AnnotationRequest = {
                title: 'Discussion Thread',
                snippet: 'Users discussing the latest...',
                url: 'https://reddit.com/r/technology/comments/123',
                query: 'technology discussion'
            };

            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'social' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: '0.6' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('social');
            expect(result.reasoning).toContain('social');
            expect(result.reasoning).toContain('reddit');
        });
    });

    describe('enhanced validation', () => {
        it('should reject reasoning that is too short', () => {
            const invalidResponse = {
                domainType: 'news' as const,
                factualScore: 0.8,
                confidenceScore: 0.9,
                reasoning: 'news' // Too short
            };

            expect(service.validateAnnotation(invalidResponse)).toBe(false);
        });

        it('should reject reasoning that does not contain domain type', () => {
            const invalidResponse = {
                domainType: 'news' as const,
                factualScore: 0.8,
                confidenceScore: 0.9,
                reasoning: 'This is a valid looking response but does not contain the domain classification'
            };

            expect(service.validateAnnotation(invalidResponse)).toBe(false);
        });

        it('should reject NaN or infinite scores', () => {
            const invalidResponse = {
                domainType: 'news' as const,
                factualScore: NaN,
                confidenceScore: 0.9,
                reasoning: 'Classified as news domain with detailed reasoning'
            };

            expect(service.validateAnnotation(invalidResponse)).toBe(false);
        });
    });

    describe('factual consistency scoring', () => {
        it('should provide enhanced factual scoring with rubric-based evaluation', async () => {
            const request: AnnotationRequest = {
                title: 'CDC Study Shows Vaccine Effectiveness',
                snippet: 'A comprehensive study by the Centers for Disease Control shows...',
                url: 'https://cdc.gov/studies/vaccine-effectiveness',
                query: 'vaccine effectiveness study'
            };

            // Mock domain and factual scoring responses
            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'government' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: '0.9' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('government');
            expect(result.factualScore).toBeGreaterThanOrEqual(0.8); // Should be high for CDC
            expect(result.confidenceScore).toBeGreaterThan(0.8); // High confidence for .gov
            expect(result.reasoning).toContain('government');
            expect(result.reasoning).toContain('factual');
        });

        it('should apply domain-specific factual score adjustments', async () => {
            const request: AnnotationRequest = {
                title: 'Random Tweet About Health',
                snippet: 'Someone posted their opinion about health...',
                url: 'https://twitter.com/user/status/123',
                query: 'health opinion'
            };

            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'social' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: '0.6' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.domainType).toBe('social');
            expect(result.factualScore).toBeLessThanOrEqual(0.6); // Should be adjusted for social media
            expect(result.reasoning).toContain('social');
            expect(result.reasoning).toContain('low'); // Should mention low reliability for social media
        });

        it('should handle invalid factual score responses gracefully', async () => {
            const request: AnnotationRequest = {
                title: 'Test Article',
                snippet: 'Test content',
                url: 'https://example.com/article',
                query: 'test query'
            };

            mockOpenAICreate
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'news' } }]
                })
                .mockResolvedValueOnce({
                    choices: [{ message: { content: 'invalid response' } }]
                });

            const result = await service.annotateResult(request);

            expect(result.factualScore).toBe(0.5); // Should fallback to neutral score
            expect(result.domainType).toBe('news');
        });
    });

    describe('quality assurance', () => {
        it('should perform quality assurance checks on annotations', () => {
            const response = {
                domainType: 'academic' as const,
                factualScore: 0.9,
                confidenceScore: 0.95,
                reasoning: 'Classified as academic domain based on .edu domain. High factual reliability (0.9) due to authoritative source. High confidence in classification based on clear domain indicators.'
            };

            const request: AnnotationRequest = {
                title: 'Research Study',
                snippet: 'Academic research shows...',
                url: 'https://university.edu/research',
                query: 'research study'
            };

            const qaResult = service.performQualityAssurance(response, request);

            expect(qaResult.passed).toBe(true);
            expect(qaResult.requiresHumanReview).toBe(false);
            expect(qaResult.issues).toHaveLength(0);
        });

        it('should flag low confidence annotations for human review', () => {
            const response = {
                domainType: 'blog' as const,
                factualScore: 0.3,
                confidenceScore: 0.4,
                reasoning: 'Uncertain classification with limited credibility indicators and questionable source reliability'
            };

            const request: AnnotationRequest = {
                title: 'Personal Opinion',
                snippet: 'I think that...',
                url: 'https://personalblog.com/opinion',
                query: 'personal opinion'
            };

            const qaResult = service.performQualityAssurance(response, request);

            expect(qaResult.requiresHumanReview).toBe(true);
            expect(qaResult.passed).toBe(false);
        });

        it('should provide recommendations for quality improvements', () => {
            const response = {
                domainType: 'news' as const,
                factualScore: 0.9,
                confidenceScore: 0.5, // Low confidence for high factual score
                reasoning: 'Classified as news domain based on URL. High factual reliability due to source credibility.'
            };

            const request: AnnotationRequest = {
                title: 'Breaking News',
                snippet: 'Latest developments...',
                url: 'https://cnn.com/news',
                query: 'breaking news'
            };

            const qaResult = service.performQualityAssurance(response, request);

            expect(qaResult.issues.length).toBeGreaterThan(0);
            expect(qaResult.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('factual scoring rubric', () => {
        it('should provide access to factual scoring rubric', () => {
            const rubric = service.getFactualScoringRubric();

            expect(rubric).toHaveLength(6);
            expect(rubric[0].score).toBe(1.0);
            expect(rubric[0].label).toBe('Highly Factual');
            expect(rubric[rubric.length - 1].score).toBe(0.1);
            expect(rubric[rubric.length - 1].label).toBe('Unreliable');
        });

        it('should find best rubric match for factual scores', () => {
            const highMatch = service.getRubricMatch(0.95); // Closer to 1.0
            const lowMatch = service.getRubricMatch(0.15); // Closer to 0.1

            expect(highMatch?.label).toBe('Highly Factual');
            expect(lowMatch?.label).toBe('Unreliable');
        });

        it('should provide quality assurance thresholds', () => {
            const thresholds = service.getQualityAssuranceThresholds();

            expect(thresholds.minConfidenceForAutoAccept).toBe(0.8);
            expect(thresholds.maxFactualScoreVariance).toBe(0.2);
            expect(thresholds.minReasoningLength).toBe(50);
            expect(typeof thresholds.requiresHumanReview).toBe('function');
        });
    });

    describe('createAnnotationService factory', () => {
        it('should create OpenAI service for openai provider', () => {
            const service = createAnnotationService(config);
            expect(service).toBeInstanceOf(OpenAIAnnotationService);
        });

        it('should throw error for anthropic provider', () => {
            const anthropicConfig = { ...config, provider: 'anthropic' as const };
            expect(() => createAnnotationService(anthropicConfig)).toThrow('Anthropic provider not yet implemented');
        });

        it('should throw error for unsupported provider', () => {
            const invalidConfig = { ...config, provider: 'invalid' as any };
            expect(() => createAnnotationService(invalidConfig)).toThrow('Unsupported annotation provider');
        });
    });
});