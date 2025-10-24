import { NextRequest, NextResponse } from 'next/server';

// Global storage for export files (in production, use S3/MinIO)
declare global {
    var exportFiles: Map<string, {
        content: string;
        contentType: string;
        filename: string;
    }> | undefined;
}

export async function GET(
    request: NextRequest,
    { params }: { params: { exportId: string } }
) {
    try {
        const { exportId } = params;
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('filename') || `export-${exportId}`;

        // Get the stored file content (in production, this would fetch from S3/MinIO)
        if (!global.exportFiles) {
            global.exportFiles = new Map();
        }

        const exportFiles = global.exportFiles;

        const fileData = exportFiles.get(exportId);

        if (!fileData) {
            return NextResponse.json(
                { success: false, error: 'Export file not found or expired' },
                { status: 404 }
            );
        }

        // Return the file content
        return new NextResponse(fileData.content, {
            status: 200,
            headers: {
                'Content-Type': fileData.contentType,
                'Content-Disposition': `attachment; filename="${fileData.filename}"`,
                'Content-Length': Buffer.byteLength(fileData.content, 'utf8').toString(),
            },
        });

    } catch (error) {
        console.error('Error downloading export file:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to download export file' },
            { status: 500 }
        );
    }
}