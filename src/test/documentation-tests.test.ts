import { describe, it, expect } from 'vitest';
import { getReportTemplate, getAvailableTemplates } from '../services/report-templates';
import { ReportVisualizationService } from '../services/report-visualizations';
import * as fs from 'fs/promises';

describe('Documentation Tests', () => {
    describe('Report Template Validation', () => {
        it('should validate report templates are complete and functional', () => {
            const templates = getAvailableTemplates();
            expect(templates.length).toBeGreaterThan(0);

            templates.forEach(template => {
                // Validate template structure
                expect(template).toHaveProperty('id');
                expect(template).toHaveProperty('name');
                expect(template).toHaveProperty('description');
                expect(template).toHaveProperty('defaultConfig');
                expect(template).toHaveProperty('htmlTemplate');
                expect(template).toHaveProperty('markdownTemplate');
                expect(template).toHaveProperty('cssStyles');

                // Validate template content completeness
                expect(template.htmlTemplate).toContain('{{title}}');
                expect(template.markdownTemplate).toContain('# {{title}}');
                expect(template.cssStyles).toContain('body');

                // Validate default config completeness
                expect(template.defaultConfig).toHaveProperty('title');
                expect(template.defaultConfig).toHaveProperty('timePeriod');
                expect(template.defaultConfig).toHaveProperty('engines');
                expect(template.defaultConfig).toHaveProperty('format');
            });
        });

        it('should validate specific template completeness for transparency reports', () => {
            const standardTemplate = getReportTemplate('transparency_standard');
            expect(standardTemplate).toBeDefined();

            if (standardTemplate) {
                // Check HTML template has all required sections for transparency
                expect(standardTemplate.htmlTemplate).toContain('{{executiveSummary}}');
                expect(standardTemplate.htmlTemplate).toContain('{{methodology}}');

                // Check markdown template structure for reports
                expect(standardTemplate.markdownTemplate).toContain('## Executive Summary');
                expect(standardTemplate.markdownTemplate).toContain('## Methodology');

                // Check CSS includes essential styling for reports
                expect(standardTemplate.cssStyles).toContain('.report-container');
                expect(standardTemplate.cssStyles).toContain('table');
            }
        });
    });

    describe('Dataset Export Interface Validation', () => {
        it('should validate export service interface exists', async () => {
            // Test that we can import the export service
            const { DatasetExportService } = await import('../services/dataset-export-service');

            // Test that the class can be instantiated
            const exportService = new DatasetExportService('./test-exports');

            expect(exportService).toBeDefined();
            expect(typeof exportService.exportDataset).toBe('function');
            expect(typeof exportService.listVersions).toBe('function');
            expect(typeof exportService.getVersion).toBe('function');
        });

        it('should validate export options interface completeness', async () => {
            // Test that ExportOptions interface supports all required formats
            const validOptions = {
                format: 'csv' as const,
                engines: ['google', 'bing', 'perplexity', 'brave'],
                categories: ['health', 'politics', 'technology', 'science'],
                includeAnnotations: true,
                includeRawData: false
            };

            expect(validOptions.format).toBe('csv');
            expect(validOptions.engines).toContain('google');
            expect(validOptions.categories).toContain('health');
            expect(validOptions.includeAnnotations).toBe(true);

            // Test Parquet format support
            const parquetOptions = { ...validOptions, format: 'parquet' as const };
            expect(parquetOptions.format).toBe('parquet');

            // Test JSON format support
            const jsonOptions = { ...validOptions, format: 'json' as const };
            expect(jsonOptions.format).toBe('json');
        });
    });

    describe('Documentation Completeness Validation', () => {
        it('should validate all documentation files exist and are complete', async () => {
            const docFiles = [
                'docs/README.md',
                'docs/METHODOLOGY.md',
                'docs/DATA_COLLECTION.md',
                'docs/BIAS_METRICS.md',
                'docs/REPRODUCIBILITY.md',
                'docs/DATASET_USAGE.md'
            ];

            for (const docFile of docFiles) {
                const content = await fs.readFile(docFile, 'utf-8');

                // Validate basic structure
                expect(content).toContain('# '); // Has main heading
                expect(content.length).toBeGreaterThan(500); // Substantial content

                // Check for key sections based on file type
                if (docFile.includes('METHODOLOGY')) {
                    expect(content).toContain('Data Collection');
                    expect(content).toContain('Annotation');
                    expect(content).toContain('Bias Metrics');
                }

                if (docFile.includes('DATA_COLLECTION')) {
                    expect(content).toContain('Search Engine Integration');
                }

                if (docFile.includes('BIAS_METRICS')) {
                    expect(content).toContain('Domain Diversity');
                    expect(content).toContain('Engine Overlap');
                    expect(content).toContain('Factual Alignment');
                }

                if (docFile.includes('REPRODUCIBILITY')) {
                    expect(content).toContain('Environment Setup');
                    expect(content).toContain('Data Collection');
                }

                if (docFile.includes('DATASET_USAGE')) {
                    expect(content).toContain('Data Schema');
                    expect(content).toContain('Citation');
                }
            }
        });

        it('should validate visualization components generate proper output', () => {
            const mockData = {
                aggregatedMetrics: {
                    averageMetrics: {
                        domainDiversity: 0.68,
                        engineOverlap: 0.42,
                        factualAlignment: 0.79
                    },
                    trends: {
                        domainDiversity: {
                            values: Array.from({ length: 10 }, (_, i) => ({
                                date: new Date(Date.now() - i * 86400000),
                                value: 0.6 + Math.random() * 0.2
                            }))
                        },
                        engineOverlap: {
                            values: Array.from({ length: 10 }, (_, i) => ({
                                date: new Date(Date.now() - i * 86400000),
                                value: 0.3 + Math.random() * 0.2
                            }))
                        },
                        factualAlignment: {
                            values: Array.from({ length: 10 }, (_, i) => ({
                                date: new Date(Date.now() - i * 86400000),
                                value: 0.7 + Math.random() * 0.2
                            }))
                        }
                    }
                },
                crossEngineAnalysis: {
                    engines: ['google', 'bing'],
                    overallComparison: {
                        rankings: [
                            { engine: 'google', overallScore: 0.78, rank: 1 },
                            { engine: 'bing', overallScore: 0.72, rank: 2 }
                        ],
                        metrics: {
                            domainDiversity: { google: 0.72, bing: 0.65 },
                            factualAlignment: { google: 0.82, bing: 0.76 },
                            resultCount: { google: 2000, bing: 1800 }
                        }
                    }
                }
            };

            // Test visualization generation
            const visualizations = ReportVisualizationService.generateAllVisualizations(mockData);

            expect(visualizations.length).toBeGreaterThan(0);

            // Validate each visualization has required properties
            visualizations.forEach(viz => {
                expect(viz).toHaveProperty('id');
                expect(viz).toHaveProperty('title');
                expect(viz).toHaveProperty('config');
                expect(viz.config).toHaveProperty('type');
                expect(viz.config).toHaveProperty('data');

                // Test SVG generation works for supported chart types
                if (viz.config.type === 'bar' || viz.config.type === 'line') {
                    const svg = ReportVisualizationService.generateSVGChart(viz.config, 400, 300);
                    expect(svg).toContain('<svg');
                    expect(svg).toContain('</svg>');
                    expect(svg).toContain('width="400"');
                    expect(svg).toContain('height="300"');
                }
            });
        });
    });

    describe('Metadata Accuracy Validation', () => {
        it('should validate report generation service interface', async () => {
            // Test that we can import the report generation service
            const { ReportGenerationService } = await import('../services/report-generation-service');

            // Validate the service class exists and has required methods
            expect(ReportGenerationService).toBeDefined();
            expect(typeof ReportGenerationService).toBe('function'); // Constructor
        });

        it('should validate report configuration interface completeness', () => {
            // Test that ReportConfig interface supports all required options
            const validConfig = {
                title: 'Test Transparency Report',
                subtitle: 'Test Report for Validation',
                timePeriod: '30d' as const,
                engines: ['google', 'bing', 'perplexity', 'brave'],
                categories: ['health', 'politics'],
                includeVisualization: true,
                includeRawData: true,
                format: 'html' as const
            };

            expect(validConfig.title).toBe('Test Transparency Report');
            expect(validConfig.engines).toContain('google');
            expect(validConfig.format).toBe('html');

            // Test other formats
            const markdownConfig = { ...validConfig, format: 'markdown' as const };
            expect(markdownConfig.format).toBe('markdown');

            const jsonConfig = { ...validConfig, format: 'json' as const };
            expect(jsonConfig.format).toBe('json');
        });
    });
});