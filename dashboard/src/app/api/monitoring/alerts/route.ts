import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const severity = url.searchParams.get('severity');
        const acknowledged = url.searchParams.get('acknowledged');
        const limit = parseInt(url.searchParams.get('limit') || '50');

        // Generate alerts based on current system state
        const alerts = await generateSystemAlerts();

        // Filter alerts based on query parameters
        let filteredAlerts = alerts;

        if (severity) {
            filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
        }

        if (acknowledged !== null) {
            const isAcknowledged = acknowledged === 'true';
            filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged === isAcknowledged);
        }

        // Sort by timestamp (newest first) and limit
        filteredAlerts = filteredAlerts
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);

        return NextResponse.json({
            success: true,
            data: filteredAlerts,
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch alerts',
            },
            { status: 500 }
        );
    }
}

async function generateSystemAlerts() {
    const alerts = [];
    const now = new Date();

    try {
        // Check collection success rate (last 24 hours)
        const collectionResult = await query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as successful_collections,
        engine
      FROM search_results 
      WHERE collected_at >= NOW() - INTERVAL '24 hours'
      GROUP BY engine
    `);

        for (const row of collectionResult) {
            const successRate = row.total_attempts > 0 ? row.successful_collections / row.total_attempts : 0;

            if (successRate < 0.7) {
                alerts.push({
                    id: `collection_${row.engine}_${Date.now()}`,
                    severity: successRate < 0.5 ? 'error' : 'warning',
                    title: `Low Collection Success Rate - ${row.engine}`,
                    message: `${row.engine} collection success rate is ${(successRate * 100).toFixed(1)}% (${row.successful_collections}/${row.total_attempts})`,
                    timestamp: now,
                    source: 'collection_monitor',
                    acknowledged: false,
                });
            }
        }

        // Check annotation queue backlog
        const queueResult = await query(`
      SELECT COUNT(*) as pending_annotations
      FROM search_results sr
      LEFT JOIN annotations a ON sr.id = a.result_id
      WHERE a.id IS NULL 
        AND sr.collected_at >= NOW() - INTERVAL '7 days'
    `);

        const pendingAnnotations = parseInt(queueResult[0].pending_annotations);

        if (pendingAnnotations > 500) {
            alerts.push({
                id: `queue_backlog_${Date.now()}`,
                severity: pendingAnnotations > 1000 ? 'error' : 'warning',
                title: 'Annotation Queue Backlog',
                message: `${pendingAnnotations} search results pending annotation`,
                timestamp: now,
                source: 'annotation_monitor',
                acknowledged: false,
            });
        }

        // Check for stale data (no recent collections)
        const staleDataResult = await query(`
      SELECT MAX(collected_at) as last_collection
      FROM search_results
    `);

        const lastCollection = staleDataResult[0].last_collection;
        if (lastCollection) {
            const hoursSinceLastCollection = (now.getTime() - new Date(lastCollection).getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastCollection > 6) {
                alerts.push({
                    id: `stale_data_${Date.now()}`,
                    severity: hoursSinceLastCollection > 24 ? 'error' : 'warning',
                    title: 'Stale Data Detected',
                    message: `No data collection in the last ${Math.floor(hoursSinceLastCollection)} hours`,
                    timestamp: now,
                    source: 'data_monitor',
                    acknowledged: false,
                });
            }
        }

        // Check annotation error rate
        const annotationErrorResult = await query(`
      SELECT 
        COUNT(*) as total_annotations,
        COUNT(CASE WHEN confidence_score < 0.5 THEN 1 END) as low_confidence_annotations
      FROM annotations 
      WHERE annotated_at >= NOW() - INTERVAL '24 hours'
    `);

        const annotationData = annotationErrorResult[0];
        if (annotationData.total_annotations > 0) {
            const lowConfidenceRate = annotationData.low_confidence_annotations / annotationData.total_annotations;

            if (lowConfidenceRate > 0.2) {
                alerts.push({
                    id: `annotation_quality_${Date.now()}`,
                    severity: lowConfidenceRate > 0.4 ? 'error' : 'warning',
                    title: 'High Annotation Uncertainty',
                    message: `${(lowConfidenceRate * 100).toFixed(1)}% of annotations have low confidence scores`,
                    timestamp: now,
                    source: 'annotation_quality',
                    acknowledged: false,
                });
            }
        }

        // Check domain diversity issues
        const diversityResult = await query(`
      SELECT 
        q.text as query_text,
        COUNT(DISTINCT SUBSTRING(sr.url FROM 'https?://([^/]+)')) as unique_domains,
        COUNT(*) as total_results
      FROM queries q
      JOIN search_results sr ON q.id = sr.query_id
      WHERE sr.collected_at >= NOW() - INTERVAL '24 hours'
      GROUP BY q.id, q.text
      HAVING COUNT(*) >= 20
    `);

        for (const row of diversityResult) {
            const diversityIndex = row.unique_domains / row.total_results;

            if (diversityIndex < 0.3) {
                alerts.push({
                    id: `low_diversity_${row.query_text.replace(/\s+/g, '_')}_${Date.now()}`,
                    severity: diversityIndex < 0.2 ? 'warning' : 'info',
                    title: 'Low Domain Diversity',
                    message: `Query "${row.query_text}" has low domain diversity: ${(diversityIndex * 100).toFixed(1)}%`,
                    timestamp: now,
                    source: 'diversity_monitor',
                    acknowledged: false,
                });
            }
        }

        // Check system logs for errors
        const errorLogsResult = await query(`
      SELECT COUNT(*) as error_count
      FROM system_logs 
      WHERE level IN ('ERROR', 'FATAL')
        AND created_at >= NOW() - INTERVAL '1 hour'
    `);

        const errorCount = parseInt(errorLogsResult[0].error_count);

        if (errorCount > 5) {
            alerts.push({
                id: `high_error_rate_${Date.now()}`,
                severity: errorCount > 20 ? 'error' : 'warning',
                title: 'High Error Rate',
                message: `${errorCount} errors logged in the last hour`,
                timestamp: now,
                source: 'error_monitor',
                acknowledged: false,
            });
        }

    } catch (error) {
        console.error('Error generating system alerts:', error);

        // Create an alert about the monitoring system itself failing
        alerts.push({
            id: `monitoring_error_${Date.now()}`,
            severity: 'error',
            title: 'Monitoring System Error',
            message: `Failed to generate system alerts: ${error}`,
            timestamp: now,
            source: 'monitoring_system',
            acknowledged: false,
        });
    }

    return alerts;
}