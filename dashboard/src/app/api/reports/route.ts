import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '../../../../../src/database/connection';
import { ReportGenerationService, ReportConfig } from '../../../../../src/services/report-generation-service';
import { getReportTemplate } from '../../../../../src/services/report-templates';

/**
 * GET /api/reports - Get list of generated reports
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        const db = new DatabaseConnection();
        await db.connect();

        const reportService = new ReportGenerationService(db);
        const reports = await reportService.getReports(limit);

        await db.disconnect();

        return NextResponse.json({
            success: true,
            data: reports
        });
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch reports'
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/reports - Generate a new report
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        const {
            title,
            timePeriod = '30d',
            engines = ['google', 'bing', 'perplexity', 'brave'],
            categories,
            includeVisualization = true,
            includeRawData = false,
            format = 'html',
            templateId = 'transparency_standard',
            branding
        } = body;

        if (!title) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Title is required'
                },
                { status: 400 }
            );
        }

        // Get template if specified
        let template = null;
        if (templateId) {
            template = getReportTemplate(templateId);
            if (!template) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Template '${templateId}' not found`
                    },
                    { status: 400 }
                );
            }
        }

        // Build report configuration
        const config: ReportConfig = {
            title,
            timePeriod,
            engines,
            categories,
            includeVisualization,
            includeRawData,
            format,
            branding: branding || template?.defaultConfig.branding
        };

        // Apply template defaults if available
        if (template) {
            Object.assign(config, template.defaultConfig, config);
        }

        const db = new DatabaseConnection();
        await db.connect();

        const reportService = new ReportGenerationService(db);
        const report = await reportService.generateReport(config);

        await db.disconnect();

        return NextResponse.json({
            success: true,
            data: {
                id: report.id,
                title: report.config.title,
                generatedAt: report.metadata.generatedAt,
                config: report.config,
                metadata: report.metadata
            }
        });
    } catch (error) {
        console.error('Failed to generate report:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate report'
            },
            { status: 500 }
        );
    }
}