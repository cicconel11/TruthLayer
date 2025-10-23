import { DatabaseConnection } from '../database/connection';
import { MetricsService } from './metrics-service';
import { logger } from '../utils/logger';
import {
    BiasMetrics,
    HistoricalMetric,
    EngineComparison,
    TrendAnalysis,
    RollingAverage
} from '../types/metrics';

/**
 * Time period options for aggregation
 */
export type TimePeriod = '1d' | '7d' | '30d' | '90d' | '1y';

/**
 * Aggregation options for metrics computation
 */
export interface AggregationOptions {
    timePeriod: TimePeriod;
    engines?: string[];
    categories?: string[];
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month';
}

/**
 * Aggregated metrics result
 */
export interface AggregatedMetrics {
    period: TimePeriod;
    startDate: Date;
    endDate: Date;
    totalQueries: number;
    averageMetrics: {
        domainDiversity: number;
        engineOverlap: number;
        factualAlignment: number;
    };
    metricsByEngine: Record<string, {
        domainDiversity: number;
        factualAlignment: number;
        queryCount: number;
    }>;
    metricsByCategory: Record<string, {
        domainDiversity: number;
        engineOverlap: number;
        factualAlignment: number;
        queryCount: number;
    }>;
    trends: {
        domainDiversity: TrendAnalysis;
        engineOverlap: TrendAnalysis;
        factualAlignment: TrendAnalysis;
    };
}

/**
 * Cross-engine comparison result
 */
export interface CrossEngineAnalysis {
    comparisonDate: Date;
    engines: string[];
    overallComparison: EngineComparison;
    categoryComparisons: Record<string, EngineComparison>;
    significantDifferences: Array<{
        metric: string;
        engines: [string, string];
        difference: number;
        pValue: number;
        isSignificant: boolean;
    }>;
    recommendations: string[];
}

/**
 * Historical data management options
 */
export interface HistoricalDataOptions {
    retentionPeriod: TimePeriod;
    compressionThreshold: number;
    archiveOlderThan?: Date;
}

/**
 * Service for aggregating metrics across time periods and engines
 */
export class MetricsAggregationService {
    private metricsService: MetricsService;

    constructor(private db: DatabaseConnection) {
        this.metricsService = new MetricsService(db);
    }

