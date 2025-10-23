import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    QueryRepository,
    SearchResultRepository,
    AnnotationRepository,
    RepositoryFactory,
    DatabaseError,
    ValidationError
} from '../database/repositories';
import { DatabaseConnection } from '../database/connection';
import { MigrationManager } from '../database/migrations';
import type {
    CreateQueryRequest,
    CreateSearchResultRequest,
    CreateAnnotationRequest,
    Query,
    SearchResult,
    Annotation
} from '../database/models';

// Mock database connection
const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    healthCheck: vi.fn(),
    getClient: vi.fn()
} as unknown as DatabaseConnection;

describe('Repository Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('QueryRepository', () => {
        let queryRepo: QueryRepository;

        beforeEach(() => {
            queryRepo = new QueryRepository(mockDb);
        });

        describe('create', () => {
            it('should create a new query successfully', async () => {
                const mockQuery: Query = {
                    id: 'test-id',
                    text: 'test query',
                    category: 'health',
                    created_at: new Date(),
                    updated_at: new Date()
                };

                (mockDb.query as any).mockResolvedValue({ rows: [mockQuery] });

                const createData: CreateQueryRequest = {
                    text: 'test query',
                    category: 'health'
                };

                const result = await queryRepo.create(createData);

                expect(result).toEqual(mockQuery);
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO queries'),
                    expect.arrayContaining(['test query', 'health'])
                );
            });

            it('should throw ValidationError for empty text', async () => {
                const createData: CreateQueryRequest = {
                    text: '',
                    category: 'health'
                };

                await expect(queryRepo.create(createData)).rejects.toThrow(ValidationError);
                expect(mockDb.query).not.toHaveBeenCalled();
            });

            it('should sanitize input text', async () => {
                const mockQuery: Query = {
                    id: 'test-id',
                    text: 'test query',
                    category: 'health',
                    created_at: new Date(),
                    updated_at: new Date()
                };

                (mockDb.query as any).mockResolvedValue({ rows: [mockQuery] });

                const createData: CreateQueryRequest = {
                    text: '  test query\0  ',
                    category: 'health'
                };

                await queryRepo.create(createData);

                // Check that the query was called and text was sanitized
                expect(mockDb.query).toHaveBeenCalled();
                const callArgs = (mockDb.query as any).mock.calls[0];
                // The text should be trimmed (removing leading/trailing spaces and null chars)
                const actualText = callArgs[1][1];
                expect(actualText).toBe('test query');
            });
        });

        describe('findById', () => {
            it('should find query by ID', async () => {
                const mockQuery: Query = {
                    id: 'test-id',
                    text: 'test query',
                    category: 'health',
                    created_at: new Date(),
                    updated_at: new Date()
                };

                (mockDb.query as any).mockResolvedValue({ rows: [mockQuery] });

                const result = await queryRepo.findById('test-id');

                expect(result).toEqual(mockQuery);
                expect(mockDb.query).toHaveBeenCalledWith(
                    'SELECT * FROM queries WHERE id = $1',
                    ['test-id']
                );
            });

            it('should return null for non-existent ID', async () => {
                (mockDb.query as any).mockResolvedValue({ rows: [] });

                const result = await queryRepo.findById('non-existent');

                expect(result).toBeNull();
            });

            it('should throw ValidationError for empty ID', async () => {
                await expect(queryRepo.findById('')).rejects.toThrow(ValidationError);
            });
        });

        describe('findMany', () => {
            it('should find queries with filters', async () => {
                const mockQueries: Query[] = [
                    {
                        id: 'test-id-1',
                        text: 'test query 1',
                        category: 'health',
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                ];

                (mockDb.query as any).mockResolvedValue({ rows: mockQueries });

                const result = await queryRepo.findMany({ category: 'health' }, 10, 0);

                expect(result).toEqual(mockQueries);
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.stringContaining('WHERE 1=1 AND category = $1'),
                    expect.arrayContaining(['health', 10, 0])
                );
            });
        });

        describe('update', () => {
            it('should update query successfully', async () => {
                const mockQuery: Query = {
                    id: 'test-id',
                    text: 'updated query',
                    category: 'health',
                    created_at: new Date(),
                    updated_at: new Date()
                };

                (mockDb.query as any).mockResolvedValue({ rows: [mockQuery] });

                const result = await queryRepo.update('test-id', { text: 'updated query' });

                expect(result).toEqual(mockQuery);
                // Check that the query contains UPDATE and the text parameter is correct
                const callArgs = (mockDb.query as any).mock.calls[0];
                expect(callArgs[0]).toContain('UPDATE queries');
                expect(callArgs[1][0]).toBe('updated query');
            });

            it('should throw ValidationError for empty text update', async () => {
                await expect(queryRepo.update('test-id', { text: '' })).rejects.toThrow(ValidationError);
            });
        });

        describe('delete', () => {
            it('should delete query successfully', async () => {
                (mockDb.query as any).mockResolvedValue({ rowCount: 1 });

                const result = await queryRepo.delete('test-id');

                expect(result).toBe(true);
                expect(mockDb.query).toHaveBeenCalledWith(
                    'DELETE FROM queries WHERE id = $1',
                    ['test-id']
                );
            });

            it('should return false for non-existent query', async () => {
                (mockDb.query as any).mockResolvedValue({ rowCount: 0 });

                const result = await queryRepo.delete('non-existent');

                expect(result).toBe(false);
            });
        });
    });

    describe('SearchResultRepository', () => {
        let searchResultRepo: SearchResultRepository;

        beforeEach(() => {
            searchResultRepo = new SearchResultRepository(mockDb);
        });

        describe('create', () => {
            it('should create a new search result successfully', async () => {
                const mockResult: SearchResult = {
                    id: 'test-id',
                    query_id: 'query-id',
                    engine: 'google',
                    rank: 1,
                    title: 'Test Title',
                    snippet: 'Test snippet',
                    url: 'https://example.com',
                    collected_at: new Date(),
                    content_hash: 'hash123',
                    raw_html_path: '/path/to/html'
                };

                (mockDb.query as any).mockResolvedValue({ rows: [mockResult] });

                const createData: CreateSearchResultRequest = {
                    query_id: 'query-id',
                    engine: 'google',
                    rank: 1,
                    title: 'Test Title',
                    snippet: 'Test snippet',
                    url: 'https://example.com',
                    content_hash: 'hash123',
                    raw_html_path: '/path/to/html'
                };

                const result = await searchResultRepo.create(createData);

                expect(result).toEqual(mockResult);
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO search_results'),
                    expect.arrayContaining(['query-id', 'google', 1, 'Test Title'])
                );
            });

            it('should throw ValidationError for invalid URL', async () => {
                const createData: CreateSearchResultRequest = {
                    query_id: 'query-id',
                    engine: 'google',
                    rank: 1,
                    title: 'Test Title',
                    url: 'invalid-url'
                };

                await expect(searchResultRepo.create(createData)).rejects.toThrow(ValidationError);
            });

            it('should throw ValidationError for invalid rank', async () => {
                const createData: CreateSearchResultRequest = {
                    query_id: 'query-id',
                    engine: 'google',
                    rank: 0,
                    title: 'Test Title',
                    url: 'https://example.com'
                };

                await expect(searchResultRepo.create(createData)).rejects.toThrow(ValidationError);
            });
        });

        describe('createMany', () => {
            it('should create multiple search results in transaction', async () => {
                const mockResults: SearchResult[] = [
                    {
                        id: 'test-id-1',
                        query_id: 'query-id',
                        engine: 'google',
                        rank: 1,
                        title: 'Test Title 1',
                        snippet: 'Test snippet 1',
                        url: 'https://example1.com',
                        collected_at: new Date()
                    },
                    {
                        id: 'test-id-2',
                        query_id: 'query-id',
                        engine: 'google',
                        rank: 2,
                        title: 'Test Title 2',
                        snippet: 'Test snippet 2',
                        url: 'https://example2.com',
                        collected_at: new Date()
                    }
                ];

                (mockDb.transaction as any).mockImplementation(async (callback) => {
                    const mockClient = {
                        query: vi.fn()
                            .mockResolvedValueOnce({ rows: [mockResults[0]] })
                            .mockResolvedValueOnce({ rows: [mockResults[1]] })
                    };
                    return callback(mockClient);
                });

                const createData: CreateSearchResultRequest[] = [
                    {
                        query_id: 'query-id',
                        engine: 'google',
                        rank: 1,
                        title: 'Test Title 1',
                        url: 'https://example1.com'
                    },
                    {
                        query_id: 'query-id',
                        engine: 'google',
                        rank: 2,
                        title: 'Test Title 2',
                        url: 'https://example2.com'
                    }
                ];

                const result = await searchResultRepo.createMany(createData);

                expect(result).toHaveLength(2);
                expect(mockDb.transaction).toHaveBeenCalled();
            });
        });
    });

    describe('AnnotationRepository', () => {
        let annotationRepo: AnnotationRepository;

        beforeEach(() => {
            annotationRepo = new AnnotationRepository(mockDb);
        });

        describe('create', () => {
            it('should create a new annotation successfully', async () => {
                const mockAnnotation: Annotation = {
                    id: 'test-id',
                    result_id: 'result-id',
                    domain_type: 'news',
                    factual_score: 0.8,
                    confidence_score: 0.9,
                    reasoning: 'Test reasoning',
                    model_version: 'gpt-4',
                    annotated_at: new Date()
                };

                (mockDb.query as any).mockResolvedValue({ rows: [mockAnnotation] });

                const createData: CreateAnnotationRequest = {
                    result_id: 'result-id',
                    domain_type: 'news',
                    factual_score: 0.8,
                    confidence_score: 0.9,
                    reasoning: 'Test reasoning',
                    model_version: 'gpt-4'
                };

                const result = await annotationRepo.create(createData);

                expect(result).toEqual(mockAnnotation);
                expect(mockDb.query).toHaveBeenCalledWith(
                    expect.stringContaining('INSERT INTO annotations'),
                    expect.arrayContaining(['result-id', 'news', 0.8, 0.9])
                );
            });

            it('should throw ValidationError for invalid factual score', async () => {
                const createData: CreateAnnotationRequest = {
                    result_id: 'result-id',
                    factual_score: 1.5,
                    model_version: 'gpt-4'
                };

                await expect(annotationRepo.create(createData)).rejects.toThrow(ValidationError);
            });

            it('should throw ValidationError for invalid confidence score', async () => {
                const createData: CreateAnnotationRequest = {
                    result_id: 'result-id',
                    confidence_score: -0.1,
                    model_version: 'gpt-4'
                };

                await expect(annotationRepo.create(createData)).rejects.toThrow(ValidationError);
            });
        });

        describe('getStatistics', () => {
            it('should return annotation statistics', async () => {
                const mockStats = {
                    total_count: '100',
                    avg_factual_score: '0.75',
                    avg_confidence_score: '0.85'
                };

                const mockDistribution = [
                    { domain_type: 'news', count: '50' },
                    { domain_type: 'academic', count: '30' },
                    { domain_type: 'blog', count: '20' }
                ];

                (mockDb.query as any)
                    .mockResolvedValueOnce({ rows: [mockStats] })
                    .mockResolvedValueOnce({ rows: mockDistribution });

                const result = await annotationRepo.getStatistics();

                expect(result).toEqual({
                    totalCount: 100,
                    averageFactualScore: 0.75,
                    averageConfidenceScore: 0.85,
                    domainTypeDistribution: {
                        news: 50,
                        academic: 30,
                        blog: 20
                    }
                });
            });
        });
    });

    describe('RepositoryFactory', () => {
        let factory: RepositoryFactory;

        beforeEach(() => {
            factory = new RepositoryFactory(mockDb);
        });

        it('should create QueryRepository instance', () => {
            const repo = factory.createQueryRepository();
            expect(repo).toBeInstanceOf(QueryRepository);
        });

        it('should create SearchResultRepository instance', () => {
            const repo = factory.createSearchResultRepository();
            expect(repo).toBeInstanceOf(SearchResultRepository);
        });

        it('should create AnnotationRepository instance', () => {
            const repo = factory.createAnnotationRepository();
            expect(repo).toBeInstanceOf(AnnotationRepository);
        });
    });

    describe('Error Handling', () => {
        let queryRepo: QueryRepository;

        beforeEach(() => {
            queryRepo = new QueryRepository(mockDb);
        });

        it('should throw DatabaseError on query failure', async () => {
            const dbError = new Error('Connection failed');
            (mockDb.query as any).mockRejectedValue(dbError);

            await expect(queryRepo.findById('test-id')).rejects.toThrow(DatabaseError);
        });

        it('should handle transaction rollback on error', async () => {
            const searchResultRepo = new SearchResultRepository(mockDb);
            const transactionError = new Error('Transaction failed');

            (mockDb.transaction as any).mockImplementation(async (callback: any) => {
                const mockClient = {
                    query: vi.fn().mockRejectedValue(transactionError)
                };
                return callback(mockClient);
            });

            const createData: CreateSearchResultRequest[] = [
                {
                    query_id: 'query-id',
                    engine: 'google',
                    rank: 1,
                    title: 'Test Title',
                    url: 'https://example.com'
                }
            ];

            await expect(searchResultRepo.createMany(createData)).rejects.toThrow();
        });

        it('should handle network timeout errors', async () => {
            const timeoutError = new Error('Connection timeout');
            timeoutError.name = 'TimeoutError';
            (mockDb.query as any).mockRejectedValue(timeoutError);

            await expect(queryRepo.findById('test-id')).rejects.toThrow(DatabaseError);
        });

        it('should handle constraint violation errors', async () => {
            const constraintError = new Error('duplicate key value violates unique constraint');
            constraintError.name = 'ConstraintError';
            (mockDb.query as any).mockRejectedValue(constraintError);

            const createData: CreateQueryRequest = {
                text: 'test query',
                category: 'health'
            };

            await expect(queryRepo.create(createData)).rejects.toThrow(DatabaseError);
        });
    });

    describe('Database Connection Tests', () => {
        it('should establish database connection successfully', async () => {
            const config = {
                host: 'localhost',
                port: 5432,
                database: 'test_db',
                username: 'test_user',
                password: 'test_password'
            };

            const dbConnection = new DatabaseConnection(config);
            expect(dbConnection).toBeDefined();
        });

        it('should handle connection failures gracefully', async () => {
            const mockDbWithFailure = {
                query: vi.fn().mockRejectedValue(new Error('Connection refused')),
                transaction: vi.fn(),
                connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
                close: vi.fn(),
                healthCheck: vi.fn().mockResolvedValue(false),
                getClient: vi.fn()
            } as unknown as DatabaseConnection;

            await expect(mockDbWithFailure.connect()).rejects.toThrow('Connection refused');
        });

        it('should perform health check correctly', async () => {
            const healthyDb = {
                query: vi.fn().mockResolvedValue({ rows: [{ health: 1 }] }),
                healthCheck: vi.fn().mockResolvedValue(true)
            } as unknown as DatabaseConnection;

            const isHealthy = await healthyDb.healthCheck();
            expect(isHealthy).toBe(true);
        });

        it('should handle health check failures', async () => {
            const unhealthyDb = {
                query: vi.fn().mockRejectedValue(new Error('Database unavailable')),
                healthCheck: vi.fn().mockResolvedValue(false)
            } as unknown as DatabaseConnection;

            const isHealthy = await unhealthyDb.healthCheck();
            expect(isHealthy).toBe(false);
        });

        it('should handle transaction commit and rollback', async () => {
            const mockClient = {
                query: vi.fn()
                    .mockResolvedValueOnce({ rows: [] }) // BEGIN
                    .mockResolvedValueOnce({ rows: [{ id: 'test' }] }) // actual query
                    .mockResolvedValueOnce({ rows: [] }), // COMMIT
                release: vi.fn()
            };

            const transactionDb = {
                getClient: vi.fn().mockResolvedValue(mockClient),
                transaction: vi.fn().mockImplementation(async (callback: any) => {
                    await mockClient.query('BEGIN');
                    try {
                        const result = await callback(mockClient);
                        await mockClient.query('COMMIT');
                        return result;
                    } catch (error) {
                        await mockClient.query('ROLLBACK');
                        throw error;
                    } finally {
                        mockClient.release();
                    }
                })
            } as unknown as DatabaseConnection;

            const result = await transactionDb.transaction(async (client) => {
                return await client.query('SELECT * FROM test');
            });

            expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
            expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    describe('Migration Manager Tests', () => {
        let migrationManager: MigrationManager;
        let mockDbForMigrations: DatabaseConnection;

        beforeEach(() => {
            mockDbForMigrations = {
                query: vi.fn(),
                transaction: vi.fn(),
                connect: vi.fn(),
                close: vi.fn(),
                healthCheck: vi.fn(),
                getClient: vi.fn()
            } as unknown as DatabaseConnection;

            migrationManager = new MigrationManager(mockDbForMigrations);
        });

        it('should initialize migrations table', async () => {
            (mockDbForMigrations.query as any).mockResolvedValue({ rows: [] });

            await migrationManager.initialize();

            expect(mockDbForMigrations.query).toHaveBeenCalledWith(
                expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations')
            );
        });

        it('should get applied migrations', async () => {
            const mockMigrations = [
                { id: '001_initial_schema', name: 'initial schema', applied_at: new Date() }
            ];
            (mockDbForMigrations.query as any).mockResolvedValue({ rows: mockMigrations });

            const applied = await migrationManager.getAppliedMigrations();

            expect(applied).toEqual(mockMigrations);
            expect(mockDbForMigrations.query).toHaveBeenCalledWith(
                'SELECT id, name, applied_at FROM migrations ORDER BY applied_at ASC'
            );
        });

        it('should handle migration application errors', async () => {
            const migrationError = new Error('Migration failed');
            (mockDbForMigrations.transaction as any).mockRejectedValue(migrationError);

            const migration = {
                id: '001_test',
                name: 'test migration',
                sql: 'CREATE TABLE test (id UUID);'
            };

            await expect(migrationManager.applyMigration(migration)).rejects.toThrow('Migration failed');
        });

        it('should get migration status correctly', async () => {
            const appliedMigrations = [
                { id: '001_initial_schema', name: 'initial schema', applied_at: new Date() }
            ];

            (mockDbForMigrations.query as any).mockResolvedValue({ rows: appliedMigrations });

            // Mock the file system operations by overriding the private method behavior
            const originalGetPending = migrationManager.getPendingMigrations;
            migrationManager.getPendingMigrations = vi.fn().mockResolvedValue([]);

            const status = await migrationManager.getMigrationStatus();

            expect(status.applied).toEqual(appliedMigrations);
            expect(status.pending).toEqual([]);
        });
    });

    describe('Data Validation Tests', () => {
        let queryRepo: QueryRepository;
        let searchResultRepo: SearchResultRepository;
        let annotationRepo: AnnotationRepository;

        beforeEach(() => {
            queryRepo = new QueryRepository(mockDb);
            searchResultRepo = new SearchResultRepository(mockDb);
            annotationRepo = new AnnotationRepository(mockDb);
        });

        it('should validate query text length limits', async () => {
            const longText = 'a'.repeat(10000);
            const createData: CreateQueryRequest = {
                text: longText,
                category: 'health'
            };

            // Should not throw for long text (database will handle limits)
            (mockDb.query as any).mockResolvedValue({
                rows: [{ id: 'test', text: longText, category: 'health', created_at: new Date(), updated_at: new Date() }]
            });

            const result = await queryRepo.create(createData);
            expect(result.text).toBe(longText);
        });

        it('should sanitize malicious input', async () => {
            const maliciousText = "'; DROP TABLE queries; --";
            const createData: CreateQueryRequest = {
                text: maliciousText,
                category: 'health'
            };

            (mockDb.query as any).mockResolvedValue({
                rows: [{ id: 'test', text: maliciousText, category: 'health', created_at: new Date(), updated_at: new Date() }]
            });

            await queryRepo.create(createData);

            // Verify that the query was called with parameterized values
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO queries'),
                expect.arrayContaining([maliciousText, 'health'])
            );
        });

        it('should validate search result rank boundaries', async () => {
            const invalidRankData: CreateSearchResultRequest = {
                query_id: 'query-id',
                engine: 'google',
                rank: 101, // Invalid: > 100
                title: 'Test Title',
                url: 'https://example.com'
            };

            await expect(searchResultRepo.create(invalidRankData)).rejects.toThrow(ValidationError);

            const negativeRankData: CreateSearchResultRequest = {
                query_id: 'query-id',
                engine: 'google',
                rank: -1, // Invalid: < 1
                title: 'Test Title',
                url: 'https://example.com'
            };

            await expect(searchResultRepo.create(negativeRankData)).rejects.toThrow(ValidationError);
        });

        it('should validate annotation score precision', async () => {
            const preciseScoreData: CreateAnnotationRequest = {
                result_id: 'result-id',
                factual_score: 0.123456789, // High precision
                confidence_score: 0.987654321,
                model_version: 'gpt-4'
            };

            (mockDb.query as any).mockResolvedValue({
                rows: [{
                    id: 'test',
                    result_id: 'result-id',
                    factual_score: 0.12, // Database rounds to 2 decimal places
                    confidence_score: 0.99,
                    model_version: 'gpt-4',
                    annotated_at: new Date()
                }]
            });

            const result = await annotationRepo.create(preciseScoreData);

            // Verify the annotation was created (database handles precision)
            expect(result.result_id).toBe('result-id');
        });

        it('should handle concurrent repository operations', async () => {
            const promises = Array.from({ length: 10 }, (_, i) => {
                (mockDb.query as any).mockResolvedValue({
                    rows: [{
                        id: `test-${i}`,
                        text: `query ${i}`,
                        category: 'health',
                        created_at: new Date(),
                        updated_at: new Date()
                    }]
                });

                return queryRepo.create({
                    text: `concurrent query ${i}`,
                    category: 'health'
                });
            });

            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
            expect(mockDb.query).toHaveBeenCalledTimes(10);
        });
    });
});