import { DatabaseConnection } from '../database/connection';
import { RepositoryFactory } from '../database/repositories';
import { generateSearchResultHash, isValidHash } from '../utils/hash-utils';
import { safeValidate } from '../utils/validation';
// TODO: Add imports as needed for data integrity operations
// import { SearchResult, Query, Annotation } from '../database/models';
import { logger } from '../utils/logger';
import { z } from 'zod';

/**
 * Data integrity validation results
 */
export interface IntegrityValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    statistics: {
        totalRecords: number;
        validRecords: number;
        duplicateRecords: number;
        missingHashes: number;
        schemaViolations: number;
    };
}

/**
 * Collection cycle completeness check result
 */
export interface CompletenessCheckResult {
    isComplete: boolean;
    expectedEngines: string[];
    actualEngines: string[];
    missingEngines: string[];
    expectedResultsPerEngine: number;
    actualResultsPerEngine: Record<string, number>;
    coveragePercentage: number;
    issues: string[];
}

/**
 * Annotation coverage check result
 */
export interface AnnotationCoverageResult {
    totalResults: number;
    annotatedResults: number;
    coveragePercentage: number;
    missingAnnotations: string[];
    incompleteAnnotations: string[];
    issues: string[];
}

/**
 * Schema validation result for a single record
 */
export interface SchemaValidationResult {
    recordId: string;
    recordType: 'query' | 'search_result' | 'annotation';
    isValid: boolean;
    errors: string[];
}

/**
 * Service for validating data integrity across the system
 */
export class DataIntegrityService {
    private repositories: RepositoryFactory;

    constructor(private db: DatabaseConnection) {
        this.repositories = new RepositoryFactory(db);
    }

