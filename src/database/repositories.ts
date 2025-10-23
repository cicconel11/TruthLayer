import { PoolClient } from 'pg';
import { DatabaseConnection } from './connection';
import { logger } from '../utils/logger';
import {
    Query,
    CreateQueryRequest,
    SearchResult,
    CreateSearchResultRequest,
    Annotation,
    CreateAnnotationRequest,
    QueryFilter,
    SearchResultFilter,
    AnnotationFilter,
    SearchResultWithQuery
} from './models';

/**
 * Base repository class with common functionality
 */
export abstract class BaseRepository {
    constructor(protected db: DatabaseConnection) { }

    /**
     * Execute a query with error handling and logging
     */
    protected async executeQuery<T>(
        query: string,
        params: any[] = [],
        client?: PoolClient
    ): Promise<T[]> {
        try {
            const result = client
                ? await client.query(query, params)
                : await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            logger.error('Database query failed:', { query, params, error });
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new DatabaseError(`Query execution failed: ${errorMessage}`, error);
        }
    }

    /**
     * Generate UUID for new records
     */
    protected generateId(): string {
        return crypto.randomUUID();
    }

    /**
     * Validate and sanitize input data
     */
    protected sanitizeString(input: string | undefined): string | undefined {
        if (!input) return input;
        return input.trim().replace(/\0/g, '');
    }

    /**
     * Validate URL format
     */
    protected validateUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate score range (0.0 - 1.0)
     */
    protected validateScore(score: number): boolean {
        return score >= 0.0 && score <= 1.0;
    }
}

/**
 * Repository for Query operations
 */
export class QueryRepository extends BaseRepository {
    /**
     * Create a new query
     */
    async create(data: CreateQueryRequest): Promise<Query> {
        const sanitizedText = this.sanitizeString(data.text);
        const sanitizedCategory = this.sanitizeString(data.category);

        if (!sanitizedText || sanitizedText.length === 0) {
            throw new ValidationError('Query text is required and cannot be empty');
        }

        const id = this.generateId();
        const now = new Date();

        const query = `
            INSERT INTO queries (id, text, category, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

        const params = [id, sanitizedText, sanitizedCategory, now, now];
        const rows = await this.executeQuery<Query>(query, params);

        if (rows.length === 0) {
            throw new DatabaseError('Failed to create query');
        }

        logger.info('Query created successfully', { id, text: sanitizedText });
        return rows[0];
    }

    /**
     * Find query by ID
     */
    async findById(id: string): Promise<Query | null> {
        if (!id) {
            throw new ValidationError('Query ID is required');
        }

        const query = 'SELECT * FROM queries WHERE id = $1';
        const rows = await this.executeQuery<Query>(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find queries with filters
     */
    async findMany(filter: QueryFilter = {}, limit = 100, offset = 0): Promise<Query[]> {
        let query = 'SELECT * FROM queries WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filter.category) {
            query += ` AND category = $${paramIndex++}`;
            params.push(filter.category);
        }

        if (filter.created_after) {
            query += ` AND created_at >= $${paramIndex++}`;
            params.push(filter.created_after);
        }

        if (filter.created_before) {
            query += ` AND created_at <= $${paramIndex++}`;
            params.push(filter.created_before);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        return this.executeQuery<Query>(query, params);
    }

    /**
     * Update query
     */
    async update(id: string, data: Partial<CreateQueryRequest>): Promise<Query | null> {
        if (!id) {
            throw new ValidationError('Query ID is required');
        }

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (data.text !== undefined) {
            const sanitizedText = this.sanitizeString(data.text);
            if (!sanitizedText || sanitizedText.length === 0) {
                throw new ValidationError('Query text cannot be empty');
            }
            updates.push(`text = $${paramIndex++}`);
            params.push(sanitizedText);
        }

        if (data.category !== undefined) {
            updates.push(`category = $${paramIndex++}`);
            params.push(this.sanitizeString(data.category));
        }

        if (updates.length === 0) {
            throw new ValidationError('No valid fields to update');
        }

        updates.push(`updated_at = $${paramIndex++}`);
        params.push(new Date());
        params.push(id);

        const query = `
            UPDATE queries 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const rows = await this.executeQuery<Query>(query, params);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Delete query
     */
    async delete(id: string): Promise<boolean> {
        if (!id) {
            throw new ValidationError('Query ID is required');
        }

        const query = 'DELETE FROM queries WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rowCount > 0;
    }

    /**
     * Count queries with filters
     */
    async count(filter: QueryFilter = {}): Promise<number> {
        let query = 'SELECT COUNT(*) as count FROM queries WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filter.category) {
            query += ` AND category = $${paramIndex++}`;
            params.push(filter.category);
        }

        if (filter.created_after) {
            query += ` AND created_at >= $${paramIndex++}`;
            params.push(filter.created_after);
        }

        if (filter.created_before) {
            query += ` AND created_at <= $${paramIndex++}`;
            params.push(filter.created_before);
        }

        const rows = await this.executeQuery<{ count: string }>(query, params);
        return parseInt(rows[0].count, 10);
    }
}

