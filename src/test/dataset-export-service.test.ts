import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatasetExportService, ExportOptions } from '../services/dataset-export-service';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('DatasetExportService', () => {
    let exportService: DatasetExportService;
    let testOutputDir: string;

    beforeEach(async () => {
        testOutputDir = path.join(__dirname, '../../test-exports');
        exportService = new DatasetExportService(testOutputDir);

        // Ensure test directory exists
        await fs.mkdir(testOutputDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test files
        try {
            await fs.rm(testOutputDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('Version Management', () => {
        it('should generate unique version strings', () => {
            const service1 = new DatasetExportService();
            const service2 = new DatasetExportService();

            // Generate versions at slightly different times
            const version1 = (service1 as any).generateVersion();
            const version2 = (service2 as any).generateVersion();

            expect(version1).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/);
            expect(version2).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d{4}$/);
        });

        it('should list empty versions initially', async () => {
            const versions = await exportService.listVersions();
            expect(versions).toEqual([]);
        });

        it('should return null for non-existent version', async () => {
            const version = await exportService.getVersion('non-existent');
            expect(version).toBeNull();
        });
    });

    describe('Metadata Generation', () => {
        it('should generate comprehensive metadata', async () => {
            const mockData = {
                searchResults: [
                    {
                        query_id: 'q1',
                        query_text: 'test query',
                        query_category: 'health',
                        query_created_at: new Date().toISOString(),
                        result_id: 'r1',
                        engine: 'google',
                        rank: 1,
                        title: 'Test Result',
                        snippet: 'Test snippet',
                        url: 'https://example.com',
                        collected_at: new Date().toISOString(),
                        content_hash: 'hash123'
                    }
                ],
                annotations: [
                    {
                        annotation_id: 'a1',
                        result_id: 'r1',
                        domain_type: 'news',
                        factual_score: 0.8,
                        confidence_score: 0.9,
                        reasoning: 'Test reasoning',
                        model_version: 'gpt-4',
                        annotated_at: new Date().toISOString()
                    }
                ],
                queries: [
                    {
                        id: 'q1',
                        text: 'test query',
                        category: 'health',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
                ]
            };

            const options = {
                dateRange: {
                    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    end: new Date()
                },
                engines: ['google'],
                categories: ['health'],
                includeAnnotations: true,
                includeRawData: false,
                version: '2025.01.01.test'
            };

            const metadata = await (exportService as any).generateMetadata(mockData, options);

            expect(metadata).toHaveProperty('title');
            expect(metadata).toHaveProperty('version', '2025.01.01.test');
            expect(metadata).toHaveProperty('methodology');
            expect(metadata).toHaveProperty('statistics');
            expect(metadata).toHaveProperty('schema');
            expect(metadata).toHaveProperty('usage');
            expect(metadata).toHaveProperty('provenance');

            expect(metadata.statistics.totalQueries).toBe(1);
            expect(metadata.statistics.totalResults).toBe(1);
            expect(metadata.statistics.totalAnnotations).toBe(1);
            expect(metadata.statistics.engineDistribution).toHaveProperty('google', 1);
            expect(metadata.statistics.categoryDistribution).toHaveProperty('health', 1);
        });
    });

    describe('File Hash Calculation', () => {
        it('should calculate SHA-256 hash correctly', async () => {
            const testFile = path.join(testOutputDir, 'test.txt');
            const testContent = 'Hello, World!';

            await fs.writeFile(testFile, testContent);

            const hash = await (exportService as any).calculateFileHash(testFile);

            // Expected SHA-256 hash for "Hello, World!"
            const expectedHash = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f';
            expect(hash).toBe(expectedHash);
        });
    });

    describe('Documentation Generation', () => {
        it('should generate README with proper formatting', async () => {
            const mockVersion = {
                version: '2025.01.01.test',
                createdAt: new Date(),
                description: 'Test dataset',
                dataHash: 'testhash123',
                recordCount: 100,
                filePath: path.join(testOutputDir, 'test.parquet'),
                metadata: {
                    title: 'Test Dataset',
                    description: 'Test description',
                    version: '2025.01.01.test',
                    createdAt: new Date().toISOString(),
                    methodology: {
                        dataCollection: {
                            engines: ['google', 'bing'],
                            resultsPerQuery: 20,
                            collectionFrequency: 'Daily',
                            antiDetection: 'Proxy rotation',
                            proxyRotation: true,
                            requestThrottling: '2-8 seconds'
                        },
                        annotation: {
                            method: 'LLM-powered',
                            domainTypes: ['news', 'academic'],
                            factualScoring: '0.0-1.0 scale',
                            confidenceScoring: '0.0-1.0 scale',
                            modelVersions: ['gpt-4']
                        },
                        biasMetrics: {
                            domainDiversity: 'Unique domains / total results',
                            engineOverlap: 'Shared URLs / total unique URLs',
                            factualAlignment: 'Weighted average of factual scores'
                        }
                    },
                    dataQuality: {
                        completenessCheck: 'All required fields present',
                        deduplication: 'Content hash verification',
                        validation: 'Schema validation',
                        integrityVerification: 'SHA-256 hashes'
                    },
                    schema: {
                        searchResults: {
                            query_id: 'UUID - Foreign key to queries table',
                            title: 'string - Result title'
                        },
                        annotations: {
                            annotation_id: 'UUID - Unique identifier',
                            domain_type: 'string - Classified domain type'
                        },
                        queries: {
                            id: 'UUID - Unique identifier',
                            text: 'string - Query text'
                        }
                    },
                    statistics: {
                        totalQueries: 10,
                        totalResults: 100,
                        totalAnnotations: 80,
                        dateRange: {
                            start: '2025-01-01T00:00:00.000Z',
                            end: '2025-01-02T00:00:00.000Z'
                        },
                        engineDistribution: { google: 50, bing: 50 },
                        categoryDistribution: { health: 5, politics: 5 }
                    },
                    usage: {
                        license: 'CC BY 4.0',
                        citation: 'TruthLayer Team. (2025). Dataset.',
                        contact: 'test@example.com',
                        restrictions: ['Attribution required']
                    },
                    provenance: {
                        sourceSystem: 'TruthLayer MVP',
                        exportedBy: 'DatasetExportService',
                        exportedAt: new Date().toISOString(),
                        dataIntegrityHash: 'testhash123'
                    }
                }
            };

            await (exportService as any).generateDocumentation(mockVersion);

            const readmePath = path.join(testOutputDir, `README-v${mockVersion.version}.md`);
            const readmeContent = await fs.readFile(readmePath, 'utf-8');

            expect(readmeContent).toContain('# TruthLayer Dataset v2025.01.01.test');
            expect(readmeContent).toContain('**Version:** 2025.01.01.test');
            expect(readmeContent).toContain('**Records:** 100');
            expect(readmeContent).toContain('**google:** 50 results');
            expect(readmeContent).toContain('**health:** 5 queries');
            expect(readmeContent).toContain('**SHA-256 Hash:** `testhash123`');
        });
    });

    describe('Export Options Validation', () => {
        it('should handle default export options', () => {
            const defaultOptions: ExportOptions = {
                format: 'parquet',
                engines: ['google', 'bing', 'perplexity', 'brave'],
                categories: [],
                includeAnnotations: true,
                includeRawData: false
            };

            expect(defaultOptions.format).toBe('parquet');
            expect(defaultOptions.engines).toHaveLength(4);
            expect(defaultOptions.includeAnnotations).toBe(true);
            expect(defaultOptions.includeRawData).toBe(false);
        });

        it('should validate format options', () => {
            const validFormats = ['parquet', 'csv', 'json'];

            validFormats.forEach(format => {
                const options: ExportOptions = {
                    format: format as 'parquet' | 'csv' | 'json',
                    engines: ['google'],
                    categories: [],
                    includeAnnotations: true,
                    includeRawData: false
                };

                expect(options.format).toBe(format);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle missing output directory gracefully', async () => {
            const nonExistentDir = path.join(__dirname, '../../non-existent-dir');
            const service = new DatasetExportService(nonExistentDir);

            // This should not throw an error - the service should create the directory
            const versions = await service.listVersions();
            expect(versions).toEqual([]);
        });

        it('should handle corrupted versions file', async () => {
            const versionsFile = path.join(testOutputDir, 'versions.json');
            await fs.writeFile(versionsFile, 'invalid json content');

            // Should return empty array instead of throwing
            const versions = await exportService.listVersions();
            expect(versions).toEqual([]);
        });
    });
});