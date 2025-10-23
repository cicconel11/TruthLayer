import { DatabaseConnection } from '../database/connection';

import {
    BiasMetrics,
    DomainDiversityMetric,
    EngineOverlapMetric,
    FactualAlignmentMetric,
    TrendAnalysis,
    RollingAverage,
    SignificanceTest,
    AnomalyDetection
} from '../types/metrics';
import { logger } from '../utils/logger';

/**
 * Service for calculating bias metrics from search results and annotations
 */
export class MetricsService {
    constructor(private db: DatabaseConnection) { }

    /**
     * Calculate Domain Diversity Index for a query
     * DDI = unique_domains / total_results
     */
    async calculateDomainDiversity(queryId: string): Promise<DomainDiversityMetric> {
        const query = `
            SELECT url, engine, COUNT(*) as count
            FROM search_results 
            WHERE query_id = $1
            GROUP BY url, engine
            ORDER BY count DESC
        `;

        const results = await this.db.query(query, [queryId]);

        if (results.rows.length === 0) {
            return {
                uniqueDomains: 0,
                totalResults: 0,
                diversityIndex: 0,
                topDomains: []
            };
        }

        // Extract domains from URLs
        const domainCounts = new Map<string, number>();
        let totalResults = 0;

        for (const row of results.rows) {
            try {
                const url = new URL(row.url);
                const domain = url.hostname.replace(/^www\./, '');
                const count = parseInt(row.count, 10);

                domainCounts.set(domain, (domainCounts.get(domain) || 0) + count);
                totalResults += count;
            } catch (error) {
                logger.warn('Invalid URL in domain diversity calculation', {
                    url: row.url,
                    queryId
                });
            }
        }

        const uniqueDomains = domainCounts.size;
        const diversityIndex = totalResults > 0 ? uniqueDomains / totalResults : 0;

        // Get top domains sorted by count
        const topDomains = Array.from(domainCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([domain, count]) => ({
                domain,
                count,
                percentage: totalResults > 0 ? (count / totalResults) * 100 : 0
            }));

        return {
            uniqueDomains,
            totalResults,
            diversityIndex,
            topDomains
        };
    }

    /**
     * Calculate Engine Overlap Coefficient for a query
     * EOC = shared_urls / total_unique_urls
     */
    async calculateEngineOverlap(queryId: string): Promise<EngineOverlapMetric> {
        const query = `
            SELECT url, engine
            FROM search_results 
            WHERE query_id = $1
            ORDER BY engine, url
        `;

        const results = await this.db.query(query, [queryId]);

        if (results.rows.length === 0) {
            return {
                sharedUrls: 0,
                totalUniqueUrls: 0,
                overlapCoefficient: 0,
                enginePairs: []
            };
        }

        // Group URLs by engine
        const engineUrls = new Map<string, Set<string>>();
        const allUrls = new Set<string>();

        for (const row of results.rows) {
            const { url, engine } = row;

            if (!engineUrls.has(engine)) {
                engineUrls.set(engine, new Set());
            }

            engineUrls.get(engine)!.add(url);
            allUrls.add(url);
        }

        const engines = Array.from(engineUrls.keys());
        const totalUniqueUrls = allUrls.size;

        // Calculate shared URLs across all engines
        let sharedUrls = 0;
        for (const url of allUrls) {
            let engineCount = 0;
            for (const engine of engines) {
                if (engineUrls.get(engine)?.has(url)) {
                    engineCount++;
                }
            }
            if (engineCount > 1) {
                sharedUrls++;
            }
        }

        // Calculate pairwise overlaps
        const enginePairs: Array<{
            engines: [string, string];
            sharedCount: number;
            overlapPercentage: number;
        }> = [];

        for (let i = 0; i < engines.length; i++) {
            for (let j = i + 1; j < engines.length; j++) {
                const engine1 = engines[i];
                const engine2 = engines[j];
                const urls1 = engineUrls.get(engine1)!;
                const urls2 = engineUrls.get(engine2)!;

                const intersection = new Set([...urls1].filter(url => urls2.has(url)));
                const union = new Set([...urls1, ...urls2]);

                const sharedCount = intersection.size;
                const overlapPercentage = union.size > 0 ? (sharedCount / union.size) * 100 : 0;

                enginePairs.push({
                    engines: [engine1, engine2],
                    sharedCount,
                    overlapPercentage
                });
            }
        }

        const overlapCoefficient = totalUniqueUrls > 0 ? sharedUrls / totalUniqueUrls : 0;

        return {
            sharedUrls,
            totalUniqueUrls,
            overlapCoefficient,
            enginePairs
        };
    }

