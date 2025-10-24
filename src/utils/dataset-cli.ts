#!/usr/bin/env node

import { Command } from 'commander';
import { DatasetExportService, ExportOptions } from '../services/dataset-export-service';

// Simple console logger for CLI
const logger = {
    info: (message: string, meta?: any) => {
        console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
    error: (message: string, meta?: any) => {
        console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }
};

const program = new Command();
let exportService: DatasetExportService;

program
    .name('dataset-cli')
    .description('TruthLayer Dataset Export CLI')
    .version('1.0.0')
    .option('-d, --dir <directory>', 'Output directory for datasets', './exports');

program
    .command('export')
    .description('Export dataset in specified format')
    .option('-f, --format <format>', 'Export format (parquet, csv, json)', 'parquet')
    .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
    .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
    .option('--engines <engines>', 'Comma-separated list of engines', 'google,bing,perplexity,brave')
    .option('--categories <categories>', 'Comma-separated list of categories')
    .option('--no-annotations', 'Exclude annotations from export')
    .option('--include-raw', 'Include raw HTML data')
    .option('-o, --output <dir>', 'Output directory', './exports')
    .option('-v, --version <version>', 'Custom version string')
    .action(async (options) => {
        try {
            logger.info('Starting dataset export...', { options });

            const exportOptions: ExportOptions = {
                format: options.format as 'parquet' | 'csv' | 'json',
                engines: options.engines.split(',').map((e: string) => e.trim()),
                includeAnnotations: options.annotations !== false,
                includeRawData: options.includeRaw || false,
                outputDir: options.output
            };

            if (options.start) {
                exportOptions.dateRange = {
                    start: new Date(options.start),
                    end: options.end ? new Date(options.end) : new Date()
                };
            }

            if (options.categories) {
                exportOptions.categories = options.categories.split(',').map((c: string) => c.trim());
            }

            if (options.version) {
                exportOptions.version = options.version;
            }

            const result = await exportService.exportDataset(exportOptions);

            logger.info('Dataset export completed successfully', {
                version: result.version,
                recordCount: result.recordCount,
                filePath: result.filePath,
                dataHash: result.dataHash
            });

            console.log('\n✅ Export completed successfully!');
            console.log(`📁 File: ${result.filePath}`);
            console.log(`📊 Records: ${result.recordCount.toLocaleString()}`);
            console.log(`🔢 Version: ${result.version}`);
            console.log(`🔐 Hash: ${result.dataHash}`);

        } catch (error) {
            logger.error('Dataset export failed', { error: error.message });
            console.error('❌ Export failed:', error.message);
            process.exit(1);
        }
    });

program
    .command('list')
    .description('List all dataset versions')
    .action(async (options, command) => {
        try {
            const globalOptions = command.parent?.opts() || {};
            exportService = new DatasetExportService(globalOptions.dir || './exports');
            const versions = await exportService.listVersions();

            if (versions.length === 0) {
                console.log('No dataset versions found.');
                return;
            }

            console.log('\n📋 Dataset Versions:\n');

            versions.forEach((version, index) => {
                console.log(`${index + 1}. Version ${version.version}`);
                console.log(`   📅 Created: ${new Date(version.createdAt).toISOString()}`);
                console.log(`   📊 Records: ${version.recordCount.toLocaleString()}`);
                console.log(`   📁 File: ${version.filePath}`);
                console.log(`   🔐 Hash: ${version.dataHash}`);
                console.log(`   📝 Description: ${version.description}`);
                console.log('');
            });

        } catch (error) {
            logger.error('Failed to list versions', { error: error.message });
            console.error('❌ Failed to list versions:', error.message);
            process.exit(1);
        }
    });

program
    .command('info')
    .description('Show detailed information about a specific version')
    .argument('<version>', 'Version to show info for')
    .action(async (version, options, command) => {
        try {
            const globalOptions = command.parent?.opts() || {};
            exportService = new DatasetExportService(globalOptions.dir || './exports');
            const versionInfo = await exportService.getVersion(version);

            if (!versionInfo) {
                console.log(`❌ Version ${version} not found.`);
                return;
            }

            console.log(`\n📋 Dataset Version ${versionInfo.version}\n`);
            console.log(`📅 Created: ${new Date(versionInfo.createdAt).toISOString()}`);
            console.log(`📊 Records: ${versionInfo.recordCount.toLocaleString()}`);
            console.log(`📁 File: ${versionInfo.filePath}`);
            console.log(`🔐 Hash: ${versionInfo.dataHash}`);
            console.log(`📝 Description: ${versionInfo.description}\n`);

            console.log('📈 Statistics:');
            console.log(`  • Total Queries: ${versionInfo.metadata.statistics.totalQueries.toLocaleString()}`);
            console.log(`  • Total Results: ${versionInfo.metadata.statistics.totalResults.toLocaleString()}`);
            console.log(`  • Total Annotations: ${versionInfo.metadata.statistics.totalAnnotations.toLocaleString()}`);
            console.log(`  • Date Range: ${versionInfo.metadata.statistics.dateRange.start} to ${versionInfo.metadata.statistics.dateRange.end}\n`);

            console.log('🔍 Engine Distribution:');
            Object.entries(versionInfo.metadata.statistics.engineDistribution).forEach(([engine, count]) => {
                console.log(`  • ${engine}: ${count.toLocaleString()} results`);
            });

            console.log('\n📂 Category Distribution:');
            Object.entries(versionInfo.metadata.statistics.categoryDistribution).forEach(([category, count]) => {
                console.log(`  • ${category}: ${count.toLocaleString()} queries`);
            });

            console.log('\n🏷️ Metadata:');
            console.log(`  • License: ${versionInfo.metadata.usage.license}`);
            console.log(`  • Contact: ${versionInfo.metadata.usage.contact}`);
            console.log(`  • Source System: ${versionInfo.metadata.provenance.sourceSystem}`);

        } catch (error) {
            logger.error('Failed to get version info', { error: error.message });
            console.error('❌ Failed to get version info:', error.message);
            process.exit(1);
        }
    });

program
    .command('delete')
    .description('Delete a dataset version')
    .argument('<version>', 'Version to delete')
    .option('-f, --force', 'Force deletion without confirmation')
    .action(async (version, options, command) => {
        try {
            const globalOptions = command.parent?.opts() || {};
            exportService = new DatasetExportService(globalOptions.dir || './exports');
            const versionInfo = await exportService.getVersion(version);

            if (!versionInfo) {
                console.log(`❌ Version ${version} not found.`);
                return;
            }

            if (!options.force) {
                console.log(`⚠️  This will permanently delete version ${version}:`);
                console.log(`   📁 File: ${versionInfo.filePath}`);
                console.log(`   📊 Records: ${versionInfo.recordCount.toLocaleString()}`);
                console.log('\nTo confirm deletion, run with --force flag');
                return;
            }

            const success = await exportService.deleteVersion(version);

            if (success) {
                logger.info('Dataset version deleted', { version });
                console.log(`✅ Version ${version} deleted successfully.`);
            } else {
                console.log(`❌ Failed to delete version ${version}.`);
            }

        } catch (error) {
            logger.error('Failed to delete version', { error: error.message });
            console.error('❌ Failed to delete version:', error.message);
            process.exit(1);
        }
    });

program
    .command('validate')
    .description('Validate dataset file integrity')
    .argument('<version>', 'Version to validate')
    .action(async (version, options, command) => {
        try {
            const globalOptions = command.parent?.opts() || {};
            exportService = new DatasetExportService(globalOptions.dir || './exports');
            const versionInfo = await exportService.getVersion(version);

            if (!versionInfo) {
                console.log(`❌ Version ${version} not found.`);
                return;
            }

            console.log(`🔍 Validating version ${version}...`);

            // Check if file exists
            const fs = await import('fs/promises');
            try {
                await fs.access(versionInfo.filePath);
                console.log('✅ File exists');
            } catch {
                console.log('❌ File not found');
                return;
            }

            // Validate hash
            const crypto = await import('crypto');
            const fileBuffer = await fs.readFile(versionInfo.filePath);
            const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

            if (currentHash === versionInfo.dataHash) {
                console.log('✅ File integrity verified');
            } else {
                console.log('❌ File integrity check failed');
                console.log(`   Expected: ${versionInfo.dataHash}`);
                console.log(`   Actual:   ${currentHash}`);
            }

            console.log(`\n📊 File size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        } catch (error) {
            logger.error('Failed to validate version', { error: error.message });
            console.error('❌ Failed to validate version:', error.message);
            process.exit(1);
        }
    });

// Handle unknown commands
program.on('command:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
});

if (process.argv.length === 2) {
    program.help();
}

program.parse();