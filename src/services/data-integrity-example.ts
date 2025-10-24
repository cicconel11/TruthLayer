/**
 * Example usage of the Data Integrity Service
 * 
 * This file demonstrates how to use the DataIntegrityService
 * for various data validation and monitoring tasks.
 */

import { DatabaseConnection } from '../database/connection';
import { DataIntegrityService } from './data-integrity-service';
import { MonitoringService } from './monitoring-service';
import { getConfig } from '../utils/config-loader';
import { logger } from '../utils/logger';

/**
 * Example: Daily data integrity check
 */
export async function runDailyIntegrityCheck(): Promise<void> {
    const config = getConfig();
    const db = new DatabaseConnection(config.database);

    try {
        await db.connect();
        const integrityService = new DataIntegrityService(db);

        logger.info('Starting daily data integrity check');

        // 1. Run comprehensive validation
        const validation = await integrityService.validateDataIntegrity({
            checkHashes: true,
            checkSchema: true,
            checkDuplicates: true,
            batchSize: 1000
        });

        logger.info('Data integrity validation completed', {
            isValid: validation.isValid,
            errorCount: validation.errors.length,
            warningCount: validation.warnings.length,
            statistics: validation.statistics
        });

        // 2. Check collection completeness for recent queries
        const recentQueries = await db.query(`
            SELECT DISTINCT q.id, q.text
            FROM queries q
            JOIN search_results sr ON q.id = sr.query_id
            WHERE sr.collected_at >= NOW() - INTERVAL '24 hours'
            LIMIT 10
        `);

        for (const query of recentQueries.rows) {
            const completeness = await integrityService.checkCollectionCompleteness(
                query.id,
                ['google', 'bing', 'perplexity', 'brave'],
                20
            );

            if (!completeness.isComplete) {
                logger.warn('Incomplete collection detected', {
                    queryId: query.id,
                    queryText: query.text,
                    coveragePercentage: completeness.coveragePercentage,
                    issues: completeness.issues
                });
            }
        }

        // 3. Check annotation coverage
        const coverage = await integrityService.checkAnnotationCoverage({
            collectedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        });

        logger.info('Annotation coverage check completed', {
            coveragePercentage: coverage.coveragePercentage,
            totalResults: coverage.totalResults,
            annotatedResults: coverage.annotatedResults,
            issues: coverage.issues
        });

        // 4. Auto-generate missing hashes if needed
        if (validation.statistics.missingHashes > 0) {
            logger.info('Generating missing content hashes', {
                missingCount: validation.statistics.missingHashes
            });

            const hashGeneration = await integrityService.generateMissingContentHashes(100);

            logger.info('Hash generation completed', {
                processed: hashGeneration.processed,
                updated: hashGeneration.updated,
                errors: hashGeneration.errors.length
            });
        }

        // 5. Report duplicates if significant
        const duplicates = await integrityService.findDuplicateResults();

        if (duplicates.totalDuplicates > 100) {
            logger.warn('High number of duplicate results detected', {
                duplicateGroups: duplicates.duplicateGroups.length,
                totalDuplicates: duplicates.totalDuplicates
            });
        }

        logger.info('Daily data integrity check completed successfully');

    } catch (error) {
        logger.error('Daily data integrity check failed', { error });
        throw error;
    } finally {
        await db.close();
    }
}

/**
 * Example: Integration with monitoring service
 */
export async function setupIntegrityMonitoring(): Promise<MonitoringService> {
    const config = getConfig();
    const db = new DatabaseConnection(config.database);
    await db.connect();

    const monitoringService = new MonitoringService(db, {
        alertRetentionHours: 168, // 7 days
        metricsRetentionHours: 72, // 3 days
        healthCheckInterval: 60000, // 1 minute
        integrityCheckInterval: 3600000 // 1 hour
    });

    // Set up periodic integrity checks
    setInterval(async () => {
        try {
            await monitoringService.performDataIntegrityChecks();
            await monitoringService.checkRecentCollectionCompleteness(24);
            await monitoringService.checkAnnotationCoverage(24);
        } catch (error) {
            logger.error('Periodic integrity check failed', { error });
        }
    }, 3600000); // Every hour

    // Set up daily hash generation
    setInterval(async () => {
        try {
            await monitoringService.autoGenerateMissingHashes();
        } catch (error) {
            logger.error('Auto hash generation failed', { error });
        }
    }, 86400000); // Every 24 hours

    monitoringService.start();

    logger.info('Data integrity monitoring setup completed');
    return monitoringService;
}