    /**
     * Calculate Factual Alignment Score for a query
     * FAS = weighted_average(factual_scores)
     */
    async calculateFactualAlignment(queryId: string): Promise<FactualAlignmentMetric> {
        const query = `
            SELECT 
                a.factual_score,
                a.confidence_score,
                sr.engine
            FROM annotations a
            JOIN search_results sr ON a.result_id = sr.id
            WHERE sr.query_id = $1 
            AND a.factual_score IS NOT NULL
            AND a.confidence_score IS NOT NULL
            ORDER BY a.factual_score
        `;

        const results = await this.db.query(query, [queryId]);

        if (results.rows.length === 0) {
            return {
                averageScore: 0,
                weightedScore: 0,
                confidenceLevel: 0,
                scoreDistribution: []
            };
        }

        const scores = results.rows
            .filter((row: any) => row.factual_score != null && row.confidence_score != null)
            .map((row: any) => ({
                factualScore: parseFloat(row.factual_score),
                confidenceScore: parseFloat(row.confidence_score),
                engine: row.engine
            }))
            .filter((score: any) => !isNaN(score.factualScore) && !isNaN(score.confidenceScore));

        // Calculate simple average
        const averageScore = scores.length > 0
            ? scores.reduce((sum: number, s: any) => sum + s.factualScore, 0) / scores.length
            : 0;

        // Calculate weighted average (weighted by confidence)
        const totalWeight = scores.reduce((sum: number, s: any) => sum + s.confidenceScore, 0);
        const weightedScore = totalWeight > 0
            ? scores.reduce((sum: number, s: any) => sum + (s.factualScore * s.confidenceScore), 0) / totalWeight
            : averageScore;

        // Calculate overall confidence level
        const confidenceLevel = scores.length > 0
            ? scores.reduce((sum: number, s: any) => sum + s.confidenceScore, 0) / scores.length
            : 0;

        // Create score distribution
        const scoreRanges = [
            { range: '0.0-0.2', min: 0.0, max: 0.2 },
            { range: '0.2-0.4', min: 0.2, max: 0.4 },
            { range: '0.4-0.6', min: 0.4, max: 0.6 },
            { range: '0.6-0.8', min: 0.6, max: 0.8 },
            { range: '0.8-1.0', min: 0.8, max: 1.0 }
        ];

        const scoreDistribution = scoreRanges.map(range => {
            const count = scores.filter((s: any) =>
                s.factualScore >= range.min && s.factualScore < range.max
            ).length;

            return {
                range: range.range,
                count,
                percentage: scores.length > 0 ? (count / scores.length) * 100 : 0
            };
        });

        return {
            averageScore,
            weightedScore,
            confidenceLevel,
            scoreDistribution
        };
    }

