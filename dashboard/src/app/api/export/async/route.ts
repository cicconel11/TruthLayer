import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { ExportRequest } from '@/types/dashboard';
import { createExportProgress, updateExportProgress } from '@/lib/export-progress';
import { randomUUID } from 'crypto';

// Global storage for export files (in production, use S3/MinIO)
declare global {
    var exportFiles: Map<string, {
        content: string;
        contentType: string;
        filename: string;
    }> | undefined;
}

export async function POST(request: NextRequest) {
    try {
        const exportRequest: ExportRequest = await request.json();
        const exportId = randomUUID();

        // Create initial progress entry
        createExportProgress(exportId);

        // Start async export process
        processAsyncExport(exportId, exportRequest).catch(error => {
            console.error('Async export failed:', error);
            updateExportProgress(exportId, {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                progress: 0,
            });
        });

        return NextResponse.json({
            success: true,
            data: {
                exportId,
                message: 'Export started. Use the exportId to track progress.',
            },
        });

    } catch (error) {
        console.error('Error starting async export:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to start export' },
            { status: 500 }
        );
    }
}

async function processAsyncExport(exportId: string, exportRequest: ExportRequest) {
    const {
        format,
        dateRange,
        engines = ['google', 'bing', 'perplexity', 'brave'],
        categories = [],
        includeAnnotations = false,
        includeRawData = false,
    } = exportRequest;

    try {
        // Update progress to processing
        updateExportProgress(exportId, {
            status: 'processing',
            progress: 10,
        });

        // First, get total count for progress tracking
        let countQuery = `
            SELECT COUNT(*) as total
            FROM queries q
            JOIN search_results sr ON q.id = sr.query_id
        `;

        if (includeAnnotations) {
            countQuery += ` LEFT JOIN annotations a ON sr.id = a.result_id`;
        }

        const whereConditions = [
            'sr.collected_at >= $1',
            'sr.collected_at <= $2',
            'sr.engine = ANY($3)',
        ];

        const countParams: any[] = [dateRange.start, dateRange.end, engines];
        let paramIndex = 4;

        if (categories.length > 0) {
            whereConditions.push(`q.category = ANY($${paramIndex})`);
            countParams.push(categories);
            paramIndex++;
        }

        countQuery += ` WHERE ${whereConditions.join(' AND ')}`;

        const countResult = await query(countQuery, countParams);
        const totalRecords = parseInt(countResult[0]?.total || '0');

        updateExportProgress(exportId, {
            progress: 20,
            totalRecords,
        });

        // Build the main query (same as in the regular export)
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

        if (includeRawData) {
            baseQuery += `,
                sr.raw_html_path
            `;
        }

        baseQuery += `
            FROM queries q
            JOIN search_results sr ON q.id = sr.query_id
        `;

        if (includeAnnotations) {
            baseQuery += ` LEFT JOIN annotations a ON sr.id = a.result_id`;
        }

        baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
        baseQuery += ` ORDER BY q.created_at DESC, sr.engine, sr.rank`;

        updateExportProgress(exportId, {
            progress: 30,
        });

        // Get metadata (same as regular export)
        const metadataQueries = await Promise.all([
            query(`
                SELECT 
                    category,
                    COUNT(*) as query_count,
                    MIN(created_at) as first_query,
                    MAX(created_at) as last_query
                FROM queries q
                WHERE q.created_at >= $1 AND q.created_at <= $2
                ${categories.length > 0 ? 'AND q.category = ANY($3)' : ''}
                GROUP BY category
                ORDER BY category
            `, categories.length > 0 ? [dateRange.start, dateRange.end, categories] : [dateRange.start, dateRange.end]),

            query(`
                SELECT 
                    engine,
                    COUNT(*) as result_count,
                    COUNT(DISTINCT sr.query_id) as unique_queries,
                    MIN(collected_at) as first_collection,
                    MAX(collected_at) as last_collection
                FROM search_results sr
                JOIN queries q ON sr.query_id = q.id
                WHERE sr.collected_at >= $1 AND sr.collected_at <= $2
                AND sr.engine = ANY($3)
                ${categories.length > 0 ? 'AND q.category = ANY($4)' : ''}
                GROUP BY engine
                ORDER BY engine
            `, categories.length > 0 ? [dateRange.start, dateRange.end, engines, categories] : [dateRange.start, dateRange.end, engines]),

            includeAnnotations ? query(`
                SELECT 
                    model_version,
                    COUNT(*) as annotation_count,
                    AVG(factual_score) as avg_factual_score,
                    AVG(confidence_score) as avg_confidence_score,
                    MIN(annotated_at) as first_annotation,
                    MAX(annotated_at) as last_annotation
                FROM annotations a
                JOIN search_results sr ON a.result_id = sr.id
                JOIN queries q ON sr.query_id = q.id
                WHERE a.annotated_at >= $1 AND a.annotated_at <= $2
                AND sr.engine = ANY($3)
                ${categories.length > 0 ? 'AND q.category = ANY($4)' : ''}
                GROUP BY model_version
                ORDER BY model_version
            `, categories.length > 0 ? [dateRange.start, dateRange.end, engines, categories] : [dateRange.start, dateRange.end, engines]) : Promise.resolve([])
        ]);

        updateExportProgress(exportId, {
            progress: 50,
        });

        const [querySetStats, collectionStats, annotationStats] = metadataQueries;

        // Execute main query
        const results = await query(baseQuery, countParams);

        updateExportProgress(exportId, {
            progress: 80,
            processedRecords: results.length,
        });

        // Create enhanced metadata (same as regular export)
        const enhancedMetadata = {
            export: {
                exportedAt: new Date().toISOString(),
                exportVersion: '1.0',
                format,
                totalRecords: results.length,
                exportId,
            },
            methodology: {
                description: 'TruthLayer collects search results from multiple engines to analyze algorithmic bias and information visibility patterns.',
                dataCollection: {
                    engines: engines,
                    resultsPerQuery: 20,
                    collectionFrequency: 'Daily for core queries, weekly for extended set',
                    antiDetection: 'Proxy rotation, random delays, realistic browser fingerprinting',
                },
                annotation: includeAnnotations ? {
                    method: 'LLM-powered classification and factual scoring',
                    domainTypes: ['news', 'government', 'academic', 'blog', 'commercial', 'social'],
                    factualScoring: 'Scale 0.0-1.0 based on factual reliability assessment',
                    confidenceScoring: 'Scale 0.0-1.0 indicating annotation certainty',
                } : undefined,
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
                statistics: querySetStats,
            },
            collection: {
                engines,
                statistics: collectionStats,
                crawlDates: {
                    firstCollection: collectionStats.length > 0 ? Math.min(...collectionStats.map(s => new Date(s.first_collection).getTime())) : null,
                    lastCollection: collectionStats.length > 0 ? Math.max(...collectionStats.map(s => new Date(s.last_collection).getTime())) : null,
                },
            },
            annotations: includeAnnotations ? {
                included: true,
                statistics: annotationStats,
            } : {
                included: false,
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

        // Generate file content
        let fileContent: string;
        let contentType: string;
        let fileExtension: string;

        if (format === 'csv') {
            const headers = Object.keys(results[0] || {});
            const metadataHeader = [
                '# TruthLayer Data Export',
                `# Exported: ${enhancedMetadata.export.exportedAt}`,
                `# Export ID: ${exportId}`,
                `# Version: ${enhancedMetadata.export.exportVersion}`,
                `# Records: ${enhancedMetadata.export.totalRecords}`,
                `# Date Range: ${enhancedMetadata.querySet.dateRange.start} to ${enhancedMetadata.querySet.dateRange.end}`,
                `# Engines: ${engines.join(', ')}`,
                `# Categories: ${categories.length > 0 ? categories.join(', ') : 'all'}`,
                `# Includes Annotations: ${includeAnnotations}`,
                `# Includes Raw Data: ${includeRawData}`,
                '# Methodology: https://truthlayer.org/methodology',
                '# Citation: Please cite TruthLayer when using this data',
                '#',
            ].join('\n');

            fileContent = [
                metadataHeader,
                headers.join(','),
                ...results.map(row =>
                    headers.map(header => {
                        const value = row[header];
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value || '';
                    }).join(',')
                )
            ].join('\n');

            contentType = 'text/csv';
            fileExtension = 'csv';
        } else {
            const jsonData = {
                metadata: enhancedMetadata,
                data: results,
            };
            fileContent = JSON.stringify(jsonData, null, 2);
            contentType = 'application/json';
            fileExtension = 'json';
        }

        // In a real implementation, you would save this to a file storage service (S3, etc.)
        // For now, we'll simulate by storing the content in memory with a temporary URL
        const filename = `truthlayer-export-${new Date().toISOString().split('T')[0]}-${exportId}.${fileExtension}`;

        // Simulate file storage - in production, upload to S3/MinIO and get real URL
        const downloadUrl = `/api/export/download/${exportId}?filename=${encodeURIComponent(filename)}`;

        // Store the file content temporarily (in production, this would be in proper storage)
        if (!global.exportFiles) {
            global.exportFiles = new Map();
        }
        global.exportFiles.set(exportId, {
            content: fileContent,
            contentType,
            filename,
        });

        updateExportProgress(exportId, {
            status: 'completed',
            progress: 100,
            downloadUrl,
        });

    } catch (error) {
        console.error('Error in async export processing:', error);
        updateExportProgress(exportId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
        throw error;
    }
}