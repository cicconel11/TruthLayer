import { NextRequest, NextResponse } from 'next/server';
import { getAvailableTemplates } from '../../../../../../src/services/report-templates';

/**
 * GET /api/reports/templates - Get available report templates
 */
export async function GET(request: NextRequest) {
    try {
        const templates = getAvailableTemplates();

        // Return template metadata without the full template content
        const templateMetadata = templates.map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            defaultConfig: template.defaultConfig
        }));

        return NextResponse.json({
            success: true,
            data: templateMetadata
        });
    } catch (error) {
        console.error('Failed to fetch report templates:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch report templates'
            },
            { status: 500 }
        );
    }
}