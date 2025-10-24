#!/usr/bin/env node

import { Command } from 'commander';
import { DatabaseConnection } from '../database/connection';
import { DataIntegrityService } from '../services/data-integrity-service';
import { logger } from './logger';
import { getConfig } from './config-loader';

const program = new Command();

program
    .name('data-integrity')
    .description('TruthLayer Data Integrity Validation CLI')
    .version('1.0.0');

program
    .command('validate')
    .description('Run comprehensive data integrity validation')
    .option('--no-hashes', 'Skip content hash validation')
    .option('--no-schema', 'Skip schema validation')
    .option('--no-duplicates', 'Skip duplicate detection')
    .option('--batch-size <size>', 'Batch size for processing', '1000')
    .option('--format <format>', 'Output format (json|table)', 'table')
    .action(async (options) => {
        const config = getConfig();
        const db = new DatabaseConnection(config.database);
        try {
            await db.connect();
            const service = new DataIntegrityService(db);

            console.log('🔍 Running comprehensive data integrity validation...\n');

            const result = await service.validateDataIntegrity({
                checkHashes: options.hashes !== false,
                checkSchema: options.schema !== false,
                checkDuplicates: options.duplicates !== false,
                batchSize: parseInt(options.batchSize)
            });

            if (options.format === 'json') {
                console.log(JSON.stringify(result, null, 2));
            } else {
                printValidationResult(result);
            }

            process.exit(result.isValid ? 0 : 1);
        } catch (error) {
            logger.error('Validation failed', { error });
            console.error('❌ Validation failed:', error);
            process.exit(1);
        } finally {
            await db.close();
        }
    });

program
    .command('completeness')
    .description('Check collection completeness for a query')
    .requiredOption('--query-id <id>', 'Query ID to check')
    .option('--engines <engines>', 'Expected engines (comma-separated)', 'google,bing,perplexity,brave')
    .option('--results-per-engine <count>', 'Expected results per engine', '20')
    .option('--format <format>', 'Output format (json|table)', 'table')
    .action(async (options) => {
        const config = getConfig(); const db = new DatabaseConnection(config.database);
        try {
            await db.connect();
            const service = new DataIntegrityService(db);

            const engines = options.engines.split(',').map((e: string) => e.trim());
            const resultsPerEngine = parseInt(options.resultsPerEngine);

            console.log(`🔍 Checking collection completeness for query ${options.queryId}...\n`);

            const result = await service.checkCollectionCompleteness(
                options.queryId,
                engines,
                resultsPerEngine
            );

            if (options.format === 'json') {
                console.log(JSON.stringify(result, null, 2));
            } else {
                printCompletenessResult(result);
            }

            process.exit(result.isComplete ? 0 : 1);
        } catch (error) {
            logger.error('Completeness check failed', { error });
            console.error('❌ Completeness check failed:', error);
            process.exit(1);
        } finally {
            await db.close();
        }
    });

program
    .command('coverage')
    .description('Check annotation coverage for search results')
    .option('--query-id <id>', 'Filter by query ID')
    .option('--engine <engine>', 'Filter by engine')
    .option('--after <date>', 'Filter results collected after date (YYYY-MM-DD)')
    .option('--before <date>', 'Filter results collected before date (YYYY-MM-DD)')
    .option('--format <format>', 'Output format (json|table)', 'table')
    .action(async (options) => {
        const config = getConfig(); const db = new DatabaseConnection(config.database);
        try {
            await db.connect();
            const service = new DataIntegrityService(db);

            const filters: any = {};
            if (options.queryId) filters.queryId = options.queryId;
            if (options.engine) filters.engine = options.engine;
            if (options.after) filters.collectedAfter = new Date(options.after);
            if (options.before) filters.collectedBefore = new Date(options.before);

            console.log('🔍 Checking annotation coverage...\n');

            const result = await service.checkAnnotationCoverage(filters);

            if (options.format === 'json') {
                console.log(JSON.stringify(result, null, 2));
            } else {
                printCoverageResult(result);
            }

            process.exit(result.issues.length === 0 ? 0 : 1);
        } catch (error) {
            logger.error('Coverage check failed', { error });
            console.error('❌ Coverage check failed:', error);
            process.exit(1);
        } finally {
            await db.close();
        }
    });

program
    .command('generate-hashes')
    .description('Generate missing content hashes for search results')
    .option('--batch-size <size>', 'Batch size for processing', '100')
    .option('--dry-run', 'Show what would be updated without making changes')
    .action(async (options) => {
        const config = getConfig(); const db = new DatabaseConnection(config.database);
        try {
            await db.connect();
            const service = new DataIntegrityService(db);

            if (options.dryRun) {
                console.log('🔍 Dry run: Checking for missing content hashes...\n');

                // Count results without hashes
                const countResult = await db.query(
                    'SELECT COUNT(*) as count FROM search_results WHERE content_hash IS NULL'
                );
                const missingCount = parseInt(countResult.rows[0].count);

                console.log(`📊 Found ${missingCount} search results without content hashes`);
                console.log('   Run without --dry-run to generate hashes');
            } else {
                console.log('🔧 Generating missing content hashes...\n');

                const result = await service.generateMissingContentHashes(
                    parseInt(options.batchSize)
                );

                console.log(`📊 Processing Results:`);
                console.log(`   Processed: ${result.processed} records`);
                console.log(`   Updated: ${result.updated} records`);
                console.log(`   Errors: ${result.errors.length}`);

                if (result.errors.length > 0) {
                    console.log('\n❌ Errors:');
                    result.errors.forEach(error => console.log(`   ${error}`));
                }
            }

            process.exit(0);
        } catch (error) {
            logger.error('Hash generation failed', { error });
            console.error('❌ Hash generation failed:', error);
            process.exit(1);
        } finally {
            await db.close();
        }
    });

