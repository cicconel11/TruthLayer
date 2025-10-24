#!/usr/bin/env node

import { DatasetExportService } from '../services/dataset-export-service';
import * as path from 'path';

// Mock query function for demo purposes
const mockQueryFunction = async (sql: string, params?: any[]): Promise<any[]> => {
    console.log('Mock query:', sql.substring(0, 100) + '...');
    console.log('Params:', params);

    // Return mock data based on query type
    if (sql.includes('FROM queries q')) {
        // Main search results query
        return [
            {
                query_id: 'q1',
                query_text: 'climate change effects',
                query_category: 'science',
                query_created_at: new Date('2025-01-01').toISOString(),
                result_id: 'r1',
                engine: 'google',
                rank: 1,
                title: 'Climate Change: Effects and Impacts',
                snippet: 'Climate change is causing significant environmental impacts worldwide...',
                url: 'https://example.com/climate-effects',
                collected_at: new Date('2025-01-01T10:00:00Z').toISOString(),
                content_hash: 'abc123'
            },
            {
                query_id: 'q1',
                query_text: 'climate change effects',
                query_category: 'science',
                query_created_at: new Date('2025-01-01').toISOString(),
                result_id: 'r2',
                engine: 'bing',
                rank: 1,
                title: 'Understanding Climate Change',
                snippet: 'Learn about the causes and effects of climate change...',
                url: 'https://example.org/climate-understanding',
                collected_at: new Date('2025-01-01T10:05:00Z').toISOString(),
                content_hash: 'def456'
            },
            {
                query_id: 'q2',
                query_text: 'renewable energy benefits',
                query_category: 'science',
                query_created_at: new Date('2025-01-01').toISOString(),
                result_id: 'r3',
                engine: 'google',
                rank: 1,
                title: 'Benefits of Renewable Energy',
                snippet: 'Renewable energy sources provide clean, sustainable power...',
                url: 'https://example.com/renewable-benefits',
                collected_at: new Date('2025-01-01T11:00:00Z').toISOString(),
                content_hash: 'ghi789'
            }
        ];
    } else if (sql.includes('FROM annotations a')) {
        // Annotations query
        return [
            {
                annotation_id: 'a1',
                result_id: 'r1',
                domain_type: 'academic',
                factual_score: 0.9,
                confidence_score: 0.85,
                reasoning: 'This appears to be from a reputable scientific source with peer-reviewed information.',
                model_version: 'gpt-4-turbo',
                annotated_at: new Date('2025-01-01T12:00:00Z').toISOString()
            },
            {
                annotation_id: 'a2',
                result_id: 'r2',
                domain_type: 'government',
                factual_score: 0.85,
                confidence_score: 0.8,
                reasoning: 'Government source with official climate data and policy information.',
                model_version: 'gpt-4-turbo',
                annotated_at: new Date('2025-01-01T12:05:00Z').toISOString()
            },
            {
                annotation_id: 'a3',
                result_id: 'r3',
                domain_type: 'news',
                factual_score: 0.75,
                confidence_score: 0.7,
                reasoning: 'News article with good sourcing but some promotional content.',
                model_version: 'gpt-4-turbo',
                annotated_at: new Date('2025-01-01T12:10:00Z').toISOString()
            }
        ];
    } else if (sql.includes('SELECT id, text, category')) {
        // Queries lookup
        return [
            {
                id: 'q1',
                text: 'climate change effects',
                category: 'science',
                created_at: new Date('2025-01-01').toISOString(),
                updated_at: new Date('2025-01-01').toISOString()
            },
            {
                id: 'q2',
                text: 'renewable energy benefits',
                category: 'science',
                created_at: new Date('2025-01-01').toISOString(),
                updated_at: new Date('2025-01-01').toISOString()
            }
        ];
    }

    return [];
};

async function runDemo() {
    console.log('🚀 Starting TruthLayer Dataset Export Demo\n');

    const outputDir = path.join(__dirname, '../../demo-exports');
    const exportService = new DatasetExportService(outputDir, mockQueryFunction);

    try {
        // Test 1: Create a Parquet export
        console.log('📊 Creating Parquet export...');
        const parquetExport = await exportService.exportDataset({
            format: 'parquet',
            engines: ['google', 'bing'],
            categories: ['science'],
            includeAnnotations: true,
            includeRawData: false,
            version: '2025.01.demo.parquet'
        });

        console.log('✅ Parquet export completed:');
        console.log(`   Version: ${parquetExport.version}`);
        console.log(`   Records: ${parquetExport.recordCount}`);
        console.log(`   File: ${parquetExport.filePath}`);
        console.log(`   Hash: ${parquetExport.dataHash}\n`);

        // Test 2: Create a CSV export
        console.log('📄 Creating CSV export...');
        const csvExport = await exportService.exportDataset({
            format: 'csv',
            engines: ['google', 'bing'],
            categories: ['science'],
            includeAnnotations: true,
            includeRawData: false,
            version: '2025.01.demo.csv'
        });

        console.log('✅ CSV export completed:');
        console.log(`   Version: ${csvExport.version}`);
        console.log(`   Records: ${csvExport.recordCount}`);
        console.log(`   File: ${csvExport.filePath}`);
        console.log(`   Hash: ${csvExport.dataHash}\n`);

        // Test 3: Create a JSON export
        console.log('📋 Creating JSON export...');
        const jsonExport = await exportService.exportDataset({
            format: 'json',
            engines: ['google', 'bing'],
            categories: ['science'],
            includeAnnotations: true,
            includeRawData: false,
            version: '2025.01.demo.json'
        });

        console.log('✅ JSON export completed:');
        console.log(`   Version: ${jsonExport.version}`);
        console.log(`   Records: ${jsonExport.recordCount}`);
        console.log(`   File: ${jsonExport.filePath}`);
        console.log(`   Hash: ${jsonExport.dataHash}\n`);

        // Test 4: List all versions
        console.log('📋 Listing all dataset versions...');
        const versions = await exportService.listVersions();

        console.log(`Found ${versions.length} versions:`);
        versions.forEach((version, index) => {
            console.log(`${index + 1}. ${version.version} (${version.recordCount} records)`);
        });

        // Test 5: Get detailed info for one version
        console.log('\n🔍 Getting detailed info for Parquet version...');
        const versionInfo = await exportService.getVersion(parquetExport.version);

        if (versionInfo) {
            console.log('Version Details:');
            console.log(`  Title: ${versionInfo.metadata.title}`);
            console.log(`  Description: ${versionInfo.metadata.description}`);
            console.log(`  Total Queries: ${versionInfo.metadata.statistics.totalQueries}`);
            console.log(`  Total Results: ${versionInfo.metadata.statistics.totalResults}`);
            console.log(`  Total Annotations: ${versionInfo.metadata.statistics.totalAnnotations}`);
            console.log(`  Engine Distribution:`, versionInfo.metadata.statistics.engineDistribution);
            console.log(`  Category Distribution:`, versionInfo.metadata.statistics.categoryDistribution);
        }

        console.log('\n🎉 Demo completed successfully!');
        console.log(`📁 Check the demo exports in: ${outputDir}`);

    } catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    }
}

// Run the demo
if (require.main === module) {
    runDemo();
}

export { runDemo };