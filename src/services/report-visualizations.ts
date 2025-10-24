/**
 * Visualization generation for transparency reports
 */

export interface ChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
        borderWidth?: number;
        fill?: boolean;
    }>;
}

export interface ChartConfig {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
    data: ChartData;
    options: {
        responsive?: boolean;
        maintainAspectRatio?: boolean;
        plugins?: {
            title?: {
                display: boolean;
                text: string;
            };
            legend?: {
                display: boolean;
                position?: 'top' | 'bottom' | 'left' | 'right';
            };
        };
        scales?: {
            x?: {
                beginAtZero?: boolean;
                title?: {
                    display: boolean;
                    text: string;
                };
            };
            y?: {
                beginAtZero?: boolean;
                max?: number;
                title?: {
                    display: boolean;
                    text: string;
                };
            };
        };
    };
}

export interface VisualizationData {
    aggregatedMetrics: any;
    crossEngineAnalysis: any;
    trendData?: any;
    anomalyData?: any;
}

/**
 * Color schemes for consistent visualization styling
 */
export const COLOR_SCHEMES = {
    primary: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
    engines: {
        google: '#4285f4',
        bing: '#00809d',
        perplexity: '#6366f1',
        brave: '#fb542b'
    },
    metrics: {
        domainDiversity: '#059669',
        engineOverlap: '#dc2626',
        factualAlignment: '#d97706'
    },
    trends: {
        improving: '#059669',
        declining: '#dc2626',
        stable: '#64748b',
        increasing: '#2563eb',
        decreasing: '#d97706'
    }
};

/**
 * Service for generating report visualizations
 */