program
    .command('duplicates')
    .description('Find and report duplicate search results')
    .option('--format <format>', 'Output format (json|table)', 'table')
    .action(async (options) => {
        const config = getConfig(); const db = new DatabaseConnection(config.database);
        try {
            await db.connect();
            const service = new DataIntegrityService(db);

            console.log('🔍 Finding duplicate search results...\n');

            const result = await service.findDuplicateResults();

            if (options.format === 'json') {
                console.log(JSON.stringify(result, null, 2));
            } else {
                printDuplicatesResult(result);
            }

            process.exit(0);
        } catch (error) {
            logger.error('Duplicate detection failed', { error });
            console.error('❌ Duplicate detection failed:', error);
            process.exit(1);
        } finally {
            await db.close();
        }
    });

function printValidationResult(result: any) {
    console.log('📊 Data Integrity Validation Results');
    console.log('=====================================\n');

    if (result.isValid) {
        console.log('✅ Overall Status: VALID');
    } else {
        console.log('❌ Overall Status: INVALID');
    }

    console.log('\n📈 Statistics:');
    console.log(`   Total Records: ${result.statistics.totalRecords}`);
    console.log(`   Valid Records: ${result.statistics.validRecords}`);
    console.log(`   Duplicate Records: ${result.statistics.duplicateRecords}`);
    console.log(`   Missing Hashes: ${result.statistics.missingHashes}`);
    console.log(`   Schema Violations: ${result.statistics.schemaViolations}`);

    if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach((error: string) => console.log(`   ${error}`));
    }

    if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach((warning: string) => console.log(`   ${warning}`));
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log('\n🎉 No issues found!');
    }
}

function printCompletenessResult(result: any) {
    console.log('📊 Collection Completeness Results');
    console.log('==================================\n');

    if (result.isComplete) {
        console.log('✅ Collection Status: COMPLETE');
    } else {
        console.log('❌ Collection Status: INCOMPLETE');
    }

    console.log(`\n📈 Coverage: ${result.coveragePercentage.toFixed(1)}%`);

    console.log('\n🎯 Expected vs Actual:');
    console.log(`   Expected Engines: ${result.expectedEngines.join(', ')}`);
    console.log(`   Actual Engines: ${result.actualEngines.join(', ')}`);
    console.log(`   Expected Results per Engine: ${result.expectedResultsPerEngine}`);

    console.log('\n📊 Results by Engine:');
    for (const [engine, count] of Object.entries(result.actualResultsPerEngine)) {
        console.log(`   ${engine}: ${count}`);
    }

    if (result.missingEngines.length > 0) {
        console.log(`\n❌ Missing Engines: ${result.missingEngines.join(', ')}`);
    }

    if (result.issues.length > 0) {
        console.log('\n⚠️  Issues:');
        result.issues.forEach((issue: string) => console.log(`   ${issue}`));
    }
}

function printCoverageResult(result: any) {
    console.log('📊 Annotation Coverage Results');
    console.log('==============================\n');

    console.log(`📈 Coverage: ${result.coveragePercentage.toFixed(1)}%`);
    console.log(`   Total Results: ${result.totalResults}`);
    console.log(`   Annotated Results: ${result.annotatedResults}`);

    if (result.missingAnnotations.length > 0) {
        console.log(`\n❌ Missing Annotations: ${result.missingAnnotations.length}`);
        if (result.missingAnnotations.length <= 10) {
            result.missingAnnotations.forEach((id: string) => console.log(`   ${id}`));
        } else {
            console.log(`   (showing first 10 of ${result.missingAnnotations.length})`);
            result.missingAnnotations.slice(0, 10).forEach((id: string) => console.log(`   ${id}`));
        }
    }

    if (result.incompleteAnnotations.length > 0) {
        console.log(`\n⚠️  Incomplete Annotations: ${result.incompleteAnnotations.length}`);
        if (result.incompleteAnnotations.length <= 10) {
            result.incompleteAnnotations.forEach((id: string) => console.log(`   ${id}`));
        } else {
            console.log(`   (showing first 10 of ${result.incompleteAnnotations.length})`);
            result.incompleteAnnotations.slice(0, 10).forEach((id: string) => console.log(`   ${id}`));
        }
    }

    if (result.issues.length > 0) {
        console.log('\n📋 Summary:');
        result.issues.forEach((issue: string) => console.log(`   ${issue}`));
    } else {
        console.log('\n🎉 All results are properly annotated!');
    }
}

function printDuplicatesResult(result: any) {
    console.log('📊 Duplicate Search Results');
    console.log('===========================\n');

    console.log(`📈 Summary:`);
    console.log(`   Duplicate Groups: ${result.duplicateGroups.length}`);
    console.log(`   Total Duplicates: ${result.totalDuplicates}`);

    if (result.duplicateGroups.length > 0) {
        console.log('\n🔍 Duplicate Groups:');
        result.duplicateGroups.forEach((group: any, index: number) => {
            console.log(`\n   Group ${index + 1}:`);
            console.log(`     Content Hash: ${group.contentHash}`);
            console.log(`     Count: ${group.count}`);
            console.log(`     Result IDs: ${group.resultIds.join(', ')}`);
        });
    } else {
        console.log('\n🎉 No duplicate results found!');
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error });
    process.exit(1);
});

program.parse();