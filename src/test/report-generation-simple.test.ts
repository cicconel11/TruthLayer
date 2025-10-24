import { describe, it, expect } from 'vitest';
import { getReportTemplate, getAvailableTemplates } from '../services/report-templates';
import { ReportVisualizationService, COLOR_SCHEMES } from '../services/report-visualizations';

describe('Report Generation Components', () => {
    describe('Report Templates', () => {
        it('should load available templates', () => {
            const templates = getAvailableTemplates();
            expect(templates.length).toBeGreaterThan(0);

            const standardTemplate = templates.find(t => t.id === 'transparency_standard');
            expect(standardTemplate).toBeDefined();
            expect(standardTemplate?.name).toBe('Standard Transparency Report');
        });

        it('should have required template properties', () => {
            const template = getReportTemplate('transparency_standard');
            expect(template).toBeDefined();
            expect(template).toHaveProperty('id');
            expect(template).toHaveProperty('name');
            expect(template).toHaveProperty('description');
            expect(template).toHaveProperty('defaultConfig');
            expect(template).toHaveProperty('htmlTemplate');
            expect(template).toHaveProperty('markdownTemplate');
            expect(template).toHaveProperty('cssStyles');
        });

        it('should return null for non-existent template', () => {
            const template = getReportTemplate('non-existent-template');
            expect(template).toBeNull();
        });

        it('should have valid default configurations', () => {
            const templates = getAvailableTemplates();

            templates.forEach(template => {
                expect(template.defaultConfig).toBeDefined();
                expect(template.defaultConfig).toHaveProperty('title');
                expect(template.defaultConfig).toHaveProperty('timePeriod');
                expect(template.defaultConfig).toHaveProperty('engines');
                expect(template.defaultConfig).toHaveProperty('format');
            });
        });
    });

    describe('Report Visualizations', () => {
        const mockData = {
            aggregatedMetrics: {
                averageMetrics: {
                    domainDiversity: 0.65,
                    engineOverlap: 0.35,
                    factualAlignment: 0.78
                },
                trends: {
                    domainDiversity: {
                        values: [
                            { date: new Date('2024-01-01'), value: 0.6 },
                            { date: new Date('2024-01-02'), value: 0.65 },
                            { date: new Date('2024-01-03'), value: 0.7 }
                        ]
                    },
                    engineOverlap: {
                        values: [
                            { date: new Date('2024-01-01'), value: 0.4 },
                            { date: new Date('2024-01-02'), value: 0.35 },
                            { date: new Date('2024-01-03'), value: 0.3 }
                        ]
                    },
                    factualAlignment: {
                        values: [
                            { date: new Date('2024-01-01'), value: 0.75 },
                            { date: new Date('2024-01-02'), value: 0.78 },
                            { date: new Date('2024-01-03'), value: 0.8 }
                        ]
                    }
                }
            },
            crossEngineAnalysis: {
                engines: ['google', 'bing'],
                overallComparison: {
                    rankings: [
                        { engine: 'google', overallScore: 0.75, rank: 1 },
                        { engine: 'bing', overallScore: 0.65, rank: 2 }
                    ],
                    metrics: {
                        domainDiversity: { google: 0.7, bing: 0.6 },
                        factualAlignment: { google: 0.8, bing: 0.7 },
                        resultCount: { google: 100, bing: 95 }
                    }
                }
            }
        };

        it('should generate bias metrics overview chart', () => {
            const chart = ReportVisualizationService.generateBiasMetricsOverview(mockData);

            expect(chart).toBeDefined();
            expect(chart.type).toBe('bar');
            expect(chart.data.labels).toEqual(['Domain Diversity', 'Engine Overlap', 'Factual Alignment']);
            expect(chart.data.datasets[0].data).toEqual([0.65, 0.35, 0.78]);
        });

        it('should generate engine comparison chart', () => {
            const chart = ReportVisualizationService.generateEngineComparison(mockData);

            expect(chart).toBeDefined();
            expect(chart.type).toBe('bar');
            expect(chart.data.labels).toEqual(['google', 'bing']);
            expect(chart.data.datasets[0].data).toEqual([0.75, 0.65]);
        });

        it('should generate trend analysis chart', () => {
            const chart = ReportVisualizationService.generateTrendAnalysis(mockData);

            expect(chart).toBeDefined();
            expect(chart.type).toBe('line');
            expect(chart.data.datasets).toHaveLength(3);
            expect(chart.data.datasets[0].label).toBe('Domain Diversity');
            expect(chart.data.datasets[1].label).toBe('Engine Overlap');
            expect(chart.data.datasets[2].label).toBe('Factual Alignment');
        });

        it('should generate engine radar comparison', () => {
            const chart = ReportVisualizationService.generateEngineRadarComparison(mockData);

            expect(chart).toBeDefined();
            expect(chart.type).toBe('radar');
            expect(chart.data.labels).toEqual(['Domain Diversity', 'Factual Alignment', 'Uniqueness']);
            expect(chart.data.datasets).toHaveLength(2); // One for each engine
        });

        it('should generate all visualizations', () => {
            const visualizations = ReportVisualizationService.generateAllVisualizations(mockData);

            expect(visualizations).toBeDefined();
            expect(visualizations.length).toBeGreaterThan(0);

            const vizIds = visualizations.map(v => v.id);
            expect(vizIds).toContain('bias_metrics_overview');
            expect(vizIds).toContain('engine_comparison');
            expect(vizIds).toContain('trend_analysis');
        });

        it('should convert chart config to Chart.js format', () => {
            const chart = ReportVisualizationService.generateBiasMetricsOverview(mockData);
            const chartJS = ReportVisualizationService.toChartJS(chart);

            expect(chartJS).toBeDefined();
            expect(chartJS.type).toBe(chart.type);
            expect(chartJS.data).toEqual(chart.data);
            expect(chartJS.options).toBeDefined();
            expect(chartJS.options.plugins.tooltip).toBeDefined();
        });

        it('should generate SVG charts', () => {
            const chart = ReportVisualizationService.generateBiasMetricsOverview(mockData);
            const svg = ReportVisualizationService.generateSVGChart(chart, 400, 300);

            expect(svg).toBeDefined();
            expect(svg).toContain('<svg');
            expect(svg).toContain('</svg>');
            expect(svg).toContain('width="400"');
            expect(svg).toContain('height="300"');
        });
    });

    describe('Template Rendering', () => {
        it('should render HTML template with data', () => {
            const template = getReportTemplate('transparency_standard');
            expect(template).toBeDefined();

            if (template) {
                const htmlContent = template.htmlTemplate;
                expect(htmlContent).toContain('{{title}}');
                expect(htmlContent).toContain('{{styles}}');
                expect(htmlContent).toContain('{{header}}');
                expect(htmlContent).toContain('{{executiveSummary}}');
            }
        });

        it('should render markdown template with data', () => {
            const template = getReportTemplate('transparency_standard');
            expect(template).toBeDefined();

            if (template) {
                const markdownContent = template.markdownTemplate;
                expect(markdownContent).toContain('# {{title}}');
                expect(markdownContent).toContain('{{executiveSummary}}');
                expect(markdownContent).toContain('{{methodology}}');
            }
        });

        it('should have valid CSS styles', () => {
            const template = getReportTemplate('transparency_standard');
            expect(template).toBeDefined();

            if (template) {
                const styles = template.cssStyles;
                expect(styles).toBeDefined();
                expect(styles.length).toBeGreaterThan(0);
                expect(styles).toContain('body');
                expect(styles).toContain('.report-container');
            }
        });
    });

    describe('Color Schemes', () => {
        it('should have consistent color schemes', () => {
            // COLOR_SCHEMES is already imported

            expect(COLOR_SCHEMES).toBeDefined();
            expect(COLOR_SCHEMES.engines).toBeDefined();
            expect(COLOR_SCHEMES.metrics).toBeDefined();
            expect(COLOR_SCHEMES.trends).toBeDefined();

            // Check engine colors
            expect(COLOR_SCHEMES.engines.google).toBeDefined();
            expect(COLOR_SCHEMES.engines.bing).toBeDefined();
            expect(COLOR_SCHEMES.engines.perplexity).toBeDefined();
            expect(COLOR_SCHEMES.engines.brave).toBeDefined();

            // Check metric colors
            expect(COLOR_SCHEMES.metrics.domainDiversity).toBeDefined();
            expect(COLOR_SCHEMES.metrics.engineOverlap).toBeDefined();
            expect(COLOR_SCHEMES.metrics.factualAlignment).toBeDefined();
        });
    });
});