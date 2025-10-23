import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsService } from '../services/metrics-service';
import { DatabaseConnection } from '../database/connection';
import type { BiasMetrics, DomainDiversityMetric, EngineOverlapMetric, FactualAlignmentMetric } from '../types/metrics';

// Mock database connection
const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    healthCheck: vi.fn(),
    getClient: vi.fn()
} as unknown as DatabaseConnection;

describe('MetricsService', () => {
    let metricsService: MetricsService;

    beforeEach(() => {
        vi.clearAllMocks();
        metricsService = new MetricsService(mockDb);
    });

    describe('calculateDomainDiversity', () => {
        it('should calculate domain diversity index correctly', async () => {
            const mockResults = [
                { url: 'https://example.com/page1', engine: 'google', count: '2' },
                { url: 'https://test.org/article', engine: 'bing', count: '1' },
                { url: 'https://news.com/story', engine: 'google', count: '1' },
                { url: 'https://example.com/page2', engine: 'perplexity', count: '1' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateDomainDiversity('test-query-id');

            expect(result.uniqueDomains).toBe(3); // example.com, test.org, news.com
            expect(result.totalResults).toBe(5); // 2 + 1 + 1 + 1
            expect(result.diversityIndex).toBe(0.6); // 3/5
            expect(result.topDomains).toHaveLength(3);
            expect(result.topDomains[0]).toEqual({
                domain: 'example.com',
                count: 3, // 2 + 1 from same domain
                percentage: 60 // 3/5 * 100
            });
        });

        it('should handle empty results', async () => {
            (mockDb.query as any).mockResolvedValue({ rows: [] });

            const result = await metricsService.calculateDomainDiversity('empty-query-id');

            expect(result.uniqueDomains).toBe(0);
            expect(result.totalResults).toBe(0);
            expect(result.diversityIndex).toBe(0);
            expect(result.topDomains).toHaveLength(0);
        });

        it('should handle invalid URLs gracefully', async () => {
            const mockResults = [
                { url: 'https://example.com/page1', engine: 'google', count: '1' },
                { url: 'invalid-url', engine: 'bing', count: '1' },
                { url: 'https://test.org/article', engine: 'google', count: '1' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateDomainDiversity('test-query-id');

            // Should only count valid URLs
            expect(result.uniqueDomains).toBe(2); // example.com, test.org
            expect(result.totalResults).toBe(2); // Invalid URL excluded
            expect(result.diversityIndex).toBe(1.0); // 2/2
        });

        it('should remove www prefix from domains', async () => {
            const mockResults = [
                { url: 'https://www.example.com/page1', engine: 'google', count: '1' },
                { url: 'https://example.com/page2', engine: 'bing', count: '1' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateDomainDiversity('test-query-id');

            expect(result.uniqueDomains).toBe(1); // Both should be counted as example.com
            expect(result.topDomains[0].domain).toBe('example.com');
            expect(result.topDomains[0].count).toBe(2);
        });
    });

    describe('calculateEngineOverlap', () => {
        it('should calculate engine overlap coefficient correctly', async () => {
            const mockResults = [
                { url: 'https://example.com/page1', engine: 'google' },
                { url: 'https://example.com/page1', engine: 'bing' }, // Shared
                { url: 'https://test.org/article', engine: 'google' },
                { url: 'https://news.com/story', engine: 'bing' },
                { url: 'https://unique.com/page', engine: 'perplexity' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateEngineOverlap('test-query-id');

            expect(result.totalUniqueUrls).toBe(4); // 4 unique URLs
            expect(result.sharedUrls).toBe(1); // Only example.com/page1 is shared
            expect(result.overlapCoefficient).toBe(0.25); // 1/4
            expect(result.enginePairs).toHaveLength(3); // google-bing, google-perplexity, bing-perplexity
        });

        it('should handle empty results', async () => {
            (mockDb.query as any).mockResolvedValue({ rows: [] });

            const result = await metricsService.calculateEngineOverlap('empty-query-id');

            expect(result.totalUniqueUrls).toBe(0);
            expect(result.sharedUrls).toBe(0);
            expect(result.overlapCoefficient).toBe(0);
            expect(result.enginePairs).toHaveLength(0);
        });

        it('should calculate pairwise overlaps correctly', async () => {
            const mockResults = [
                { url: 'https://shared.com/page1', engine: 'google' },
                { url: 'https://shared.com/page1', engine: 'bing' },
                { url: 'https://shared.com/page2', engine: 'google' },
                { url: 'https://shared.com/page2', engine: 'bing' },
                { url: 'https://google-only.com/page', engine: 'google' },
                { url: 'https://bing-only.com/page', engine: 'bing' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateEngineOverlap('test-query-id');

            const googleBingPair = result.enginePairs.find(
                pair => pair.engines.includes('google') && pair.engines.includes('bing')
            );

            expect(googleBingPair).toBeDefined();
            expect(googleBingPair!.sharedCount).toBe(2); // 2 shared URLs
            expect(googleBingPair!.overlapPercentage).toBe(50); // 2/4 * 100
        });
    });

    describe('calculateFactualAlignment', () => {
        it('should calculate factual alignment score correctly', async () => {
            const mockResults = [
                { factual_score: '0.8', confidence_score: '0.9', engine: 'google' },
                { factual_score: '0.6', confidence_score: '0.7', engine: 'bing' },
                { factual_score: '0.9', confidence_score: '0.8', engine: 'perplexity' },
                { factual_score: '0.7', confidence_score: '0.6', engine: 'brave' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateFactualAlignment('test-query-id');

            // Average score: (0.8 + 0.6 + 0.9 + 0.7) / 4 = 0.75
            expect(result.averageScore).toBe(0.75);

            // Weighted score: (0.8*0.9 + 0.6*0.7 + 0.9*0.8 + 0.7*0.6) / (0.9+0.7+0.8+0.6)
            // = (0.72 + 0.42 + 0.72 + 0.42) / 3.0 = 2.28 / 3.0 = 0.76
            expect(result.weightedScore).toBeCloseTo(0.76, 2);

            // Confidence level: (0.9 + 0.7 + 0.8 + 0.6) / 4 = 0.75
            expect(result.confidenceLevel).toBeCloseTo(0.75, 2);

            expect(result.scoreDistribution).toHaveLength(5);
        });

        it('should handle empty results', async () => {
            (mockDb.query as any).mockResolvedValue({ rows: [] });

            const result = await metricsService.calculateFactualAlignment('empty-query-id');

            expect(result.averageScore).toBe(0);
            expect(result.weightedScore).toBe(0);
            expect(result.confidenceLevel).toBe(0);
            expect(result.scoreDistribution).toHaveLength(0);
        });

        it('should create correct score distribution', async () => {
            const mockResults = [
                { factual_score: '0.1', confidence_score: '0.8', engine: 'google' }, // 0.0-0.2
                { factual_score: '0.3', confidence_score: '0.7', engine: 'bing' },   // 0.2-0.4
                { factual_score: '0.5', confidence_score: '0.9', engine: 'perplexity' }, // 0.4-0.6
                { factual_score: '0.7', confidence_score: '0.6', engine: 'brave' },  // 0.6-0.8
                { factual_score: '0.9', confidence_score: '0.8', engine: 'google' }  // 0.8-1.0
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateFactualAlignment('test-query-id');

            expect(result.scoreDistribution).toHaveLength(5);

            // Each range should have 1 result (20%)
            result.scoreDistribution.forEach(range => {
                expect(range.count).toBe(1);
                expect(range.percentage).toBe(20);
            });
        });

        it('should handle zero confidence weights', async () => {
            const mockResults = [
                { factual_score: '0.8', confidence_score: '0.0', engine: 'google' },
                { factual_score: '0.6', confidence_score: '0.0', engine: 'bing' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateFactualAlignment('test-query-id');

            // When total weight is 0, should fall back to average score
            expect(result.weightedScore).toBe(result.averageScore);
        });
    });

    describe('calculateBiasMetrics', () => {
        it('should calculate all bias metrics successfully', async () => {
            // Mock domain diversity query
            const domainResults = [
                { url: 'https://example.com/page1', engine: 'google', count: '1' },
                { url: 'https://test.org/article', engine: 'bing', count: '1' }
            ];

            // Mock engine overlap query
            const overlapResults = [
                { url: 'https://example.com/page1', engine: 'google' },
                { url: 'https://example.com/page1', engine: 'bing' },
                { url: 'https://test.org/article', engine: 'google' }
            ];

            // Mock factual alignment query
            const factualResults = [
                { factual_score: '0.8', confidence_score: '0.9', engine: 'google' },
                { factual_score: '0.6', confidence_score: '0.7', engine: 'bing' }
            ];

            (mockDb.query as any)
                .mockResolvedValueOnce({ rows: domainResults })
                .mockResolvedValueOnce({ rows: overlapResults })
                .mockResolvedValueOnce({ rows: factualResults });

            const result = await metricsService.calculateBiasMetrics('test-query-id');

            expect(result.queryId).toBe('test-query-id');
            expect(result.domainDiversityIndex).toBe(1.0); // 2 unique domains / 2 total results
            expect(result.engineOverlapCoefficient).toBe(0.5); // 1 shared / 2 unique
            expect(result.factualAlignmentScore).toBeCloseTo(0.7125, 2); // Weighted average
            expect(result.calculatedAt).toBeInstanceOf(Date);
        });

        it('should handle calculation errors gracefully', async () => {
            (mockDb.query as any).mockRejectedValue(new Error('Database error'));

            await expect(metricsService.calculateBiasMetrics('test-query-id'))
                .rejects.toThrow('Bias metrics calculation failed');
        });
    });

    describe('calculateBiasMetricsForQueries', () => {
        it('should calculate metrics for multiple queries', async () => {
            const queryIds = ['query-1', 'query-2'];

            // Mock successful calculations for both queries
            (mockDb.query as any)
                .mockResolvedValueOnce({ rows: [{ url: 'https://example.com', engine: 'google', count: '1' }] })
                .mockResolvedValueOnce({ rows: [{ url: 'https://example.com', engine: 'google' }] })
                .mockResolvedValueOnce({ rows: [{ factual_score: '0.8', confidence_score: '0.9', engine: 'google' }] })
                .mockResolvedValueOnce({ rows: [{ url: 'https://test.org', engine: 'bing', count: '1' }] })
                .mockResolvedValueOnce({ rows: [{ url: 'https://test.org', engine: 'bing' }] })
                .mockResolvedValueOnce({ rows: [{ factual_score: '0.6', confidence_score: '0.7', engine: 'bing' }] });

            const results = await metricsService.calculateBiasMetricsForQueries(queryIds);

            expect(results).toHaveLength(2);
            expect(results[0].queryId).toBe('query-1');
            expect(results[1].queryId).toBe('query-2');
        });

        it('should continue processing even if one query fails', async () => {
            const queryIds = ['query-1', 'query-2'];

            // First query fails, second succeeds
            (mockDb.query as any)
                .mockRejectedValueOnce(new Error('Database error'))
                .mockRejectedValueOnce(new Error('Database error'))
                .mockRejectedValueOnce(new Error('Database error'))
                .mockResolvedValueOnce({ rows: [{ url: 'https://test.org', engine: 'bing', count: '1' }] })
                .mockResolvedValueOnce({ rows: [{ url: 'https://test.org', engine: 'bing' }] })
                .mockResolvedValueOnce({ rows: [{ factual_score: '0.6', confidence_score: '0.7', engine: 'bing' }] });

            const results = await metricsService.calculateBiasMetricsForQueries(queryIds);

            expect(results).toHaveLength(1); // Only successful query
            expect(results[0].queryId).toBe('query-2');
        });
    });

    describe('detailed analysis methods', () => {
        it('should return detailed domain diversity analysis', async () => {
            const mockResults = [
                { url: 'https://example.com/page1', engine: 'google', count: '2' },
                { url: 'https://test.org/article', engine: 'bing', count: '1' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.getDomainDiversityAnalysis('test-query-id');

            expect(result.uniqueDomains).toBe(2);
            expect(result.totalResults).toBe(3);
            expect(result.diversityIndex).toBeCloseTo(0.667, 2);
            expect(result.topDomains).toHaveLength(2);
        });

        it('should return detailed engine overlap analysis', async () => {
            const mockResults = [
                { url: 'https://example.com/page1', engine: 'google' },
                { url: 'https://example.com/page1', engine: 'bing' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.getEngineOverlapAnalysis('test-query-id');

            expect(result.totalUniqueUrls).toBe(1);
            expect(result.sharedUrls).toBe(1);
            expect(result.overlapCoefficient).toBe(1.0);
            expect(result.enginePairs).toHaveLength(1);
        });

        it('should return detailed factual alignment analysis', async () => {
            const mockResults = [
                { factual_score: '0.8', confidence_score: '0.9', engine: 'google' },
                { factual_score: '0.6', confidence_score: '0.7', engine: 'bing' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.getFactualAlignmentAnalysis('test-query-id');

            expect(result.averageScore).toBe(0.7);
            expect(result.confidenceLevel).toBe(0.8);
            expect(result.scoreDistribution).toHaveLength(5);
        });
    });

    describe('trend analysis and historical tracking', () => {
        describe('calculateRollingAverages', () => {
            it('should calculate 7-day and 30-day rolling averages', async () => {
                const mockResults = [
                    { date: '2024-01-01', daily_value: '0.8', daily_count: '5', rolling_avg_7d: '0.8', sample_size_7d: '1', rolling_avg_30d: '0.8', sample_size_30d: '1' },
                    { date: '2024-01-02', daily_value: '0.7', daily_count: '4', rolling_avg_7d: '0.75', sample_size_7d: '2', rolling_avg_30d: '0.75', sample_size_30d: '2' },
                    { date: '2024-01-03', daily_value: '0.9', daily_count: '6', rolling_avg_7d: '0.8', sample_size_7d: '3', rolling_avg_30d: '0.8', sample_size_30d: '3' }
                ];

                (mockDb.query as any).mockResolvedValue({ rows: mockResults });

                const result = await metricsService.calculateRollingAverages('domain_diversity');

                expect(result).toHaveLength(3);
                expect(result[0]).toEqual({
                    date: new Date('2024-01-01'),
                    value: 0.8,
                    rollingAverage7d: 0.8,
                    rollingAverage30d: 0.8,
                    sampleSize7d: 1,
                    sampleSize30d: 1
                });
                expect(result[2].rollingAverage7d).toBe(0.8);
            });

            it('should handle empty results gracefully', async () => {
                (mockDb.query as any).mockResolvedValue({ rows: [] });

                const result = await metricsService.calculateRollingAverages('engine_overlap');

                expect(result).toHaveLength(0);
            });
        });

        describe('performSignificanceTest', () => {
            it('should perform statistical significance test between periods', async () => {
                const period1Data = [
                    { value: '0.8' }, { value: '0.7' }, { value: '0.9' }, { value: '0.6' }
                ];
                const period2Data = [
                    { value: '0.5' }, { value: '0.4' }, { value: '0.6' }, { value: '0.3' }
                ];

                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: period1Data })
                    .mockResolvedValueOnce({ rows: period2Data });

                const result = await metricsService.performSignificanceTest(
                    'factual_alignment',
                    new Date('2024-01-01'),
                    new Date('2024-01-07'),
                    new Date('2024-01-08'),
                    new Date('2024-01-14')
                );

                expect(result.testType).toBe('welch');
                expect(result.confidenceLevel).toBe(0.95);
                expect(typeof result.pValue).toBe('number');
                expect(typeof result.testStatistic).toBe('number');
                expect(typeof result.effectSize).toBe('number');
                expect(typeof result.isSignificant).toBe('boolean');
            });

            it('should handle insufficient data gracefully', async () => {
                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: [{ value: '0.8' }] }) // Only 1 data point
                    .mockResolvedValueOnce({ rows: [{ value: '0.5' }] }); // Only 1 data point

                const result = await metricsService.performSignificanceTest(
                    'domain_diversity',
                    new Date('2024-01-01'),
                    new Date('2024-01-07'),
                    new Date('2024-01-08'),
                    new Date('2024-01-14')
                );

                expect(result.pValue).toBe(1.0);
                expect(result.isSignificant).toBe(false);
                expect(result.testStatistic).toBe(0);
                expect(result.effectSize).toBe(0);
            });
        });

        describe('detectAnomalies', () => {
            it('should detect anomalies using statistical thresholds', async () => {
                const mockResults = [
                    { date: '2024-01-01', daily_value: '0.8', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                    { date: '2024-01-02', daily_value: '0.7', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                    { date: '2024-01-03', daily_value: '0.3', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' }, // Anomaly
                    { date: '2024-01-04', daily_value: '0.9', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' }
                ];

                (mockDb.query as any).mockResolvedValue({ rows: mockResults });

                const result = await metricsService.detectAnomalies('domain_diversity', undefined, 30, 2.0);

                expect(result).toHaveLength(4);

                // Check that the anomaly is detected (value 0.3 vs expected 0.8 with stddev 0.1)
                const anomaly = result.find(r => r.value === 0.3);
                expect(anomaly).toBeDefined();
                expect(anomaly!.isAnomaly).toBe(true);
                expect(anomaly!.severity).toBe('high'); // 5 standard deviations away

                // Check normal values are not flagged
                const normal = result.find(r => r.value === 0.7);
                expect(normal!.isAnomaly).toBe(false);
            });

            it('should handle zero standard deviation gracefully', async () => {
                const mockResults = [
                    { date: '2024-01-01', daily_value: '0.8', rolling_mean: '0.8', rolling_stddev: '0.0', window_size: '7' }
                ];

                (mockDb.query as any).mockResolvedValue({ rows: mockResults });

                const result = await metricsService.detectAnomalies('engine_overlap');

                expect(result).toHaveLength(1);
                expect(result[0].isAnomaly).toBe(false);
                expect(result[0].deviation).toBe(0);
            });
        });

        describe('analyzeTrend', () => {
            it('should analyze trend direction and significance', async () => {
                const mockRollingData = [
                    { date: new Date('2024-01-01'), value: 0.5, rollingAverage7d: 0.5, rollingAverage30d: 0.5, sampleSize7d: 1, sampleSize30d: 1 },
                    { date: new Date('2024-01-02'), value: 0.6, rollingAverage7d: 0.55, rollingAverage30d: 0.55, sampleSize7d: 2, sampleSize30d: 2 },
                    { date: new Date('2024-01-03'), value: 0.7, rollingAverage7d: 0.6, rollingAverage30d: 0.6, sampleSize7d: 3, sampleSize30d: 3 },
                    { date: new Date('2024-01-04'), value: 0.8, rollingAverage7d: 0.65, rollingAverage30d: 0.65, sampleSize7d: 4, sampleSize30d: 4 }
                ];

                // Mock the calculateRollingAverages method
                vi.spyOn(metricsService, 'calculateRollingAverages').mockResolvedValue(mockRollingData);

                const result = await metricsService.analyzeTrend('factual_alignment', '7d');

                expect(result.metric).toBe('factual_alignment');
                expect(result.timeframe).toBe('7d');
                expect(result.trend).toBe('increasing'); // 60% increase from 0.5 to 0.8
                expect(result.changePercentage).toBeCloseTo(60, 1);
                expect(result.significance).toBeGreaterThan(0.9); // Strong positive correlation
                expect(result.values).toHaveLength(4);
            });

            it('should detect decreasing trends', async () => {
                const mockRollingData = [
                    { date: new Date('2024-01-01'), value: 0.8, rollingAverage7d: 0.8, rollingAverage30d: 0.8, sampleSize7d: 1, sampleSize30d: 1 },
                    { date: new Date('2024-01-02'), value: 0.6, rollingAverage7d: 0.7, rollingAverage30d: 0.7, sampleSize7d: 2, sampleSize30d: 2 },
                    { date: new Date('2024-01-03'), value: 0.4, rollingAverage7d: 0.6, rollingAverage30d: 0.6, sampleSize7d: 3, sampleSize30d: 3 }
                ];

                vi.spyOn(metricsService, 'calculateRollingAverages').mockResolvedValue(mockRollingData);

                const result = await metricsService.analyzeTrend('domain_diversity', '30d');

                expect(result.trend).toBe('decreasing'); // 50% decrease from 0.8 to 0.4
                expect(result.changePercentage).toBe(-50);
            });

            it('should detect stable trends', async () => {
                const mockRollingData = [
                    { date: new Date('2024-01-01'), value: 0.8, rollingAverage7d: 0.8, rollingAverage30d: 0.8, sampleSize7d: 1, sampleSize30d: 1 },
                    { date: new Date('2024-01-02'), value: 0.82, rollingAverage7d: 0.81, rollingAverage30d: 0.81, sampleSize7d: 2, sampleSize30d: 2 },
                    { date: new Date('2024-01-03'), value: 0.79, rollingAverage7d: 0.8, rollingAverage30d: 0.8, sampleSize7d: 3, sampleSize30d: 3 }
                ];

                vi.spyOn(metricsService, 'calculateRollingAverages').mockResolvedValue(mockRollingData);

                const result = await metricsService.analyzeTrend('engine_overlap', '7d');

                expect(result.trend).toBe('stable'); // Less than 5% change
                expect(Math.abs(result.changePercentage)).toBeLessThan(5);
            });

            it('should handle insufficient data', async () => {
                vi.spyOn(metricsService, 'calculateRollingAverages').mockResolvedValue([]);

                const result = await metricsService.analyzeTrend('factual_alignment', '7d');

                expect(result.trend).toBe('stable');
                expect(result.changePercentage).toBe(0);
                expect(result.significance).toBe(0);
                expect(result.values).toHaveLength(0);
            });
        });

        describe('calculateAndStoreBiasMetrics', () => {
            it('should calculate and store bias metrics for trend analysis', async () => {
                // Mock the individual metric calculations
                const domainResults = [{ url: 'https://example.com', engine: 'google', count: '1' }];
                const overlapResults = [{ url: 'https://example.com', engine: 'google' }];
                const factualResults = [{ factual_score: '0.8', confidence_score: '0.9', engine: 'google' }];

                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: domainResults })
                    .mockResolvedValueOnce({ rows: overlapResults })
                    .mockResolvedValueOnce({ rows: factualResults })
                    .mockResolvedValueOnce({ rows: [] }); // Insert query

                const result = await metricsService.calculateAndStoreBiasMetrics('test-query-id');

                expect(result.queryId).toBe('test-query-id');
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO bias_metrics'),
                    expect.arrayContaining(['test-query-id'])
                );
            });
        });
    });

    describe('mathematical accuracy tests', () => {
        describe('domain diversity formula validation', () => {
            it('should calculate DDI = unique_domains / total_results with perfect accuracy', async () => {
                const testCases = [
                    {
                        name: 'perfect diversity',
                        results: [
                            { url: 'https://a.com/1', engine: 'google', count: '1' },
                            { url: 'https://b.com/1', engine: 'bing', count: '1' },
                            { url: 'https://c.com/1', engine: 'perplexity', count: '1' }
                        ],
                        expected: { uniqueDomains: 3, totalResults: 3, diversityIndex: 1.0 }
                    },
                    {
                        name: 'no diversity',
                        results: [
                            { url: 'https://same.com/1', engine: 'google', count: '1' },
                            { url: 'https://same.com/2', engine: 'bing', count: '1' },
                            { url: 'https://same.com/3', engine: 'perplexity', count: '1' }
                        ],
                        expected: { uniqueDomains: 1, totalResults: 3, diversityIndex: 1 / 3 }
                    },
                    {
                        name: 'weighted counts',
                        results: [
                            { url: 'https://heavy.com/1', engine: 'google', count: '5' },
                            { url: 'https://light.com/1', engine: 'bing', count: '1' }
                        ],
                        expected: { uniqueDomains: 2, totalResults: 6, diversityIndex: 2 / 6 }
                    }
                ];

                for (const testCase of testCases) {
                    (mockDb.query as any).mockResolvedValueOnce({ rows: testCase.results });

                    const result = await metricsService.calculateDomainDiversity('test-query');

                    expect(result.uniqueDomains).toBe(testCase.expected.uniqueDomains);
                    expect(result.totalResults).toBe(testCase.expected.totalResults);
                    expect(result.diversityIndex).toBeCloseTo(testCase.expected.diversityIndex, 10);
                }
            });

            it('should handle edge case of zero results', async () => {
                (mockDb.query as any).mockResolvedValue({ rows: [] });

                const result = await metricsService.calculateDomainDiversity('empty-query');

                expect(result.diversityIndex).toBe(0);
                expect(result.uniqueDomains).toBe(0);
                expect(result.totalResults).toBe(0);
            });
        });

        describe('engine overlap formula validation', () => {
            it('should calculate EOC = shared_urls / total_unique_urls with perfect accuracy', async () => {
                const testCases = [
                    {
                        name: 'complete overlap',
                        results: [
                            { url: 'https://shared.com/1', engine: 'google' },
                            { url: 'https://shared.com/1', engine: 'bing' },
                            { url: 'https://shared.com/2', engine: 'google' },
                            { url: 'https://shared.com/2', engine: 'bing' }
                        ],
                        expected: { sharedUrls: 2, totalUniqueUrls: 2, overlapCoefficient: 1.0 }
                    },
                    {
                        name: 'no overlap',
                        results: [
                            { url: 'https://google-only.com/1', engine: 'google' },
                            { url: 'https://bing-only.com/1', engine: 'bing' }
                        ],
                        expected: { sharedUrls: 0, totalUniqueUrls: 2, overlapCoefficient: 0.0 }
                    },
                    {
                        name: 'partial overlap',
                        results: [
                            { url: 'https://shared.com/1', engine: 'google' },
                            { url: 'https://shared.com/1', engine: 'bing' },
                            { url: 'https://google-only.com/1', engine: 'google' },
                            { url: 'https://bing-only.com/1', engine: 'bing' }
                        ],
                        expected: { sharedUrls: 1, totalUniqueUrls: 3, overlapCoefficient: 1 / 3 }
                    }
                ];

                for (const testCase of testCases) {
                    (mockDb.query as any).mockResolvedValueOnce({ rows: testCase.results });

                    const result = await metricsService.calculateEngineOverlap('test-query');

                    expect(result.sharedUrls).toBe(testCase.expected.sharedUrls);
                    expect(result.totalUniqueUrls).toBe(testCase.expected.totalUniqueUrls);
                    expect(result.overlapCoefficient).toBeCloseTo(testCase.expected.overlapCoefficient, 10);
                }
            });

            it('should calculate pairwise overlaps with mathematical precision', async () => {
                const mockResults = [
                    { url: 'https://all-three.com/1', engine: 'google' },
                    { url: 'https://all-three.com/1', engine: 'bing' },
                    { url: 'https://all-three.com/1', engine: 'perplexity' },
                    { url: 'https://google-bing.com/1', engine: 'google' },
                    { url: 'https://google-bing.com/1', engine: 'bing' },
                    { url: 'https://google-only.com/1', engine: 'google' }
                ];

                (mockDb.query as any).mockResolvedValue({ rows: mockResults });

                const result = await metricsService.calculateEngineOverlap('test-query');

                // Google-Bing: 2 shared (all-three, google-bing) out of 3 total (all-three, google-bing, google-only)
                const googleBingPair = result.enginePairs.find(
                    pair => pair.engines.includes('google') && pair.engines.includes('bing')
                );
                expect(googleBingPair!.sharedCount).toBe(2);
                expect(googleBingPair!.overlapPercentage).toBeCloseTo(66.67, 1); // 2/3 * 100

                // Google-Perplexity: 1 shared (all-three) out of 3 total (all-three, google-bing, google-only)
                const googlePerplexityPair = result.enginePairs.find(
                    pair => pair.engines.includes('google') && pair.engines.includes('perplexity')
                );
                expect(googlePerplexityPair!.sharedCount).toBe(1);
                expect(googlePerplexityPair!.overlapPercentage).toBeCloseTo(33.33, 1); // 1/3 * 100
            });
        });

        describe('factual alignment formula validation', () => {
            it('should calculate FAS = weighted_average(factual_scores) with perfect accuracy', async () => {
                const testCases = [
                    {
                        name: 'equal weights',
                        results: [
                            { factual_score: '0.8', confidence_score: '1.0', engine: 'google' },
                            { factual_score: '0.6', confidence_score: '1.0', engine: 'bing' }
                        ],
                        expected: {
                            averageScore: 0.7,
                            weightedScore: 0.7, // (0.8*1.0 + 0.6*1.0) / (1.0+1.0) = 1.4/2.0 = 0.7
                            confidenceLevel: 1.0
                        }
                    },
                    {
                        name: 'different weights',
                        results: [
                            { factual_score: '0.9', confidence_score: '0.8', engine: 'google' },
                            { factual_score: '0.3', confidence_score: '0.2', engine: 'bing' }
                        ],
                        expected: {
                            averageScore: 0.6, // (0.9 + 0.3) / 2 = 0.6
                            weightedScore: 0.78, // (0.9*0.8 + 0.3*0.2) / (0.8+0.2) = (0.72+0.06)/1.0 = 0.78
                            confidenceLevel: 0.5 // (0.8 + 0.2) / 2 = 0.5
                        }
                    },
                    {
                        name: 'zero confidence fallback',
                        results: [
                            { factual_score: '0.8', confidence_score: '0.0', engine: 'google' },
                            { factual_score: '0.4', confidence_score: '0.0', engine: 'bing' }
                        ],
                        expected: {
                            averageScore: 0.6, // (0.8 + 0.4) / 2 = 0.6
                            weightedScore: 0.6, // Should fall back to average when total weight is 0
                            confidenceLevel: 0.0
                        }
                    }
                ];

                for (const testCase of testCases) {
                    (mockDb.query as any).mockResolvedValueOnce({ rows: testCase.results });

                    const result = await metricsService.calculateFactualAlignment('test-query');

                    expect(result.averageScore).toBeCloseTo(testCase.expected.averageScore, 10);
                    expect(result.weightedScore).toBeCloseTo(testCase.expected.weightedScore, 10);
                    expect(result.confidenceLevel).toBeCloseTo(testCase.expected.confidenceLevel, 10);
                }
            });

            it('should create accurate score distribution', async () => {
                const mockResults = [
                    { factual_score: '0.05', confidence_score: '0.8', engine: 'google' },   // 0.0-0.2
                    { factual_score: '0.15', confidence_score: '0.7', engine: 'bing' },     // 0.0-0.2
                    { factual_score: '0.35', confidence_score: '0.9', engine: 'perplexity' }, // 0.2-0.4
                    { factual_score: '0.55', confidence_score: '0.6', engine: 'brave' },    // 0.4-0.6
                    { factual_score: '0.75', confidence_score: '0.8', engine: 'google' },   // 0.6-0.8
                    { factual_score: '0.95', confidence_score: '0.9', engine: 'bing' }      // 0.8-1.0
                ];

                (mockDb.query as any).mockResolvedValue({ rows: mockResults });

                const result = await metricsService.calculateFactualAlignment('test-query');

                expect(result.scoreDistribution).toHaveLength(5);

                // Check each range has correct count and percentage
                const range0_2 = result.scoreDistribution.find(r => r.range === '0.0-0.2');
                expect(range0_2!.count).toBe(2);
                expect(range0_2!.percentage).toBeCloseTo(33.33, 1); // 2/6 * 100

                const range2_4 = result.scoreDistribution.find(r => r.range === '0.2-0.4');
                expect(range2_4!.count).toBe(1);
                expect(range2_4!.percentage).toBeCloseTo(16.67, 1); // 1/6 * 100

                const range8_10 = result.scoreDistribution.find(r => r.range === '0.8-1.0');
                expect(range8_10!.count).toBe(1);
                expect(range8_10!.percentage).toBeCloseTo(16.67, 1); // 1/6 * 100
            });
        });
    });

    describe('statistical methods accuracy', () => {
        describe('correlation calculation', () => {
            it('should calculate Pearson correlation coefficient accurately', async () => {
                // Test perfect positive correlation
                const mockRollingData = [
                    { date: new Date('2024-01-01'), value: 1, rollingAverage7d: 1, rollingAverage30d: 1, sampleSize7d: 1, sampleSize30d: 1 },
                    { date: new Date('2024-01-02'), value: 2, rollingAverage7d: 1.5, rollingAverage30d: 1.5, sampleSize7d: 2, sampleSize30d: 2 },
                    { date: new Date('2024-01-03'), value: 3, rollingAverage7d: 2, rollingAverage30d: 2, sampleSize7d: 3, sampleSize30d: 3 },
                    { date: new Date('2024-01-04'), value: 4, rollingAverage7d: 2.5, rollingAverage30d: 2.5, sampleSize7d: 4, sampleSize30d: 4 }
                ];

                vi.spyOn(metricsService, 'calculateRollingAverages').mockResolvedValue(mockRollingData);

                const result = await metricsService.analyzeTrend('domain_diversity', '7d');

                expect(result.significance).toBeCloseTo(1.0, 2); // Perfect positive correlation
                expect(result.trend).toBe('increasing');
                expect(result.changePercentage).toBe(300); // 300% increase from 1 to 4
            });

            it('should calculate perfect negative correlation', async () => {
                const mockRollingData = [
                    { date: new Date('2024-01-01'), value: 4, rollingAverage7d: 4, rollingAverage30d: 4, sampleSize7d: 1, sampleSize30d: 1 },
                    { date: new Date('2024-01-02'), value: 3, rollingAverage7d: 3.5, rollingAverage30d: 3.5, sampleSize7d: 2, sampleSize30d: 2 },
                    { date: new Date('2024-01-03'), value: 2, rollingAverage7d: 3, rollingAverage30d: 3, sampleSize7d: 3, sampleSize30d: 3 },
                    { date: new Date('2024-01-04'), value: 1, rollingAverage7d: 2.5, rollingAverage30d: 2.5, sampleSize7d: 4, sampleSize30d: 4 }
                ];

                vi.spyOn(metricsService, 'calculateRollingAverages').mockResolvedValue(mockRollingData);

                const result = await metricsService.analyzeTrend('factual_alignment', '7d');

                expect(Math.abs(result.significance)).toBeCloseTo(1.0, 2); // Perfect negative correlation
                expect(result.trend).toBe('decreasing');
                expect(result.changePercentage).toBe(-75); // 75% decrease from 4 to 1
            });

            it('should detect no correlation', async () => {
                const mockRollingData = [
                    { date: new Date('2024-01-01'), value: 1, rollingAverage7d: 1, rollingAverage30d: 1, sampleSize7d: 1, sampleSize30d: 1 },
                    { date: new Date('2024-01-02'), value: 3, rollingAverage7d: 2, rollingAverage30d: 2, sampleSize7d: 2, sampleSize30d: 2 },
                    { date: new Date('2024-01-03'), value: 2, rollingAverage7d: 2, rollingAverage30d: 2, sampleSize7d: 3, sampleSize30d: 3 },
                    { date: new Date('2024-01-04'), value: 4, rollingAverage7d: 2.5, rollingAverage30d: 2.5, sampleSize7d: 4, sampleSize30d: 4 }
                ];

                vi.spyOn(metricsService, 'calculateRollingAverages').mockResolvedValue(mockRollingData);

                const result = await metricsService.analyzeTrend('engine_overlap', '7d');

                expect(Math.abs(result.significance)).toBeLessThan(0.9); // Lower correlation than perfect
                expect(result.trend).toBe('increasing'); // Still 300% increase overall
            });
        });

        describe('t-test calculations', () => {
            it('should perform Welch t-test with correct degrees of freedom', async () => {
                // Group 1: [0.8, 0.9, 0.7, 0.85] - mean=0.8125, var≈0.0075
                // Group 2: [0.4, 0.5, 0.3, 0.45] - mean=0.4125, var≈0.0075
                const period1Data = [
                    { value: '0.8' }, { value: '0.9' }, { value: '0.7' }, { value: '0.85' }
                ];
                const period2Data = [
                    { value: '0.4' }, { value: '0.5' }, { value: '0.3' }, { value: '0.45' }
                ];

                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: period1Data })
                    .mockResolvedValueOnce({ rows: period2Data });

                const result = await metricsService.performSignificanceTest(
                    'factual_alignment',
                    new Date('2024-01-01'),
                    new Date('2024-01-07'),
                    new Date('2024-01-08'),
                    new Date('2024-01-14')
                );

                expect(result.testType).toBe('welch');
                expect(result.confidenceLevel).toBe(0.95);
                expect(result.testStatistic).toBeGreaterThan(0); // Should be positive (group1 > group2)
                expect(Math.abs(result.effectSize)).toBeGreaterThan(2); // Large effect size
                expect(result.pValue).toBeLessThan(0.05); // Should be significant
                expect(result.isSignificant).toBe(true);
            });

            it('should handle equal means correctly', async () => {
                const period1Data = [{ value: '0.5' }, { value: '0.5' }, { value: '0.5' }];
                const period2Data = [{ value: '0.5' }, { value: '0.5' }, { value: '0.5' }];

                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: period1Data })
                    .mockResolvedValueOnce({ rows: period2Data });

                const result = await metricsService.performSignificanceTest(
                    'domain_diversity',
                    new Date('2024-01-01'),
                    new Date('2024-01-07'),
                    new Date('2024-01-08'),
                    new Date('2024-01-14')
                );

                expect(result.testStatistic).toBeCloseTo(0, 5); // Should be near zero
                expect(result.effectSize).toBeCloseTo(0, 5); // No effect
                expect(result.isSignificant).toBe(false);
            });
        });
    });

    describe('anomaly detection accuracy', () => {
        it('should detect anomalies using correct statistical thresholds', async () => {
            // Create data with known statistical properties
            const mockResults = [
                // Normal data points around mean=0.8, stddev=0.1
                { date: '2024-01-01', daily_value: '0.8', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                { date: '2024-01-02', daily_value: '0.75', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                { date: '2024-01-03', daily_value: '0.85', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                // Mild anomaly: 2.5 standard deviations away
                { date: '2024-01-04', daily_value: '0.55', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                // Severe anomaly: 5 standard deviations away
                { date: '2024-01-05', daily_value: '0.3', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                // Extreme positive anomaly
                { date: '2024-01-06', daily_value: '1.3', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.detectAnomalies('domain_diversity', undefined, 30, 2.0);

            expect(result).toHaveLength(6);

            // Check normal points are not flagged
            const normal1 = result.find(r => r.value === 0.8);
            expect(normal1!.isAnomaly).toBe(false);
            expect(normal1!.deviation).toBeCloseTo(0, 5);

            const normal2 = result.find(r => r.value === 0.75);
            expect(normal2!.isAnomaly).toBe(false);
            expect(normal2!.deviation).toBeCloseTo(0.5, 1); // |0.75 - 0.8| / 0.1 = 0.5

            // Check mild anomaly
            const mildAnomaly = result.find(r => r.value === 0.55);
            expect(mildAnomaly!.isAnomaly).toBe(true);
            expect(mildAnomaly!.deviation).toBeCloseTo(2.5, 1); // |0.55 - 0.8| / 0.1 = 2.5
            expect(mildAnomaly!.severity).toBe('low'); // 2.5 is not > 3.0 for medium

            // Check severe anomaly
            const severeAnomaly = result.find(r => r.value === 0.3);
            expect(severeAnomaly!.isAnomaly).toBe(true);
            expect(severeAnomaly!.deviation).toBeCloseTo(5.0, 1); // |0.3 - 0.8| / 0.1 = 5.0
            expect(severeAnomaly!.severity).toBe('high');

            // Check extreme positive anomaly
            const extremeAnomaly = result.find(r => r.value === 1.3);
            expect(extremeAnomaly!.isAnomaly).toBe(true);
            expect(extremeAnomaly!.deviation).toBeCloseTo(5.0, 1); // |1.3 - 0.8| / 0.1 = 5.0
            expect(extremeAnomaly!.severity).toBe('high');
        });

        it('should adjust sensitivity threshold correctly', async () => {
            const mockResults = [
                { date: '2024-01-01', daily_value: '0.8', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' },
                { date: '2024-01-02', daily_value: '0.65', rolling_mean: '0.8', rolling_stddev: '0.1', window_size: '7' } // 1.5 std devs
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            // Test with high sensitivity (threshold = 1.0)
            const sensitiveResult = await metricsService.detectAnomalies('engine_overlap', undefined, 30, 1.0);
            const anomaly1 = sensitiveResult.find(r => r.value === 0.65);
            expect(anomaly1!.isAnomaly).toBe(true); // 1.5 > 1.0

            // Test with low sensitivity (threshold = 2.0)
            const tolerantResult = await metricsService.detectAnomalies('engine_overlap', undefined, 30, 2.0);
            const anomaly2 = tolerantResult.find(r => r.value === 0.65);
            expect(anomaly2!.isAnomaly).toBe(false); // 1.5 < 2.0
        });

        it('should handle edge cases in anomaly detection', async () => {
            // Test zero standard deviation
            const zeroStdResults = [
                { date: '2024-01-01', daily_value: '0.8', rolling_mean: '0.8', rolling_stddev: '0.0', window_size: '7' }
            ];

            (mockDb.query as any).mockResolvedValueOnce({ rows: zeroStdResults });

            const zeroStdResult = await metricsService.detectAnomalies('factual_alignment');
            expect(zeroStdResult[0].isAnomaly).toBe(false);
            expect(zeroStdResult[0].deviation).toBe(0);

            // Test null/undefined values
            const nullResults = [
                { date: '2024-01-01', daily_value: '0.8', rolling_mean: null, rolling_stddev: '0.1', window_size: '7' }
            ];

            (mockDb.query as any).mockResolvedValueOnce({ rows: nullResults });

            const nullResult = await metricsService.detectAnomalies('factual_alignment');
            expect(nullResult[0].expectedValue).toBe(0.8); // Should fall back to current value
            expect(nullResult[0].deviation).toBe(0);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle database connection errors', async () => {
            (mockDb.query as any).mockRejectedValue(new Error('Connection timeout'));

            await expect(metricsService.calculateDomainDiversity('test-query-id'))
                .rejects.toThrow();
        });

        it('should handle malformed database responses', async () => {
            (mockDb.query as any).mockResolvedValue({ rows: [{ invalid: 'data' }] });

            const result = await metricsService.calculateDomainDiversity('test-query-id');

            // Should handle gracefully and return empty results
            expect(result.uniqueDomains).toBe(0);
            expect(result.totalResults).toBe(0);
        });

        it('should handle null and undefined values in database results', async () => {
            const mockResults = [
                { factual_score: null, confidence_score: '0.9', engine: 'google' },
                { factual_score: '0.6', confidence_score: null, engine: 'bing' },
                { factual_score: undefined, confidence_score: undefined, engine: 'perplexity' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const result = await metricsService.calculateFactualAlignment('test-query-id');

            // Should filter out invalid entries
            expect(result.averageScore).toBe(0);
            expect(result.weightedScore).toBe(0);
        });

        it('should handle very large datasets efficiently', async () => {
            // Generate large mock dataset
            const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
                url: `https://example${i % 100}.com/page${i}`,
                engine: ['google', 'bing', 'perplexity', 'brave'][i % 4],
                count: '1'
            }));

            (mockDb.query as any).mockResolvedValue({ rows: largeDataset });

            const startTime = Date.now();
            const result = await metricsService.calculateDomainDiversity('large-query-id');
            const endTime = Date.now();

            expect(result.uniqueDomains).toBe(100); // 100 unique domains
            expect(result.totalResults).toBe(1000);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should validate mathematical constraints', async () => {
            // Test that diversity index is always between 0 and 1
            const extremeResults = [
                { url: 'https://single.com/page', engine: 'google', count: '1000000' }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: extremeResults });

            const result = await metricsService.calculateDomainDiversity('extreme-query');

            expect(result.diversityIndex).toBeGreaterThanOrEqual(0);
            expect(result.diversityIndex).toBeLessThanOrEqual(1);
            expect(result.diversityIndex).toBeCloseTo(1 / 1000000, 10);
        });
    });
});