    /**
     * Perform comprehensive data integrity validation
     */
    async validateDataIntegrity(options: {
        checkHashes?: boolean;
        checkSchema?: boolean;
        checkDuplicates?: boolean;
        batchSize?: number;
    } = {}): Promise<IntegrityValidationResult> {
        const {
            checkHashes = true,
            checkSchema = true,
            checkDuplicates = true,
            batchSize = 1000
        } = options;

        logger.info('Starting comprehensive data integrity validation', { options });

        const result: IntegrityValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalRecords: 0,
                validRecords: 0,
                duplicateRecords: 0,
                missingHashes: 0,
                schemaViolations: 0
            }
        };

        try {
            // Validate search results
            await this.validateSearchResultIntegrity(result, {
                checkHashes,
                checkSchema,
                checkDuplicates,
                batchSize
            });

            // Validate queries
            await this.validateQueryIntegrity(result, { checkSchema, batchSize });

            // Validate annotations
            await this.validateAnnotationIntegrity(result, { checkSchema, batchSize });

            result.isValid = result.errors.length === 0;

            logger.info('Data integrity validation completed', {
                isValid: result.isValid,
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
                statistics: result.statistics
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Validation failed: ${errorMessage}`);
            result.isValid = false;
            logger.error('Data integrity validation failed', { error });
        }

        return result;
    }

    /**
     * Validate search result integrity
     */
    private async validateSearchResultIntegrity(
        result: IntegrityValidationResult,
        options: { checkHashes: boolean; checkSchema: boolean; checkDuplicates: boolean; batchSize: number }
    ): Promise<void> {
        const searchResultRepo = this.repositories.createSearchResultRepository();
        let offset = 0;
        const seenHashes = new Set<string>();
        const duplicateHashes = new Set<string>();

        while (true) {
            const searchResults = await searchResultRepo.findMany({}, options.batchSize, offset);

            if (searchResults.length === 0) {
                break;
            }

            for (const searchResult of searchResults) {
                result.statistics.totalRecords++;

                // Schema validation
                if (options.checkSchema) {
                    const validation = safeValidate(searchResult, z.object({
                        id: z.string().uuid(),
                        query_id: z.string().uuid(),
                        engine: z.enum(['google', 'bing', 'perplexity', 'brave']),
                        rank: z.number().int().min(1).max(100),
                        title: z.string().min(1),
                        snippet: z.string().nullable(),
                        url: z.string().url(),
                        collected_at: z.date(),
                        content_hash: z.string().nullable(),
                        raw_html_path: z.string().nullable()
                    }));

                    if (!validation.success) {
                        result.errors.push(`Schema validation failed for search result ${searchResult.id}: ${validation.error}`);
                        result.statistics.schemaViolations++;
                        continue;
                    }
                }

                // Hash validation
                if (options.checkHashes) {
                    if (!searchResult.content_hash) {
                        result.warnings.push(`Missing content hash for search result ${searchResult.id}`);
                        result.statistics.missingHashes++;
                    } else {
                        // Validate hash format
                        if (!isValidHash(searchResult.content_hash)) {
                            result.errors.push(`Invalid hash format for search result ${searchResult.id}: ${searchResult.content_hash}`);
                            continue;
                        }

                        // Verify hash correctness
                        const expectedHash = generateSearchResultHash(
                            searchResult.title,
                            searchResult.snippet || '',
                            searchResult.url
                        );

                        if (searchResult.content_hash !== expectedHash) {
                            result.errors.push(`Hash mismatch for search result ${searchResult.id}: expected ${expectedHash}, got ${searchResult.content_hash}`);
                            continue;
                        }

                        // Check for duplicates
                        if (options.checkDuplicates) {
                            if (seenHashes.has(searchResult.content_hash)) {
                                duplicateHashes.add(searchResult.content_hash);
                                result.warnings.push(`Duplicate content hash found: ${searchResult.content_hash} (result ${searchResult.id})`);
                                result.statistics.duplicateRecords++;
                            } else {
                                seenHashes.add(searchResult.content_hash);
                            }
                        }
                    }
                }

                result.statistics.validRecords++;
            }

            offset += options.batchSize;
        }

        if (duplicateHashes.size > 0) {
            result.warnings.push(`Found ${duplicateHashes.size} unique content hashes with duplicates`);
        }
    }

    /**
     * Validate query integrity
     */
    private async validateQueryIntegrity(
        result: IntegrityValidationResult,
        options: { checkSchema: boolean; batchSize: number }
    ): Promise<void> {
        const queryRepo = this.repositories.createQueryRepository();
        let offset = 0;

        while (true) {
            const queries = await queryRepo.findMany({}, options.batchSize, offset);

            if (queries.length === 0) {
                break;
            }

            for (const query of queries) {
                result.statistics.totalRecords++;

                // Schema validation
                if (options.checkSchema) {
                    const validation = safeValidate(query, z.object({
                        id: z.string().uuid(),
                        text: z.string().min(1),
                        category: z.string().nullable(),
                        created_at: z.date(),
                        updated_at: z.date()
                    }));

                    if (!validation.success) {
                        result.errors.push(`Schema validation failed for query ${query.id}: ${validation.error}`);
                        result.statistics.schemaViolations++;
                        continue;
                    }
                }

                result.statistics.validRecords++;
            }

            offset += options.batchSize;
        }
    }

    /**
     * Validate annotation integrity
     */
    private async validateAnnotationIntegrity(
        result: IntegrityValidationResult,
        options: { checkSchema: boolean; batchSize: number }
    ): Promise<void> {
        const annotationRepo = this.repositories.createAnnotationRepository();
        let offset = 0;

        while (true) {
            const annotations = await annotationRepo.findMany({}, options.batchSize, offset);

            if (annotations.length === 0) {
                break;
            }

            for (const annotation of annotations) {
                result.statistics.totalRecords++;

                // Schema validation
                if (options.checkSchema) {
                    const validation = safeValidate(annotation, z.object({
                        id: z.string().uuid(),
                        result_id: z.string().uuid(),
                        domain_type: z.enum(['news', 'government', 'academic', 'blog', 'commercial', 'social']).nullable(),
                        factual_score: z.number().min(0).max(1).nullable(),
                        confidence_score: z.number().min(0).max(1).nullable(),
                        reasoning: z.string().nullable(),
                        model_version: z.string().min(1),
                        annotated_at: z.date()
                    }));

                    if (!validation.success) {
                        result.errors.push(`Schema validation failed for annotation ${annotation.id}: ${validation.error}`);
                        result.statistics.schemaViolations++;
                        continue;
                    }
                }

                result.statistics.validRecords++;
            }

            offset += options.batchSize;
        }
    }

    /**
     * Check completeness of collection cycles
     */
    async checkCollectionCompleteness(
        queryId: string,
        expectedEngines: string[] = ['google', 'bing', 'perplexity', 'brave'],
        expectedResultsPerEngine: number = 20
    ): Promise<CompletenessCheckResult> {
        logger.info('Checking collection completeness', { queryId, expectedEngines, expectedResultsPerEngine });

        const searchResultRepo = this.repositories.createSearchResultRepository();

        // Get all results for this query
        const results = await searchResultRepo.findMany({ query_id: queryId });

        // Group results by engine
        const resultsByEngine: Record<string, number> = {};
        const actualEngines = new Set<string>();

        for (const result of results) {
            actualEngines.add(result.engine);
            resultsByEngine[result.engine] = (resultsByEngine[result.engine] || 0) + 1;
        }

        const actualEnginesList = Array.from(actualEngines);
        const missingEngines = expectedEngines.filter(engine => !actualEngines.has(engine));

        const issues: string[] = [];

        // Check for missing engines
        if (missingEngines.length > 0) {
            issues.push(`Missing results from engines: ${missingEngines.join(', ')}`);
        }

        // Check result counts per engine
        for (const engine of expectedEngines) {
            const actualCount = resultsByEngine[engine] || 0;
            if (actualCount < expectedResultsPerEngine) {
                issues.push(`Engine ${engine}: expected ${expectedResultsPerEngine} results, got ${actualCount}`);
            }
        }

        // Calculate coverage percentage
        const totalExpected = expectedEngines.length * expectedResultsPerEngine;
        const totalActual = Object.values(resultsByEngine).reduce((sum, count) => sum + count, 0);
        const coveragePercentage = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0;

        const result: CompletenessCheckResult = {
            isComplete: issues.length === 0,
            expectedEngines,
            actualEngines: actualEnginesList,
            missingEngines,
            expectedResultsPerEngine,
            actualResultsPerEngine: resultsByEngine,
            coveragePercentage,
            issues
        };

        logger.info('Collection completeness check completed', {
            queryId,
            isComplete: result.isComplete,
            coveragePercentage: result.coveragePercentage,
            issueCount: issues.length
        });

        return result;
    }

    /**
     * Check annotation coverage for search results
     */
    async checkAnnotationCoverage(options: {
        queryId?: string;
        engine?: string;
        collectedAfter?: Date;
        collectedBefore?: Date;
    } = {}): Promise<AnnotationCoverageResult> {
        logger.info('Checking annotation coverage', { options });

        const searchResultRepo = this.repositories.createSearchResultRepository();
        const annotationRepo = this.repositories.createAnnotationRepository();

        // Get search results based on filters
        const searchResults = await searchResultRepo.findMany({
            query_id: options.queryId,
            engine: options.engine as any,
            collected_after: options.collectedAfter,
            collected_before: options.collectedBefore
        });

        const totalResults = searchResults.length;
        const missingAnnotations: string[] = [];
        const incompleteAnnotations: string[] = [];
        let annotatedCount = 0;

        // Check each search result for annotations
        for (const result of searchResults) {
            const annotation = await annotationRepo.findByResultId(result.id);

            if (!annotation) {
                missingAnnotations.push(result.id);
            } else {
                annotatedCount++;

                // Check if annotation is complete (has required fields)
                if (!annotation.domain_type || annotation.factual_score === null || annotation.confidence_score === null) {
                    incompleteAnnotations.push(result.id);
                }
            }
        }

        const coveragePercentage = totalResults > 0 ? (annotatedCount / totalResults) * 100 : 0;

        const issues: string[] = [];
        if (missingAnnotations.length > 0) {
            issues.push(`${missingAnnotations.length} search results missing annotations`);
        }
        if (incompleteAnnotations.length > 0) {
            issues.push(`${incompleteAnnotations.length} annotations are incomplete`);
        }

        const result: AnnotationCoverageResult = {
            totalResults,
            annotatedResults: annotatedCount,
            coveragePercentage,
            missingAnnotations,
            incompleteAnnotations,
            issues
        };

        logger.info('Annotation coverage check completed', {
            totalResults,
            annotatedResults: annotatedCount,
            coveragePercentage,
            issueCount: issues.length
        });

        return result;
    }

    /**
     * Validate schema for all records of a specific type
     */
    async validateSchemaForType(
        recordType: 'query' | 'search_result' | 'annotation',
        batchSize: number = 1000
    ): Promise<SchemaValidationResult[]> {
        logger.info('Validating schema for record type', { recordType, batchSize });

        const results: SchemaValidationResult[] = [];
        let offset = 0;

        while (true) {
            let records: any[] = [];
            let schema: z.ZodSchema<any>;

            // Get records and schema based on type
            switch (recordType) {
                case 'query':
                    const queryRepo = this.repositories.createQueryRepository();
                    records = await queryRepo.findMany({}, batchSize, offset);
                    schema = z.object({
                        id: z.string().uuid(),
                        text: z.string().min(1),
                        category: z.string().nullable(),
                        created_at: z.date(),
                        updated_at: z.date()
                    });
                    break;

                case 'search_result':
                    const searchResultRepo = this.repositories.createSearchResultRepository();
                    records = await searchResultRepo.findMany({}, batchSize, offset);
                    schema = z.object({
                        id: z.string().uuid(),
                        query_id: z.string().uuid(),
                        engine: z.enum(['google', 'bing', 'perplexity', 'brave']),
                        rank: z.number().int().min(1).max(100),
                        title: z.string().min(1),
                        snippet: z.string().nullable(),
                        url: z.string().url(),
                        collected_at: z.date(),
                        content_hash: z.string().nullable(),
                        raw_html_path: z.string().nullable()
                    });
                    break;

                case 'annotation':
                    const annotationRepo = this.repositories.createAnnotationRepository();
                    records = await annotationRepo.findMany({}, batchSize, offset);
                    schema = z.object({
                        id: z.string().uuid(),
                        result_id: z.string().uuid(),
                        domain_type: z.enum(['news', 'government', 'academic', 'blog', 'commercial', 'social']).nullable(),
                        factual_score: z.number().min(0).max(1).nullable(),
                        confidence_score: z.number().min(0).max(1).nullable(),
                        reasoning: z.string().nullable(),
                        model_version: z.string().min(1),
                        annotated_at: z.date()
                    });
                    break;
            }

            if (records.length === 0) {
                break;
            }

            // Validate each record
            for (const record of records) {
                const validation = safeValidate(record, schema);

                results.push({
                    recordId: record.id,
                    recordType,
                    isValid: validation.success,
                    errors: validation.success ? [] : [validation.error || 'Unknown validation error']
                });
            }

            offset += batchSize;
        }

        const validCount = results.filter(r => r.isValid).length;
        logger.info('Schema validation completed', {
            recordType,
            totalRecords: results.length,
            validRecords: validCount,
            invalidRecords: results.length - validCount
        });

        return results;
    }

    /**
     * Generate content hashes for search results that are missing them
     */
    async generateMissingContentHashes(batchSize: number = 100): Promise<{
        processed: number;
        updated: number;
        errors: string[];
    }> {
        logger.info('Generating missing content hashes', { batchSize });

        const searchResultRepo = this.repositories.createSearchResultRepository();
        let offset = 0;
        let processed = 0;
        let updated = 0;
        const errors: string[] = [];

        while (true) {
            const results = await searchResultRepo.findMany({}, batchSize, offset);

            if (results.length === 0) {
                break;
            }

            for (const result of results) {
                processed++;

                if (!result.content_hash) {
                    try {
                        const hash = generateSearchResultHash(
                            result.title,
                            result.snippet || '',
                            result.url
                        );

                        // Update the record with the generated hash
                        await this.db.query(
                            'UPDATE search_results SET content_hash = $1 WHERE id = $2',
                            [hash, result.id]
                        );

                        updated++;
                        logger.debug('Generated content hash for search result', { id: result.id, hash });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        errors.push(`Failed to generate hash for result ${result.id}: ${errorMessage}`);
                        logger.error('Failed to generate content hash', { resultId: result.id, error });
                    }
                }
            }

            offset += batchSize;
        }

        logger.info('Content hash generation completed', { processed, updated, errorCount: errors.length });

        return { processed, updated, errors };
    }

    /**
     * Find and report duplicate search results based on content hash
     */
    async findDuplicateResults(): Promise<{
        duplicateGroups: Array<{
            contentHash: string;
            resultIds: string[];
            count: number;
        }>;
        totalDuplicates: number;
    }> {
        logger.info('Finding duplicate search results');

        const query = `
            SELECT content_hash, array_agg(id) as result_ids, COUNT(*) as count
            FROM search_results 
            WHERE content_hash IS NOT NULL
            GROUP BY content_hash
            HAVING COUNT(*) > 1
            ORDER BY COUNT(*) DESC
        `;

        const rows = await this.db.query(query);

        const duplicateGroups = rows.rows.map((row: any) => ({
            contentHash: row.content_hash,
            resultIds: row.result_ids,
            count: parseInt(row.count, 10)
        }));

        const totalDuplicates = duplicateGroups.reduce((sum: number, group: any) => sum + (group.count - 1), 0);

        logger.info('Duplicate search results found', {
            duplicateGroups: duplicateGroups.length,
            totalDuplicates
        });

        return { duplicateGroups, totalDuplicates };
    }
}