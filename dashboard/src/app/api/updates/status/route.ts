import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
    try {
        // Get the most recent data update across all tables
        const [lastCollectionUpdate] = await query<{ last_update: string }>(`
            SELECT MAX(collected_at) as last_update
            FROM search_results
        `);

        const [lastAnnotationUpdate] = await query<{ last_update: string }>(`
            SELECT MAX(annotated_at) as last_update
            FROM annotations
        `);

        const [lastMetricsUpdate] = await query<{ last_update: string }>(`
            SELECT MAX(updated_at) as last_update
            FROM bias_metrics
        `);

        // Find the most recent update
        const updates = [
            { type: 'collection', time: lastCollectionUpdate?.last_update },
            { type: 'annotation', time: lastAnnotationUpdate?.last_update },
            { type: 'metrics', time: lastMetricsUpdate?.last_update },
        ].filter(u => u.time);

        if (updates.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    lastUpdate: new Date(),
                    type: 'system',
                    message: 'No data updates available',
                },
            });
        }

        const mostRecent = updates.reduce((latest, current) =>
            new Date(current.time!) > new Date(latest.time!) ? current : latest
        );

        // Get some context about the update
        let message = '';
        let additionalData = {};

        switch (mostRecent.type) {
            case 'collection':
                const [recentCollections] = await query<{ count: string, engines: string }>(`
                    SELECT 
                        COUNT(*) as count,
                        STRING_AGG(DISTINCT engine, ', ') as engines
                    FROM search_results 
                    WHERE collected_at >= NOW() - INTERVAL '1 hour'
                `);
                message = `Collected ${recentCollections?.count || 0} results from ${recentCollections?.engines || 'engines'}`;
                additionalData = {
                    recentResults: parseInt(recentCollections?.count || '0'),
                    engines: recentCollections?.engines?.split(', ') || []
                };
                break;

            case 'annotation':
                const [recentAnnotations] = await query<{ count: string }>(`
                    SELECT COUNT(*) as count
                    FROM annotations 
                    WHERE annotated_at >= NOW() - INTERVAL '1 hour'
                `);
                message = `Processed ${recentAnnotations?.count || 0} annotations`;
                additionalData = {
                    recentAnnotations: parseInt(recentAnnotations?.count || '0')
                };
                break;

            case 'metrics':
                const [recentMetrics] = await query<{ count: string }>(`
                    SELECT COUNT(*) as count
                    FROM bias_metrics 
                    WHERE updated_at >= NOW() - INTERVAL '1 hour'
                `);
                message = `Updated ${recentMetrics?.count || 0} bias metrics`;
                additionalData = {
                    recentMetrics: parseInt(recentMetrics?.count || '0')
                };
                break;
        }

        // Check for any recent errors or issues
        const [errorCount] = await query<{ count: string }>(`
            SELECT COUNT(*) as count
            FROM system_logs 
            WHERE level = 'ERROR' 
                AND created_at >= NOW() - INTERVAL '1 hour'
        `);

        const hasErrors = parseInt(errorCount?.count || '0') > 0;

        return NextResponse.json({
            success: true,
            data: {
                lastUpdate: mostRecent.time,
                type: hasErrors ? 'error' : mostRecent.type,
                message: hasErrors ? `${message} (${errorCount.count} errors detected)` : message,
                hasErrors,
                ...additionalData,
            },
        });

    } catch (error) {
        console.error('Error fetching update status:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch update status',
            },
            { status: 500 }
        );
    }
}