/**
 * Repository for SearchResult operations
 */
export class SearchResultRepository extends BaseRepository {
    /**
     * Create a new search result
     */
    async create(data: CreateSearchResultRequest): Promise<SearchResult> {
        // Validate required fields
        if (!data.query_id || !data.engine || !data.title || !data.url) {
            throw new ValidationError('Missing required fields: query_id, engine, title, url');
        }

        if (!this.validateUrl(data.url)) {
            throw new ValidationError('Invalid URL format');
        }

        if (data.rank < 1 || data.rank > 100) {
            throw new ValidationError('Rank must be between 1 and 100');
        }

        const id = this.generateId();
        const now = new Date();

        const query = `
            INSERT INTO search_results (
                id, query_id, engine, rank, title, snippet, url, 
                collected_at, content_hash, raw_html_path
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;

        const params = [
            id,
            data.query_id,
            data.engine,
            data.rank,
            this.sanitizeString(data.title),
            this.sanitizeString(data.snippet),
            data.url,
            now,
            data.content_hash,
            data.raw_html_path
        ];

        const rows = await this.executeQuery<SearchResult>(query, params);

        if (rows.length === 0) {
            throw new DatabaseError('Failed to create search result');
        }

        logger.info('Search result created successfully', { id, engine: data.engine });
        return rows[0];
    }

    /**
     * Find search result by ID
     */
    async findById(id: string): Promise<SearchResult | null> {
        if (!id) {
            throw new ValidationError('Search result ID is required');
        }

        const query = 'SELECT * FROM search_results WHERE id = $1';
        const rows = await this.executeQuery<SearchResult>(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find search results with filters
     */
    async findMany(filter: SearchResultFilter = {}, limit = 100, offset = 0): Promise<SearchResult[]> {
        let query = 'SELECT * FROM search_results WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filter.engine) {
            query += ` AND engine = $${paramIndex++}`;
            params.push(filter.engine);
        }

        if (filter.query_id) {
            query += ` AND query_id = $${paramIndex++}`;
            params.push(filter.query_id);
        }

        if (filter.collected_after) {
            query += ` AND collected_at >= $${paramIndex++}`;
            params.push(filter.collected_after);
        }

        if (filter.collected_before) {
            query += ` AND collected_at <= $${paramIndex++}`;
            params.push(filter.collected_before);
        }

        if (filter.has_annotation !== undefined) {
            if (filter.has_annotation) {
                query += ` AND EXISTS (SELECT 1 FROM annotations WHERE result_id = search_results.id)`;
            } else {
                query += ` AND NOT EXISTS (SELECT 1 FROM annotations WHERE result_id = search_results.id)`;
            }
        }

        query += ` ORDER BY collected_at DESC, rank ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        return this.executeQuery<SearchResult>(query, params);
    }

    /**
     * Find search results with query information
     */
    async findWithQuery(filter: SearchResultFilter = {}, limit = 100, offset = 0): Promise<SearchResultWithQuery[]> {
        let query = `
            SELECT sr.*, q.text as query_text, q.category as query_category, 
                   q.created_at as query_created_at, q.updated_at as query_updated_at
            FROM search_results sr
            JOIN queries q ON sr.query_id = q.id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramIndex = 1;

        // Apply same filters as findMany
        if (filter.engine) {
            query += ` AND sr.engine = $${paramIndex++}`;
            params.push(filter.engine);
        }

        if (filter.query_id) {
            query += ` AND sr.query_id = $${paramIndex++}`;
            params.push(filter.query_id);
        }

        if (filter.collected_after) {
            query += ` AND sr.collected_at >= $${paramIndex++}`;
            params.push(filter.collected_after);
        }

        if (filter.collected_before) {
            query += ` AND sr.collected_at <= $${paramIndex++}`;
            params.push(filter.collected_before);
        }

        query += ` ORDER BY sr.collected_at DESC, sr.rank ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        const rows = await this.executeQuery<any>(query, params);

        return rows.map(row => ({
            id: row.id,
            query_id: row.query_id,
            engine: row.engine,
            rank: row.rank,
            title: row.title,
            snippet: row.snippet,
            url: row.url,
            collected_at: row.collected_at,
            content_hash: row.content_hash,
            raw_html_path: row.raw_html_path,
            query: {
                id: row.query_id,
                text: row.query_text,
                category: row.query_category,
                created_at: row.query_created_at,
                updated_at: row.query_updated_at
            }
        }));
    }