/**
 * Example: Query-specific integrity check
 */
export async function checkQueryIntegrity(queryId: string): Promise<{
    completeness: any;
    coverage: any;
    issues: string[];
}> {
    const config = getConfig();
    const db = new DatabaseConnection(config.database);

    try {
        await db.connect();
        const integrityService = new DataIntegrityService(db);

        // Check collection completeness
        const completeness = await integrityService.checkCollectionCompleteness(
            queryId,
            ['google', 'bing', 'perplexity', 'brave'],
            20
        );

        // Check annotation coverage
        const coverage = await integrityService.checkAnnotationCoverage({
            queryId
        });

        // Compile issues
        const issues: string[] = [];
        issues.push(...completeness.issues);
        issues.push(...coverage.issues);

        return {
            completeness,
            coverage,
            issues
        };

    } finally {
        await db.close();
    }
}

/**
 * Example: Batch validation for data migration
 */
export async function validateMigratedData(batchSize: number = 500): Promise<{
    totalRecords: number;
    validRecords: number;
    errors: string[];
    warnings: string[];
}> {
    const config = getConfig();
    const db = new DatabaseConnection(config.database);

    try {
        await db.connect();
        const integrityService = new DataIntegrityService(db);

        logger.info('Starting batch validation for migrated data');

        // Run validation with smaller batch size for large datasets
        const validation = await integrityService.validateDataIntegrity({
            checkHashes: true,
            checkSchema: true,
            checkDuplicates: true,
            batchSize
        });

        // Generate missing hashes for migrated data
        if (validation.statistics.missingHashes > 0) {
            logger.info('Generating missing hashes for migrated data');
            await integrityService.generateMissingContentHashes(batchSize);
        }

        return {
            totalRecords: validation.statistics.totalRecords,
            validRecords: validation.statistics.validRecords,
            errors: validation.errors,
            warnings: validation.warnings
        };

    } finally {
        await db.close();
    }
}

/**
 * Example: Real-time integrity monitoring
 */
export class RealTimeIntegrityMonitor {
    private integrityService: DataIntegrityService;
    private monitoringInterval?: NodeJS.Timeout;

    constructor(private db: DatabaseConnection) { // TODO: Use db for monitoring operations
        this.integrityService = new DataIntegrityService(db);
    }

    start(intervalMinutes: number = 15): void {
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.performQuickCheck();
            } catch (error) {
                logger.error('Real-time integrity check failed', { error });
            }
        }, intervalMinutes * 60 * 1000);

        logger.info('Real-time integrity monitoring started', { intervalMinutes });
    }

    stop(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }

        logger.info('Real-time integrity monitoring stopped');
    }

    private async performQuickCheck(): Promise<void> {
        // Quick validation of recent data only
        const recentCoverage = await this.integrityService.checkAnnotationCoverage({
            collectedAfter: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        });

        if (recentCoverage.coveragePercentage < 80) {
            logger.warn('Low annotation coverage detected in recent data', {
                coveragePercentage: recentCoverage.coveragePercentage,
                totalResults: recentCoverage.totalResults
            });
        }

        // Check for recent duplicates
        const duplicates = await this.integrityService.findDuplicateResults();

        if (duplicates.duplicateGroups.length > 0) {
            logger.info('Duplicate results detected', {
                duplicateGroups: duplicates.duplicateGroups.length,
                totalDuplicates: duplicates.totalDuplicates
            });
        }
    }
}

// Example usage:
if (require.main === module) {
    // Run daily check
    runDailyIntegrityCheck()
        .then(() => {
            console.log('Daily integrity check completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Daily integrity check failed:', error);
            process.exit(1);
        });
}