    /**
     * Calculate all bias metrics for a query
     */
    async calculateBiasMetrics(queryId: string): Promise<BiasMetrics> {
        try {
            const [domainDiversity, engineOverlap, factualAlignment] = await Promise.all([
                this.calculateDomainDiversity(queryId),
                this.calculateEngineOverlap(queryId),
                this.calculateFactualAlignment(queryId)
            ]);

            const metrics: BiasMetrics = {
                domainDiversityIndex: domainDiversity.diversityIndex,
                engineOverlapCoefficient: engineOverlap.overlapCoefficient,
                factualAlignmentScore: factualAlignment.weightedScore,
                calculatedAt: new Date(),
                queryId
            };

            logger.info('Bias metrics calculated successfully', {
                queryId,
                metrics: {
                    domainDiversity: metrics.domainDiversityIndex,
                    engineOverlap: metrics.engineOverlapCoefficient,
                    factualAlignment: metrics.factualAlignmentScore
                }
            });

            return metrics;
        } catch (error) {
            logger.error('Failed to calculate bias metrics', { queryId, error });
            throw new Error(`Bias metrics calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Calculate and store bias metrics for historical tracking
     */
    async calculateAndStoreBiasMetrics(queryId: string): Promise<BiasMetrics> {
        const metrics = await this.calculateBiasMetrics(queryId);

        // Store metrics in bias_metrics table for trend analysis
        const insertQuery = `
            INSERT INTO bias_metrics (
                query_id,
                domain_diversity_index,
                engine_overlap_coefficient,
                factual_alignment_score,
                calculated_at
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (query_id, calculated_at) 
            DO UPDATE SET
                domain_diversity_index = EXCLUDED.domain_diversity_index,
                engine_overlap_coefficient = EXCLUDED.engine_overlap_coefficient,
                factual_alignment_score = EXCLUDED.factual_alignment_score
        `;

        await this.db.query(insertQuery, [
            queryId,
            metrics.domainDiversityIndex,
            metrics.engineOverlapCoefficient,
            metrics.factualAlignmentScore,
            metrics.calculatedAt
        ]);

        logger.info('Bias metrics stored for trend analysis', { queryId });
        return metrics;
    }

    /**
     * Calculate metrics for multiple queries
     */
    async calculateBiasMetricsForQueries(queryIds: string[]): Promise<BiasMetrics[]> {
        const results: BiasMetrics[] = [];

        for (const queryId of queryIds) {
            try {
                const metrics = await this.calculateBiasMetrics(queryId);
                results.push(metrics);
            } catch (error) {
                logger.error('Failed to calculate metrics for query', { queryId, error });
                // Continue with other queries even if one fails
            }
        }

        return results;
    }

    /**
     * Get detailed domain diversity analysis
     */
    async getDomainDiversityAnalysis(queryId: string): Promise<DomainDiversityMetric> {
        return this.calculateDomainDiversity(queryId);
    }

    /**
     * Get detailed engine overlap analysis
     */
    async getEngineOverlapAnalysis(queryId: string): Promise<EngineOverlapMetric> {
        return this.calculateEngineOverlap(queryId);
    }

    /**
     * Get detailed factual alignment analysis
     */
    async getFactualAlignmentAnalysis(queryId: string): Promise<FactualAlignmentMetric> {
        return this.calculateFactualAlignment(queryId);
    }

    /**
     * Calculate rolling averages for a specific metric over time
     */
    async calculateRollingAverages(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        queryId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<RollingAverage[]> {
        const whereClause = this.buildWhereClause(queryId, startDate, endDate);
        const metricColumn = this.getMetricColumn(metricType);

        const query = `
            WITH daily_metrics AS (
                SELECT 
                    DATE(calculated_at) as date,
                    AVG(${metricColumn}) as daily_value,
                    COUNT(*) as daily_count
                FROM bias_metrics 
                ${whereClause.clause}
                GROUP BY DATE(calculated_at)
                ORDER BY date
            ),
            rolling_calculations AS (
                SELECT 
                    date,
                    daily_value,
                    daily_count,
                    AVG(daily_value) OVER (
                        ORDER BY date 
                        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                    ) as rolling_avg_7d,
                    COUNT(*) OVER (
                        ORDER BY date 
                        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                    ) as sample_size_7d,
                    AVG(daily_value) OVER (
                        ORDER BY date 
                        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                    ) as rolling_avg_30d,
                    COUNT(*) OVER (
                        ORDER BY date 
                        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
                    ) as sample_size_30d
                FROM daily_metrics
            )
            SELECT * FROM rolling_calculations
            ORDER BY date
        `;

        const result = await this.db.query(query, whereClause.params);

        return result.rows.map((row: any) => ({
            date: new Date(row.date),
            value: parseFloat(row.daily_value),
            rollingAverage7d: parseFloat(row.rolling_avg_7d),
            rollingAverage30d: parseFloat(row.rolling_avg_30d),
            sampleSize7d: parseInt(row.sample_size_7d, 10),
            sampleSize30d: parseInt(row.sample_size_30d, 10)
        }));
    }

    /**
     * Perform statistical significance test between two time periods
     */
    async performSignificanceTest(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        period1Start: Date,
        period1End: Date,
        period2Start: Date,
        period2End: Date,
        queryId?: string
    ): Promise<SignificanceTest> {
        const metricColumn = this.getMetricColumn(metricType);

        // Get data for both periods
        const period1Query = `
            SELECT ${metricColumn} as value
            FROM bias_metrics 
            WHERE calculated_at >= $1 AND calculated_at <= $2
            ${queryId ? 'AND query_id = $3' : ''}
            AND ${metricColumn} IS NOT NULL
        `;

        const period2Query = `
            SELECT ${metricColumn} as value
            FROM bias_metrics 
            WHERE calculated_at >= $1 AND calculated_at <= $2
            ${queryId ? 'AND query_id = $3' : ''}
            AND ${metricColumn} IS NOT NULL
        `;

        const params1 = queryId ? [period1Start, period1End, queryId] : [period1Start, period1End];
        const params2 = queryId ? [period2Start, period2End, queryId] : [period2Start, period2End];

        const [result1, result2] = await Promise.all([
            this.db.query(period1Query, params1),
            this.db.query(period2Query, params2)
        ]);

        const values1 = result1.rows.map((row: any) => parseFloat(row.value)).filter((v: number) => !isNaN(v));
        const values2 = result2.rows.map((row: any) => parseFloat(row.value)).filter((v: number) => !isNaN(v));

        if (values1.length < 2 || values2.length < 2) {
            return {
                pValue: 1.0,
                isSignificant: false,
                confidenceLevel: 0.95,
                testStatistic: 0,
                testType: 'ttest',
                effectSize: 0
            };
        }

        // Perform Welch's t-test (unequal variances)
        const stats1 = this.calculateBasicStats(values1);
        const stats2 = this.calculateBasicStats(values2);

        const pooledSE = Math.sqrt((stats1.variance / values1.length) + (stats2.variance / values2.length));
        const testStatistic = pooledSE > 0 ? (stats1.mean - stats2.mean) / pooledSE : 0;

        // Degrees of freedom for Welch's t-test
        const df = pooledSE > 0 ? Math.pow(pooledSE, 4) / (
            Math.pow(stats1.variance / values1.length, 2) / (values1.length - 1) +
            Math.pow(stats2.variance / values2.length, 2) / (values2.length - 1)
        ) : 1;

        // Approximate p-value using t-distribution
        const pValue = this.calculateTTestPValue(Math.abs(testStatistic), df);

        // Cohen's d for effect size
        const pooledStd = Math.sqrt(((values1.length - 1) * stats1.variance + (values2.length - 1) * stats2.variance) /
            (values1.length + values2.length - 2));
        const effectSize = pooledStd > 0 ? (stats1.mean - stats2.mean) / pooledStd : 0;

        return {
            pValue,
            isSignificant: pValue < 0.05,
            confidenceLevel: 0.95,
            testStatistic,
            testType: 'welch',
            effectSize
        };
    }

    /**
     * Detect anomalies in metric values using statistical methods
     */
    async detectAnomalies(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        queryId?: string,
        lookbackDays: number = 30,
        sensitivityThreshold: number = 2.5
    ): Promise<AnomalyDetection[]> {
        const metricColumn = this.getMetricColumn(metricType);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);

        const query = `
            WITH daily_metrics AS (
                SELECT 
                    DATE(calculated_at) as date,
                    AVG(${metricColumn}) as daily_value,
                    COUNT(*) as daily_count
                FROM bias_metrics 
                WHERE calculated_at >= $1
                ${queryId ? 'AND query_id = $2' : ''}
                AND ${metricColumn} IS NOT NULL
                GROUP BY DATE(calculated_at)
                ORDER BY date
            ),
            stats_window AS (
                SELECT 
                    date,
                    daily_value,
                    AVG(daily_value) OVER (
                        ORDER BY date 
                        ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
                    ) as rolling_mean,
                    STDDEV(daily_value) OVER (
                        ORDER BY date 
                        ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
                    ) as rolling_stddev,
                    COUNT(*) OVER (
                        ORDER BY date 
                        ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
                    ) as window_size
                FROM daily_metrics
            )
            SELECT 
                date,
                daily_value,
                rolling_mean,
                rolling_stddev,
                window_size
            FROM stats_window
            WHERE window_size >= 3
            ORDER BY date
        `;

        const params = queryId ? [startDate, queryId] : [startDate];
        const result = await this.db.query(query, params);

        return result.rows.map((row: any) => {
            const value = parseFloat(row.daily_value);
            const expectedValue = parseFloat(row.rolling_mean) || value;
            const stddev = parseFloat(row.rolling_stddev) || 0;

            const deviation = stddev > 0 ? Math.abs(value - expectedValue) / stddev : 0;
            const isAnomaly = deviation > sensitivityThreshold;

            let severity: 'low' | 'medium' | 'high' = 'low';
            if (deviation > sensitivityThreshold * 2) {
                severity = 'high';
            } else if (deviation > sensitivityThreshold * 1.5) {
                severity = 'medium';
            }

            // Confidence based on how many standard deviations away
            const confidence = Math.min(0.99, Math.max(0.5, deviation / (sensitivityThreshold * 2)));

            return {
                date: new Date(row.date),
                value,
                expectedValue,
                deviation,
                isAnomaly,
                severity,
                confidence
            };
        });
    }

    /**
     * Generate comprehensive trend analysis for a metric
     */
    async analyzeTrend(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        timeframe: '7d' | '30d' | '90d',
        queryId?: string
    ): Promise<TrendAnalysis> {
        const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const rollingAverages = await this.calculateRollingAverages(
            metricType,
            queryId,
            startDate
        );

        if (rollingAverages.length < 2) {
            return {
                metric: metricType,
                timeframe,
                values: rollingAverages.map(ra => ({ date: ra.date, value: ra.value })),
                trend: 'stable',
                changePercentage: 0,
                significance: 0
            };
        }

        // Calculate trend direction and magnitude
        const firstValue = rollingAverages[0].value;
        const lastValue = rollingAverages[rollingAverages.length - 1].value;
        const changePercentage = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

        // Determine trend direction
        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (Math.abs(changePercentage) > 5) { // 5% threshold for significance
            trend = changePercentage > 0 ? 'increasing' : 'decreasing';
        }

        // Calculate linear regression for trend significance
        const xValues = rollingAverages.map((_, index) => index);
        const yValues = rollingAverages.map(ra => ra.value);
        const correlation = this.calculateCorrelation(xValues, yValues);
        const significance = Math.abs(correlation);

        return {
            metric: metricType,
            timeframe,
            values: rollingAverages.map(ra => ({ date: ra.date, value: ra.value })),
            trend,
            changePercentage,
            significance
        };
    }

    /**
     * Helper method to build WHERE clause for queries
     */
    private buildWhereClause(queryId?: string, startDate?: Date, endDate?: Date): { clause: string; params: any[] } {
        const conditions: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (queryId) {
            conditions.push(`query_id = $${paramIndex++}`);
            params.push(queryId);
        }

        if (startDate) {
            conditions.push(`calculated_at >= $${paramIndex++}`);
            params.push(startDate);
        }

        if (endDate) {
            conditions.push(`calculated_at <= $${paramIndex++}`);
            params.push(endDate);
        }

        const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return { clause, params };
    }

    /**
     * Helper method to get the appropriate column name for a metric type
     */
    private getMetricColumn(metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment'): string {
        switch (metricType) {
            case 'domain_diversity':
                return 'domain_diversity_index';
            case 'engine_overlap':
                return 'engine_overlap_coefficient';
            case 'factual_alignment':
                return 'factual_alignment_score';
            default:
                throw new Error(`Unknown metric type: ${metricType}`);
        }
    }

    /**
     * Calculate basic statistical measures
     */
    private calculateBasicStats(values: number[]): { mean: number; variance: number; stddev: number } {
        if (values.length === 0) {
            return { mean: 0, variance: 0, stddev: 0 };
        }

        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
        const stddev = Math.sqrt(variance);

        return { mean, variance: variance || 0, stddev: stddev || 0 };
    }

    /**
     * Approximate p-value calculation for t-test
     */
    private calculateTTestPValue(tStat: number, df: number): number {
        // Simplified approximation - in production, use a proper statistical library
        if (df <= 0 || isNaN(tStat) || isNaN(df)) {
            return 1.0;
        }

        // Very rough approximation using normal distribution for large df
        if (df > 30) {
            return 2 * (1 - this.normalCDF(Math.abs(tStat)));
        }

        // For smaller df, use a conservative estimate
        const criticalValues = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228];
        const index = Math.min(Math.floor(df) - 1, criticalValues.length - 1);
        const critical = index >= 0 ? criticalValues[index] : 2.0;

        return Math.abs(tStat) > critical ? 0.01 : 0.1;
    }

    /**
     * Normal cumulative distribution function approximation
     */
    private normalCDF(x: number): number {
        // Abramowitz and Stegun approximation
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

        return x > 0 ? 1 - prob : prob;
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    private calculateCorrelation(x: number[], y: number[]): number {
        if (x.length !== y.length || x.length < 2) {
            return 0;
        }

        const n = x.length;
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        const sumYY = y.reduce((sum, val) => sum + val * val, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

        return denominator !== 0 ? numerator / denominator : 0;
    }
}

export interface MetricsServiceInterface {
    calculateDomainDiversity(queryId: string): Promise<DomainDiversityMetric>;
    calculateEngineOverlap(queryId: string): Promise<EngineOverlapMetric>;
    calculateFactualAlignment(queryId: string): Promise<FactualAlignmentMetric>;
    calculateBiasMetrics(queryId: string): Promise<BiasMetrics>;
    calculateAndStoreBiasMetrics(queryId: string): Promise<BiasMetrics>;
    calculateBiasMetricsForQueries(queryIds: string[]): Promise<BiasMetrics[]>;
    getDomainDiversityAnalysis(queryId: string): Promise<DomainDiversityMetric>;
    getEngineOverlapAnalysis(queryId: string): Promise<EngineOverlapMetric>;
    getFactualAlignmentAnalysis(queryId: string): Promise<FactualAlignmentMetric>;
    calculateRollingAverages(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        queryId?: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<RollingAverage[]>;
    performSignificanceTest(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        period1Start: Date,
        period1End: Date,
        period2Start: Date,
        period2End: Date,
        queryId?: string
    ): Promise<SignificanceTest>;
    detectAnomalies(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        queryId?: string,
        lookbackDays?: number,
        sensitivityThreshold?: number
    ): Promise<AnomalyDetection[]>;
    analyzeTrend(
        metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment',
        timeframe: '7d' | '30d' | '90d',
        queryId?: string
    ): Promise<TrendAnalysis>;
}