    /**
     * Bulk create search results
     */
    async createMany(results: CreateSearchResultRequest[]): Promise<SearchResult[]> {
        if (results.length === 0) {
            return [];
        }

        return this.db.transaction(async (client) => {
            const createdResults: SearchResult[] = [];

            for (const data of results) {
                // Validate each result
                if (!data.query_id || !data.engine || !data.title || !data.url) {
                    throw new ValidationError('Missing required fields in bulk create');
                }

                if (!this.validateUrl(data.url)) {
                    throw new ValidationError(`Invalid URL format: ${data.url}`);
                }

                const id = this.generateId();
                const now = new Date();

                const query = `
                    INSERT INTO search_results (
                        id, query_id, engine, rank, title, snippet, url, 
                        collected_at, content_hash, raw_html_path
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING *
                `;

                const params = [
                    id,
                    data.query_id,
                    data.engine,
                    data.rank,
                    this.sanitizeString(data.title),
                    this.sanitizeString(data.snippet),
                    data.url,
                    now,
                    data.content_hash,
                    data.raw_html_path
                ];

                const rows = await this.executeQuery<SearchResult>(query, params, client);
                if (rows.length > 0) {
                    createdResults.push(rows[0]);
                }
            }

            logger.info('Bulk search results created successfully', { count: createdResults.length });
            return createdResults;
        });
    }

    /**
     * Delete search result
     */
    async delete(id: string): Promise<boolean> {
        if (!id) {
            throw new ValidationError('Search result ID is required');
        }

        const query = 'DELETE FROM search_results WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rowCount > 0;
    }

    /**
     * Count search results with filters
     */
    async count(filter: SearchResultFilter = {}): Promise<number> {
        let query = 'SELECT COUNT(*) as count FROM search_results WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filter.engine) {
            query += ` AND engine = $${paramIndex++}`;
            params.push(filter.engine);
        }

        if (filter.query_id) {
            query += ` AND query_id = $${paramIndex++}`;
            params.push(filter.query_id);
        }

        if (filter.collected_after) {
            query += ` AND collected_at >= $${paramIndex++}`;
            params.push(filter.collected_after);
        }

        if (filter.collected_before) {
            query += ` AND collected_at <= $${paramIndex++}`;
            params.push(filter.collected_before);
        }

        const rows = await this.executeQuery<{ count: string }>(query, params);
        return parseInt(rows[0].count, 10);
    }
}

/**
 * Repository for Annotation operations
 */
