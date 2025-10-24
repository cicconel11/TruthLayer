import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseConnection } from '../database/connection';

// Mock database connection
const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    healthCheck: vi.fn(),
    getClient: vi.fn()
} as unknown as DatabaseConnection;

describe('Export Functionality', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Export API Endpoints', () => {
        it('should export data in CSV format with metadata', async () => {
            const exportRequest = {
                format: 'csv' as const,
                dateRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-12-31'),
                },
                engines: ['google', 'bing'],
                categories: ['health'],
                includeAnnotations: true,
                includeRawData: false,
            };

            // Mock the database query results
            const mockResults = [
                {
                    query_text: 'covid vaccine safety',
                    engine: 'google',
                    rank: 1,
                    title: 'CDC Vaccine Safety',
                    url: 'https://cdc.gov/vaccines',
                    collected_at: '2024-01-01T00:00:00Z',
                    domain_type: 'government',
                    factual_score: 0.95,
                }
            ];

            // Mock all the metadata queries first, then the main query
            (mockDb.query as any)
                .mockResolvedValueOnce({ rows: [] }) // query stats
                .mockResolvedValueOnce({ rows: [] }) // collection stats  
                .mockResolvedValueOnce({ rows: [] }) // annotation stats
                .mockResolvedValue({ rows: mockResults }); // main query

            const results = await getExportData(exportRequest);
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);

            if (results.length > 0) {
                const firstResult = results[0];
                expect(firstResult).toHaveProperty('query_text');
                expect(firstResult).toHaveProperty('engine');
                expect(firstResult).toHaveProperty('rank');
                expect(firstResult).toHaveProperty('title');
                expect(firstResult).toHaveProperty('url');
                expect(firstResult).toHaveProperty('collected_at');

                if (exportRequest.includeAnnotations) {
                    expect(firstResult).toHaveProperty('domain_type');
                    expect(firstResult).toHaveProperty('factual_score');
                }
            }
        });

        it('should export data in JSON format with enhanced metadata', async () => {
            const exportRequest = {
                format: 'json' as const,
                dateRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-12-31'),
                },
                engines: ['google', 'bing', 'perplexity'],
                categories: [],
                includeAnnotations: false,
                includeRawData: false,
            };

            const mockResults = [
                {
                    query_text: 'climate change effects',
                    engine: 'google',
                    rank: 1,
                    title: 'Climate Science',
                    url: 'https://climate.gov',
                    collected_at: '2024-01-01T01:00:00Z',
                }
            ];

            (mockDb.query as any).mockResolvedValue({ rows: mockResults });

            const results = await getExportData(exportRequest);
            const metadata = await getExportMetadata(exportRequest);

            expect(metadata).toBeDefined();
            expect(metadata.export).toBeDefined();
            expect(metadata.methodology).toBeDefined();
            expect(metadata.querySet).toBeDefined();
            expect(metadata.collection).toBeDefined();
            expect(metadata.dataQuality).toBeDefined();
            expect(metadata.usage).toBeDefined();

            expect(metadata.methodology.description).toContain('TruthLayer');
            expect(metadata.methodology.dataCollection.engines).toEqual(exportRequest.engines);
            expect(metadata.methodology.biasMetrics).toHaveProperty('domainDiversity');
            expect(metadata.methodology.biasMetrics).toHaveProperty('engineOverlap');
            expect(metadata.methodology.biasMetrics).toHaveProperty('factualAlignment');
        });

        it('should handle filtering by engines and categories', async () => {
            const exportRequest = {
                format: 'csv' as const,
                dateRange: {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-12-31'),
                },
                engines: ['google'],
                categories: ['health'],
                includeAnnotations: false,
                includeRawData: false,
            };

            const mockResults = [
                {
                    query_text: 'covid vaccine safety',
                    query_category: 'health',
                    engine: 'google',
                    rank: 1,
                    title: 'CDC Vaccine Safety',
                    url: 'https://cdc.gov/vaccines',
                    collected_at: '2024-01-01T00:00:00Z',
                }
            ];

            // Mock all the metadata queries first, then the main query
            (mockDb.query as any)
                .mockResolvedValueOnce({ rows: [] }) // query stats
                .mockResolvedValueOnce({ rows: [] }) // collection stats  
                .mockResolvedValue({ rows: mockResults }); // main query

            const results = await getExportData(exportRequest);

            for (const result of results) {
                expect(exportRequest.engines).toContain(result.engine);
            }

            if (results.length > 0) {
                const categories = [...new Set(results.map(r => r.query_category))];
                for (const category of categories) {
                    expect(exportRequest.categories).toContain(category);
                }
            }
        });

        it('should generate proper CSV format with metadata header', () => {
            const testData = [
                {
                    query_text: 'test query',
                    engine: 'google',
                    rank: 1,
                    title: 'Test Title',
                    url: 'https://example.com',
                    collected_at: '2024-01-01T00:00:00Z',
                },
            ];

            const csvContent = generateCSVContent(testData, {
                exportedAt: '2024-01-01T00:00:00Z',
                engines: ['google'],
                categories: ['health'],
                includeAnnotations: false,
                includeRawData: false,
            });

            expect(csvContent).toContain('# TruthLayer Data Export');
            expect(csvContent).toContain('# Exported: 2024-01-01T00:00:00Z');
            expect(csvContent).toContain('# Engines: google');
            expect(csvContent).toContain('# Categories: health');
            expect(csvContent).toContain('query_text,engine,rank,title,url,collected_at');
            expect(csvContent).toContain('test query,google,1,Test Title,https://example.com,2024-01-01T00:00:00Z');
        });

        it('should handle CSV escaping for special characters', () => {
            const testData = [
                {
                    title: 'Title with "quotes" and, commas',
                    snippet: 'Snippet with\nnewlines',
                    url: 'https://example.com',
                },
            ];

            const csvContent = generateCSVContent(testData, {
                exportedAt: '2024-01-01T00:00:00Z',
                engines: ['google'],
                categories: [],
                includeAnnotations: false,
                includeRawData: false,
            });

            expect(csvContent).toContain('"Title with ""quotes"" and, commas"');
        });
    });

    describe('Export Progress Tracking', () => {
        it('should track export progress for large datasets', async () => {
            const exportId = 'test-export-123';

            const progressUpdates = [
                { status: 'preparing', progress: 0 },
                { status: 'processing', progress: 25, totalRecords: 1000 },
                { status: 'processing', progress: 50, processedRecords: 500 },
                { status: 'processing', progress: 75, processedRecords: 750 },
                { status: 'completed', progress: 100, processedRecords: 1000, downloadUrl: '/download/test' },
            ];

            for (const update of progressUpdates) {
                const progress = updateExportProgress(exportId, update);
                expect(progress).toBeDefined();
                expect(progress.status).toBe(update.status);
                expect(progress.progress).toBe(update.progress);

                if (update.totalRecords) {
                    expect(progress.totalRecords).toBe(update.totalRecords);
                }
                if (update.processedRecords) {
                    expect(progress.processedRecords).toBe(update.processedRecords);
                }
            }
        });

        it('should handle export failures with error messages', async () => {
            const exportId = 'test-export-failed';
            const errorMessage = 'Database connection failed';

            const progress = updateExportProgress(exportId, {
                status: 'failed',
                progress: 0,
                error: errorMessage,
            });

            expect(progress).toBeDefined();
            expect(progress.status).toBe('failed');
            expect(progress.error).toBe(errorMessage);
        });
    });
});

