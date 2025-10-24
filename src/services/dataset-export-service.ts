import { ParquetWriter, ParquetSchema } from 'parquetjs';
import { SearchResult, Query, Annotation } from '../database/models';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

export interface DatasetVersion {
    version: string;
    createdAt: Date;
    description: string;
    dataHash: string;
    recordCount: number;
    filePath: string;
    metadata: DatasetMetadata;
}

export interface DatasetMetadata {
    title: string;
    description: string;
    version: string;
    createdAt: string;
    methodology: {
        dataCollection: {
            engines: string[];
            resultsPerQuery: number;
            collectionFrequency: string;
            antiDetection: string;
            proxyRotation: boolean;
            requestThrottling: string;
        };
        annotation: {
            method: string;
            domainTypes: string[];
            factualScoring: string;
            confidenceScoring: string;
            modelVersions: string[];
        };
        biasMetrics: {
            domainDiversity: string;
            engineOverlap: string;
            factualAlignment: string;
        };
    };
    dataQuality: {
        completenessCheck: string;
        deduplication: string;
        validation: string;
        integrityVerification: string;
    };
    schema: {
        searchResults: Record<string, string>;
        annotations: Record<string, string>;
        queries: Record<string, string>;
    };
    statistics: {
        totalQueries: number;
        totalResults: number;
        totalAnnotations: number;
        dateRange: {
            start: string;
            end: string;
        };
        engineDistribution: Record<string, number>;
        categoryDistribution: Record<string, number>;
    };
    usage: {
        license: string;
        citation: string;
        contact: string;
        restrictions: string[];
    };
    provenance: {
        sourceSystem: string;
        exportedBy: string;
        exportedAt: string;
        dataIntegrityHash: string;
    };
}

export interface ExportOptions {
    dateRange?: {
        start: Date;
        end: Date;
    };
    engines?: string[];
    categories?: string[];
    includeAnnotations?: boolean;
    includeRawData?: boolean;
    format: 'parquet' | 'csv' | 'json';
    outputDir?: string;
    version?: string;
}

export class DatasetExportService {
    private readonly outputDir: string;
    private readonly versionsFile: string;
    private queryFunction?: (sql: string, params?: any[]) => Promise<any[]>;

    constructor(outputDir: string = './exports', queryFunction?: (sql: string, params?: any[]) => Promise<any[]>) {
        this.outputDir = outputDir;
        this.versionsFile = path.join(outputDir, 'versions.json');
        this.queryFunction = queryFunction;
    }