    /**
     * Compute aggregated metrics across different time periods and engines
     */
    async computeAggregatedMetrics(options: AggregationOptions): Promise<AggregatedMetrics> {
        const { startDate, endDate } = this.getDateRange(options.timePeriod, options.startDate, options.endDate);

        logger.info('Computing aggregated metrics', {
            period: options.timePeriod,
            startDate,
            endDate,
            engines: options.engines,
            categories: options.categories
        });

        // Build base query with filters
        const { whereClause, params } = this.buildAggregationQuery(options, startDate, endDate);

        // Get overall metrics
        const overallQuery = `
            SELECT 
                COUNT(DISTINCT bm.query_id) as total_queries,
                AVG(bm.domain_diversity_index) as avg_domain_diversity,
                AVG(bm.engine_overlap_coefficient) as avg_engine_overlap,
                AVG(bm.factual_alignment_score) as avg_factual_alignment
            FROM bias_metrics bm
            JOIN queries q ON bm.query_id = q.id
            ${whereClause}
            AND bm.domain_diversity_index IS NOT NULL
            AND bm.engine_overlap_coefficient IS NOT NULL
            AND bm.factual_alignment_score IS NOT NULL
        `;

        const overallResult = await this.db.query(overallQuery, params);
        const overall = overallResult.rows[0];

        // Get metrics by engine
        const engineQuery = `
            SELECT 
                sr.engine,
                AVG(bm.domain_diversity_index) as avg_domain_diversity,
                AVG(bm.factual_alignment_score) as avg_factual_alignment,
                COUNT(DISTINCT bm.query_id) as query_count
            FROM bias_metrics bm
            JOIN queries q ON bm.query_id = q.id
            JOIN search_results sr ON sr.query_id = bm.query_id
            ${whereClause}
            AND bm.domain_diversity_index IS NOT NULL
            AND bm.factual_alignment_score IS NOT NULL
            ${options.engines ? `AND sr.engine = ANY($${params.length + 1})` : ''}
            GROUP BY sr.engine
            ORDER BY sr.engine
        `;

        const engineParams = options.engines ? [...params, options.engines] : params;
        const engineResult = await this.db.query(engineQuery, engineParams);

        const metricsByEngine: Record<string, any> = {};
        engineResult.rows.forEach((row: any) => {
            metricsByEngine[row.engine] = {
                domainDiversity: parseFloat(row.avg_domain_diversity) || 0,
                factualAlignment: parseFloat(row.avg_factual_alignment) || 0,
                queryCount: parseInt(row.query_count, 10)
            };
        });

        // Get metrics by category
        const categoryQuery = `
            SELECT 
                q.category,
                AVG(bm.domain_diversity_index) as avg_domain_diversity,
                AVG(bm.engine_overlap_coefficient) as avg_engine_overlap,
                AVG(bm.factual_alignment_score) as avg_factual_alignment,
                COUNT(DISTINCT bm.query_id) as query_count
            FROM bias_metrics bm
            JOIN queries q ON bm.query_id = q.id
            ${whereClause}
            AND bm.domain_diversity_index IS NOT NULL
            AND bm.engine_overlap_coefficient IS NOT NULL
            AND bm.factual_alignment_score IS NOT NULL
            AND q.category IS NOT NULL
            ${options.categories ? `AND q.category = ANY($${params.length + 1})` : ''}
            GROUP BY q.category
            ORDER BY q.category
        `;

        const categoryParams = options.categories ? [...params, options.categories] : params;
        const categoryResult = await this.db.query(categoryQuery, categoryParams);

        const metricsByCategory: Record<string, any> = {};
        categoryResult.rows.forEach((row: any) => {
            metricsByCategory[row.category] = {
                domainDiversity: parseFloat(row.avg_domain_diversity) || 0,
                engineOverlap: parseFloat(row.avg_engine_overlap) || 0,
                factualAlignment: parseFloat(row.avg_factual_alignment) || 0,
                queryCount: parseInt(row.query_count, 10)
            };
        });

        // Get trend analysis for each metric
        const timeframe = this.mapTimePeriodToTimeframe(options.timePeriod);
        const [domainTrend, overlapTrend, factualTrend] = await Promise.all([
            this.metricsService.analyzeTrend('domain_diversity', timeframe, undefined),
            this.metricsService.analyzeTrend('engine_overlap', timeframe, undefined),
            this.metricsService.analyzeTrend('factual_alignment', timeframe, undefined)
        ]);

        return {
            period: options.timePeriod,
            startDate,
            endDate,
            totalQueries: parseInt(overall.total_queries, 10) || 0,
            averageMetrics: {
                domainDiversity: parseFloat(overall.avg_domain_diversity) || 0,
                engineOverlap: parseFloat(overall.avg_engine_overlap) || 0,
                factualAlignment: parseFloat(overall.avg_factual_alignment) || 0
            },
            metricsByEngine,
            metricsByCategory,
            trends: {
                domainDiversity: domainTrend,
                engineOverlap: overlapTrend,
                factualAlignment: factualTrend
            }
        };
    }

    /**
     * Perform cross-engine comparative analysis
     */
    async performCrossEngineAnalysis(
        engines: string[],
        timePeriod: TimePeriod = '30d',
        categories?: string[]
    ): Promise<CrossEngineAnalysis> {
        const { startDate, endDate } = this.getDateRange(timePeriod);

        logger.info('Performing cross-engine analysis', {
            engines,
            timePeriod,
            startDate,
            endDate,
            categories
        });

        // Get overall comparison
        const overallComparison = await this.computeEngineComparison(engines, startDate, endDate);

        // Get category-specific comparisons
        const categoryComparisons: Record<string, EngineComparison> = {};
        if (categories && categories.length > 0) {
            for (const category of categories) {
                categoryComparisons[category] = await this.computeEngineComparison(
                    engines,
                    startDate,
                    endDate,
                    category
                );
            }
        }

        // Detect significant differences between engines
        const significantDifferences = await this.detectSignificantDifferences(
            engines,
            startDate,
            endDate
        );

        // Generate recommendations based on analysis
        const recommendations = this.generateRecommendations(
            overallComparison,
            significantDifferences
        );

        return {
            comparisonDate: new Date(),
            engines,
            overallComparison,
            categoryComparisons,
            significantDifferences,
            recommendations
        };
    }