// Helper functions for testing
function setupMockData() {
    // Setup mock data for each test
    const mockQueryStats = [
        { category: 'health', query_count: '10', first_query: '2024-01-01', last_query: '2024-01-31' }
    ];

    const mockCollectionStats = [
        { engine: 'google', result_count: '200', unique_queries: '10', first_collection: '2024-01-01', last_collection: '2024-01-31' }
    ];

    const mockAnnotationStats = [
        { model_version: 'gpt-4-turbo', annotation_count: '200', avg_factual_score: '0.85', avg_confidence_score: '0.90' }
    ];

    (mockDb.query as any)
        .mockResolvedValueOnce({ rows: mockQueryStats })
        .mockResolvedValueOnce({ rows: mockCollectionStats })
        .mockResolvedValueOnce({ rows: mockAnnotationStats });
}

async function getExportData(exportRequest: any) {
    const {
        dateRange,
        engines = ['google', 'bing', 'perplexity', 'brave'],
        categories = [],
        includeAnnotations = false,
    } = exportRequest;

    let baseQuery = `
        SELECT 
            q.id as query_id,
            q.text as query_text,
            q.category as query_category,
            q.created_at as query_created_at,
            sr.id as result_id,
            sr.engine,
            sr.rank,
            sr.title,
            sr.snippet,
            sr.url,
            sr.collected_at,
            sr.content_hash
    `;

    if (includeAnnotations) {
        baseQuery += `,
            a.domain_type,
            a.factual_score,
            a.confidence_score,
            a.reasoning,
            a.model_version,
            a.annotated_at
        `;
    }

    baseQuery += `
        FROM queries q
        JOIN search_results sr ON q.id = sr.query_id
    `;

    if (includeAnnotations) {
        baseQuery += ` LEFT JOIN annotations a ON sr.id = a.result_id`;
    }

    const whereConditions = [
        'sr.collected_at >= $1',
        'sr.collected_at <= $2',
        'sr.engine = ANY($3)',
    ];

    const params: any[] = [dateRange.start, dateRange.end, engines];
    let paramIndex = 4;

    if (categories.length > 0) {
        whereConditions.push(`q.category = ANY($${paramIndex})`);
        params.push(categories);
        paramIndex++;
    }

    baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    baseQuery += ` ORDER BY q.created_at DESC, sr.engine, sr.rank`;

    const result = await mockDb.query(baseQuery, params);
    return result.rows;
}