export class AnnotationRepository extends BaseRepository {
    /**
     * Create a new annotation
     */
    async create(data: CreateAnnotationRequest): Promise<Annotation> {
        // Validate required fields
        if (!data.result_id || !data.model_version) {
            throw new ValidationError('Missing required fields: result_id, model_version');
        }

        // Validate scores if provided
        if (data.factual_score !== undefined && !this.validateScore(data.factual_score)) {
            throw new ValidationError('Factual score must be between 0.0 and 1.0');
        }

        if (data.confidence_score !== undefined && !this.validateScore(data.confidence_score)) {
            throw new ValidationError('Confidence score must be between 0.0 and 1.0');
        }

        const id = this.generateId();
        const now = new Date();

        const query = `
            INSERT INTO annotations (
                id, result_id, domain_type, factual_score, confidence_score, 
                reasoning, model_version, annotated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const params = [
            id,
            data.result_id,
            data.domain_type,
            data.factual_score,
            data.confidence_score,
            this.sanitizeString(data.reasoning),
            this.sanitizeString(data.model_version),
            now
        ];

        const rows = await this.executeQuery<Annotation>(query, params);

        if (rows.length === 0) {
            throw new DatabaseError('Failed to create annotation');
        }

        logger.info('Annotation created successfully', { id, result_id: data.result_id });
        return rows[0];
    }

    /**
     * Find annotation by ID
     */
    async findById(id: string): Promise<Annotation | null> {
        if (!id) {
            throw new ValidationError('Annotation ID is required');
        }

        const query = 'SELECT * FROM annotations WHERE id = $1';
        const rows = await this.executeQuery<Annotation>(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find annotation by result ID
     */
    async findByResultId(resultId: string): Promise<Annotation | null> {
        if (!resultId) {
            throw new ValidationError('Result ID is required');
        }

        const query = 'SELECT * FROM annotations WHERE result_id = $1';
        const rows = await this.executeQuery<Annotation>(query, [resultId]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find annotations with filters
     */
    async findMany(filter: AnnotationFilter = {}, limit = 100, offset = 0): Promise<Annotation[]> {
        let query = 'SELECT * FROM annotations WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filter.domain_type) {
            query += ` AND domain_type = $${paramIndex++}`;
            params.push(filter.domain_type);
        }

        if (filter.min_factual_score !== undefined) {
            query += ` AND factual_score >= $${paramIndex++}`;
            params.push(filter.min_factual_score);
        }

        if (filter.max_factual_score !== undefined) {
            query += ` AND factual_score <= $${paramIndex++}`;
            params.push(filter.max_factual_score);
        }

        if (filter.min_confidence_score !== undefined) {
            query += ` AND confidence_score >= $${paramIndex++}`;
            params.push(filter.min_confidence_score);
        }

        if (filter.model_version) {
            query += ` AND model_version = $${paramIndex++}`;
            params.push(filter.model_version);
        }

        if (filter.annotated_after) {
            query += ` AND annotated_at >= $${paramIndex++}`;
            params.push(filter.annotated_after);
        }

        if (filter.annotated_before) {
            query += ` AND annotated_at <= $${paramIndex++}`;
            params.push(filter.annotated_before);
        }

        query += ` ORDER BY annotated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(limit, offset);

        return this.executeQuery<Annotation>(query, params);
    }

    /**
     * Bulk create annotations
     */
    async createMany(annotations: CreateAnnotationRequest[]): Promise<Annotation[]> {
        if (annotations.length === 0) {
            return [];
        }

        return this.db.transaction(async (client) => {
            const createdAnnotations: Annotation[] = [];

            for (const data of annotations) {
                // Validate each annotation
                if (!data.result_id || !data.model_version) {
                    throw new ValidationError('Missing required fields in bulk create');
                }

                if (data.factual_score !== undefined && !this.validateScore(data.factual_score)) {
                    throw new ValidationError(`Invalid factual score: ${data.factual_score}`);
                }

                if (data.confidence_score !== undefined && !this.validateScore(data.confidence_score)) {
                    throw new ValidationError(`Invalid confidence score: ${data.confidence_score}`);
                }

                const id = this.generateId();
                const now = new Date();

                const query = `
                    INSERT INTO annotations (
                        id, result_id, domain_type, factual_score, confidence_score, 
                        reasoning, model_version, annotated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING *
                `;

                const params = [
                    id,
                    data.result_id,
                    data.domain_type,
                    data.factual_score,
                    data.confidence_score,
                    this.sanitizeString(data.reasoning),
                    this.sanitizeString(data.model_version),
                    now
                ];

                const rows = await this.executeQuery<Annotation>(query, params, client);
                if (rows.length > 0) {
                    createdAnnotations.push(rows[0]);
                }
            }

            logger.info('Bulk annotations created successfully', { count: createdAnnotations.length });
            return createdAnnotations;
        });
    }