    /**
     * Compute engine comparison for specific criteria
     */
    private async computeEngineComparison(
        engines: string[],
        startDate: Date,
        endDate: Date,
        category?: string
    ): Promise<EngineComparison> {
        const categoryFilter = category ? 'AND q.category = $4' : '';
        const params = [startDate, endDate, engines];
        if (category) params.push(category);

        const query = `
            SELECT 
                sr.engine,
                AVG(bm.domain_diversity_index) as avg_domain_diversity,
                AVG(bm.factual_alignment_score) as avg_factual_alignment,
                COUNT(DISTINCT sr.id) as result_count
            FROM bias_metrics bm
            JOIN queries q ON bm.query_id = q.id
            JOIN search_results sr ON sr.query_id = bm.query_id
            WHERE bm.calculated_at >= $1 
            AND bm.calculated_at <= $2
            AND sr.engine = ANY($3)
            ${categoryFilter}
            AND bm.domain_diversity_index IS NOT NULL
            AND bm.factual_alignment_score IS NOT NULL
            GROUP BY sr.engine
            ORDER BY sr.engine
        `;

        const result = await this.db.query(query, params);

        const metrics = {
            domainDiversity: {} as Record<string, number>,
            factualAlignment: {} as Record<string, number>,
            resultCount: {} as Record<string, number>
        };

        result.rows.forEach((row: any) => {
            metrics.domainDiversity[row.engine] = parseFloat(row.avg_domain_diversity) || 0;
            metrics.factualAlignment[row.engine] = parseFloat(row.avg_factual_alignment) || 0;
            metrics.resultCount[row.engine] = parseInt(row.result_count, 10);
        });

        // Calculate overall scores and rankings
        const rankings = engines.map(engine => {
            const domainScore = metrics.domainDiversity[engine] || 0;
            const factualScore = metrics.factualAlignment[engine] || 0;
            const overallScore = (domainScore + factualScore) / 2;

            return {
                engine,
                overallScore,
                rank: 0 // Will be set after sorting
            };
        }).sort((a, b) => b.overallScore - a.overallScore);

        // Assign ranks
        rankings.forEach((ranking, index) => {
            ranking.rank = index + 1;
        });

        return {
            engines,
            metrics,
            rankings
        };
    }

    /**
     * Detect statistically significant differences between engines
     */
    private async detectSignificantDifferences(
        engines: string[],
        startDate: Date,
        endDate: Date
    ): Promise<Array<{
        metric: string;
        engines: [string, string];
        difference: number;
        pValue: number;
        isSignificant: boolean;
    }>> {
        const differences: Array<any> = [];
        const metrics = ['domain_diversity', 'factual_alignment'] as const;

        // Compare each pair of engines for each metric
        for (let i = 0; i < engines.length; i++) {
            for (let j = i + 1; j < engines.length; j++) {
                const engine1 = engines[i];
                const engine2 = engines[j];

                for (const metric of metrics) {
                    try {
                        const significanceTest = await this.metricsService.performSignificanceTest(
                            metric,
                            startDate,
                            endDate,
                            startDate,
                            endDate
                        );

                        // Get average values for difference calculation
                        const [avg1, avg2] = await Promise.all([
                            this.getEngineMetricAverage(engine1, metric, startDate, endDate),
                            this.getEngineMetricAverage(engine2, metric, startDate, endDate)
                        ]);

                        differences.push({
                            metric,
                            engines: [engine1, engine2] as [string, string],
                            difference: Math.abs(avg1 - avg2),
                            pValue: significanceTest.pValue,
                            isSignificant: significanceTest.isSignificant
                        });
                    } catch (error) {
                        logger.warn('Failed to compute significance test', {
                            engine1,
                            engine2,
                            metric,
                            error
                        });
                    }
                }
            }
        }

        return differences.filter(d => d.isSignificant);
    }

