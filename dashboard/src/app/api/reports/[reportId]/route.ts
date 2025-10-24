import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '../../../../../../src/database/connection';
import { ReportGenerationService } from '../../../../../../src/services/report-generation-service';

/**
 * GET /api/reports/[reportId] - Get a specific report
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { reportId: string } }
) {
    try {
        const { reportId } = params;
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json';

        const db = new DatabaseConnection();
        await db.connect();

        const reportService = new ReportGenerationService(db);
        const report = await reportService.getReport(reportId);

        await db.disconnect();

        if (!report) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Report not found'
                },
                { status: 404 }
            );
        }

        // Return different formats based on request
        if (format === 'html' && report.config.format === 'html') {
            return new NextResponse(report.content, {
                headers: {
                    'Content-Type': 'text/html',
                    'Content-Disposition': `inline; filename="${report.config.title}.html"`
                }
            });
        } else if (format === 'markdown' && report.config.format === 'markdown') {
            return new NextResponse(report.content, {
                headers: {
                    'Content-Type': 'text/markdown',
                    'Content-Disposition': `attachment; filename="${report.config.title}.md"`
                }
            });
        } else if (format === 'download') {
            const contentType = report.config.format === 'html' ? 'text/html' :
                report.config.format === 'markdown' ? 'text/markdown' :
                    'application/json';
            const extension = report.config.format === 'html' ? 'html' :
                report.config.format === 'markdown' ? 'md' : 'json';

            return new NextResponse(report.content, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `attachment; filename="${report.config.title}.${extension}"`
                }
            });
        }

        // Default JSON response
        return NextResponse.json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Failed to fetch report:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch report'
            },
            { status: 500 }
        );
    }
}