export class ReportVisualizationService {
    /**
     * Generate bias metrics overview chart
     */
    static generateBiasMetricsOverview(data: VisualizationData): ChartConfig {
        const metrics = data.aggregatedMetrics.averageMetrics;

        return {
            type: 'bar',
            data: {
                labels: ['Domain Diversity', 'Engine Overlap', 'Factual Alignment'],
                datasets: [{
                    label: 'Average Score',
                    data: [
                        metrics.domainDiversity,
                        metrics.engineOverlap,
                        metrics.factualAlignment
                    ],
                    backgroundColor: [
                        COLOR_SCHEMES.metrics.domainDiversity,
                        COLOR_SCHEMES.metrics.engineOverlap,
                        COLOR_SCHEMES.metrics.factualAlignment
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Bias Metrics Overview'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1.0,
                        title: {
                            display: true,
                            text: 'Score (0-1)'
                        }
                    }
                }
            }
        };
    }

    /**
     * Generate engine performance comparison chart
     */
    static generateEngineComparison(data: VisualizationData): ChartConfig {
        const rankings = data.crossEngineAnalysis.overallComparison.rankings;

        return {
            type: 'bar',
            data: {
                labels: rankings.map((r: any) => r.engine),
                datasets: [{
                    label: 'Overall Performance Score',
                    data: rankings.map((r: any) => r.overallScore),
                    backgroundColor: rankings.map((r: any) =>
                        COLOR_SCHEMES.engines[r.engine as keyof typeof COLOR_SCHEMES.engines] || COLOR_SCHEMES.primary[0]
                    ),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Search Engine Performance Rankings'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1.0,
                        title: {
                            display: true,
                            text: 'Performance Score'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Search Engine'
                        }
                    }
                }
            }
        };
    }

    /**
     * Generate engine metrics comparison radar chart
     */
    static generateEngineRadarComparison(data: VisualizationData): ChartConfig {
        const metrics = data.crossEngineAnalysis.overallComparison.metrics;
        const engines = data.crossEngineAnalysis.engines;

        const datasets = engines.map((engine: string, index: number) => ({
            label: engine,
            data: [
                metrics.domainDiversity[engine] || 0,
                metrics.factualAlignment[engine] || 0,
                // Add engine overlap as inverse (1 - overlap) for better radar visualization
                1 - (data.aggregatedMetrics.averageMetrics.engineOverlap || 0)
            ],
            backgroundColor: `${COLOR_SCHEMES.engines[engine as keyof typeof COLOR_SCHEMES.engines] || COLOR_SCHEMES.primary[index]}20`,
            borderColor: COLOR_SCHEMES.engines[engine as keyof typeof COLOR_SCHEMES.engines] || COLOR_SCHEMES.primary[index],
            borderWidth: 2
        }));

        return {
            type: 'radar',
            data: {
                labels: ['Domain Diversity', 'Factual Alignment', 'Uniqueness'],
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Engine Performance Comparison'
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 1.0
                    }
                }
            }
        };
    }

    /**
     * Generate trend analysis line chart
     */
    static generateTrendAnalysis(data: VisualizationData): ChartConfig {
        const trends = data.aggregatedMetrics.trends;

        // Use domain diversity trend as the base for dates
        const dates = trends.domainDiversity.values.map((v: any) =>
            new Date(v.date).toLocaleDateString()
        );

        return {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Domain Diversity',
                        data: trends.domainDiversity.values.map((v: any) => v.value),
                        borderColor: COLOR_SCHEMES.metrics.domainDiversity,
                        backgroundColor: `${COLOR_SCHEMES.metrics.domainDiversity}20`,
                        borderWidth: 2,
                        fill: false
                    },
                    {
                        label: 'Engine Overlap',
                        data: trends.engineOverlap.values.map((v: any) => v.value),
                        borderColor: COLOR_SCHEMES.metrics.engineOverlap,
                        backgroundColor: `${COLOR_SCHEMES.metrics.engineOverlap}20`,
                        borderWidth: 2,
                        fill: false
                    },
                    {
                        label: 'Factual Alignment',
                        data: trends.factualAlignment.values.map((v: any) => v.value),
                        borderColor: COLOR_SCHEMES.metrics.factualAlignment,
                        backgroundColor: `${COLOR_SCHEMES.metrics.factualAlignment}20`,
                        borderWidth: 2,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Bias Metrics Trends Over Time'
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1.0,
                        title: {
                            display: true,
                            text: 'Metric Value'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                }
            }
        };
    }

    /**
     * Generate domain distribution pie chart
     */
    static generateDomainDistribution(data: VisualizationData): ChartConfig {
        // This would need domain distribution data from the metrics
        // For now, create a placeholder with sample data
        const sampleDomains = [
            { domain: 'news sites', percentage: 35 },
            { domain: 'government', percentage: 15 },
            { domain: 'academic', percentage: 20 },
            { domain: 'commercial', percentage: 25 },
            { domain: 'other', percentage: 5 }
        ];

        return {
            type: 'doughnut',
            data: {
                labels: sampleDomains.map(d => d.domain),
                datasets: [{
                    data: sampleDomains.map(d => d.percentage),
                    backgroundColor: COLOR_SCHEMES.primary,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Domain Type Distribution'
                    },
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            }
        };
    }

    /**
     * Generate engine overlap heatmap data
     */
    static generateEngineOverlapHeatmap(data: VisualizationData): {
        type: 'heatmap';
        data: Array<{
            engine1: string;
            engine2: string;
            overlap: number;
        }>;
        config: any;
    } {
        const engines = data.crossEngineAnalysis.engines;
        const enginePairs = data.crossEngineAnalysis.overallComparison.enginePairs || [];

        const heatmapData = [];

        // Create matrix data for heatmap
        for (let i = 0; i < engines.length; i++) {
            for (let j = 0; j < engines.length; j++) {
                if (i === j) {
                    heatmapData.push({
                        engine1: engines[i],
                        engine2: engines[j],
                        overlap: 1.0 // Self-overlap is 100%
                    });
                } else {
                    // Find overlap data for this pair
                    const pairData = enginePairs.find((pair: any) =>
                        (pair.engines[0] === engines[i] && pair.engines[1] === engines[j]) ||
                        (pair.engines[1] === engines[i] && pair.engines[0] === engines[j])
                    );

                    heatmapData.push({
                        engine1: engines[i],
                        engine2: engines[j],
                        overlap: pairData ? pairData.overlapPercentage / 100 : 0
                    });
                }
            }
        }

        return {
            type: 'heatmap',
            data: heatmapData,
            config: {
                title: 'Engine Result Overlap Matrix',
                colorScale: {
                    min: 0,
                    max: 1,
                    colors: ['#ffffff', '#3b82f6']
                }
            }
        };
    }

    /**
     * Generate factual score distribution histogram
     */
    static generateFactualScoreDistribution(data: VisualizationData): ChartConfig {
        // Sample distribution data - in real implementation, this would come from actual data
        const scoreRanges = [
            { range: '0.0-0.2', count: 5 },
            { range: '0.2-0.4', count: 12 },
            { range: '0.4-0.6', count: 25 },
            { range: '0.6-0.8', count: 35 },
            { range: '0.8-1.0', count: 23 }
        ];

        return {
            type: 'bar',
            data: {
                labels: scoreRanges.map(r => r.range),
                datasets: [{
                    label: 'Number of Results',
                    data: scoreRanges.map(r => r.count),
                    backgroundColor: COLOR_SCHEMES.metrics.factualAlignment,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Factual Score Distribution'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Results'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Factual Score Range'
                        }
                    }
                }
            }
        };
    }

    /**
     * Generate comprehensive visualization suite
     */
    static generateAllVisualizations(data: VisualizationData): Array<{
        id: string;
        title: string;
        description: string;
        config: ChartConfig | any;
    }> {
        return [
            {
                id: 'bias_metrics_overview',
                title: 'Bias Metrics Overview',
                description: 'Average bias metrics across all search engines',
                config: this.generateBiasMetricsOverview(data)
            },
            {
                id: 'engine_comparison',
                title: 'Engine Performance Comparison',
                description: 'Overall performance scores by search engine',
                config: this.generateEngineComparison(data)
            },
            {
                id: 'engine_radar',
                title: 'Engine Metrics Radar',
                description: 'Multi-dimensional comparison of engine performance',
                config: this.generateEngineRadarComparison(data)
            },
            {
                id: 'trend_analysis',
                title: 'Trend Analysis',
                description: 'Evolution of bias metrics over time',
                config: this.generateTrendAnalysis(data)
            },
            {
                id: 'domain_distribution',
                title: 'Domain Distribution',
                description: 'Distribution of result sources by domain type',
                config: this.generateDomainDistribution(data)
            },
            {
                id: 'engine_overlap_heatmap',
                title: 'Engine Overlap Heatmap',
                description: 'Matrix showing result overlap between search engines',
                config: this.generateEngineOverlapHeatmap(data)
            },
            {
                id: 'factual_score_distribution',
                title: 'Factual Score Distribution',
                description: 'Distribution of factual alignment scores',
                config: this.generateFactualScoreDistribution(data)
            }
        ];
    }

    /**
     * Convert chart config to Chart.js format
     */
    static toChartJS(config: ChartConfig): any {
        return {
            type: config.type,
            data: config.data,
            options: {
                ...config.options,
                plugins: {
                    ...config.options.plugins,
                    tooltip: {
                        callbacks: {
                            label: function (context: any) {
                                const label = context.dataset.label || '';
                                const value = typeof context.parsed.y !== 'undefined'
                                    ? context.parsed.y
                                    : context.parsed;

                                if (typeof value === 'number' && value <= 1) {
                                    return `${label}: ${(value * 100).toFixed(1)}%`;
                                }
                                return `${label}: ${value}`;
                            }
                        }
                    }
                }
            }
        };
    }

    /**
     * Generate SVG visualization for static reports
     */
    static generateSVGChart(config: ChartConfig, width: number = 400, height: number = 300): string {
        // Simple SVG generation for basic charts
        // In a real implementation, you might use a library like D3.js or similar

        if (config.type === 'bar') {
            return this.generateSVGBarChart(config, width, height);
        } else if (config.type === 'line') {
            return this.generateSVGLineChart(config, width, height);
        } else {
            return this.generateSVGPlaceholder(config, width, height);
        }
    }

    /**
     * Generate SVG bar chart
     */
    private static generateSVGBarChart(config: ChartConfig, width: number, height: number): string {
        const margin = { top: 40, right: 20, bottom: 60, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const data = config.data.datasets[0].data;
        const labels = config.data.labels;
        const maxValue = Math.max(...data);
        const barWidth = chartWidth / data.length * 0.8;
        const barSpacing = chartWidth / data.length * 0.2;

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        // Background
        svg += `<rect width="${width}" height="${height}" fill="white"/>`;

        // Title
        if (config.options.plugins?.title?.display) {
            svg += `<text x="${width / 2}" y="20" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold">${config.options.plugins.title.text}</text>`;
        }

        // Bars
        data.forEach((value: number, index: number) => {
            const barHeight = (value / maxValue) * chartHeight;
            const x = margin.left + index * (barWidth + barSpacing);
            const y = margin.top + chartHeight - barHeight;

            const color = Array.isArray(config.data.datasets[0].backgroundColor)
                ? config.data.datasets[0].backgroundColor[index]
                : config.data.datasets[0].backgroundColor || '#3b82f6';

            svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}"/>`;

            // Value labels
            svg += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-family="Arial" font-size="12">${(value * 100).toFixed(1)}%</text>`;

            // X-axis labels
            svg += `<text x="${x + barWidth / 2}" y="${height - 20}" text-anchor="middle" font-family="Arial" font-size="12">${labels[index]}</text>`;
        });

        // Y-axis
        svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="black" stroke-width="1"/>`;

        // X-axis
        svg += `<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="black" stroke-width="1"/>`;

        svg += '</svg>';
        return svg;
    }

    /**
     * Generate SVG line chart
     */
    private static generateSVGLineChart(config: ChartConfig, width: number, height: number): string {
        const margin = { top: 40, right: 20, bottom: 60, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

        // Background
        svg += `<rect width="${width}" height="${height}" fill="white"/>`;

        // Title
        if (config.options.plugins?.title?.display) {
            svg += `<text x="${width / 2}" y="20" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold">${config.options.plugins.title.text}</text>`;
        }

        // Draw each dataset
        config.data.datasets.forEach((dataset, datasetIndex) => {
            const data = dataset.data;
            const maxValue = 1.0; // Assuming normalized data
            const stepX = chartWidth / (data.length - 1);

            let pathD = '';
            data.forEach((value: number, index: number) => {
                const x = margin.left + index * stepX;
                const y = margin.top + chartHeight - (value / maxValue) * chartHeight;

                if (index === 0) {
                    pathD += `M ${x} ${y}`;
                } else {
                    pathD += ` L ${x} ${y}`;
                }
            });

            svg += `<path d="${pathD}" stroke="${dataset.borderColor}" stroke-width="2" fill="none"/>`;
        });

        // Axes
        svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="black" stroke-width="1"/>`;
        svg += `<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="black" stroke-width="1"/>`;

        svg += '</svg>';
        return svg;
    }

    /**
     * Generate SVG placeholder for unsupported chart types
     */
    private static generateSVGPlaceholder(config: ChartConfig, width: number, height: number): string {
        return `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${width}" height="${height}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2" stroke-dasharray="5,5"/>
                <text x="${width / 2}" y="${height / 2 - 10}" text-anchor="middle" font-family="Arial" font-size="14" fill="#6b7280">
                    ${config.options.plugins?.title?.text || 'Chart Visualization'}
                </text>
                <text x="${width / 2}" y="${height / 2 + 10}" text-anchor="middle" font-family="Arial" font-size="12" fill="#9ca3af">
                    (${config.type} chart)
                </text>
            </svg>
        `;
    }
}