    /**
     * Get average metric value for a specific engine
     */
    private async getEngineMetricAverage(
        engine: string,
        metric: 'domain_diversity' | 'factual_alignment',
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        const column = metric === 'domain_diversity'
            ? 'domain_diversity_index'
            : 'factual_alignment_score';

        const query = `
            SELECT AVG(bm.${column}) as avg_value
            FROM bias_metrics bm
            JOIN search_results sr ON sr.query_id = bm.query_id
            WHERE bm.calculated_at >= $1 
            AND bm.calculated_at <= $2
            AND sr.engine = $3
            AND bm.${column} IS NOT NULL
        `;

        const result = await this.db.query(query, [startDate, endDate, engine]);
        return parseFloat(result.rows[0]?.avg_value) || 0;
    }

    /**
     * Generate recommendations based on analysis results
     */
    private generateRecommendations(
        comparison: EngineComparison,
        significantDifferences: Array<any>
    ): string[] {
        const recommendations: string[] = [];

        // Analyze rankings
        const topEngine = comparison.rankings[0];
        const bottomEngine = comparison.rankings[comparison.rankings.length - 1];

        if (topEngine && bottomEngine) {
            recommendations.push(
                `${topEngine.engine} shows the best overall performance with a score of ${topEngine.overallScore.toFixed(3)}`
            );

            if (topEngine.overallScore - bottomEngine.overallScore > 0.1) {
                recommendations.push(
                    `Significant performance gap detected between ${topEngine.engine} and ${bottomEngine.engine}`
                );
            }
        }

        // Analyze domain diversity
        const domainDiversityValues = Object.values(comparison.metrics.domainDiversity);
        const maxDiversity = Math.max(...domainDiversityValues);
        const minDiversity = Math.min(...domainDiversityValues);

        if (maxDiversity - minDiversity > 0.2) {
            const bestDiversityEngine = Object.entries(comparison.metrics.domainDiversity)
                .find(([_, value]) => value === maxDiversity)?.[0];

            if (bestDiversityEngine) {
                recommendations.push(
                    `${bestDiversityEngine} provides the highest domain diversity (${maxDiversity.toFixed(3)})`
                );
            }
        }

        // Analyze factual alignment
        const factualValues = Object.values(comparison.metrics.factualAlignment);
        const maxFactual = Math.max(...factualValues);
        const minFactual = Math.min(...factualValues);

        if (maxFactual - minFactual > 0.15) {
            const bestFactualEngine = Object.entries(comparison.metrics.factualAlignment)
                .find(([_, value]) => value === maxFactual)?.[0];

            if (bestFactualEngine) {
                recommendations.push(
                    `${bestFactualEngine} shows the highest factual alignment score (${maxFactual.toFixed(3)})`
                );
            }
        }

        // Add recommendations based on significant differences
        if (significantDifferences.length > 0) {
            recommendations.push(
                `${significantDifferences.length} statistically significant differences detected between engines`
            );
        }

        return recommendations;
    }

