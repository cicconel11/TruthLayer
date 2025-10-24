import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const hours = parseInt(url.searchParams.get('hours') || '24');

        // Generate current system metrics
        const metrics = await generateSystemMetrics(hours);

        return NextResponse.json({
            success: true,
            data: metrics,
        });
    } catch (error) {
        console.error('Error fetching system metrics:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch system metrics',
            },
            { status: 500 }
        );
    }
}

async function generateSystemMetrics(hours: number) {
    const metrics = [];
    const now = new Date();

    try {
        // Get scheduler metrics (simulated for now)
        const schedulerMetrics = {
            totalJobs: 10, // Total configured jobs
            enabledJobs: 8, // Currently enabled jobs
            activeExecutions: 2, // Currently running jobs
            failureRate: 0.05, // 5% failure rate
        };

        // Get queue metrics
        const queueResult = await query(`
      SELECT 
        COUNT(CASE WHEN a.id IS NULL THEN 1 END) as pending,
        COUNT(CASE WHEN a.annotated_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_processed
      FROM search_results sr
      LEFT JOIN annotations a ON sr.id = a.result_id
      WHERE sr.collected_at >= NOW() - INTERVAL '7 days'
    `);

        const queueData = queueResult[0];
        const queueMetrics = {
            pending: parseInt(queueData.pending),
            running: 3, // Simulated active processing
            throughput: parseInt(queueData.recent_processed), // Per hour
            averageProcessingTime: 45, // Seconds (simulated)
        };

        // Get collection metrics
        const collectionResult = await query(`
      SELECT 
        COUNT(*) as total_collected,
        COUNT(CASE WHEN title IS NOT NULL AND title != '' THEN 1 END) as successful_collections
      FROM search_results 
      WHERE collected_at >= NOW() - INTERVAL '${hours} hours'
    `);

        const collectionData = collectionResult[0];
        const totalCollected = parseInt(collectionData.total_collected);
        const successfulCollections = parseInt(collectionData.successful_collections);
        const successRate = totalCollected > 0 ? successfulCollections / totalCollected : 0;
        const collectionErrorRate = 1 - successRate;

        const collectionMetrics = {
            successRate,
            totalCollected,
            errorRate: collectionErrorRate,
        };

        // Get annotation metrics
        const annotationResult = await query(`
      SELECT 
        COUNT(CASE WHEN a.id IS NULL THEN 1 END) as queue_size,
        COUNT(CASE WHEN a.annotated_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_annotations,
        COUNT(CASE WHEN a.confidence_score < 0.5 THEN 1 END) as low_confidence_count,
        COUNT(a.id) as total_annotations
      FROM search_results sr
      LEFT JOIN annotations a ON sr.id = a.result_id
      WHERE sr.collected_at >= NOW() - INTERVAL '${hours} hours'
    `);

        const annotationData = annotationResult[0];
        const totalAnnotations = parseInt(annotationData.total_annotations);
        const lowConfidenceCount = parseInt(annotationData.low_confidence_count);
        const annotationErrorRate = totalAnnotations > 0 ? lowConfidenceCount / totalAnnotations : 0;

        const annotationMetrics = {
            queueSize: parseInt(annotationData.queue_size),
            processingRate: parseInt(annotationData.recent_annotations), // Per hour
            errorRate: annotationErrorRate,
        };

        // Create metrics snapshot
        const metricsSnapshot = {
            timestamp: now,
            scheduler: schedulerMetrics,
            queue: queueMetrics,
            collection: collectionMetrics,
            annotation: annotationMetrics,
        };

        metrics.push(metricsSnapshot);

        // Generate historical metrics for the requested time period
        for (let i = 1; i < Math.min(hours, 24); i++) {
            const historicalTime = new Date(now.getTime() - (i * 60 * 60 * 1000));

            // Generate slightly varied historical data (simulated)
            const historicalMetrics = {
                timestamp: historicalTime,
                scheduler: {
                    ...schedulerMetrics,
                    failureRate: Math.max(0, schedulerMetrics.failureRate + (Math.random() - 0.5) * 0.02),
                },
                queue: {
                    ...queueMetrics,
                    pending: Math.max(0, queueMetrics.pending + Math.floor((Math.random() - 0.5) * 20)),
                    throughput: Math.max(0, queueMetrics.throughput + Math.floor((Math.random() - 0.5) * 10)),
                },
                collection: {
                    ...collectionMetrics,
                    successRate: Math.min(1, Math.max(0, collectionMetrics.successRate + (Math.random() - 0.5) * 0.1)),
                },
                annotation: {
                    ...annotationMetrics,
                    queueSize: Math.max(0, annotationMetrics.queueSize + Math.floor((Math.random() - 0.5) * 50)),
                    errorRate: Math.min(1, Math.max(0, annotationMetrics.errorRate + (Math.random() - 0.5) * 0.05)),
                },
            };

            // Recalculate dependent values
            historicalMetrics.collection.errorRate = 1 - historicalMetrics.collection.successRate;

            metrics.push(historicalMetrics);
        }

        // Sort by timestamp (newest first)
        return metrics.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } catch (error) {
        console.error('Error generating system metrics:', error);

        // Return minimal metrics in case of error
        return [{
            timestamp: now,
            scheduler: {
                totalJobs: 0,
                enabledJobs: 0,
                activeExecutions: 0,
                failureRate: 1,
            },
            queue: {
                pending: 0,
                running: 0,
                throughput: 0,
                averageProcessingTime: 0,
            },
            collection: {
                successRate: 0,
                totalCollected: 0,
                errorRate: 1,
            },
            annotation: {
                queueSize: 0,
                processingRate: 0,
                errorRate: 1,
            },
        }];
    }
}