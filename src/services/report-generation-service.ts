import { DatabaseConnection } from '../database/connection';
import { MetricsService } from './metrics-service';
import { MetricsAggregationService, AggregationOptions, TimePeriod } from './metrics-aggregation-service';
import { logger } from '../utils/logger';

/**
 * Report configuration options
 */
export interface ReportConfig {
    title: string;
    subtitle?: string;
    timePeriod: TimePeriod;
    engines: string[];
    categories?: string[];
    includeVisualization: boolean;
    includeRawData: boolean;
    format: 'html' | 'markdown' | 'json';
    branding?: {
        logo?: string;
        organizationName?: string;
        contactInfo?: string;
    };
}

/**
 * Generated report structure
 */
export interface GeneratedReport {
    id: string;
    config: ReportConfig;
    metadata: {
        generatedAt: Date;
        dataRange: {
            startDate: Date;
            endDate: Date;
        };
        totalQueries: number;
        totalResults: number;
    };
    executiveSummary: {
        keyFindings: string[];
        recommendations: string[];
        overallTrends: {
            domainDiversity: 'improving' | 'declining' | 'stable';
            engineOverlap: 'increasing' | 'decreasing' | 'stable';
            factualAlignment: 'improving' | 'declining' | 'stable';
        };
    };
    sections: {
        biasMetricsOverview: BiasMetricsSection;
        engineComparison: EngineComparisonSection;
        trendAnalysis: TrendAnalysisSection;
        keyInsights: KeyInsightsSection;
        methodology: MethodologySection;
    };
    visualizations: ReportVisualization[];
    rawData?: any;
    content: string; // Rendered report content
}

/**
 * Report section interfaces
 */
export interface BiasMetricsSection {
    title: string;
    summary: string;
    metrics: {
        averageDomainDiversity: number;
        averageEngineOverlap: number;
        averageFactualAlignment: number;
    };
    insights: string[];
    charts: string[];
}

export interface EngineComparisonSection {
    title: string;
    summary: string;
    rankings: Array<{
        engine: string;
        rank: number;
        overallScore: number;
        strengths: string[];
        weaknesses: string[];
    }>;
    significantDifferences: Array<{
        metric: string;
        engines: [string, string];
        difference: number;
        significance: string;
    }>;
    charts: string[];
}

export interface TrendAnalysisSection {
    title: string;
    summary: string;
    trends: {
        domainDiversity: {
            direction: 'improving' | 'declining' | 'stable';
            changePercentage: number;
            significance: number;
        };
        engineOverlap: {
            direction: 'increasing' | 'decreasing' | 'stable';
            changePercentage: number;
            significance: number;
        };
        factualAlignment: {
            direction: 'improving' | 'declining' | 'stable';
            changePercentage: number;
            significance: number;
        };
    };
    anomalies: Array<{
        date: Date;
        metric: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
    }>;
    charts: string[];
}

export interface KeyInsightsSection {
    title: string;
    insights: Array<{
        category: string;
        finding: string;
        impact: 'high' | 'medium' | 'low';
        evidence: string[];
    }>;
}

export interface MethodologySection {
    title: string;
    dataCollection: string;
    biasMetrics: string;
    limitations: string[];
    reproducibility: string;
}

export interface ReportVisualization {
    id: string;
    type: 'line_chart' | 'bar_chart' | 'pie_chart' | 'heatmap' | 'scatter_plot';
    title: string;
    description: string;
    data: any;
    config: any;
}

/**
 * Service for generating automated transparency reports
 */
export class ReportGenerationService {
    private metricsService: MetricsService;
    private aggregationService: MetricsAggregationService;

    constructor(private db: DatabaseConnection) {
        this.metricsService = new MetricsService(db);
        this.aggregationService = new MetricsAggregationService(db);
    }

