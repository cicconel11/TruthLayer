import { NextRequest, NextResponse } from 'next/server';
import { getAllExportProgress, updateExportProgress, cleanupOldExports, getExportProgress } from '@/lib/export-progress';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const exportId = searchParams.get('id');

        if (!exportId) {
            return NextResponse.json(
                { success: false, error: 'Export ID is required' },
                { status: 400 }
            );
        }

        const progress = getExportProgress(exportId);

        if (!progress) {
            return NextResponse.json(
                { success: false, error: 'Export not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                exportId,
                ...progress,
            },
        });

    } catch (error) {
        console.error('Error getting export progress:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get export progress' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { exportId, status, progress, totalRecords, processedRecords, error, downloadUrl } = await request.json();

        if (!exportId) {
            return NextResponse.json(
                { success: false, error: 'Export ID is required' },
                { status: 400 }
            );
        }

        const updatedProgress = updateExportProgress(exportId, {
            status,
            progress,
            totalRecords,
            processedRecords,
            error,
            downloadUrl,
        });

        if (!updatedProgress) {
            return NextResponse.json(
                { success: false, error: 'Export not found' },
                { status: 404 }
            );
        }

        // Clean up old exports
        cleanupOldExports();

        return NextResponse.json({
            success: true,
            data: {
                exportId,
                ...updatedProgress,
            },
        });

    } catch (error) {
        console.error('Error updating export progress:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update export progress' },
            { status: 500 }
        );
    }
}