    /**
     * Update annotation
     */
    async update(id: string, data: Partial<CreateAnnotationRequest>): Promise<Annotation | null> {
        if (!id) {
            throw new ValidationError('Annotation ID is required');
        }

        const updates: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        if (data.domain_type !== undefined) {
            updates.push(`domain_type = $${paramIndex++}`);
            params.push(data.domain_type);
        }

        if (data.factual_score !== undefined) {
            if (!this.validateScore(data.factual_score)) {
                throw new ValidationError('Factual score must be between 0.0 and 1.0');
            }
            updates.push(`factual_score = $${paramIndex++}`);
            params.push(data.factual_score);
        }

        if (data.confidence_score !== undefined) {
            if (!this.validateScore(data.confidence_score)) {
                throw new ValidationError('Confidence score must be between 0.0 and 1.0');
            }
            updates.push(`confidence_score = $${paramIndex++}`);
            params.push(data.confidence_score);
        }

        if (data.reasoning !== undefined) {
            updates.push(`reasoning = $${paramIndex++}`);
            params.push(this.sanitizeString(data.reasoning));
        }

        if (data.model_version !== undefined) {
            updates.push(`model_version = $${paramIndex++}`);
            params.push(this.sanitizeString(data.model_version));
        }

        if (updates.length === 0) {
            throw new ValidationError('No valid fields to update');
        }

        params.push(id);

        const query = `
            UPDATE annotations 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const rows = await this.executeQuery<Annotation>(query, params);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Delete annotation
     */
    async delete(id: string): Promise<boolean> {
        if (!id) {
            throw new ValidationError('Annotation ID is required');
        }

        const query = 'DELETE FROM annotations WHERE id = $1';
        const result = await this.db.query(query, [id]);
        return result.rowCount > 0;
    }

    /**
     * Count annotations with filters
     */
    async count(filter: AnnotationFilter = {}): Promise<number> {
        let query = 'SELECT COUNT(*) as count FROM annotations WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (filter.domain_type) {
            query += ` AND domain_type = $${paramIndex++}`;
            params.push(filter.domain_type);
        }

        if (filter.min_factual_score !== undefined) {
            query += ` AND factual_score >= $${paramIndex++}`;
            params.push(filter.min_factual_score);
        }

        if (filter.max_factual_score !== undefined) {
            query += ` AND factual_score <= $${paramIndex++}`;
            params.push(filter.max_factual_score);
        }

        if (filter.model_version) {
            query += ` AND model_version = $${paramIndex++}`;
            params.push(filter.model_version);
        }

        const rows = await this.executeQuery<{ count: string }>(query, params);
        return parseInt(rows[0].count, 10);
    }

    /**
     * Get annotation statistics
     */
    async getStatistics(filter: AnnotationFilter = {}): Promise<{
        totalCount: number;
        averageFactualScore: number;
        averageConfidenceScore: number;
        domainTypeDistribution: Record<string, number>;
    }> {
        let baseQuery = 'FROM annotations WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        // Apply filters
        if (filter.domain_type) {
            baseQuery += ` AND domain_type = $${paramIndex++}`;
            params.push(filter.domain_type);
        }

        if (filter.model_version) {
            baseQuery += ` AND model_version = $${paramIndex++}`;
            params.push(filter.model_version);
        }

        if (filter.annotated_after) {
            baseQuery += ` AND annotated_at >= $${paramIndex++}`;
            params.push(filter.annotated_after);
        }

        if (filter.annotated_before) {
            baseQuery += ` AND annotated_at <= $${paramIndex++}`;
            params.push(filter.annotated_before);
        }

        // Get basic statistics
        const statsQuery = `
            SELECT 
                COUNT(*) as total_count,
                AVG(factual_score) as avg_factual_score,
                AVG(confidence_score) as avg_confidence_score
            ${baseQuery}
        `;

        const statsRows = await this.executeQuery<{
            total_count: string;
            avg_factual_score: string;
            avg_confidence_score: string;
        }>(statsQuery, params);

        // Get domain type distribution
        const distributionQuery = `
            SELECT domain_type, COUNT(*) as count
            ${baseQuery}
            GROUP BY domain_type
            ORDER BY count DESC
        `;

        const distributionRows = await this.executeQuery<{
            domain_type: string;
            count: string;
        }>(distributionQuery, params);

        const domainTypeDistribution: Record<string, number> = {};
        distributionRows.forEach(row => {
            if (row.domain_type) {
                domainTypeDistribution[row.domain_type] = parseInt(row.count, 10);
            }
        });

        return {
            totalCount: parseInt(statsRows[0].total_count, 10),
            averageFactualScore: parseFloat(statsRows[0].avg_factual_score) || 0,
            averageConfidenceScore: parseFloat(statsRows[0].avg_confidence_score) || 0,
            domainTypeDistribution
        };
    }
}

/**
 * Custom error classes for better error handling
 */
export class DatabaseError extends Error {
    constructor(message: string, public originalError?: any) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Repository factory for creating repository instances
 */
export class RepositoryFactory {
    constructor(private db: DatabaseConnection) { }

    createQueryRepository(): QueryRepository {
        return new QueryRepository(this.db);
    }

    createSearchResultRepository(): SearchResultRepository {
        return new SearchResultRepository(this.db);
    }

    createAnnotationRepository(): AnnotationRepository {
        return new AnnotationRepository(this.db);
    }
}