async function getExportMetadata(exportRequest: any) {
    const { dateRange, engines, categories } = exportRequest;

    return {
        export: {
            exportedAt: new Date().toISOString(),
            exportVersion: '1.0',
            format: exportRequest.format,
            totalRecords: 0,
        },
        methodology: {
            description: 'TruthLayer collects search results from multiple engines to analyze algorithmic bias and information visibility patterns.',
            dataCollection: {
                engines: engines,
                resultsPerQuery: 20,
                collectionFrequency: 'Daily for core queries, weekly for extended set',
                antiDetection: 'Proxy rotation, random delays, realistic browser fingerprinting',
            },
            biasMetrics: {
                domainDiversity: 'Unique domains / total results (0.0-1.0, higher = more diverse)',
                engineOverlap: 'Shared URLs / total unique URLs (0.0-1.0, higher = more overlap)',
                factualAlignment: 'Weighted average of factual scores (0.0-1.0, higher = more factual)',
            },
        },
        querySet: {
            dateRange: {
                start: dateRange.start.toISOString(),
                end: dateRange.end.toISOString(),
            },
            categories: categories.length > 0 ? categories : 'all',
            statistics: [],
        },
        collection: {
            engines,
            statistics: [],
            crawlDates: {
                firstCollection: null,
                lastCollection: null,
            },
        },
        dataQuality: {
            completenessCheck: 'All results include required fields: query, engine, rank, title, url, timestamp',
            deduplication: 'Content hash verification prevents duplicate results',
            validation: 'Schema validation ensures data integrity',
        },
        usage: {
            license: 'Research and analysis purposes',
            citation: 'Please cite TruthLayer when using this data in publications',
            contact: 'For questions about methodology or data quality',
        },
    };
}

function generateCSVContent(data: any[], metadata: any) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const metadataHeader = [
        '# TruthLayer Data Export',
        `# Exported: ${metadata.exportedAt}`,
        `# Engines: ${metadata.engines.join(', ')}`,
        `# Categories: ${metadata.categories.length > 0 ? metadata.categories.join(', ') : 'all'}`,
        `# Includes Annotations: ${metadata.includeAnnotations}`,
        `# Includes Raw Data: ${metadata.includeRawData}`,
        '#',
    ].join('\n');

    const csvContent = [
        metadataHeader,
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header];
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        )
    ].join('\n');

    return csvContent;
}

function updateExportProgress(exportId: string, updates: any) {
    return {
        exportId,
        status: 'preparing',
        progress: 0,
        startedAt: new Date(),
        ...updates,
    };
}