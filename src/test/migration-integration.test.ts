import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationManager } from '../database/migrations';
import { DatabaseConnection } from '../database/connection';

describe('Migration Integration Tests', () => {
    let migrationManager: MigrationManager;
    let mockDb: DatabaseConnection;

    beforeEach(() => {
        mockDb = {
            query: vi.fn(),
            transaction: vi.fn(),
            connect: vi.fn(),
            close: vi.fn(),
            healthCheck: vi.fn(),
            getClient: vi.fn()
        } as unknown as DatabaseConnection;

        migrationManager = new MigrationManager(mockDb);
    });

    it('should handle complete migration workflow', async () => {
        // Mock successful migration table creation
        (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

        // Mock no applied migrations initially
        (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

        // Mock successful transaction for migration application
        (mockDb.transaction as any).mockImplementation(async (callback: any) => {
            const mockClient = {
                query: vi.fn()
                    .mockResolvedValueOnce({ rows: [] }) // Migration SQL execution
                    .mockResolvedValueOnce({ rows: [] }) // Insert migration record
            };
            return callback(mockClient);
        });

        await migrationManager.initialize();

        const migration = {
            id: '001_initial_schema',
            name: 'initial schema',
            sql: 'CREATE TABLE test (id UUID);'
        };

        await migrationManager.applyMigration(migration);

        expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations')
        );
        expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should handle migration rollback correctly', async () => {
        (mockDb.transaction as any).mockImplementation(async (callback: any) => {
            const mockClient = {
                query: vi.fn().mockResolvedValue({ rows: [] })
            };
            return callback(mockClient);
        });

        await migrationManager.rollbackMigration('001_initial_schema');

        expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should detect pending migrations correctly', async () => {
        // Mock applied migrations
        const appliedMigrations = [
            { id: '001_initial_schema', name: 'initial schema', applied_at: new Date() }
        ];
        (mockDb.query as any).mockResolvedValue({ rows: appliedMigrations });

        // Override the private method to simulate file system
        const mockPendingMigrations = [
            { id: '002_add_indexes', name: 'add indexes', sql: 'CREATE INDEX test_idx ON test(id);' }
        ];
        migrationManager.getPendingMigrations = vi.fn().mockResolvedValue(mockPendingMigrations);

        const status = await migrationManager.getMigrationStatus();

        expect(status.applied).toEqual(appliedMigrations);
        expect(status.pending).toEqual(mockPendingMigrations);
    });

    it('should handle migration errors gracefully', async () => {
        const migrationError = new Error('Syntax error in migration SQL');
        (mockDb.transaction as any).mockRejectedValue(migrationError);

        const migration = {
            id: '001_bad_migration',
            name: 'bad migration',
            sql: 'INVALID SQL SYNTAX;'
        };

        await expect(migrationManager.applyMigration(migration)).rejects.toThrow('Syntax error in migration SQL');
    });

    it('should handle empty migration directory', async () => {
        // Mock empty applied migrations
        (mockDb.query as any).mockResolvedValue({ rows: [] });

        // Override to simulate empty directory
        migrationManager.getPendingMigrations = vi.fn().mockResolvedValue([]);

        const status = await migrationManager.getMigrationStatus();

        expect(status.applied).toEqual([]);
        expect(status.pending).toEqual([]);
    });
});