    /**
     * Manage historical data with retention and compression
     */
    async manageHistoricalData(options: HistoricalDataOptions): Promise<{
        recordsProcessed: number;
        recordsArchived: number;
        recordsDeleted: number;
        compressionRatio: number;
    }> {
        logger.info('Managing historical data', options);

        const retentionDate = this.getRetentionDate(options.retentionPeriod);
        let recordsProcessed = 0;
        let recordsArchived = 0;
        let recordsDeleted = 0;

        return this.db.transaction(async (client) => {
            // Count records to be processed
            const countQuery = `
                SELECT COUNT(*) as count 
                FROM bias_metrics 
                WHERE calculated_at < $1
            `;
            const countResult = await client.query(countQuery, [retentionDate]);
            recordsProcessed = parseInt(countResult.rows[0].count, 10);

            if (recordsProcessed === 0) {
                return { recordsProcessed: 0, recordsArchived: 0, recordsDeleted: 0, compressionRatio: 1 };
            }

            // Archive old records if archive date is specified
            if (options.archiveOlderThan) {
                const archiveQuery = `
                    INSERT INTO bias_metrics_archive 
                    SELECT * FROM bias_metrics 
                    WHERE calculated_at < $1
                `;

                try {
                    const archiveResult = await client.query(archiveQuery, [options.archiveOlderThan]);
                    recordsArchived = archiveResult.rowCount || 0;
                } catch (error) {
                    logger.warn('Archive table does not exist, skipping archival', { error });
                }
            }

            // Compress data by aggregating daily metrics for old records
            if (options.compressionThreshold > 0) {
                await this.compressHistoricalData(client, retentionDate, options.compressionThreshold);
            }

            // Delete very old records beyond retention period
            const deleteQuery = `
                DELETE FROM bias_metrics 
                WHERE calculated_at < $1
            `;
            const deleteResult = await client.query(deleteQuery, [retentionDate]);
            recordsDeleted = deleteResult.rowCount || 0;

            const compressionRatio = recordsProcessed > 0
                ? (recordsProcessed - recordsDeleted) / recordsProcessed
                : 1;

            logger.info('Historical data management completed', {
                recordsProcessed,
                recordsArchived,
                recordsDeleted,
                compressionRatio
            });

            return {
                recordsProcessed,
                recordsArchived,
                recordsDeleted,
                compressionRatio
            };
        });
    }

    /**
     * Compress historical data by aggregating to daily averages
     */
    private async compressHistoricalData(
        client: any,
        beforeDate: Date,
        threshold: number
    ): Promise<void> {
        // Create daily aggregates for old data
        const compressionQuery = `
            WITH daily_aggregates AS (
                SELECT 
                    query_id,
                    DATE(calculated_at) as date,
                    AVG(domain_diversity_index) as avg_domain_diversity,
                    AVG(engine_overlap_coefficient) as avg_engine_overlap,
                    AVG(factual_alignment_score) as avg_factual_alignment,
                    COUNT(*) as record_count
                FROM bias_metrics 
                WHERE calculated_at < $1
                GROUP BY query_id, DATE(calculated_at)
                HAVING COUNT(*) >= $2
            ),
            compressed_records AS (
                INSERT INTO bias_metrics (
                    query_id,
                    domain_diversity_index,
                    engine_overlap_coefficient,
                    factual_alignment_score,
                    calculated_at,
                    metadata
                )
                SELECT 
                    query_id,
                    avg_domain_diversity,
                    avg_engine_overlap,
                    avg_factual_alignment,
                    date + INTERVAL '12 hours', -- Set to noon of the day
                    jsonb_build_object('compressed', true, 'original_count', record_count)
                FROM daily_aggregates
                RETURNING query_id, DATE(calculated_at) as date
            )
            DELETE FROM bias_metrics 
            WHERE calculated_at < $1
            AND (query_id, DATE(calculated_at)) IN (
                SELECT query_id, date FROM compressed_records
            )
            AND metadata->>'compressed' IS NULL
        `;

        await client.query(compressionQuery, [beforeDate, threshold]);
    }

