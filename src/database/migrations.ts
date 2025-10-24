import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { DatabaseConnection } from './connection';
import { logger, errorToLogContext } from '../utils/logger';

export interface Migration {
    id: string;
    name: string;
    sql: string;
    appliedAt?: Date;
}

export interface MigrationRecord {
    id: string;
    name: string;
    applied_at: Date;
}

export class MigrationManager {
    private db: DatabaseConnection;
    private migrationsPath: string;

    constructor(db: DatabaseConnection, migrationsPath?: string) {
        this.db = db;
        this.migrationsPath = migrationsPath || join(__dirname, 'migrations');
    }

    async initialize(): Promise<void> {
        // Create migrations table if it doesn't exist
        const createMigrationsTable = `
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `;

        await this.db.query(createMigrationsTable);
        logger.info('Migrations table initialized');
    }

    async getAppliedMigrations(): Promise<MigrationRecord[]> {
        const result = await this.db.query(
            'SELECT id, name, applied_at FROM migrations ORDER BY applied_at ASC'
        );
        return result.rows;
    }

    async getPendingMigrations(): Promise<Migration[]> {
        const appliedMigrations = await this.getAppliedMigrations();
        const appliedIds = new Set(appliedMigrations.map(m => m.id));

        const allMigrations = this.loadMigrationFiles();
        return allMigrations.filter(migration => !appliedIds.has(migration.id));
    }

    private loadMigrationFiles(): Migration[] {
        try {
            const files = readdirSync(this.migrationsPath)
                .filter(file => file.endsWith('.sql'))
                .sort();

            return files.map(file => {
                const filePath = join(this.migrationsPath, file);
                const sql = readFileSync(filePath, 'utf-8');
                const id = file.replace('.sql', '');
                const name = id.replace(/^\d+_/, '').replace(/_/g, ' ');

                return {
                    id,
                    name,
                    sql
                };
            });
        } catch (error) {
            logger.error('Failed to load migration files:', errorToLogContext(error));
            return [];
        }
    }

    async applyMigration(migration: Migration): Promise<void> {
        await this.db.transaction(async (client) => {
            logger.info(`Applying migration: ${migration.id} - ${migration.name}`);

            // Execute the migration SQL
            await client.query(migration.sql);

            // Record the migration as applied
            await client.query(
                'INSERT INTO migrations (id, name) VALUES ($1, $2)',
                [migration.id, migration.name]
            );

            logger.info(`Migration applied successfully: ${migration.id}`);
        });
    }

    async applyPendingMigrations(): Promise<void> {
        await this.initialize();

        const pendingMigrations = await this.getPendingMigrations();

        if (pendingMigrations.length === 0) {
            logger.info('No pending migrations to apply');
            return;
        }

        logger.info(`Found ${pendingMigrations.length} pending migrations`);

        for (const migration of pendingMigrations) {
            await this.applyMigration(migration);
        }

        logger.info('All pending migrations applied successfully');
    }

    async rollbackMigration(migrationId: string): Promise<void> {
        // Note: This is a basic rollback that just removes the migration record
        // For production use, you'd want to implement proper rollback SQL
        await this.db.transaction(async (client) => {
            await client.query('DELETE FROM migrations WHERE id = $1', [migrationId]);
            logger.info(`Migration rollback recorded: ${migrationId}`);
        });
    }

    async getMigrationStatus(): Promise<{
        applied: MigrationRecord[];
        pending: Migration[];
    }> {
        const applied = await this.getAppliedMigrations();
        const pending = await this.getPendingMigrations();

        return { applied, pending };
    }
}