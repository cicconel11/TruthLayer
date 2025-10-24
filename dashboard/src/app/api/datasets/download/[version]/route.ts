import { NextRequest, NextResponse } from 'next/server';
import { DatasetExportService } from '../../../../../../../src/services/dataset-export-service';
import * as fs from 'fs/promises';
import * as path from 'path';

const exportService = new DatasetExportService('./exports');

export async function GET(
    request: NextRequest,
    { params }: { params: { version: string } }
) {
    try {
        const version = params.version;
        const { searchParams } = new URL(request.url);
        const fileType = searchParams.get('type') || 'dataset'; // 'dataset', 'metadata', 'readme'

        const versionInfo = await exportService.getVersion(version);

        if (!versionInfo) {
            return NextResponse.json(
                { error: 'Version not found' },
                { status: 404 }
            );
        }

        let filePath: string;
        let contentType: string;
        let fileName: string;

        switch (fileType) {
            case 'dataset':
                filePath = versionInfo.filePath;
                const ext = path.extname(filePath).toLowerCase();

                switch (ext) {
                    case '.parquet':
                        contentType = 'application/octet-stream';
                        break;
                    case '.csv':
                        contentType = 'text/csv';
                        break;
                    case '.json':
                        contentType = 'application/json';
                        break;
                    default:
                        contentType = 'application/octet-stream';
                }

                fileName = path.basename(filePath);
                break;

            case 'metadata':
                const baseName = path.basename(versionInfo.filePath, path.extname(versionInfo.filePath));
                filePath = path.join(path.dirname(versionInfo.filePath), `${baseName}-metadata.json`);
                contentType = 'application/json';
                fileName = `truthlayer-dataset-v${version}-metadata.json`;
                break;

            case 'readme':
                filePath = path.join(path.dirname(versionInfo.filePath), `README-v${version}.md`);
                contentType = 'text/markdown';
                fileName = `README-v${version}.md`;
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid file type' },
                    { status: 400 }
                );
        }

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Read file
        const fileBuffer = await fs.readFile(filePath);

        // Return file with appropriate headers
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': fileBuffer.length.toString(),
                'Cache-Control': 'public, max-age=31536000', // Cache for 1 year since versions are immutable
                'ETag': versionInfo.dataHash
            }
        });

    } catch (error) {
        console.error('Error downloading dataset file:', error);
        return NextResponse.json(
            { error: 'Failed to download file' },
            { status: 500 }
        );
    }
}