    /**
     * Generate a comprehensive transparency report
     */
    async generateReport(config: ReportConfig): Promise<GeneratedReport> {
        logger.info('Starting report generation', { config });

        try {
            // Gather data for the report
            const aggregationOptions: AggregationOptions = {
                timePeriod: config.timePeriod,
                engines: config.engines,
                categories: config.categories
            };

            const [aggregatedMetrics, crossEngineAnalysis] = await Promise.all([
                this.aggregationService.computeAggregatedMetrics(aggregationOptions),
                this.aggregationService.performCrossEngineAnalysis(config.engines, config.timePeriod, config.categories)
            ]);

            // Generate report ID
            const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create report metadata
            const metadata = {
                generatedAt: new Date(),
                dataRange: {
                    startDate: aggregatedMetrics.startDate,
                    endDate: aggregatedMetrics.endDate
                },
                totalQueries: aggregatedMetrics.totalQueries,
                totalResults: Object.values(aggregatedMetrics.metricsByEngine)
                    .reduce((sum, engine) => sum + engine.queryCount, 0)
            };

            // Generate executive summary
            const executiveSummary = await this.generateExecutiveSummary(
                aggregatedMetrics,
                crossEngineAnalysis
            );

            // Generate report sections
            const sections = {
                biasMetricsOverview: await this.generateBiasMetricsSection(aggregatedMetrics),
                engineComparison: await this.generateEngineComparisonSection(crossEngineAnalysis),
                trendAnalysis: await this.generateTrendAnalysisSection(aggregatedMetrics),
                keyInsights: await this.generateKeyInsightsSection(aggregatedMetrics, crossEngineAnalysis),
                methodology: this.generateMethodologySection()
            };

            // Generate visualizations
            const visualizations = config.includeVisualization
                ? await this.generateVisualizations(aggregatedMetrics, crossEngineAnalysis)
                : [];

            // Render report content
            const content = await this.renderReport(config, metadata, executiveSummary, sections, visualizations);

            const report: GeneratedReport = {
                id: reportId,
                config,
                metadata,
                executiveSummary,
                sections,
                visualizations,
                rawData: config.includeRawData ? { aggregatedMetrics, crossEngineAnalysis } : undefined,
                content
            };

            // Store report in database
            await this.storeReport(report);

            logger.info('Report generation completed', {
                reportId,
                contentLength: content.length,
                visualizationCount: visualizations.length
            });

            return report;
        } catch (error) {
            logger.error('Report generation failed', { config, error });
            throw new Error(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate executive summary with key findings and recommendations
     */
    private async generateExecutiveSummary(
        aggregatedMetrics: any,
        crossEngineAnalysis: any
    ): Promise<any> {
        const keyFindings: string[] = [];
        const recommendations: string[] = [];

        // Analyze overall metrics
        const avgDiversity = aggregatedMetrics.averageMetrics.domainDiversity;
        const avgOverlap = aggregatedMetrics.averageMetrics.engineOverlap;
        const avgFactual = aggregatedMetrics.averageMetrics.factualAlignment;

        // Domain diversity findings
        if (avgDiversity > 0.7) {
            keyFindings.push(`High domain diversity observed (${(avgDiversity * 100).toFixed(1)}%), indicating good source variety across search engines.`);
        } else if (avgDiversity < 0.3) {
            keyFindings.push(`Low domain diversity detected (${(avgDiversity * 100).toFixed(1)}%), suggesting potential source concentration issues.`);
            recommendations.push('Consider investigating factors contributing to limited source diversity.');
        }

        // Engine overlap findings
        if (avgOverlap > 0.6) {
            keyFindings.push(`High engine overlap (${(avgOverlap * 100).toFixed(1)}%) suggests similar result patterns across search engines.`);
        } else if (avgOverlap < 0.2) {
            keyFindings.push(`Low engine overlap (${(avgOverlap * 100).toFixed(1)}%) indicates significant differences in search engine results.`);
        }

        // Factual alignment findings
        if (avgFactual > 0.8) {
            keyFindings.push(`Strong factual alignment (${(avgFactual * 100).toFixed(1)}%) across search results indicates high information quality.`);
        } else if (avgFactual < 0.6) {
            keyFindings.push(`Moderate factual alignment (${(avgFactual * 100).toFixed(1)}%) suggests variability in information quality.`);
            recommendations.push('Monitor factual consistency trends and investigate sources of variation.');
        }

        // Engine performance findings
        const topEngine = crossEngineAnalysis.overallComparison.rankings[0];
        if (topEngine) {
            keyFindings.push(`${topEngine.engine} demonstrates the highest overall performance with a score of ${topEngine.overallScore.toFixed(3)}.`);
        }

        // Significant differences
        if (crossEngineAnalysis.significantDifferences.length > 0) {
            keyFindings.push(`${crossEngineAnalysis.significantDifferences.length} statistically significant differences detected between search engines.`);
            recommendations.push('Review engine-specific differences to understand algorithmic variations.');
        }

        // Trend analysis
        const overallTrends = {
            domainDiversity: this.categorizeTrend(aggregatedMetrics.trends.domainDiversity),
            engineOverlap: this.categorizeTrend(aggregatedMetrics.trends.engineOverlap),
            factualAlignment: this.categorizeTrend(aggregatedMetrics.trends.factualAlignment)
        };

        // Add trend-based recommendations
        if (overallTrends.domainDiversity === 'declining') {
            recommendations.push('Address declining domain diversity through algorithmic adjustments or source expansion.');
        }
        if (overallTrends.factualAlignment === 'declining') {
            recommendations.push('Investigate factors contributing to declining factual alignment scores.');
        }

        return {
            keyFindings,
            recommendations,
            overallTrends
        };
    }

    /**
     * Generate bias metrics overview section
     */
    private async generateBiasMetricsSection(aggregatedMetrics: any): Promise<BiasMetricsSection> {
        const metrics = aggregatedMetrics.averageMetrics;
        const insights: string[] = [];

        // Generate insights based on metric values
        if (metrics.domainDiversity > 0.6) {
            insights.push('Domain diversity is within acceptable range, indicating healthy source variety.');
        } else {
            insights.push('Domain diversity could be improved to ensure broader source representation.');
        }

        if (metrics.engineOverlap < 0.4) {
            insights.push('Low engine overlap suggests diverse algorithmic approaches across search engines.');
        } else {
            insights.push('High engine overlap indicates similar result patterns across different search engines.');
        }

        if (metrics.factualAlignment > 0.7) {
            insights.push('Factual alignment scores demonstrate good information quality across results.');
        } else {
            insights.push('Factual alignment scores indicate room for improvement in information quality.');
        }

        return {
            title: 'Bias Metrics Overview',
            summary: `Analysis of ${aggregatedMetrics.totalQueries} queries across ${Object.keys(aggregatedMetrics.metricsByEngine).length} search engines reveals key patterns in algorithmic bias and information diversity.`,
            metrics: {
                averageDomainDiversity: metrics.domainDiversity,
                averageEngineOverlap: metrics.engineOverlap,
                averageFactualAlignment: metrics.factualAlignment
            },
            insights,
            charts: ['bias_metrics_overview', 'metrics_comparison']
        };
    }

    /**
     * Generate engine comparison section
     */
    private async generateEngineComparisonSection(crossEngineAnalysis: any): Promise<EngineComparisonSection> {
        const rankings = crossEngineAnalysis.overallComparison.rankings.map((ranking: any) => {
            const strengths: string[] = [];
            const weaknesses: string[] = [];

            // Analyze engine-specific metrics
            const domainScore = crossEngineAnalysis.overallComparison.metrics.domainDiversity[ranking.engine] || 0;
            const factualScore = crossEngineAnalysis.overallComparison.metrics.factualAlignment[ranking.engine] || 0;

            if (domainScore > 0.7) {
                strengths.push('High domain diversity');
            } else if (domainScore < 0.4) {
                weaknesses.push('Limited domain diversity');
            }

            if (factualScore > 0.8) {
                strengths.push('Strong factual alignment');
            } else if (factualScore < 0.6) {
                weaknesses.push('Moderate factual alignment');
            }

            return {
                engine: ranking.engine,
                rank: ranking.rank,
                overallScore: ranking.overallScore,
                strengths,
                weaknesses
            };
        });

        const significantDifferences = crossEngineAnalysis.significantDifferences.map((diff: any) => ({
            metric: diff.metric,
            engines: diff.engines,
            difference: diff.difference,
            significance: diff.pValue < 0.01 ? 'High' : diff.pValue < 0.05 ? 'Moderate' : 'Low'
        }));

        return {
            title: 'Search Engine Comparison',
            summary: `Comparative analysis of ${crossEngineAnalysis.engines.length} search engines reveals performance differences and algorithmic variations.`,
            rankings,
            significantDifferences,
            charts: ['engine_rankings', 'engine_metrics_comparison']
        };
    }

    /**
     * Generate trend analysis section
     */
    private async generateTrendAnalysisSection(aggregatedMetrics: any): Promise<TrendAnalysisSection> {
        const trends = {
            domainDiversity: {
                direction: this.categorizeTrend(aggregatedMetrics.trends.domainDiversity),
                changePercentage: aggregatedMetrics.trends.domainDiversity.changePercentage,
                significance: aggregatedMetrics.trends.domainDiversity.significance
            },
            engineOverlap: {
                direction: this.categorizeTrend(aggregatedMetrics.trends.engineOverlap),
                changePercentage: aggregatedMetrics.trends.engineOverlap.changePercentage,
                significance: aggregatedMetrics.trends.engineOverlap.significance
            },
            factualAlignment: {
                direction: this.categorizeTrend(aggregatedMetrics.trends.factualAlignment),
                changePercentage: aggregatedMetrics.trends.factualAlignment.changePercentage,
                significance: aggregatedMetrics.trends.factualAlignment.significance
            }
        };

        // Detect anomalies (placeholder - would need actual anomaly detection data)
        const anomalies: any[] = [];

        return {
            title: 'Trend Analysis',
            summary: `Temporal analysis reveals evolving patterns in search engine bias metrics over the selected time period.`,
            trends,
            anomalies,
            charts: ['trend_lines', 'anomaly_detection']
        };
    }

    /**
     * Generate key insights section
     */
    private async generateKeyInsightsSection(aggregatedMetrics: any, crossEngineAnalysis: any): Promise<KeyInsightsSection> {
        const insights: any[] = [];

        // Engine performance insights
        const topEngine = crossEngineAnalysis.overallComparison.rankings[0];
        if (topEngine) {
            insights.push({
                category: 'Engine Performance',
                finding: `${topEngine.engine} demonstrates superior overall performance`,
                impact: 'high' as const,
                evidence: [
                    `Highest overall score: ${topEngine.overallScore.toFixed(3)}`,
                    `Ranked #1 among ${crossEngineAnalysis.engines.length} engines`
                ]
            });
        }

        // Domain diversity insights
        const avgDiversity = aggregatedMetrics.averageMetrics.domainDiversity;
        if (avgDiversity < 0.4) {
            insights.push({
                category: 'Source Diversity',
                finding: 'Limited domain diversity across search results',
                impact: 'medium' as const,
                evidence: [
                    `Average domain diversity: ${(avgDiversity * 100).toFixed(1)}%`,
                    'Below recommended threshold of 40%'
                ]
            });
        }

        // Factual alignment insights
        const avgFactual = aggregatedMetrics.averageMetrics.factualAlignment;
        if (avgFactual > 0.8) {
            insights.push({
                category: 'Information Quality',
                finding: 'High factual alignment across search engines',
                impact: 'high' as const,
                evidence: [
                    `Average factual alignment: ${(avgFactual * 100).toFixed(1)}%`,
                    'Indicates consistent information quality'
                ]
            });
        }

        return {
            title: 'Key Insights',
            insights
        };
    }

    /**
     * Generate methodology section
     */
    private generateMethodologySection(): MethodologySection {
        return {
            title: 'Methodology',
            dataCollection: 'Search results were collected from multiple engines using automated scrapers with proxy rotation and anti-detection measures. Results were normalized to a common schema and stored with temporal metadata.',
            biasMetrics: 'Three core metrics were computed: Domain Diversity Index (unique domains / total results), Engine Overlap Coefficient (shared URLs / total unique URLs), and Factual Alignment Score (weighted average of LLM-based factual assessments).',
            limitations: [
                'Results limited to top 20 search results per query per engine',
                'Factual scoring based on LLM analysis which may contain inherent biases',
                'Temporal variations in search engine algorithms may affect consistency',
                'Proxy usage may influence result localization'
            ],
            reproducibility: 'All queries, collection timestamps, and processing parameters are stored for reproducibility. Raw HTML snapshots are preserved for auditing purposes.'
        };
    }

    /**
     * Generate visualizations for the report
     */
    private async generateVisualizations(aggregatedMetrics: any, crossEngineAnalysis: any): Promise<ReportVisualization[]> {
        const visualizations: ReportVisualization[] = [];

        // Bias metrics overview chart
        visualizations.push({
            id: 'bias_metrics_overview',
            type: 'bar_chart',
            title: 'Bias Metrics Overview',
            description: 'Average bias metrics across all search engines',
            data: {
                labels: ['Domain Diversity', 'Engine Overlap', 'Factual Alignment'],
                datasets: [{
                    label: 'Average Score',
                    data: [
                        aggregatedMetrics.averageMetrics.domainDiversity,
                        aggregatedMetrics.averageMetrics.engineOverlap,
                        aggregatedMetrics.averageMetrics.factualAlignment
                    ],
                    backgroundColor: ['#3B82F6', '#10B981', '#F59E0B']
                }]
            },
            config: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1.0
                    }
                }
            }
        });

        // Engine rankings chart
        visualizations.push({
            id: 'engine_rankings',
            type: 'bar_chart',
            title: 'Search Engine Performance Rankings',
            description: 'Overall performance scores by search engine',
            data: {
                labels: crossEngineAnalysis.overallComparison.rankings.map((r: any) => r.engine),
                datasets: [{
                    label: 'Overall Score',
                    data: crossEngineAnalysis.overallComparison.rankings.map((r: any) => r.overallScore),
                    backgroundColor: '#6366F1'
                }]
            },
            config: {
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 1.0
                    }
                }
            }
        });

        // Trend analysis chart
        if (aggregatedMetrics.trends.domainDiversity.values.length > 0) {
            visualizations.push({
                id: 'trend_lines',
                type: 'line_chart',
                title: 'Bias Metrics Trends Over Time',
                description: 'Evolution of bias metrics across the analysis period',
                data: {
                    labels: aggregatedMetrics.trends.domainDiversity.values.map((v: any) =>
                        v.date.toISOString().split('T')[0]
                    ),
                    datasets: [
                        {
                            label: 'Domain Diversity',
                            data: aggregatedMetrics.trends.domainDiversity.values.map((v: any) => v.value),
                            borderColor: '#3B82F6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)'
                        },
                        {
                            label: 'Engine Overlap',
                            data: aggregatedMetrics.trends.engineOverlap.values.map((v: any) => v.value),
                            borderColor: '#10B981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)'
                        },
                        {
                            label: 'Factual Alignment',
                            data: aggregatedMetrics.trends.factualAlignment.values.map((v: any) => v.value),
                            borderColor: '#F59E0B',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)'
                        }
                    ]
                },
                config: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 1.0
                        }
                    }
                }
            });
        }

        return visualizations;
    }

    /**
     * Render report content based on format
     */
    private async renderReport(
        config: ReportConfig,
        metadata: any,
        executiveSummary: any,
        sections: any,
        visualizations: ReportVisualization[]
    ): Promise<string> {
        switch (config.format) {
            case 'html':
                return this.renderHTMLReport(config, metadata, executiveSummary, sections, visualizations);
            case 'markdown':
                return this.renderMarkdownReport(config, metadata, executiveSummary, sections, visualizations);
            case 'json':
                return JSON.stringify({
                    config,
                    metadata,
                    executiveSummary,
                    sections,
                    visualizations
                }, null, 2);
            default:
                throw new Error(`Unsupported report format: ${config.format}`);
        }
    }

    /**
     * Render HTML report
     */
    private renderHTMLReport(
        config: ReportConfig,
        metadata: any,
        executiveSummary: any,
        sections: any,
        visualizations: ReportVisualization[]
    ): string {
        const branding = config.branding || {};

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 40px; }
        .metric-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 10px 0; }
        .insight { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 10px 0; }
        .recommendation { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 10px 0; }
        .chart-placeholder { background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; padding: 40px; text-align: center; color: #6b7280; margin: 20px 0; }
        .metadata { font-size: 0.9em; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background: #f9fafb; font-weight: 600; }
    </style>
</head>
<body>
    <div class="header">
        ${branding.logo ? `<img src="${branding.logo}" alt="Logo" style="max-height: 60px; margin-bottom: 20px;">` : ''}
        <h1>${config.title}</h1>
        ${config.subtitle ? `<h2 style="color: #6b7280; font-weight: 400;">${config.subtitle}</h2>` : ''}
        <div class="metadata">
            Generated on ${metadata.generatedAt.toLocaleDateString()} | 
            Data period: ${metadata.dataRange.startDate.toLocaleDateString()} - ${metadata.dataRange.endDate.toLocaleDateString()} |
            ${metadata.totalQueries} queries analyzed
        </div>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <h3>Key Findings</h3>
        ${executiveSummary.keyFindings.map((finding: string) => `<div class="insight">${finding}</div>`).join('')}
        
        <h3>Recommendations</h3>
        ${executiveSummary.recommendations.map((rec: string) => `<div class="recommendation">${rec}</div>`).join('')}
    </div>

    <div class="section">
        <h2>${sections.biasMetricsOverview.title}</h2>
        <p>${sections.biasMetricsOverview.summary}</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <div class="metric-card">
                <h4>Domain Diversity</h4>
                <div style="font-size: 2em; font-weight: bold; color: #3b82f6;">
                    ${(sections.biasMetricsOverview.metrics.averageDomainDiversity * 100).toFixed(1)}%
                </div>
            </div>
            <div class="metric-card">
                <h4>Engine Overlap</h4>
                <div style="font-size: 2em; font-weight: bold; color: #10b981;">
                    ${(sections.biasMetricsOverview.metrics.averageEngineOverlap * 100).toFixed(1)}%
                </div>
            </div>
            <div class="metric-card">
                <h4>Factual Alignment</h4>
                <div style="font-size: 2em; font-weight: bold; color: #f59e0b;">
                    ${(sections.biasMetricsOverview.metrics.averageFactualAlignment * 100).toFixed(1)}%
                </div>
            </div>
        </div>

        ${sections.biasMetricsOverview.insights.map((insight: string) => `<div class="insight">${insight}</div>`).join('')}
    </div>

    <div class="section">
        <h2>${sections.engineComparison.title}</h2>
        <p>${sections.engineComparison.summary}</p>
        
        <h3>Engine Rankings</h3>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Engine</th>
                    <th>Overall Score</th>
                    <th>Strengths</th>
                    <th>Areas for Improvement</th>
                </tr>
            </thead>
            <tbody>
                ${sections.engineComparison.rankings.map((ranking: any) => `
                    <tr>
                        <td>${ranking.rank}</td>
                        <td><strong>${ranking.engine}</strong></td>
                        <td>${ranking.overallScore.toFixed(3)}</td>
                        <td>${ranking.strengths.join(', ') || 'N/A'}</td>
                        <td>${ranking.weaknesses.join(', ') || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>${sections.trendAnalysis.title}</h2>
        <p>${sections.trendAnalysis.summary}</p>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
            <div class="metric-card">
                <h4>Domain Diversity Trend</h4>
                <div style="font-size: 1.5em; font-weight: bold;">
                    ${sections.trendAnalysis.trends.domainDiversity.direction}
                </div>
                <div>Change: ${sections.trendAnalysis.trends.domainDiversity.changePercentage.toFixed(1)}%</div>
            </div>
            <div class="metric-card">
                <h4>Engine Overlap Trend</h4>
                <div style="font-size: 1.5em; font-weight: bold;">
                    ${sections.trendAnalysis.trends.engineOverlap.direction}
                </div>
                <div>Change: ${sections.trendAnalysis.trends.engineOverlap.changePercentage.toFixed(1)}%</div>
            </div>
            <div class="metric-card">
                <h4>Factual Alignment Trend</h4>
                <div style="font-size: 1.5em; font-weight: bold;">
                    ${sections.trendAnalysis.trends.factualAlignment.direction}
                </div>
                <div>Change: ${sections.trendAnalysis.trends.factualAlignment.changePercentage.toFixed(1)}%</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>${sections.keyInsights.title}</h2>
        ${sections.keyInsights.insights.map((insight: any) => `
            <div class="insight">
                <h4>${insight.category} - ${insight.impact.toUpperCase()} IMPACT</h4>
                <p><strong>${insight.finding}</strong></p>
                <ul>
                    ${insight.evidence.map((evidence: string) => `<li>${evidence}</li>`).join('')}
                </ul>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>${sections.methodology.title}</h2>
        <h3>Data Collection</h3>
        <p>${sections.methodology.dataCollection}</p>
        
        <h3>Bias Metrics</h3>
        <p>${sections.methodology.biasMetrics}</p>
        
        <h3>Limitations</h3>
        <ul>
            ${sections.methodology.limitations.map((limitation: string) => `<li>${limitation}</li>`).join('')}
        </ul>
        
        <h3>Reproducibility</h3>
        <p>${sections.methodology.reproducibility}</p>
    </div>

    ${visualizations.length > 0 ? `
    <div class="section">
        <h2>Visualizations</h2>
        ${visualizations.map((viz: ReportVisualization) => `
            <div class="chart-placeholder">
                <h3>${viz.title}</h3>
                <p>${viz.description}</p>
                <p><em>Chart data available in JSON format</em></p>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <footer style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280;">
        ${branding.organizationName ? `<p>Generated by ${branding.organizationName}</p>` : ''}
        ${branding.contactInfo ? `<p>${branding.contactInfo}</p>` : ''}
        <p>Report generated on ${metadata.generatedAt.toISOString()}</p>
    </footer>
</body>
</html>
        `.trim();
    }

    /**
     * Render Markdown report
     */
    private renderMarkdownReport(
        config: ReportConfig,
        metadata: any,
        executiveSummary: any,
        sections: any,
        visualizations: ReportVisualization[]
    ): string {
        const branding = config.branding || {};

        return `
# ${config.title}

${config.subtitle ? `## ${config.subtitle}` : ''}

**Generated:** ${metadata.generatedAt.toLocaleDateString()}  
**Data Period:** ${metadata.dataRange.startDate.toLocaleDateString()} - ${metadata.dataRange.endDate.toLocaleDateString()}  
**Queries Analyzed:** ${metadata.totalQueries}

## Executive Summary

### Key Findings

${executiveSummary.keyFindings.map((finding: string) => `- ${finding}`).join('\n')}

### Recommendations

${executiveSummary.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

## ${sections.biasMetricsOverview.title}

${sections.biasMetricsOverview.summary}

### Metrics Overview

| Metric | Value |
|--------|-------|
| Domain Diversity | ${(sections.biasMetricsOverview.metrics.averageDomainDiversity * 100).toFixed(1)}% |
| Engine Overlap | ${(sections.biasMetricsOverview.metrics.averageEngineOverlap * 100).toFixed(1)}% |
| Factual Alignment | ${(sections.biasMetricsOverview.metrics.averageFactualAlignment * 100).toFixed(1)}% |

### Insights

${sections.biasMetricsOverview.insights.map((insight: string) => `- ${insight}`).join('\n')}

## ${sections.engineComparison.title}

${sections.engineComparison.summary}

### Engine Rankings

| Rank | Engine | Overall Score | Strengths | Areas for Improvement |
|------|--------|---------------|-----------|----------------------|
${sections.engineComparison.rankings.map((ranking: any) =>
            `| ${ranking.rank} | **${ranking.engine}** | ${ranking.overallScore.toFixed(3)} | ${ranking.strengths.join(', ') || 'N/A'} | ${ranking.weaknesses.join(', ') || 'N/A'} |`
        ).join('\n')}

## ${sections.trendAnalysis.title}

${sections.trendAnalysis.summary}

### Trend Summary

| Metric | Direction | Change |
|--------|-----------|--------|
| Domain Diversity | ${sections.trendAnalysis.trends.domainDiversity.direction} | ${sections.trendAnalysis.trends.domainDiversity.changePercentage.toFixed(1)}% |
| Engine Overlap | ${sections.trendAnalysis.trends.engineOverlap.direction} | ${sections.trendAnalysis.trends.engineOverlap.changePercentage.toFixed(1)}% |
| Factual Alignment | ${sections.trendAnalysis.trends.factualAlignment.direction} | ${sections.trendAnalysis.trends.factualAlignment.changePercentage.toFixed(1)}% |

## ${sections.keyInsights.title}

${sections.keyInsights.insights.map((insight: any) => `
### ${insight.category} (${insight.impact.toUpperCase()} Impact)

**${insight.finding}**

Evidence:
${insight.evidence.map((evidence: string) => `- ${evidence}`).join('\n')}
`).join('\n')}

## ${sections.methodology.title}

### Data Collection

${sections.methodology.dataCollection}

### Bias Metrics

${sections.methodology.biasMetrics}

### Limitations

${sections.methodology.limitations.map((limitation: string) => `- ${limitation}`).join('\n')}

### Reproducibility

${sections.methodology.reproducibility}

---

${branding.organizationName ? `*Generated by ${branding.organizationName}*  ` : ''}
${branding.contactInfo ? `*${branding.contactInfo}*  ` : ''}
*Report generated on ${metadata.generatedAt.toISOString()}*
        `.trim();
    }

    /**
     * Store generated report in database
     */
    private async storeReport(report: GeneratedReport): Promise<void> {
        const query = `
            INSERT INTO generated_reports (
                id,
                title,
                config,
                metadata,
                content,
                generated_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await this.db.query(query, [
            report.id,
            report.config.title,
            JSON.stringify(report.config),
            JSON.stringify(report.metadata),
            report.content,
            report.metadata.generatedAt
        ]);

        logger.info('Report stored in database', { reportId: report.id });
    }

    /**
     * Helper method to categorize trend direction
     */
    private categorizeTrend(trend: any): 'improving' | 'declining' | 'stable' | 'increasing' | 'decreasing' {
        if (Math.abs(trend.changePercentage) < 5) {
            return 'stable';
        }

        // For metrics where higher is better (domain diversity, factual alignment)
        if (trend.metric === 'domain_diversity' || trend.metric === 'factual_alignment') {
            return trend.changePercentage > 0 ? 'improving' : 'declining';
        }

        // For engine overlap, direction is neutral
        return trend.changePercentage > 0 ? 'increasing' : 'decreasing';
    }

    /**
     * Get list of generated reports
     */
    async getReports(limit: number = 50): Promise<Array<{
        id: string;
        title: string;
        generatedAt: Date;
        config: ReportConfig;
    }>> {
        const query = `
            SELECT id, title, generated_at, config
            FROM generated_reports
            ORDER BY generated_at DESC
            LIMIT $1
        `;

        const result = await this.db.query(query, [limit]);

        return result.rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            generatedAt: row.generated_at,
            config: JSON.parse(row.config)
        }));
    }

    /**
     * Get a specific report by ID
     */
    async getReport(reportId: string): Promise<GeneratedReport | null> {
        const query = `
            SELECT id, title, config, metadata, content, generated_at
            FROM generated_reports
            WHERE id = $1
        `;

        const result = await this.db.query(query, [reportId]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];

        // Reconstruct the report object (simplified version)
        return {
            id: row.id,
            config: JSON.parse(row.config),
            metadata: JSON.parse(row.metadata),
            content: row.content,
            // Note: Other fields would need to be reconstructed from stored data
            executiveSummary: { keyFindings: [], recommendations: [], overallTrends: {} as any },
            sections: {} as any,
            visualizations: []
        };
    }
}

/**
 * Interface for the report generation service
 */
export interface ReportGenerationServiceInterface {
    generateReport(config: ReportConfig): Promise<GeneratedReport>;
    getReports(limit?: number): Promise<Array<{
        id: string;
        title: string;
        generatedAt: Date;
        config: ReportConfig;
    }>>;
    getReport(reportId: string): Promise<GeneratedReport | null>;
}