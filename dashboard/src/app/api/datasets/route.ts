import { NextRequest, NextResponse } from 'next/server';
import { DatasetExportService, ExportOptions } from '../../../../../src/services/dataset-export-service';
import { query } from '@/lib/database';

const exportService = new DatasetExportService('./exports', query);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        switch (action) {
            case 'list':
                return await handleListVersions();
            case 'info':
                const version = searchParams.get('version');
                if (!version) {
                    return NextResponse.json({ error: 'Version parameter required' }, { status: 400 });
                }
                return await handleVersionInfo(version);
            default:
                return await handleListVersions();
        }
    } catch (error) {
        console.error('Error in datasets GET:', error);
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, ...options } = body;

        switch (action) {
            case 'export':
                return await handleExport(options);
            case 'delete':
                const version = options.version;
                if (!version) {
                    return NextResponse.json({ error: 'Version parameter required' }, { status: 400 });
                }
                return await handleDeleteVersion(version);
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error in datasets POST:', error);
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 }
        );
    }
}

async function handleListVersions() {
    try {
        const versions = await exportService.listVersions();
        return NextResponse.json({
            success: true,
            versions: versions.map(v => ({
                version: v.version,
                createdAt: v.createdAt,
                description: v.description,
                recordCount: v.recordCount,
                dataHash: v.dataHash,
                filePath: v.filePath,
                statistics: v.metadata.statistics
            }))
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to list versions' },
            { status: 500 }
        );
    }
}

async function handleVersionInfo(version: string) {
    try {
        const versionInfo = await exportService.getVersion(version);

        if (!versionInfo) {
            return NextResponse.json(
                { error: 'Version not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            version: versionInfo
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to get version info' },
            { status: 500 }
        );
    }
}

async function handleExport(options: any) {
    try {
        const exportOptions: ExportOptions = {
            format: options.format || 'parquet',
            engines: options.engines || ['google', 'bing', 'perplexity', 'brave'],
            categories: options.categories || [],
            includeAnnotations: options.includeAnnotations !== false,
            includeRawData: options.includeRawData || false
        };

        if (options.dateRange) {
            exportOptions.dateRange = {
                start: new Date(options.dateRange.start),
                end: new Date(options.dateRange.end)
            };
        }

        if (options.version) {
            exportOptions.version = options.version;
        }

        const result = await exportService.exportDataset(exportOptions);

        return NextResponse.json({
            success: true,
            version: result.version,
            recordCount: result.recordCount,
            filePath: result.filePath,
            dataHash: result.dataHash,
            metadata: result.metadata
        });
    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json(
            { error: 'Failed to export dataset' },
            { status: 500 }
        );
    }
}

async function handleDeleteVersion(version: string) {
    try {
        const success = await exportService.deleteVersion(version);

        if (success) {
            return NextResponse.json({
                success: true,
                message: `Version ${version} deleted successfully`
            });
        } else {
            return NextResponse.json(
                { error: 'Failed to delete version' },
                { status: 500 }
            );
        }
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to delete version' },
            { status: 500 }
        );
    }
}