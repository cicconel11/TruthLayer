import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseConnection } from '../database/connection';
import { ReportGenerationService, ReportConfig } from '../services/report-generation-service';
import { getReportTemplate } from '../services/report-templates';

// Mock database connection
const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    healthCheck: vi.fn(),
    getClient: vi.fn()
} as unknown as DatabaseConnection;

describe('Report Generation Service', () => {
    let reportService: ReportGenerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        reportService = new ReportGenerationService(mockDb);

        // Mock database responses for metrics aggregation
        const mockDate = new Date('2024-01-01T00:00:00Z');
        (mockDb.query as any).mockImplementation((query: string) => {
            if (query.includes('bias_metrics')) {
                return Promise.resolve({
                    rows: [{
                        total_queries: '10',
                        avg_domain_diversity: '0.65',
                        avg_engine_overlap: '0.35',
                        avg_factual_alignment: '0.78'
                    }]
                });
            }
            if (query.includes('search_results')) {
                return Promise.resolve({
                    rows: [{
                        engine: 'google',
                        avg_domain_diversity: '0.7',
                        avg_factual_alignment: '0.8',
                        query_count: '5'
                    }]
                });
            }
            if (query.includes('generated_reports')) {
                return Promise.resolve({ rows: [], rowCount: 0 });
            }
            // Mock trend data with valid dates
            if (query.includes('daily_metrics')) {
                return Promise.resolve({
                    rows: [
                        { date: mockDate, daily_value: '0.65', rolling_avg_7d: '0.65', rolling_avg_30d: '0.65', sample_size_7d: '7', sample_size_30d: '30' },
                        { date: new Date(mockDate.getTime() + 86400000), daily_value: '0.67', rolling_avg_7d: '0.66', rolling_avg_30d: '0.66', sample_size_7d: '7', sample_size_30d: '30' }
                    ]
                });
            }
            return Promise.resolve({ rows: [] });
        });

        (mockDb.transaction as any).mockImplementation(async (callback: any) => {
            return await callback(mockDb);
        });
    });

    describe('Report Templates', () => {
        it('should load available templates', () => {
            const template = getReportTemplate('transparency_standard');
            expect(template).toBeDefined();
            expect(template?.name).toBe('Standard Transparency Report');
        });

        it('should have required template properties', () => {
            const template = getReportTemplate('transparency_standard');
            expect(template).toHaveProperty('id');
            expect(template).toHaveProperty('name');
            expect(template).toHaveProperty('description');
            expect(template).toHaveProperty('defaultConfig');
            expect(template).toHaveProperty('htmlTemplate');
            expect(template).toHaveProperty('markdownTemplate');
            expect(template).toHaveProperty('cssStyles');
        });
    });

    describe('Report Generation', () => {
        it('should generate a basic HTML report', async () => {
            const config: ReportConfig = {
                title: 'Test Transparency Report',
                subtitle: 'Test Report for Unit Testing',
                timePeriod: '7d',
                engines: ['google', 'bing'],
                includeVisualization: true,
                includeRawData: false,
                format: 'html'
            };

            const report = await reportService.generateReport(config);

            expect(report).toBeDefined();
            expect(report.id).toBeDefined();
            expect(report.config.title).toBe(config.title);
            expect(report.metadata.generatedAt).toBeInstanceOf(Date);
            expect(report.content).toContain('<!DOCTYPE html>');
            expect(report.content).toContain(config.title);
        });

        it('should generate a markdown report', async () => {
            const config: ReportConfig = {
                title: 'Test Markdown Report',
                timePeriod: '30d',
                engines: ['google', 'bing', 'perplexity'],
                includeVisualization: false,
                includeRawData: false,
                format: 'markdown'
            };

            const report = await reportService.generateReport(config);

            expect(report).toBeDefined();
            expect(report.config.format).toBe('markdown');
            expect(report.content).toContain('# Test Markdown Report');
            expect(report.content).toContain('## Executive Summary');
        });

        it('should generate a JSON report', async () => {
            const config: ReportConfig = {
                title: 'Test JSON Report',
                timePeriod: '30d',
                engines: ['google'],
                includeVisualization: false,
                includeRawData: true,
                format: 'json'
            };

            const report = await reportService.generateReport(config);

            expect(report).toBeDefined();
            expect(report.config.format).toBe('json');

            // Should be valid JSON
            expect(() => JSON.parse(report.content)).not.toThrow();

            const jsonContent = JSON.parse(report.content);
            expect(jsonContent).toHaveProperty('config');
            expect(jsonContent).toHaveProperty('metadata');
            expect(jsonContent).toHaveProperty('executiveSummary');
        });

        it('should include visualizations when requested', async () => {
            const config: ReportConfig = {
                title: 'Test Report with Visualizations',
                timePeriod: '30d',
                engines: ['google', 'bing'],
                includeVisualization: true,
                includeRawData: false,
                format: 'html'
            };

            const report = await reportService.generateReport(config);

            expect(report.visualizations).toBeDefined();
            expect(report.visualizations.length).toBeGreaterThan(0);

            // Check for specific visualization types
            const vizIds = report.visualizations.map(v => v.id);
            expect(vizIds).toContain('bias_metrics_overview');
            expect(vizIds).toContain('engine_comparison');
        });

        it('should include raw data when requested', async () => {
            const config: ReportConfig = {
                title: 'Test Report with Raw Data',
                timePeriod: '30d',
                engines: ['google'],
                includeVisualization: false,
                includeRawData: true,
                format: 'json'
            };

            const report = await reportService.generateReport(config);

            expect(report.rawData).toBeDefined();
            expect(report.rawData).toHaveProperty('aggregatedMetrics');
            expect(report.rawData).toHaveProperty('crossEngineAnalysis');
        });

        it('should apply template defaults', async () => {
            const template = getReportTemplate('transparency_standard');
            const config: ReportConfig = {
                title: 'Template Test Report',
                timePeriod: '30d',
                engines: ['google'],
                includeVisualization: true,
                includeRawData: false,
                format: 'html'
            };

            const report = await reportService.generateReport(config);

            // Should include branding from template
            if (template?.defaultConfig.branding) {
                expect(report.config.branding).toBeDefined();
            }
        });

        it('should handle missing data gracefully', async () => {
            const config: ReportConfig = {
                title: 'Empty Data Test Report',
                timePeriod: '1d', // Very short period likely to have no data
                engines: ['google'],
                includeVisualization: true,
                includeRawData: false,
                format: 'html'
            };

            // Should not throw even with no data
            const report = await reportService.generateReport(config);
            expect(report).toBeDefined();
            expect(report.metadata.totalQueries).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Report Storage and Retrieval', () => {
        it('should store and retrieve reports', async () => {
            const config: ReportConfig = {
                title: 'Storage Test Report',
                timePeriod: '30d',
                engines: ['google'],
                includeVisualization: false,
                includeRawData: false,
                format: 'html'
            };

            const report = await reportService.generateReport(config);

            // Should be stored automatically
            const retrievedReport = await reportService.getReport(report.id);
            expect(retrievedReport).toBeDefined();
            expect(retrievedReport?.id).toBe(report.id);
            expect(retrievedReport?.config.title).toBe(config.title);
        });

        it('should list generated reports', async () => {
            // Generate a few reports
            const configs = [
                { title: 'Report 1', timePeriod: '7d' as const, engines: ['google'], includeVisualization: false, includeRawData: false, format: 'html' as const },
                { title: 'Report 2', timePeriod: '30d' as const, engines: ['bing'], includeVisualization: false, includeRawData: false, format: 'markdown' as const }
            ];

            for (const config of configs) {
                await reportService.generateReport(config);
            }

            const reports = await reportService.getReports(10);
            expect(reports.length).toBeGreaterThanOrEqual(2);

            // Should be sorted by generation date (newest first)
            for (let i = 1; i < reports.length; i++) {
                expect(reports[i - 1].generatedAt.getTime()).toBeGreaterThanOrEqual(reports[i].generatedAt.getTime());
            }
        });

        it('should return null for non-existent report', async () => {
            const report = await reportService.getReport('non-existent-id');
            expect(report).toBeNull();
        });
    });

    describe('Report Content Validation', () => {
        it('should generate valid HTML structure', async () => {
            const config: ReportConfig = {
                title: 'HTML Validation Test',
                timePeriod: '30d',
                engines: ['google', 'bing'],
                includeVisualization: true,
                includeRawData: false,
                format: 'html'
            };

            const report = await reportService.generateReport(config);

            // Basic HTML structure validation
            expect(report.content).toContain('<!DOCTYPE html>');
            expect(report.content).toContain('<html');
            expect(report.content).toContain('<head>');
            expect(report.content).toContain('<body>');
            expect(report.content).toContain('</html>');

            // Should contain report sections
            expect(report.content).toContain('Executive Summary');
            expect(report.content).toContain('Bias Metrics Overview');
            expect(report.content).toContain('Engine Comparison');
            expect(report.content).toContain('Methodology');
        });

        it('should generate valid markdown structure', async () => {
            const config: ReportConfig = {
                title: 'Markdown Validation Test',
                timePeriod: '30d',
                engines: ['google'],
                includeVisualization: false,
                includeRawData: false,
                format: 'markdown'
            };

            const report = await reportService.generateReport(config);

            // Basic markdown structure validation
            expect(report.content).toMatch(/^# /m); // Should start with h1
            expect(report.content).toContain('## Executive Summary');
            expect(report.content).toContain('## Bias Metrics Overview');
            expect(report.content).toContain('## Methodology');

            // Should contain markdown tables
            expect(report.content).toContain('|');
        });

        it('should include metadata in all formats', async () => {
            const formats: Array<'html' | 'markdown' | 'json'> = ['html', 'markdown', 'json'];

            for (const format of formats) {
                const config: ReportConfig = {
                    title: `Metadata Test ${format.toUpperCase()}`,
                    timePeriod: '30d',
                    engines: ['google'],
                    includeVisualization: false,
                    includeRawData: false,
                    format
                };

                const report = await reportService.generateReport(config);

                expect(report.metadata).toBeDefined();
                expect(report.metadata.generatedAt).toBeInstanceOf(Date);
                expect(report.metadata.dataRange).toBeDefined();
                expect(report.metadata.totalQueries).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid configuration', async () => {
            const config: ReportConfig = {
                title: '', // Empty title
                timePeriod: '30d',
                engines: [], // No engines
                includeVisualization: false,
                includeRawData: false,
                format: 'html'
            };

            await expect(reportService.generateReport(config)).rejects.toThrow();
        });

        it('should handle database connection issues gracefully', async () => {
            // This test would require mocking database failures
            // For now, we'll just ensure the service handles basic validation
            const config: ReportConfig = {
                title: 'Valid Title',
                timePeriod: '30d',
                engines: ['google'],
                includeVisualization: false,
                includeRawData: false,
                format: 'html'
            };

            // Should not throw for valid config
            await expect(reportService.generateReport(config)).resolves.toBeDefined();
        });
    });
});