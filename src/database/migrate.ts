#!/usr/bin/env tsx

import { DatabaseConnection } from './connection';
import { MigrationManager } from './migrations';
import { loadConfig } from '../utils/config-loader';
import { logger, errorToLogContext } from '../utils/logger';

async function runMigrations() {
    try {
        const config = loadConfig();

        const dbConnection = new DatabaseConnection({
            host: config.database.host,
            port: config.database.port,
            database: config.database.database,
            username: config.database.username,
            password: config.database.password,
            ssl: config.database.ssl,
        });

        await dbConnection.connect();
        logger.info('Connected to database for migrations');

        const migrationManager = new MigrationManager(dbConnection);

        // Check migration status
        const status = await migrationManager.getMigrationStatus();
        logger.info(`Applied migrations: ${status.applied.length}`);
        logger.info(`Pending migrations: ${status.pending.length}`);

        if (status.pending.length > 0) {
            logger.info('Applying pending migrations...');
            await migrationManager.applyPendingMigrations();
            logger.info('All migrations completed successfully');
        } else {
            logger.info('Database is up to date');
        }

        await dbConnection.close();
    } catch (error) {
        logger.error('Migration failed:', errorToLogContext(error));
        process.exit(1);
    }
}

// Run migrations if this script is executed directly
if (require.main === module) {
    runMigrations();
}

export { runMigrations };