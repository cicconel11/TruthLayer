import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseConnection } from '../database/connection';
import { RepositoryFactory } from '../database/repositories';
import { DataIntegrityService } from '../services/data-integrity-service';
import { generateSearchResultHash } from '../utils/hash-utils';
import { CreateQueryRequest, CreateSearchResultRequest, CreateAnnotationRequest } from '../database/models';

// Mock database connection
const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    healthCheck: vi.fn(),
    getClient: vi.fn()
} as unknown as DatabaseConnection;

describe('DataIntegrityService', () => {
    let repositories: RepositoryFactory;
    let integrityService: DataIntegrityService;
    let testQueryId: string;
    let testResultIds: string[] = [];

    beforeEach(() => {
        vi.clearAllMocks();
        repositories = new RepositoryFactory(mockDb);
        integrityService = new DataIntegrityService(mockDb);
        testQueryId = 'test-query-id-123';
        testResultIds = [];
    });



    describe('validateDataIntegrity', () => {
        it('should validate data integrity with all checks enabled', async () => {
            // Mock repository responses for valid data
            const mockSearchResults = [{
                id: 'result-1',
                query_id: testQueryId,
                engine: 'google',
                rank: 1,
                title: 'Test Result',
                snippet: 'Test snippet',
                url: 'https://example.com',
                collected_at: new Date(),
                content_hash: generateSearchResultHash('Test Result', 'Test snippet', 'https://example.com'),
                raw_html_path: null
            }];

            const mockQueries = [{
                id: testQueryId,
                text: 'test query',
                category: 'technology',
                created_at: new Date(),
                updated_at: new Date()
            }];

            const mockAnnotations = [{
                id: 'annotation-1',
                result_id: 'result-1',
                domain_type: 'commercial',
                factual_score: 0.8,
                confidence_score: 0.9,
                reasoning: 'Test reasoning',
                model_version: 'gpt-4',
                annotated_at: new Date()
            }];

            // Mock the repository methods
            vi.spyOn(repositories.createSearchResultRepository(), 'findMany')
                .mockResolvedValueOnce(mockSearchResults)
                .mockResolvedValueOnce([]); // Second call returns empty to end pagination

            vi.spyOn(repositories.createQueryRepository(), 'findMany')
                .mockResolvedValueOnce(mockQueries)
                .mockResolvedValueOnce([]); // Second call returns empty to end pagination

            vi.spyOn(repositories.createAnnotationRepository(), 'findMany')
                .mockResolvedValueOnce(mockAnnotations)
                .mockResolvedValueOnce([]); // Second call returns empty to end pagination

            const validation = await integrityService.validateDataIntegrity({
                checkHashes: true,
                checkSchema: true,
                checkDuplicates: true
            });

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
            expect(validation.statistics.totalRecords).toBe(3); // 1 search result + 1 query + 1 annotation
            expect(validation.statistics.validRecords).toBe(3);
            expect(validation.statistics.schemaViolations).toBe(0);
        });

        it('should detect missing content hashes', async () => {
            // Mock search result without hash
            const mockSearchResults = [{
                id: 'result-1',
                query_id: testQueryId,
                engine: 'google',
                rank: 1,
                title: 'Test Result',
                snippet: 'Test snippet',
                url: 'https://example.com',
                collected_at: new Date(),
                content_hash: null, // Missing hash
                raw_html_path: null
            }];

            vi.spyOn(repositories.createSearchResultRepository(), 'findMany')
                .mockResolvedValueOnce(mockSearchResults)
                .mockResolvedValueOnce([]); // End pagination

            vi.spyOn(repositories.createQueryRepository(), 'findMany')
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            vi.spyOn(repositories.createAnnotationRepository(), 'findMany')
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const validation = await integrityService.validateDataIntegrity({
                checkHashes: true
            });

            expect(validation.warnings.some(w => w.includes('Missing content hash'))).toBe(true);
            expect(validation.statistics.missingHashes).toBe(1);
        });

        it('should detect hash mismatches', async () => {
            // Mock search result with incorrect hash
            const mockSearchResults = [{
                id: 'result-1',
                query_id: testQueryId,
                engine: 'google',
                rank: 1,
                title: 'Test Result',
                snippet: 'Test snippet',
                url: 'https://example.com',
                collected_at: new Date(),
                content_hash: 'incorrect_hash_value_that_does_not_match_content_at_all_wrong',
                raw_html_path: null
            }];

            vi.spyOn(repositories.createSearchResultRepository(), 'findMany')
                .mockResolvedValueOnce(mockSearchResults)
                .mockResolvedValueOnce([]);

            vi.spyOn(repositories.createQueryRepository(), 'findMany')
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            vi.spyOn(repositories.createAnnotationRepository(), 'findMany')
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const validation = await integrityService.validateDataIntegrity({
                checkHashes: true
            });

            expect(validation.isValid).toBe(false);
            expect(validation.errors.some(e => e.includes('Hash mismatch'))).toBe(true);
        });
    });

    describe('generateMissingContentHashes', () => {
        it('should generate hashes for results without them', async () => {
            // Mock search results without hashes
            const mockResults = [
                {
                    id: 'result-1',
                    query_id: testQueryId,
                    engine: 'google',
                    rank: 1,
                    title: 'Test Result 1',
                    snippet: 'Test snippet 1',
                    url: 'https://example.com/1',
                    collected_at: new Date(),
                    content_hash: null,
                    raw_html_path: null
                },
                {
                    id: 'result-2',
                    query_id: testQueryId,
                    engine: 'google',
                    rank: 2,
                    title: 'Test Result 2',
                    snippet: 'Test snippet 2',
                    url: 'https://example.com/2',
                    collected_at: new Date(),
                    content_hash: null,
                    raw_html_path: null
                }
            ];

            vi.spyOn(repositories.createSearchResultRepository(), 'findMany')
                .mockResolvedValueOnce(mockResults)
                .mockResolvedValueOnce([]); // End pagination

            // Mock database update queries
            (mockDb.query as any).mockResolvedValue({ rowCount: 1 });

            const hashGeneration = await integrityService.generateMissingContentHashes();

            expect(hashGeneration.processed).toBe(2);
            expect(hashGeneration.updated).toBe(2);
            expect(hashGeneration.errors).toHaveLength(0);
        });
    });

    describe('findDuplicateResults', () => {
        it('should find duplicate results by content hash', async () => {
            const hash = generateSearchResultHash('Test Result', 'Test snippet', 'https://example.com');

            // Mock database query for duplicates
            (mockDb.query as any).mockResolvedValue({
                rows: [{
                    content_hash: hash,
                    result_ids: ['result-1', 'result-2', 'result-3'],
                    count: '3'
                }]
            });

            const duplicates = await integrityService.findDuplicateResults();

            expect(duplicates.duplicateGroups).toHaveLength(1);
            expect(duplicates.duplicateGroups[0].contentHash).toBe(hash);
            expect(duplicates.duplicateGroups[0].count).toBe(3);
            expect(duplicates.duplicateGroups[0].resultIds).toHaveLength(3);
            expect(duplicates.totalDuplicates).toBe(2); // 3 results - 1 unique = 2 duplicates
        });
    });
});