    async exportDataset(options: ExportOptions): Promise<DatasetVersion> {
        const {
            dateRange = {
                start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last year
                end: new Date()
            },
            engines = ['google', 'bing', 'perplexity', 'brave'],
            categories = [],
            includeAnnotations = true,
            includeRawData = false,
            format = 'parquet',
            version = this.generateVersion()
        } = options;

        // Ensure output directory exists
        await fs.mkdir(this.outputDir, { recursive: true });

        // Collect data
        const data = await this.collectData({
            dateRange,
            engines,
            categories,
            includeAnnotations,
            includeRawData
        });

        // Generate metadata
        const metadata = await this.generateMetadata(data, {
            dateRange,
            engines,
            categories,
            includeAnnotations,
            includeRawData,
            version
        });

        // Export based on format
        let filePath: string;
        let dataHash: string;

        switch (format) {
            case 'parquet':
                filePath = await this.exportToParquet(data, version, metadata);
                break;
            case 'csv':
                filePath = await this.exportToCSV(data, version, metadata);
                break;
            case 'json':
                filePath = await this.exportToJSON(data, version, metadata);
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        // Calculate data hash for integrity verification
        dataHash = await this.calculateFileHash(filePath);

        // Create dataset version record
        const datasetVersion: DatasetVersion = {
            version,
            createdAt: new Date(),
            description: `TruthLayer dataset export v${version} - ${data.searchResults.length} results from ${engines.join(', ')}`,
            dataHash,
            recordCount: data.searchResults.length,
            filePath,
            metadata
        };

        // Save version information
        await this.saveVersionInfo(datasetVersion);

        // Generate documentation files
        await this.generateDocumentation(datasetVersion);

        return datasetVersion;
    }

    private async collectData(options: {
        dateRange: { start: Date; end: Date };
        engines: string[];
        categories: string[];
        includeAnnotations: boolean;
        includeRawData: boolean;
    }) {
        if (!this.queryFunction) {
            throw new Error('Database query function not provided. Cannot collect data without database connection.');
        }

        const { dateRange, engines, categories, includeAnnotations, includeRawData } = options;

        // Build query for search results with queries
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

        if (includeRawData) {
            baseQuery += `, sr.raw_html_path`;
        }

        baseQuery += `
            FROM queries q
            JOIN search_results sr ON q.id = sr.query_id
            WHERE sr.collected_at >= $1 
            AND sr.collected_at <= $2
            AND sr.engine = ANY($3)
        `;

        const params: any[] = [dateRange.start, dateRange.end, engines];
        let paramIndex = 4;

        if (categories.length > 0) {
            baseQuery += ` AND q.category = ANY($${paramIndex})`;
            params.push(categories);
            paramIndex++;
        }

        baseQuery += ` ORDER BY q.created_at DESC, sr.engine, sr.rank`;

        const searchResults = await this.queryFunction(baseQuery, params);

        let annotations: any[] = [];
        if (includeAnnotations) {
            const resultIds = searchResults.map(r => r.result_id);
            if (resultIds.length > 0) {
                annotations = await this.queryFunction(`
                    SELECT 
                        a.id as annotation_id,
                        a.result_id,
                        a.domain_type,
                        a.factual_score,
                        a.confidence_score,
                        a.reasoning,
                        a.model_version,
                        a.annotated_at
                    FROM annotations a
                    WHERE a.result_id = ANY($1)
                    ORDER BY a.annotated_at DESC
                `, [resultIds]);
            }
        }

        // Get unique queries
        const uniqueQueryIds = [...new Set(searchResults.map(r => r.query_id))];
        const queries = await this.queryFunction(`
            SELECT id, text, category, created_at, updated_at
            FROM queries
            WHERE id = ANY($1)
        `, [uniqueQueryIds]);

        return {
            searchResults,
            annotations,
            queries
        };
    }

    private async generateMetadata(
        data: { searchResults: any[]; annotations: any[]; queries: any[] },
        options: {
            dateRange: { start: Date; end: Date };
            engines: string[];
            categories: string[];
            includeAnnotations: boolean;
            includeRawData: boolean;
            version: string;
        }
    ): Promise<DatasetMetadata> {
        const { searchResults, annotations, queries } = data;
        const { dateRange, engines, categories, includeAnnotations, version } = options;

        // Calculate statistics
        const engineDistribution = engines.reduce((acc, engine) => {
            acc[engine] = searchResults.filter(r => r.engine === engine).length;
            return acc;
        }, {} as Record<string, number>);

        const categoryDistribution = queries.reduce((acc, query) => {
            const category = query.category || 'uncategorized';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const modelVersions = [...new Set(annotations.map(a => a.model_version))];

        return {
            title: `TruthLayer Search Transparency Dataset v${version}`,
            description: 'Comprehensive dataset of search engine results with bias analysis and factual annotations for transparency research',
            version,
            createdAt: new Date().toISOString(),
            methodology: {
                dataCollection: {
                    engines,
                    resultsPerQuery: 20,
                    collectionFrequency: 'Daily for core queries, weekly for extended set',
                    antiDetection: 'Proxy rotation, random delays (2-8s), realistic browser fingerprinting',
                    proxyRotation: true,
                    requestThrottling: '2-8 second random delays between requests'
                },
                annotation: {
                    method: 'LLM-powered classification using OpenAI GPT models with versioned prompts',
                    domainTypes: ['news', 'government', 'academic', 'blog', 'commercial', 'social'],
                    factualScoring: 'Scale 0.0-1.0 based on factual reliability assessment using chain-of-thought reasoning',
                    confidenceScoring: 'Scale 0.0-1.0 indicating annotation certainty and model confidence',
                    modelVersions
                },
                biasMetrics: {
                    domainDiversity: 'Unique domains / total results (0.0-1.0, higher = more diverse)',
                    engineOverlap: 'Shared URLs / total unique URLs (0.0-1.0, higher = more overlap)',
                    factualAlignment: 'Weighted average of factual scores (0.0-1.0, higher = more factual)'
                }
            },
            dataQuality: {
                completenessCheck: 'All results include required fields: query, engine, rank, title, url, timestamp',
                deduplication: 'Content hash verification prevents duplicate results within collection cycles',
                validation: 'Schema validation ensures data integrity and type safety',
                integrityVerification: 'SHA-256 hashes for file integrity and provenance tracking'
            },
            schema: {
                searchResults: {
                    query_id: 'UUID - Foreign key to queries table',
                    query_text: 'string - Original search query text',
                    query_category: 'string - Topic category (health, politics, technology, science)',
                    query_created_at: 'timestamp - When query was first added to system',
                    result_id: 'UUID - Unique identifier for search result',
                    engine: 'string - Search engine (google, bing, perplexity, brave)',
                    rank: 'integer - Position in search results (1-20)',
                    title: 'string - Result title as displayed by search engine',
                    snippet: 'string - Result snippet/description text',
                    url: 'string - Full URL of the result',
                    collected_at: 'timestamp - When result was scraped',
                    content_hash: 'string - SHA-256 hash of result content for deduplication'
                },
                annotations: includeAnnotations ? {
                    annotation_id: 'UUID - Unique identifier for annotation',
                    result_id: 'UUID - Foreign key to search_results table',
                    domain_type: 'string - Classified domain type',
                    factual_score: 'decimal - Factual reliability score (0.0-1.0)',
                    confidence_score: 'decimal - Annotation confidence (0.0-1.0)',
                    reasoning: 'string - LLM reasoning for classification',
                    model_version: 'string - LLM model version used for annotation',
                    annotated_at: 'timestamp - When annotation was generated'
                } : {},
                queries: {
                    id: 'UUID - Unique identifier for query',
                    text: 'string - Query text',
                    category: 'string - Topic category',
                    created_at: 'timestamp - When query was created',
                    updated_at: 'timestamp - Last modification time'
                }
            },
            statistics: {
                totalQueries: queries.length,
                totalResults: searchResults.length,
                totalAnnotations: annotations.length,
                dateRange: {
                    start: dateRange.start.toISOString(),
                    end: dateRange.end.toISOString()
                },
                engineDistribution,
                categoryDistribution
            },
            usage: {
                license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
                citation: 'TruthLayer Team. (2025). TruthLayer Search Transparency Dataset. Retrieved from https://truthlayer.org/datasets',
                contact: 'datasets@truthlayer.org',
                restrictions: [
                    'Attribution required for any use',
                    'Commercial use permitted with attribution',
                    'Derivative works permitted with attribution',
                    'No warranty provided - use at your own risk'
                ]
            },
            provenance: {
                sourceSystem: 'TruthLayer MVP v1.0',
                exportedBy: 'DatasetExportService',
                exportedAt: new Date().toISOString(),
                dataIntegrityHash: '' // Will be filled after file creation
            }
        };
    }

    private async exportToParquet(
        data: { searchResults: any[]; annotations: any[]; queries: any[] },
        version: string,
        metadata: DatasetMetadata
    ): Promise<string> {
        const fileName = `truthlayer-dataset-v${version}.parquet`;
        const filePath = path.join(this.outputDir, fileName);

        // Define Parquet schema for combined data
        const schema = new ParquetSchema({
            // Query fields
            query_id: { type: 'UTF8' },
            query_text: { type: 'UTF8' },
            query_category: { type: 'UTF8', optional: true },
            query_created_at: { type: 'TIMESTAMP_MILLIS' },

            // Search result fields
            result_id: { type: 'UTF8' },
            engine: { type: 'UTF8' },
            rank: { type: 'INT32' },
            title: { type: 'UTF8' },
            snippet: { type: 'UTF8', optional: true },
            url: { type: 'UTF8' },
            collected_at: { type: 'TIMESTAMP_MILLIS' },
            content_hash: { type: 'UTF8', optional: true },

            // Annotation fields (optional)
            annotation_id: { type: 'UTF8', optional: true },
            domain_type: { type: 'UTF8', optional: true },
            factual_score: { type: 'DOUBLE', optional: true },
            confidence_score: { type: 'DOUBLE', optional: true },
            reasoning: { type: 'UTF8', optional: true },
            model_version: { type: 'UTF8', optional: true },
            annotated_at: { type: 'TIMESTAMP_MILLIS', optional: true }
        });

        // Create writer
        const writer = await ParquetWriter.openFile(schema, filePath);

        // Prepare data for writing
        const { searchResults, annotations } = data;

        // Create annotation lookup for faster joins
        const annotationMap = new Map();
        annotations.forEach(ann => {
            annotationMap.set(ann.result_id, ann);
        });

        // Write combined records
        for (const result of searchResults) {
            const annotation = annotationMap.get(result.result_id);

            const record = {
                query_id: result.query_id,
                query_text: result.query_text,
                query_category: result.query_category,
                query_created_at: new Date(result.query_created_at),
                result_id: result.result_id,
                engine: result.engine,
                rank: result.rank,
                title: result.title,
                snippet: result.snippet,
                url: result.url,
                collected_at: new Date(result.collected_at),
                content_hash: result.content_hash,
                annotation_id: annotation?.annotation_id,
                domain_type: annotation?.domain_type,
                factual_score: annotation?.factual_score,
                confidence_score: annotation?.confidence_score,
                reasoning: annotation?.reasoning,
                model_version: annotation?.model_version,
                annotated_at: annotation ? new Date(annotation.annotated_at) : undefined
            };

            await writer.appendRow(record);
        }

        await writer.close();

        // Write metadata as separate JSON file
        const metadataPath = path.join(this.outputDir, `truthlayer-dataset-v${version}-metadata.json`);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        return filePath;
    }

    private async exportToCSV(
        data: { searchResults: any[]; annotations: any[]; queries: any[] },
        version: string,
        metadata: DatasetMetadata
    ): Promise<string> {
        const fileName = `truthlayer-dataset-v${version}.csv`;
        const filePath = path.join(this.outputDir, fileName);

        const { searchResults, annotations } = data;

        // Create annotation lookup
        const annotationMap = new Map();
        annotations.forEach(ann => {
            annotationMap.set(ann.result_id, ann);
        });

        // Define headers
        const headers = [
            'query_id', 'query_text', 'query_category', 'query_created_at',
            'result_id', 'engine', 'rank', 'title', 'snippet', 'url', 'collected_at', 'content_hash',
            'annotation_id', 'domain_type', 'factual_score', 'confidence_score', 'reasoning', 'model_version', 'annotated_at'
        ];

        // Create CSV content
        const csvRows = [headers.join(',')];

        for (const result of searchResults) {
            const annotation = annotationMap.get(result.result_id);

            const row = [
                result.query_id,
                `"${(result.query_text || '').replace(/"/g, '""')}"`,
                result.query_category || '',
                result.query_created_at,
                result.result_id,
                result.engine,
                result.rank,
                `"${(result.title || '').replace(/"/g, '""')}"`,
                `"${(result.snippet || '').replace(/"/g, '""')}"`,
                result.url,
                result.collected_at,
                result.content_hash || '',
                annotation?.annotation_id || '',
                annotation?.domain_type || '',
                annotation?.factual_score || '',
                annotation?.confidence_score || '',
                `"${(annotation?.reasoning || '').replace(/"/g, '""')}"`,
                annotation?.model_version || '',
                annotation?.annotated_at || ''
            ];

            csvRows.push(row.join(','));
        }

        await fs.writeFile(filePath, csvRows.join('\n'));

        // Write metadata as separate JSON file
        const metadataPath = path.join(this.outputDir, `truthlayer-dataset-v${version}-metadata.json`);
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

        return filePath;
    }

    private async exportToJSON(
        data: { searchResults: any[]; annotations: any[]; queries: any[] },
        version: string,
        metadata: DatasetMetadata
    ): Promise<string> {
        const fileName = `truthlayer-dataset-v${version}.json`;
        const filePath = path.join(this.outputDir, fileName);

        const exportData = {
            metadata,
            data: {
                searchResults: data.searchResults,
                annotations: data.annotations,
                queries: data.queries
            }
        };

        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
        return filePath;
    }

    private async calculateFileHash(filePath: string): Promise<string> {
        const fileBuffer = await fs.readFile(filePath);
        return createHash('sha256').update(fileBuffer).digest('hex');
    }

    private generateVersion(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        return `${year}.${month}.${day}.${hour}${minute}`;
    }

    private async saveVersionInfo(version: DatasetVersion): Promise<void> {
        let versions: DatasetVersion[] = [];

        try {
            const existingData = await fs.readFile(this.versionsFile, 'utf-8');
            versions = JSON.parse(existingData);
        } catch (error) {
            // File doesn't exist or is invalid, start with empty array
        }

        versions.push(version);

        // Sort by creation date, newest first
        versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        await fs.writeFile(this.versionsFile, JSON.stringify(versions, null, 2));
    }

    private async generateDocumentation(version: DatasetVersion): Promise<void> {
        const readmePath = path.join(this.outputDir, `README-v${version.version}.md`);

        const readme = `# TruthLayer Dataset v${version.version}

## Overview

${version.metadata.description}

**Version:** ${version.version}  
**Created:** ${version.createdAt.toISOString()}  
**Records:** ${version.recordCount.toLocaleString()}  
**File:** ${path.basename(version.filePath)}  

## Methodology

### Data Collection

- **Search Engines:** ${version.metadata.methodology.dataCollection.engines.join(', ')}
- **Results per Query:** ${version.metadata.methodology.dataCollection.resultsPerQuery}
- **Collection Frequency:** ${version.metadata.methodology.dataCollection.collectionFrequency}
- **Anti-Detection:** ${version.metadata.methodology.dataCollection.antiDetection}

### Annotation Process

- **Method:** ${version.metadata.methodology.annotation.method}
- **Domain Types:** ${version.metadata.methodology.annotation.domainTypes.join(', ')}
- **Factual Scoring:** ${version.metadata.methodology.annotation.factualScoring}
- **Model Versions:** ${version.metadata.methodology.annotation.modelVersions.join(', ')}

### Bias Metrics

- **Domain Diversity:** ${version.metadata.methodology.biasMetrics.domainDiversity}
- **Engine Overlap:** ${version.metadata.methodology.biasMetrics.engineOverlap}
- **Factual Alignment:** ${version.metadata.methodology.biasMetrics.factualAlignment}

## Dataset Statistics

- **Total Queries:** ${version.metadata.statistics.totalQueries.toLocaleString()}
- **Total Results:** ${version.metadata.statistics.totalResults.toLocaleString()}
- **Total Annotations:** ${version.metadata.statistics.totalAnnotations.toLocaleString()}
- **Date Range:** ${version.metadata.statistics.dateRange.start} to ${version.metadata.statistics.dateRange.end}

### Engine Distribution

${Object.entries(version.metadata.statistics.engineDistribution)
                .map(([engine, count]) => `- **${engine}:** ${count.toLocaleString()} results`)
                .join('\n')}

### Category Distribution

${Object.entries(version.metadata.statistics.categoryDistribution)
                .map(([category, count]) => `- **${category}:** ${count.toLocaleString()} queries`)
                .join('\n')}

## Data Schema

### Search Results

${Object.entries(version.metadata.schema.searchResults)
                .map(([field, description]) => `- **${field}:** ${description}`)
                .join('\n')}

### Annotations

${Object.entries(version.metadata.schema.annotations)
                .map(([field, description]) => `- **${field}:** ${description}`)
                .join('\n')}

## Data Quality

- **Completeness:** ${version.metadata.dataQuality.completenessCheck}
- **Deduplication:** ${version.metadata.dataQuality.deduplication}
- **Validation:** ${version.metadata.dataQuality.validation}
- **Integrity:** ${version.metadata.dataQuality.integrityVerification}

## Usage and Citation

**License:** ${version.metadata.usage.license}

**Citation:**
\`\`\`
${version.metadata.usage.citation}
\`\`\`

**Contact:** ${version.metadata.usage.contact}

### Restrictions

${version.metadata.usage.restrictions.map(r => `- ${r}`).join('\n')}

## File Integrity

**SHA-256 Hash:** \`${version.dataHash}\`

To verify file integrity:
\`\`\`bash
sha256sum ${path.basename(version.filePath)}
\`\`\`

## Provenance

- **Source System:** ${version.metadata.provenance.sourceSystem}
- **Exported By:** ${version.metadata.provenance.exportedBy}
- **Export Date:** ${version.metadata.provenance.exportedAt}

---

For questions about this dataset or methodology, please contact ${version.metadata.usage.contact}
`;

        await fs.writeFile(readmePath, readme);
    }

    async listVersions(): Promise<DatasetVersion[]> {
        try {
            const data = await fs.readFile(this.versionsFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    async getVersion(version: string): Promise<DatasetVersion | null> {
        const versions = await this.listVersions();
        return versions.find(v => v.version === version) || null;
    }

    async deleteVersion(version: string): Promise<boolean> {
        const versions = await this.listVersions();
        const versionIndex = versions.findIndex(v => v.version === version);

        if (versionIndex === -1) {
            return false;
        }

        const versionInfo = versions[versionIndex];

        try {
            // Delete files
            await fs.unlink(versionInfo.filePath);

            // Try to delete metadata and README files
            const baseName = path.basename(versionInfo.filePath, path.extname(versionInfo.filePath));
            const metadataPath = path.join(this.outputDir, `${baseName}-metadata.json`);
            const readmePath = path.join(this.outputDir, `README-v${version}.md`);

            await fs.unlink(metadataPath).catch(() => { }); // Ignore if doesn't exist
            await fs.unlink(readmePath).catch(() => { }); // Ignore if doesn't exist

            // Remove from versions list
            versions.splice(versionIndex, 1);
            await fs.writeFile(this.versionsFile, JSON.stringify(versions, null, 2));

            return true;
        } catch (error) {
            console.error('Error deleting version files:', error);
            return false;
        }
    }
}