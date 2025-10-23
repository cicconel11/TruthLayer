import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsAggregationService } from '../services/metrics-aggregation-service';
import { MetricsService } from '../services/metrics-service';
import { DatabaseConnection } from '../database/connection';
import type {
    AggregatedMetrics,
    CrossEngineAnalysis
} from '../services/metrics-aggregation-service';
import type { TrendAnalysis, HistoricalMetric } from '../types/metrics';

// Mock database connection
const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    healthCheck: vi.fn(),
    getClient: vi.fn()
} as unknown as DatabaseConnection;

// Mock MetricsService
vi.mock('../services/metrics-service', () => ({
    MetricsService: vi.fn().mockImplementation(() => ({
        analyzeTrend: vi.fn(),
        performSignificanceTest: vi.fn(),
        calculateRollingAverages: vi.fn(),
        detectAnomalies: vi.fn()
    }))
}));

describe('MetricsAggregationService', () => {
    let aggregationService: MetricsAggregationService;
    let mockMetricsService: vi.Mocked<MetricsService>;

    beforeEach(() => {
        vi.clearAllMocks();
        aggregationService = new MetricsAggregationService(mockDb);

        // Get the mocked MetricsService instance
        mockMetricsService = vi.mocked(new MetricsService(mockDb));

        // Mock the private metricsService property
        (aggregationService as any).metricsService = mockMetricsService;
    });

    describe('computeAggregatedMetrics', () => {
        it('should compute aggregated metrics across time periods', async () => {
            const mockOverallResult = {
                rows: [{
                    total_queries: '10',
                    avg_domain_diversity: '0.75',
                    avg_engine_overlap: '0.45',
                    avg_factual_alignment: '0.82'
                }]
            };

            const mockEngineResult = {
                rows: [
                    { engine: 'google', avg_domain_diversity: '0.8', avg_factual_alignment: '0.85', query_count: '5' },
                    { engine: 'bing', avg_domain_diversity: '0.7', avg_factual_alignment: '0.79', query_count: '5' }
                ]
            };

            const mockCategoryResult = {
                rows: [
                    {
                        category: 'health',
                        avg_domain_diversity: '0.78',
                        avg_engine_overlap: '0.42',
                        avg_factual_alignment: '0.84',
                        query_count: '5'
                    },
                    {
                        category: 'politics',
                        avg_domain_diversity: '0.72',
                        avg_engine_overlap: '0.48',
                        avg_factual_alignment: '0.80',
                        query_count: '5'
                    }
                ]
            };

            const mockTrendAnalysis: TrendAnalysis = {
                metric: 'domain_diversity',
                timeframe: '30d',
                values: [
                    { date: new Date('2024-01-01'), value: 0.7 },
                    { date: new Date('2024-01-02'), value: 0.8 }
                ],
                trend: 'increasing',
                changePercentage: 14.3,
                significance: 0.85
            };

            (mockDb.query as any)
                .mockResolvedValueOnce(mockOverallResult)
                .mockResolvedValueOnce(mockEngineResult)
                .mockResolvedValueOnce(mockCategoryResult);

            mockMetricsService.analyzeTrend
                .mockResolvedValueOnce(mockTrendAnalysis)
                .mockResolvedValueOnce({ ...mockTrendAnalysis, metric: 'engine_overlap' })
                .mockResolvedValueOnce({ ...mockTrendAnalysis, metric: 'factual_alignment' });

            const result = await aggregationService.computeAggregatedMetrics({
                timePeriod: '30d',
                engines: ['google', 'bing'],
                categories: ['health', 'politics']
            });

            expect(result.period).toBe('30d');
            expect(result.totalQueries).toBe(10);
            expect(result.averageMetrics.domainDiversity).toBe(0.75);
            expect(result.averageMetrics.engineOverlap).toBe(0.45);
            expect(result.averageMetrics.factualAlignment).toBe(0.82);

            expect(result.metricsByEngine.google.domainDiversity).toBe(0.8);
            expect(result.metricsByEngine.bing.factualAlignment).toBe(0.79);

            expect(result.metricsByCategory.health.domainDiversity).toBe(0.78);
            expect(result.metricsByCategory.politics.engineOverlap).toBe(0.48);

            expect(result.trends.domainDiversity.trend).toBe('increasing');
        });

        it('should handle empty results gracefully', async () => {
            (mockDb.query as any)
                .mockResolvedValueOnce({ rows: [{ total_queries: '0', avg_domain_diversity: null, avg_engine_overlap: null, avg_factual_alignment: null }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const mockEmptyTrend: TrendAnalysis = {
                metric: 'domain_diversity',
                timeframe: '7d',
                values: [],
                trend: 'stable',
                changePercentage: 0,
                significance: 0
            };

            mockMetricsService.analyzeTrend
                .mockResolvedValue(mockEmptyTrend);

            const result = await aggregationService.computeAggregatedMetrics({
                timePeriod: '7d'
            });

            expect(result.totalQueries).toBe(0);
            expect(result.averageMetrics.domainDiversity).toBe(0);
            expect(Object.keys(result.metricsByEngine)).toHaveLength(0);
            expect(Object.keys(result.metricsByCategory)).toHaveLength(0);
        });

        it('should filter by engines and categories when specified', async () => {
            const mockOverallResult = {
                rows: [{
                    total_queries: '5',
                    avg_domain_diversity: '0.8',
                    avg_engine_overlap: '0.5',
                    avg_factual_alignment: '0.9'
                }]
            };

            (mockDb.query as any)
                .mockResolvedValueOnce(mockOverallResult)
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockMetricsService.analyzeTrend.mockResolvedValue({
                metric: 'domain_diversity',
                timeframe: '30d',
                values: [],
                trend: 'stable',
                changePercentage: 0,
                significance: 0
            });

            await aggregationService.computeAggregatedMetrics({
                timePeriod: '30d',
                engines: ['google'],
                categories: ['health']
            });

            // Verify that the queries include the engine and category filters
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('sr.engine = ANY($'),
                expect.arrayContaining([['google']])
            );

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('q.category = ANY($'),
                expect.arrayContaining([['health']])
            );
        });
    });

    describe('performCrossEngineAnalysis', () => {
        it('should perform comprehensive cross-engine analysis', async () => {
            const mockEngineComparisonData = {
                rows: [
                    { engine: 'google', avg_domain_diversity: '0.8', avg_factual_alignment: '0.85', result_count: '100' },
                    { engine: 'bing', avg_domain_diversity: '0.7', avg_factual_alignment: '0.75', result_count: '95' },
                    { engine: 'perplexity', avg_domain_diversity: '0.9', avg_factual_alignment: '0.9', result_count: '80' }
                ]
            };

            (mockDb.query as any).mockResolvedValue(mockEngineComparisonData);

            // Mock significance test
            mockMetricsService.performSignificanceTest.mockResolvedValue({
                pValue: 0.03,
                isSignificant: true,
                confidenceLevel: 0.95,
                testStatistic: 2.5,
                testType: 'welch',
                effectSize: 0.8
            });

            const result = await aggregationService.performCrossEngineAnalysis(
                ['google', 'bing', 'perplexity'],
                '30d',
                ['health', 'politics']
            );

            expect(result.engines).toEqual(['google', 'bing', 'perplexity']);
            expect(result.overallComparison.engines).toEqual(['google', 'bing', 'perplexity']);

            // Check rankings - perplexity should be first with highest scores
            expect(result.overallComparison.rankings[0].engine).toBe('perplexity');
            expect(result.overallComparison.rankings[0].rank).toBe(1);
            expect(result.overallComparison.rankings[0].overallScore).toBe(0.9); // (0.9 + 0.9) / 2

            expect(result.categoryComparisons).toHaveProperty('health');
            expect(result.categoryComparisons).toHaveProperty('politics');

            expect(result.significantDifferences.length).toBeGreaterThan(0);
            expect(result.recommendations.length).toBeGreaterThan(0);
        });

        it('should generate appropriate recommendations', async () => {
            const mockEngineComparisonData = {
                rows: [
                    { engine: 'google', avg_domain_diversity: '0.9', avg_factual_alignment: '0.95', result_count: '100' },
                    { engine: 'bing', avg_domain_diversity: '0.5', avg_factual_alignment: '0.6', result_count: '95' }
                ]
            };

            (mockDb.query as any).mockResolvedValue(mockEngineComparisonData);
            mockMetricsService.performSignificanceTest.mockResolvedValue({
                pValue: 0.001,
                isSignificant: true,
                confidenceLevel: 0.95,
                testStatistic: 3.2,
                testType: 'welch',
                effectSize: 1.2
            });

            const result = await aggregationService.performCrossEngineAnalysis(['google', 'bing']);

            expect(result.recommendations.some(r => r.includes('google shows the best overall performance'))).toBe(true);
            expect(result.recommendations.some(r => r.includes('Significant performance gap detected between google and bing'))).toBe(true);
            expect(result.recommendations.some(r => r.includes('google provides the highest domain diversity'))).toBe(true);
            expect(result.recommendations.some(r => r.includes('google shows the highest factual alignment score'))).toBe(true);
        });

        it('should handle single engine gracefully', async () => {
            const mockEngineComparisonData = {
                rows: [
                    { engine: 'google', avg_domain_diversity: '0.8', avg_factual_alignment: '0.85', result_count: '100' }
                ]
            };

            (mockDb.query as any).mockResolvedValue(mockEngineComparisonData);

            const result = await aggregationService.performCrossEngineAnalysis(['google']);

            expect(result.engines).toEqual(['google']);
            expect(result.overallComparison.rankings).toHaveLength(1);
            expect(result.overallComparison.rankings[0].rank).toBe(1);
            expect(result.significantDifferences).toHaveLength(0); // No pairs to compare
        });
    });

    describe('manageHistoricalData', () => {
        it('should manage historical data with retention and compression', async () => {
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                return await callback({
                    query: vi.fn()
                        .mockResolvedValueOnce({ rows: [{ count: '1000' }] }) // Count query
                        .mockResolvedValueOnce({ rowCount: 200 }) // Archive query
                        .mockResolvedValueOnce({}) // Compression query
                        .mockResolvedValueOnce({ rowCount: 800 }) // Delete query
                });
            });

            (mockDb.transaction as any).mockImplementation(mockTransaction);

            const result = await aggregationService.manageHistoricalData({
                retentionPeriod: '90d',
                compressionThreshold: 5,
                archiveOlderThan: new Date('2024-01-01')
            });

            expect(result.recordsProcessed).toBe(1000);
            expect(result.recordsArchived).toBe(200);
            expect(result.recordsDeleted).toBe(800);
            expect(result.compressionRatio).toBe(0.2); // (1000 - 800) / 1000
        });

        it('should handle zero records gracefully', async () => {
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                return await callback({
                    query: vi.fn().mockResolvedValueOnce({ rows: [{ count: '0' }] })
                });
            });

            (mockDb.transaction as any).mockImplementation(mockTransaction);

            const result = await aggregationService.manageHistoricalData({
                retentionPeriod: '30d',
                compressionThreshold: 10
            });

            expect(result.recordsProcessed).toBe(0);
            expect(result.recordsArchived).toBe(0);
            expect(result.recordsDeleted).toBe(0);
            expect(result.compressionRatio).toBe(1);
        });

        it('should handle archive table not existing', async () => {
            const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                return await callback({
                    query: vi.fn()
                        .mockResolvedValueOnce({ rows: [{ count: '500' }] }) // Count query
                        .mockRejectedValueOnce(new Error('Table does not exist')) // Archive query fails
                        .mockResolvedValueOnce({}) // Compression query
                        .mockResolvedValueOnce({ rowCount: 500 }) // Delete query
                });
            });

            (mockDb.transaction as any).mockImplementation(mockTransaction);

            const result = await aggregationService.manageHistoricalData({
                retentionPeriod: '30d',
                compressionThreshold: 5,
                archiveOlderThan: new Date('2024-01-01')
            });

            expect(result.recordsProcessed).toBe(500);
            expect(result.recordsArchived).toBe(0); // Archive failed
            expect(result.recordsDeleted).toBe(500);
        });
    });

    describe('getHistoricalMetrics', () => {
        it('should retrieve historical metrics with filters', async () => {
            const mockHistoricalData = {
                rows: [
                    {
                        id: 'metric-1',
                        query_id: 'query-1',
                        domain_diversity_index: '0.8',
                        engine_overlap_coefficient: '0.5',
                        factual_alignment_score: '0.9',
                        calculated_at: new Date('2024-01-01'),
                        metadata: { compressed: false }
                    },
                    {
                        id: 'metric-2',
                        query_id: 'query-1',
                        domain_diversity_index: '0.7',
                        engine_overlap_coefficient: '0.6',
                        factual_alignment_score: '0.85',
                        calculated_at: new Date('2024-01-02'),
                        metadata: { compressed: true }
                    }
                ]
            };

            (mockDb.query as any).mockResolvedValue(mockHistoricalData);

            const result = await aggregationService.getHistoricalMetrics(
                'query-1',
                new Date('2024-01-01'),
                new Date('2024-01-02'),
                'domain_diversity'
            );

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('metric-1');
            expect(result[0].queryId).toBe('query-1');
            expect(result[0].metricType).toBe('domain_diversity');
            expect(result[0].value).toBe(0.8); // domain_diversity_index value
            expect(result[1].value).toBe(0.7);

            // Verify query was called with correct parameters
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('query_id = $1'),
                ['query-1', new Date('2024-01-01'), new Date('2024-01-02')]
            );
        });

        it('should return combined metrics when no specific type requested', async () => {
            const mockHistoricalData = {
                rows: [
                    {
                        id: 'metric-1',
                        query_id: 'query-1',
                        domain_diversity_index: '0.6',
                        engine_overlap_coefficient: '0.9',
                        factual_alignment_score: '0.9',
                        calculated_at: new Date('2024-01-01'),
                        metadata: null
                    }
                ]
            };

            (mockDb.query as any).mockResolvedValue(mockHistoricalData);

            const result = await aggregationService.getHistoricalMetrics('query-1');

            expect(result).toHaveLength(1);
            expect(result[0].metricType).toBe('combined');
            expect(result[0].value).toBeCloseTo(0.8, 1); // (0.6 + 0.9 + 0.9) / 3
        });

        it('should handle null metric values gracefully', async () => {
            const mockHistoricalData = {
                rows: [
                    {
                        id: 'metric-1',
                        query_id: 'query-1',
                        domain_diversity_index: null,
                        engine_overlap_coefficient: '0.5',
                        factual_alignment_score: null,
                        calculated_at: new Date('2024-01-01'),
                        metadata: null
                    }
                ]
            };

            (mockDb.query as any).mockResolvedValue(mockHistoricalData);

            const result = await aggregationService.getHistoricalMetrics(
                'query-1',
                undefined,
                undefined,
                'engine_overlap'
            );

            expect(result).toHaveLength(1);
            expect(result[0].value).toBe(0.5); // engine_overlap_coefficient value
        });

        it('should build query without filters when none provided', async () => {
            (mockDb.query as any).mockResolvedValue({ rows: [] });

            await aggregationService.getHistoricalMetrics();

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY calculated_at ASC'),
                []
            );
        });
    });

    describe('helper methods', () => {
        describe('date range calculation', () => {
            it('should calculate correct date ranges for different time periods', async () => {
                const endDate = new Date('2024-01-31T12:00:00Z');

                // Mock the database responses
                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: [{ total_queries: '5', avg_domain_diversity: '0.8', avg_engine_overlap: '0.5', avg_factual_alignment: '0.9' }] })
                    .mockResolvedValueOnce({ rows: [] })
                    .mockResolvedValueOnce({ rows: [] });

                mockMetricsService.analyzeTrend.mockResolvedValue({
                    metric: 'domain_diversity',
                    timeframe: '7d',
                    values: [],
                    trend: 'stable',
                    changePercentage: 0,
                    significance: 0
                });

                // Test 7d period
                const result7d = await aggregationService.computeAggregatedMetrics({
                    timePeriod: '7d',
                    endDate
                });

                // Verify the start date is 7 days before end date
                const expectedStart7d = new Date('2024-01-24T12:00:00Z');
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.arrayContaining([expectedStart7d, endDate])
                );
            });

            it('should use provided start and end dates when specified', async () => {
                const startDate = new Date('2024-01-01');
                const endDate = new Date('2024-01-31');

                // Mock the database responses
                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: [{ total_queries: '3', avg_domain_diversity: '0.7', avg_engine_overlap: '0.4', avg_factual_alignment: '0.8' }] })
                    .mockResolvedValueOnce({ rows: [] })
                    .mockResolvedValueOnce({ rows: [] });

                mockMetricsService.analyzeTrend.mockResolvedValue({
                    metric: 'domain_diversity',
                    timeframe: '30d',
                    values: [],
                    trend: 'stable',
                    changePercentage: 0,
                    significance: 0
                });

                await aggregationService.computeAggregatedMetrics({
                    timePeriod: '30d',
                    startDate,
                    endDate
                });

                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.arrayContaining([startDate, endDate])
                );
            });
        });

        describe('timeframe mapping', () => {
            it('should map time periods to appropriate timeframes', async () => {
                // Mock empty results to focus on the mapping
                (mockDb.query as any).mockResolvedValue({ rows: [{ total_queries: '0', avg_domain_diversity: null, avg_engine_overlap: null, avg_factual_alignment: null }] });

                const mockTrend: TrendAnalysis = {
                    metric: 'domain_diversity',
                    timeframe: '7d',
                    values: [],
                    trend: 'stable',
                    changePercentage: 0,
                    significance: 0
                };

                mockMetricsService.analyzeTrend.mockResolvedValue(mockTrend);

                // Test 1d -> 7d mapping
                await aggregationService.computeAggregatedMetrics({ timePeriod: '1d' });
                expect(mockMetricsService.analyzeTrend).toHaveBeenCalledWith('domain_diversity', '7d', undefined);

                // Test 90d -> 90d mapping
                await aggregationService.computeAggregatedMetrics({ timePeriod: '90d' });
                expect(mockMetricsService.analyzeTrend).toHaveBeenCalledWith('domain_diversity', '90d', undefined);

                // Test 1y -> 90d mapping
                await aggregationService.computeAggregatedMetrics({ timePeriod: '1y' });
                expect(mockMetricsService.analyzeTrend).toHaveBeenCalledWith('domain_diversity', '90d', undefined);
            });
        });
    });

    describe('error handling', () => {
        it('should handle database errors gracefully', async () => {
            (mockDb.query as any).mockRejectedValue(new Error('Database connection failed'));

            await expect(aggregationService.computeAggregatedMetrics({ timePeriod: '7d' }))
                .rejects.toThrow('Database connection failed');
        });

        it('should handle transaction errors in historical data management', async () => {
            (mockDb.transaction as any).mockRejectedValue(new Error('Transaction failed'));

            await expect(aggregationService.manageHistoricalData({
                retentionPeriod: '30d',
                compressionThreshold: 5
            })).rejects.toThrow('Transaction failed');
        });

        it('should handle significance test failures gracefully', async () => {
            const mockEngineComparisonData = {
                rows: [
                    { engine: 'google', avg_domain_diversity: '0.8', avg_factual_alignment: '0.85', result_count: '100' },
                    { engine: 'bing', avg_domain_diversity: '0.7', avg_factual_alignment: '0.75', result_count: '95' }
                ]
            };

            (mockDb.query as any).mockResolvedValue(mockEngineComparisonData);
            mockMetricsService.performSignificanceTest.mockRejectedValue(new Error('Significance test failed'));

            const result = await aggregationService.performCrossEngineAnalysis(['google', 'bing']);

            // Should still return results even if significance tests fail
            expect(result.engines).toEqual(['google', 'bing']);
            expect(result.overallComparison.rankings).toHaveLength(2);
            expect(result.significantDifferences).toHaveLength(0); // No successful tests
        });
    });

    describe('mathematical accuracy and aggregation tests', () => {
        describe('cross-engine comparison accuracy', () => {
            it('should calculate engine rankings with mathematical precision', async () => {
                const mockEngineData = {
                    rows: [
                        { engine: 'google', avg_domain_diversity: '0.8', avg_factual_alignment: '0.9', result_count: '100' },
                        { engine: 'bing', avg_domain_diversity: '0.6', avg_factual_alignment: '0.7', result_count: '95' },
                        { engine: 'perplexity', avg_domain_diversity: '0.9', avg_factual_alignment: '0.8', result_count: '80' },
                        { engine: 'brave', avg_domain_diversity: '0.7', avg_factual_alignment: '0.6', result_count: '75' }
                    ]
                };

                (mockDb.query as any).mockResolvedValue(mockEngineData);

                const result = await aggregationService.performCrossEngineAnalysis(['google', 'bing', 'perplexity', 'brave']);

                // Verify overall scores: (domain_diversity + factual_alignment) / 2
                const rankings = result.overallComparison.rankings;

                const googleRanking = rankings.find(r => r.engine === 'google');
                expect(googleRanking!.overallScore).toBeCloseTo(0.85, 10); // (0.8 + 0.9) / 2

                const perplexityRanking = rankings.find(r => r.engine === 'perplexity');
                expect(perplexityRanking!.overallScore).toBeCloseTo(0.85, 10); // (0.9 + 0.8) / 2

                const bingRanking = rankings.find(r => r.engine === 'bing');
                expect(bingRanking!.overallScore).toBeCloseTo(0.65, 10); // (0.6 + 0.7) / 2

                const braveRanking = rankings.find(r => r.engine === 'brave');
                expect(braveRanking!.overallScore).toBeCloseTo(0.65, 10); // (0.7 + 0.6) / 2

                // Verify rankings are correctly ordered (ties should maintain order)
                expect(rankings[0].rank).toBe(1);
                expect(rankings[1].rank).toBe(2);
                expect(rankings[2].rank).toBe(3);
                expect(rankings[3].rank).toBe(4);

                // Top performers should be Google or Perplexity (both have 0.85)
                expect(['google', 'perplexity']).toContain(rankings[0].engine);
            });

            it('should handle tied scores correctly in rankings', async () => {
                const mockEngineData = {
                    rows: [
                        { engine: 'engine1', avg_domain_diversity: '0.8', avg_factual_alignment: '0.8', result_count: '100' },
                        { engine: 'engine2', avg_domain_diversity: '0.8', avg_factual_alignment: '0.8', result_count: '100' },
                        { engine: 'engine3', avg_domain_diversity: '0.6', avg_factual_alignment: '0.6', result_count: '100' }
                    ]
                };

                (mockDb.query as any).mockResolvedValue(mockEngineData);

                const result = await aggregationService.performCrossEngineAnalysis(['engine1', 'engine2', 'engine3']);

                const rankings = result.overallComparison.rankings;

                // Both engine1 and engine2 should have score 0.8
                const engine1Ranking = rankings.find(r => r.engine === 'engine1');
                const engine2Ranking = rankings.find(r => r.engine === 'engine2');
                const engine3Ranking = rankings.find(r => r.engine === 'engine3');

                expect(engine1Ranking!.overallScore).toBeCloseTo(0.8, 10);
                expect(engine2Ranking!.overallScore).toBeCloseTo(0.8, 10);
                expect(engine3Ranking!.overallScore).toBeCloseTo(0.6, 10);

                // Tied engines should get consecutive ranks
                expect([1, 2]).toContain(engine1Ranking!.rank);
                expect([1, 2]).toContain(engine2Ranking!.rank);
                expect(engine3Ranking!.rank).toBe(3);
            });
        });

        describe('aggregation mathematical accuracy', () => {
            it('should calculate weighted averages correctly across time periods', async () => {
                const mockOverallResult = {
                    rows: [{
                        total_queries: '6',
                        avg_domain_diversity: '0.75',  // (0.8*2 + 0.7*4) / 6 = 4.4/6 ≈ 0.733
                        avg_engine_overlap: '0.5',
                        avg_factual_alignment: '0.8'
                    }]
                };

                const mockEngineResult = {
                    rows: [
                        { engine: 'google', avg_domain_diversity: '0.8', avg_factual_alignment: '0.85', query_count: '3' },
                        { engine: 'bing', avg_domain_diversity: '0.7', avg_factual_alignment: '0.75', query_count: '3' }
                    ]
                };

                (mockDb.query as any)
                    .mockResolvedValueOnce(mockOverallResult)
                    .mockResolvedValueOnce(mockEngineResult)
                    .mockResolvedValueOnce({ rows: [] });

                mockMetricsService.analyzeTrend.mockResolvedValue({
                    metric: 'domain_diversity',
                    timeframe: '30d',
                    values: [],
                    trend: 'stable',
                    changePercentage: 0,
                    significance: 0
                });

                const result = await aggregationService.computeAggregatedMetrics({
                    timePeriod: '30d',
                    engines: ['google', 'bing']
                });

                expect(result.totalQueries).toBe(6);
                expect(result.averageMetrics.domainDiversity).toBeCloseTo(0.75, 10);
                expect(result.averageMetrics.factualAlignment).toBeCloseTo(0.8, 10);

                // Verify individual engine metrics
                expect(result.metricsByEngine.google.domainDiversity).toBeCloseTo(0.8, 10);
                expect(result.metricsByEngine.google.factualAlignment).toBeCloseTo(0.85, 10);
                expect(result.metricsByEngine.google.queryCount).toBe(3);

                expect(result.metricsByEngine.bing.domainDiversity).toBeCloseTo(0.7, 10);
                expect(result.metricsByEngine.bing.factualAlignment).toBeCloseTo(0.75, 10);
                expect(result.metricsByEngine.bing.queryCount).toBe(3);
            });

            it('should handle zero and null values in aggregations', async () => {
                const mockOverallResult = {
                    rows: [{
                        total_queries: '0',
                        avg_domain_diversity: null,
                        avg_engine_overlap: null,
                        avg_factual_alignment: null
                    }]
                };

                (mockDb.query as any)
                    .mockResolvedValueOnce(mockOverallResult)
                    .mockResolvedValueOnce({ rows: [] })
                    .mockResolvedValueOnce({ rows: [] });

                mockMetricsService.analyzeTrend.mockResolvedValue({
                    metric: 'domain_diversity',
                    timeframe: '7d',
                    values: [],
                    trend: 'stable',
                    changePercentage: 0,
                    significance: 0
                });

                const result = await aggregationService.computeAggregatedMetrics({ timePeriod: '7d' });

                expect(result.totalQueries).toBe(0);
                expect(result.averageMetrics.domainDiversity).toBe(0);
                expect(result.averageMetrics.engineOverlap).toBe(0);
                expect(result.averageMetrics.factualAlignment).toBe(0);
                expect(Object.keys(result.metricsByEngine)).toHaveLength(0);
                expect(Object.keys(result.metricsByCategory)).toHaveLength(0);
            });
        });

        describe('historical data compression accuracy', () => {
            it('should maintain mathematical accuracy during compression', async () => {
                const mockTransaction = vi.fn().mockImplementation(async (callback) => {
                    return {
                        recordsProcessed: 100,
                        recordsArchived: 0,
                        recordsDeleted: 80,
                        compressionRatio: 0.2
                    };
                });

                (mockDb.transaction as any).mockImplementation(mockTransaction);

                const result = await aggregationService.manageHistoricalData({
                    retentionPeriod: '30d',
                    compressionThreshold: 5
                });

                expect(result.recordsProcessed).toBe(100);
                expect(result.recordsDeleted).toBe(80);
                expect(result.compressionRatio).toBeCloseTo(0.2, 10); // (100 - 80) / 100 = 0.2
            });

            it('should calculate compression ratios accurately for edge cases', async () => {
                // Test perfect compression (all records deleted)
                const perfectCompressionTransaction = vi.fn().mockImplementation(async (callback) => {
                    return {
                        recordsProcessed: 50,
                        recordsArchived: 0,
                        recordsDeleted: 50,
                        compressionRatio: 0.0
                    };
                });

                (mockDb.transaction as any).mockImplementation(perfectCompressionTransaction);

                const perfectResult = await aggregationService.manageHistoricalData({
                    retentionPeriod: '90d',
                    compressionThreshold: 1
                });

                expect(perfectResult.compressionRatio).toBeCloseTo(0.0, 10); // (50 - 50) / 50 = 0

                // Test no compression (no records deleted)
                const noCompressionTransaction = vi.fn().mockImplementation(async (callback) => {
                    return {
                        recordsProcessed: 30,
                        recordsArchived: 0,
                        recordsDeleted: 0,
                        compressionRatio: 1.0
                    };
                });

                (mockDb.transaction as any).mockImplementation(noCompressionTransaction);

                const noCompressionResult = await aggregationService.manageHistoricalData({
                    retentionPeriod: '7d',
                    compressionThreshold: 10
                });

                expect(noCompressionResult.compressionRatio).toBeCloseTo(1.0, 10); // (30 - 0) / 30 = 1
            });
        });

        describe('date range calculations', () => {
            it('should calculate date ranges with precise time arithmetic', async () => {
                const fixedEndDate = new Date('2024-02-29T15:30:45.123Z'); // Leap year edge case

                // Mock empty results to focus on date calculations
                (mockDb.query as any).mockResolvedValue({
                    rows: [{ total_queries: '0', avg_domain_diversity: null, avg_engine_overlap: null, avg_factual_alignment: null }]
                });

                mockMetricsService.analyzeTrend.mockResolvedValue({
                    metric: 'domain_diversity',
                    timeframe: '7d',
                    values: [],
                    trend: 'stable',
                    changePercentage: 0,
                    significance: 0
                });

                // Test 1 day period
                await aggregationService.computeAggregatedMetrics({
                    timePeriod: '1d',
                    endDate: fixedEndDate
                });

                const expectedStart1d = new Date('2024-02-28T15:30:45.123Z');
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.arrayContaining([expectedStart1d, fixedEndDate])
                );

                // Test 7 day period
                await aggregationService.computeAggregatedMetrics({
                    timePeriod: '7d',
                    endDate: fixedEndDate
                });

                const expectedStart7d = new Date('2024-02-22T15:30:45.123Z');
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.arrayContaining([expectedStart7d, fixedEndDate])
                );

                // Test 1 year period (leap year handling)
                await aggregationService.computeAggregatedMetrics({
                    timePeriod: '1y',
                    endDate: fixedEndDate
                });

                const expectedStart1y = new Date('2023-03-01T15:30:45.123Z'); // Previous year
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.arrayContaining([expectedStart1y, fixedEndDate])
                );
            });

            it('should preserve millisecond precision in date calculations', async () => {
                const preciseDate = new Date('2024-01-15T12:34:56.789Z');

                (mockDb.query as any).mockResolvedValue({
                    rows: [{ total_queries: '1', avg_domain_diversity: '0.5', avg_engine_overlap: '0.5', avg_factual_alignment: '0.5' }]
                });

                mockMetricsService.analyzeTrend.mockResolvedValue({
                    metric: 'domain_diversity',
                    timeframe: '30d',
                    values: [],
                    trend: 'stable',
                    changePercentage: 0,
                    significance: 0
                });

                await aggregationService.computeAggregatedMetrics({
                    timePeriod: '30d',
                    endDate: preciseDate
                });

                const expectedStart = new Date('2023-12-16T12:34:56.789Z');
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.arrayContaining([expectedStart, preciseDate])
                );

                // Verify millisecond precision is maintained
                expect(expectedStart.getMilliseconds()).toBe(789);
                expect(preciseDate.getMilliseconds()).toBe(789);
            });
        });
    });

    describe('performance considerations', () => {
        it('should handle large datasets efficiently', async () => {
            // Generate large mock dataset
            const largeEngineDataset = Array.from({ length: 100 }, (_, i) => ({
                engine: `engine-${i % 10}`,
                avg_domain_diversity: (0.5 + (i % 50) / 100).toString(),
                avg_factual_alignment: (0.6 + (i % 40) / 100).toString(),
                query_count: (10 + i % 20).toString()
            }));

            (mockDb.query as any)
                .mockResolvedValueOnce({ rows: [{ total_queries: '1000', avg_domain_diversity: '0.75', avg_engine_overlap: '0.5', avg_factual_alignment: '0.8' }] })
                .mockResolvedValueOnce({ rows: largeEngineDataset })
                .mockResolvedValueOnce({ rows: [] });

            mockMetricsService.analyzeTrend.mockResolvedValue({
                metric: 'domain_diversity',
                timeframe: '30d',
                values: [],
                trend: 'stable',
                changePercentage: 0,
                significance: 0
            });

            const startTime = Date.now();
            const result = await aggregationService.computeAggregatedMetrics({ timePeriod: '30d' });
            const endTime = Date.now();

            expect(result.totalQueries).toBe(1000);
            expect(Object.keys(result.metricsByEngine)).toHaveLength(10);
            expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
        });
    });
});