    /**
     * Get historical metrics for a specific query or time range
     */
    async getHistoricalMetrics(
        queryId?: string,
        startDate?: Date,
        endDate?: Date,
        metricType?: 'domain_diversity' | 'engine_overlap' | 'factual_alignment'
    ): Promise<HistoricalMetric[]> {
        let query = `
            SELECT 
                id,
                query_id,
                domain_diversity_index,
                engine_overlap_coefficient,
                factual_alignment_score,
                calculated_at,
                metadata
            FROM bias_metrics 
            WHERE 1=1
        `;

        const params: any[] = [];
        let paramIndex = 1;

        if (queryId) {
            query += ` AND query_id = $${paramIndex++}`;
            params.push(queryId);
        }

        if (startDate) {
            query += ` AND calculated_at >= $${paramIndex++}`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND calculated_at <= $${paramIndex++}`;
            params.push(endDate);
        }

        query += ` ORDER BY calculated_at ASC`;

        const result = await this.db.query(query, params);

        return result.rows.map((row: any) => {
            let value: number;
            switch (metricType) {
                case 'domain_diversity':
                    value = parseFloat(row.domain_diversity_index) || 0;
                    break;
                case 'engine_overlap':
                    value = parseFloat(row.engine_overlap_coefficient) || 0;
                    break;
                case 'factual_alignment':
                    value = parseFloat(row.factual_alignment_score) || 0;
                    break;
                default:
                    // Return average of all metrics if no specific type requested
                    const dd = parseFloat(row.domain_diversity_index) || 0;
                    const eo = parseFloat(row.engine_overlap_coefficient) || 0;
                    const fa = parseFloat(row.factual_alignment_score) || 0;
                    value = (dd + eo + fa) / 3;
            }

            return {
                id: row.id,
                queryId: row.query_id,
                metricType: metricType || 'combined',
                value,
                calculatedAt: row.calculated_at,
                metadata: row.metadata
            } as HistoricalMetric;
        });
    }

    /**
     * Helper method to get date range for time period
     */
    private getDateRange(
        timePeriod: TimePeriod,
        startDate?: Date,
        endDate?: Date
    ): { startDate: Date; endDate: Date } {
        const end = endDate || new Date();
        let start: Date;

        if (startDate) {
            start = startDate;
        } else {
            start = new Date(end);
            switch (timePeriod) {
                case '1d':
                    start.setDate(start.getDate() - 1);
                    break;
                case '7d':
                    start.setDate(start.getDate() - 7);
                    break;
                case '30d':
                    start.setDate(start.getDate() - 30);
                    break;
                case '90d':
                    start.setDate(start.getDate() - 90);
                    break;
                case '1y':
                    start.setFullYear(start.getFullYear() - 1);
                    break;
            }
        }

        return { startDate: start, endDate: end };
    }

    /**
     * Helper method to get retention date
     */
    private getRetentionDate(retentionPeriod: TimePeriod): Date {
        const date = new Date();
        switch (retentionPeriod) {
            case '1d':
                date.setDate(date.getDate() - 1);
                break;
            case '7d':
                date.setDate(date.getDate() - 7);
                break;
            case '30d':
                date.setDate(date.getDate() - 30);
                break;
            case '90d':
                date.setDate(date.getDate() - 90);
                break;
            case '1y':
                date.setFullYear(date.getFullYear() - 1);
                break;
        }
        return date;
    }

    /**
     * Helper method to build aggregation query with filters
     */
    private buildAggregationQuery(
        options: AggregationOptions,
        startDate: Date,
        endDate: Date
    ): { whereClause: string; params: any[] } {
        const conditions = ['bm.calculated_at >= $1', 'bm.calculated_at <= $2'];
        const params = [startDate, endDate];
        let paramIndex = 3;

        if (options.categories && options.categories.length > 0) {
            conditions.push(`q.category = ANY($${paramIndex++})`);
            params.push(options.categories);
        }

        return {
            whereClause: `WHERE ${conditions.join(' AND ')}`,
            params
        };
    }

    /**
     * Helper method to map time period to timeframe
     */
    private mapTimePeriodToTimeframe(timePeriod: TimePeriod): '7d' | '30d' | '90d' {
        switch (timePeriod) {
            case '1d':
            case '7d':
                return '7d';
            case '30d':
                return '30d';
            case '90d':
            case '1y':
                return '90d';
            default:
                return '30d';
        }
    }
}

/**
 * Interface for the metrics aggregation service
 */
export interface MetricsAggregationServiceInterface {
    computeAggregatedMetrics(options: AggregationOptions): Promise<AggregatedMetrics>;
    performCrossEngineAnalysis(
        engines: string[],
        timePeriod?: TimePeriod,
        categories?: string[]
    ): Promise<CrossEngineAnalysis>;
    manageHistoricalData(options: HistoricalDataOptions): Promise<{
        recordsProcessed: number;
        recordsArchived: number;
        recordsDeleted: number;
        compressionRatio: number;
    }>;
    getHistoricalMetrics(
        queryId?: string,
        startDate?: Date,
        endDate?: Date,
        metricType?: 'domain_diversity' | 'engine_overlap' | 'factual_alignment'
    ): Promise<HistoricalMetric[]>;
}