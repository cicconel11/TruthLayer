import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryService, BENCHMARK_QUERIES, SEASONAL_QUERIES } from '../services/query-service';
import { QueryManagementService } from '../services/query-management-service';
import { DatabaseConnection } from '../database/connection';
import { QueryRepository } from '../database/repositories';
import { Query } from '../database/models';
import { QueryCategory } from '../types/query';

// Mock the database connection
const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
    close: vi.fn()
} as unknown as DatabaseConnection;

// Mock the query repository
const mockQueryRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
};

// Mock the repository factory
vi.mock('../database/repositories', () => ({
    RepositoryFactory: class MockRepositoryFactory {
        constructor(db: any) { }
        createQueryRepository() {
            return mockQueryRepo;
        }
    }
}));

describe('QueryService', () => {
    let queryService: QueryService;

    beforeEach(() => {
        vi.clearAllMocks();
        queryService = new QueryService(mockDb);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Benchmark Queries', () => {
        it('should have predefined benchmark queries for all categories', () => {
            expect(BENCHMARK_QUERIES.health).toBeDefined();
            expect(BENCHMARK_QUERIES.politics).toBeDefined();
            expect(BENCHMARK_QUERIES.technology).toBeDefined();
            expect(BENCHMARK_QUERIES.science).toBeDefined();

            // Verify each category has queries
            expect(BENCHMARK_QUERIES.health.length).toBeGreaterThan(0);
            expect(BENCHMARK_QUERIES.politics.length).toBeGreaterThan(0);
            expect(BENCHMARK_QUERIES.technology.length).toBeGreaterThan(0);
            expect(BENCHMARK_QUERIES.science.length).toBeGreaterThan(0);

            // Verify query content
            expect(BENCHMARK_QUERIES.health).toContain('covid vaccine safety');
            expect(BENCHMARK_QUERIES.politics).toContain('election results 2024');
            expect(BENCHMARK_QUERIES.technology).toContain('AI safety research');
            expect(BENCHMARK_QUERIES.science).toContain('renewable energy efficiency');
        });

        it('should initialize benchmark queries in database', async () => {
            mockQueryRepo.findMany.mockResolvedValue([]);
            mockQueryRepo.create.mockResolvedValue({ id: 'test-id' });

            await queryService.initializeBenchmarkQueries();

            // Should check for existing queries in each category
            expect(mockQueryRepo.findMany).toHaveBeenCalledTimes(4);

            // Should create queries for each category
            const totalQueries = Object.values(BENCHMARK_QUERIES).flat().length;
            expect(mockQueryRepo.create).toHaveBeenCalledTimes(totalQueries);
        });

        it('should not duplicate existing queries during initialization', async () => {
            const existingQuery: Query = {
                id: 'existing-id',
                text: 'covid vaccine safety',
                category: 'health',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQueryRepo.findMany.mockResolvedValue([existingQuery]);
            mockQueryRepo.create.mockResolvedValue({ id: 'new-id' });

            await queryService.initializeBenchmarkQueries();

            // Should still check all categories
            expect(mockQueryRepo.findMany).toHaveBeenCalledTimes(4);

            // Should create fewer queries (excluding existing ones)
            const healthQueries = BENCHMARK_QUERIES.health.length;
            const otherQueries = Object.values(BENCHMARK_QUERIES).flat().length - healthQueries;
            expect(mockQueryRepo.create).toHaveBeenCalledTimes(otherQueries + healthQueries - 1);
        });
    });

    describe('Query Retrieval', () => {
        it('should get queries by category', async () => {
            const mockQueries: Query[] = [
                {
                    id: '1',
                    text: 'covid vaccine safety',
                    category: 'health',
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ];

            mockQueryRepo.findMany.mockResolvedValue(mockQueries);

            const result = await queryService.getQueriesByCategory('health');

            expect(mockQueryRepo.findMany).toHaveBeenCalledWith({ category: 'health' }, 50);
            expect(result).toEqual(mockQueries);
        });

        it('should get daily query set with balanced categories', async () => {
            const mockHealthQueries = Array.from({ length: 15 }, (_, i) => ({
                id: `health-${i}`,
                text: `health query ${i}`,
                category: 'health' as QueryCategory,
                created_at: new Date(),
                updated_at: new Date()
            }));

            mockQueryRepo.findMany.mockResolvedValue(mockHealthQueries);

            const result = await queryService.getDailyQuerySet();

            // Should call findMany for each category
            expect(mockQueryRepo.findMany).toHaveBeenCalledTimes(4);
            expect(result.length).toBeLessThanOrEqual(50);
        });

        it('should get weekly query set with more queries', async () => {
            const mockQueries = Array.from({ length: 100 }, (_, i) => ({
                id: `query-${i}`,
                text: `query ${i}`,
                category: 'health' as QueryCategory,
                created_at: new Date(),
                updated_at: new Date()
            }));

            mockQueryRepo.findMany.mockResolvedValue(mockQueries);

            const result = await queryService.getWeeklyQuerySet();

            expect(mockQueryRepo.findMany).toHaveBeenCalledTimes(4);
            expect(result.length).toBeLessThanOrEqual(200);
        });
    });

    describe('Seasonal Queries', () => {
        it('should return appropriate seasonal queries based on current date', async () => {
            // Mock current date to be in spring (March)
            const mockDate = new Date('2024-03-15');
            vi.setSystemTime(mockDate);

            const seasonalQueries = await queryService.getSeasonalQueries();

            expect(seasonalQueries).toEqual(SEASONAL_QUERIES.seasonal.spring);
            expect(seasonalQueries).toContain('allergy season treatment');

            vi.useRealTimers();
        });

        it('should handle all seasons correctly', async () => {
            const seasons = [
                { month: 1, season: 'winter' },  // January
                { month: 4, season: 'spring' },  // April
                { month: 7, season: 'summer' },  // July
                { month: 10, season: 'fall' }    // October
            ];

            for (const { month, season } of seasons) {
                const mockDate = new Date(2024, month - 1, 15);
                vi.setSystemTime(mockDate);

                const seasonalQueries = await queryService.getSeasonalQueries();
                expect(seasonalQueries).toEqual(SEASONAL_QUERIES.seasonal[season as keyof typeof SEASONAL_QUERIES.seasonal]);
            }

            vi.useRealTimers();
        });
    });

    describe('Event-Driven Queries', () => {
        it('should add event-driven queries for different event types', async () => {
            const mockCreatedQuery: Query = {
                id: 'event-query-id',
                text: 'voter registration',
                category: 'general',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQueryRepo.create.mockResolvedValue(mockCreatedQuery);

            const result = await queryService.addEventDrivenQueries('election');

            expect(mockQueryRepo.create).toHaveBeenCalledTimes(SEASONAL_QUERIES.eventDriven.election.length);
            expect(result).toHaveLength(SEASONAL_QUERIES.eventDriven.election.length);

            // Verify first call
            expect(mockQueryRepo.create).toHaveBeenCalledWith({
                text: 'voter registration',
                category: 'general'
            });
        });

        it('should handle creation failures gracefully', async () => {
            mockQueryRepo.create
                .mockResolvedValueOnce({ id: 'success-1' })
                .mockRejectedValueOnce(new Error('Database error'))
                .mockResolvedValueOnce({ id: 'success-2' });

            const result = await queryService.addEventDrivenQueries('election');

            // Should return only successful creations
            expect(result).toHaveLength(2);
        });
    });

    describe('Query Set Management', () => {
        it('should create query set with valid queries', async () => {
            const mockQuery: Query = {
                id: 'query-1',
                text: 'test query',
                category: 'health',
                created_at: new Date(),
                updated_at: new Date()
            };

            mockQueryRepo.findById.mockResolvedValue(mockQuery);

            const querySet = await queryService.createQuerySet(
                'Test Set',
                'Test description',
                ['query-1'],
                {
                    frequency: 'daily',
                    time: '09:00',
                    enabled: true
                }
            );

            expect(querySet.name).toBe('Test Set');
            expect(querySet.queries).toHaveLength(1);
            expect(querySet.queries[0]).toEqual({
                id: mockQuery.id,
                text: mockQuery.text,
                category: mockQuery.category,
                createdAt: mockQuery.created_at,
                isActive: true,
                metadata: undefined
            });
            expect(querySet.schedule.frequency).toBe('daily');
        });

        it('should throw error for invalid query IDs', async () => {
            mockQueryRepo.findById.mockResolvedValue(null);

            await expect(
                queryService.createQuerySet(
                    'Test Set',
                    'Test description',
                    ['invalid-id'],
                    { frequency: 'daily', enabled: true }
                )
            ).rejects.toThrow('Query not found: invalid-id');
        });

        it('should validate query sets correctly', () => {
            const validQuerySet = {
                id: 'set-1',
                name: 'Valid Set',
                description: 'Valid description',
                queries: [{ id: 'q1' } as Query],
                schedule: { frequency: 'daily' as const, enabled: true },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            expect(queryService.validateQuerySet(validQuerySet)).toBe(true);

            // Test invalid cases
            expect(() => queryService.validateQuerySet({
                ...validQuerySet,
                name: ''
            })).toThrow('Query set name is required');

            expect(() => queryService.validateQuerySet({
                ...validQuerySet,
                queries: []
            })).toThrow('Query set must contain at least one query');

            expect(() => queryService.validateQuerySet({
                ...validQuerySet,
                schedule: { ...validQuerySet.schedule, frequency: undefined as any }
            })).toThrow('Schedule frequency is required');
        });
    });

    describe('Scheduling', () => {
        it('should calculate next execution time for daily schedule', () => {
            const schedule = {
                frequency: 'daily' as const,
                time: '14:30',
                enabled: true
            };

            const nextExecution = queryService.getNextExecutionTime(schedule);

            expect(nextExecution.getHours()).toBe(14);
            expect(nextExecution.getMinutes()).toBe(30);
            expect(nextExecution.getSeconds()).toBe(0);
        });

        it('should calculate next execution time for weekly schedule', () => {
            const schedule = {
                frequency: 'weekly' as const,
                dayOfWeek: 1, // Monday
                time: '09:00',
                enabled: true
            };

            const nextExecution = queryService.getNextExecutionTime(schedule);

            expect(nextExecution.getDay()).toBe(1); // Monday
            expect(nextExecution.getHours()).toBe(9);
            expect(nextExecution.getMinutes()).toBe(0);
        });

        it('should throw error for disabled schedule', () => {
            const schedule = {
                frequency: 'daily' as const,
                enabled: false
            };

            expect(() => queryService.getNextExecutionTime(schedule))
                .toThrow('Schedule is disabled');
        });
    });

    describe('Statistics', () => {
        it('should get query statistics by category', async () => {
            mockQueryRepo.count
                .mockResolvedValueOnce(15) // health
                .mockResolvedValueOnce(20) // politics
                .mockResolvedValueOnce(18) // technology
                .mockResolvedValueOnce(12) // science
                .mockResolvedValueOnce(5);  // general

            const stats = await queryService.getQueryStatistics();

            expect(stats).toEqual({
                health: 15,
                politics: 20,
                technology: 18,
                science: 12,
                general: 5
            });

            expect(mockQueryRepo.count).toHaveBeenCalledTimes(5);
        });
    });
});

describe('QueryManagementService', () => {
    let queryManagementService: QueryManagementService;

    beforeEach(() => {
        vi.clearAllMocks();
        queryManagementService = new QueryManagementService(mockDb);
    });

    describe('Rotation Strategies', () => {
        it('should have available rotation strategies', () => {
            const strategies = queryManagementService.getAvailableRotationStrategies();

            expect(strategies).toHaveLength(3);
            expect(strategies.map(s => s.name)).toContain('round-robin');
            expect(strategies.map(s => s.name)).toContain('random');
            expect(strategies.map(s => s.name)).toContain('category-balanced');
        });

        it('should throw error for unknown rotation strategy', async () => {
            await expect(
                queryManagementService.getQueriesForExecution('test-set', 10, 'unknown-strategy')
            ).rejects.toThrow('Unknown rotation strategy: unknown-strategy');
        });
    });

    describe('Execution Tracking', () => {
        it('should schedule and track query execution', async () => {
            const scheduledAt = new Date();
            const executionId = await queryManagementService.scheduleQueryExecution(
                'test-set',
                scheduledAt,
                10
            );

            expect(executionId).toBeTruthy();

            const status = queryManagementService.getExecutionStatus(executionId);
            expect(status).toBeTruthy();
            expect(status?.status).toBe('scheduled');
            expect(status?.querySetId).toBe('test-set');
            expect(status?.queryCount).toBe(10);
        });

        it('should track execution lifecycle', async () => {
            const executionId = await queryManagementService.scheduleQueryExecution(
                'test-set',
                new Date(),
                5
            );

            // Start execution
            await queryManagementService.startQueryExecution(executionId);
            let status = queryManagementService.getExecutionStatus(executionId);
            expect(status?.status).toBe('running');
            expect(status?.startedAt).toBeTruthy();

            // Complete execution
            await queryManagementService.completeQueryExecution(
                executionId,
                4,
                1,
                ['One query failed']
            );

            status = queryManagementService.getExecutionStatus(executionId);
            expect(status?.status).toBe('failed'); // Because failureCount > 0
            expect(status?.completedAt).toBeTruthy();
            expect(status?.successCount).toBe(4);
            expect(status?.failureCount).toBe(1);
            expect(status?.errors).toEqual(['One query failed']);
        });

        it('should get execution history for query set', async () => {
            const executionId1 = await queryManagementService.scheduleQueryExecution(
                'test-set',
                new Date(),
                5
            );
            const executionId2 = await queryManagementService.scheduleQueryExecution(
                'test-set',
                new Date(),
                3
            );

            const history = queryManagementService.getExecutionHistory('test-set');

            expect(history).toHaveLength(2);
            expect(history.map(h => h.id)).toContain(executionId1);
            expect(history.map(h => h.id)).toContain(executionId2);
        });

        it('should clean up old execution history', () => {
            // This test would need to manipulate dates to test cleanup
            // For now, just verify the method exists and doesn't throw
            expect(() => {
                queryManagementService.cleanupExecutionHistory(30);
            }).not.toThrow();
        });
    });

    describe('Query History Management', () => {
        it('should reset rotation history', () => {
            expect(() => {
                queryManagementService.resetRotationHistory('test-set');
            }).not.toThrow();
        });

        it('should get rotation statistics', () => {
            const stats = queryManagementService.getRotationStatistics('test-set');

            expect(stats).toHaveProperty('totalQueries');
            expect(stats).toHaveProperty('recentlyUsed');
            expect(stats).toHaveProperty('availableForRotation');
            expect(stats).toHaveProperty('historyLength');
        });
    });
});