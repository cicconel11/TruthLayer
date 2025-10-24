import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
    try {
        // Perform health checks for various components
        const components = await Promise.allSettled([
            checkDatabaseHealth(),
            checkCollectionHealth(),
            checkAnnotationHealth(),
            checkQueueHealth(),
        ]);

        const healthResults = components.map((result, index) => {
            const componentNames = ['database', 'collection', 'annotation', 'queue'];

            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    component: componentNames[index],
                    status: 'unhealthy' as const,
                    message: `Health check failed: ${result.reason}`,
                    responseTime: undefined,
                };
            }
        });

        // Determine overall system health
        const unhealthyCount = healthResults.filter(r => r.status === 'unhealthy').length;
        const degradedCount = healthResults.filter(r => r.status === 'degraded').length;

        let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
        let summary: string;

        if (unhealthyCount > 0) {
            overallStatus = 'unhealthy';
            summary = `${unhealthyCount} component(s) unhealthy`;
        } else if (degradedCount > 0) {
            overallStatus = 'degraded';
            summary = `${degradedCount} component(s) degraded`;
        } else {
            overallStatus = 'healthy';
            summary = 'All components healthy';
        }

        return NextResponse.json({
            success: true,
            data: {
                status: overallStatus,
                components: healthResults,
                summary,
            },
        });
    } catch (error) {
        console.error('Error checking system health:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to check system health',
            },
            { status: 500 }
        );
    }
}

async function checkDatabaseHealth() {
    const startTime = Date.now();

    try {
        // Simple query to check database connectivity
        await query('SELECT 1');
        const responseTime = Date.now() - startTime;

        return {
            component: 'database',
            status: responseTime < 100 ? 'healthy' as const : 'degraded' as const,
            message: responseTime < 100 ? 'Database responding normally' : 'Database response slow',
            responseTime,
        };
    } catch (error) {
        return {
            component: 'database',
            status: 'unhealthy' as const,
            message: `Database connection failed: ${error}`,
            responseTime: Date.now() - startTime,
        };
    }
}

async function checkCollectionHealth() {
    const startTime = Date.now();

    try {
        // Check recent collection activity (last 24 hours)
        const result = await query(`
      SELECT 
        COUNT(*) as total_results,
        COUNT(DISTINCT engine) as active_engines,
        MAX(collected_at) as last_collection
      FROM search_results 
      WHERE collected_at >= NOW() - INTERVAL '24 hours'
    `);

        const responseTime = Date.now() - startTime;
        const data = result[0];

        const totalResults = parseInt(data.total_results);
        const activeEngines = parseInt(data.active_engines);
        const lastCollection = data.last_collection;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        let message: string;

        if (!lastCollection) {
            status = 'unhealthy';
            message = 'No recent collection activity';
        } else if (activeEngines < 4) {
            status = 'degraded';
            message = `Only ${activeEngines}/4 engines active`;
        } else if (totalResults < 100) {
            status = 'degraded';
            message = 'Low collection volume';
        } else {
            status = 'healthy';
            message = `${totalResults} results from ${activeEngines} engines`;
        }

        return {
            component: 'collection',
            status,
            message,
            responseTime,
            metadata: {
                totalResults,
                activeEngines,
                lastCollection,
            },
        };
    } catch (error) {
        return {
            component: 'collection',
            status: 'unhealthy' as const,
            message: `Collection health check failed: ${error}`,
            responseTime: Date.now() - startTime,
        };
    }
}

async function checkAnnotationHealth() {
    const startTime = Date.now();

    try {
        // Check annotation pipeline health
        const result = await query(`
      SELECT 
        COUNT(sr.id) as total_results,
        COUNT(a.id) as annotated_results,
        MAX(a.annotated_at) as last_annotation
      FROM search_results sr
      LEFT JOIN annotations a ON sr.id = a.result_id
      WHERE sr.collected_at >= NOW() - INTERVAL '24 hours'
    `);

        const responseTime = Date.now() - startTime;
        const data = result[0];

        const totalResults = parseInt(data.total_results);
        const annotatedResults = parseInt(data.annotated_results);
        const lastAnnotation = data.last_annotation;
        const annotationRate = totalResults > 0 ? annotatedResults / totalResults : 0;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        let message: string;

        if (!lastAnnotation) {
            status = 'unhealthy';
            message = 'No recent annotation activity';
        } else if (annotationRate < 0.5) {
            status = 'degraded';
            message = `Low annotation rate: ${(annotationRate * 100).toFixed(1)}%`;
        } else if (annotationRate < 0.8) {
            status = 'degraded';
            message = `Moderate annotation rate: ${(annotationRate * 100).toFixed(1)}%`;
        } else {
            status = 'healthy';
            message = `Annotation rate: ${(annotationRate * 100).toFixed(1)}%`;
        }

        return {
            component: 'annotation',
            status,
            message,
            responseTime,
            metadata: {
                totalResults,
                annotatedResults,
                annotationRate,
                lastAnnotation,
            },
        };
    } catch (error) {
        return {
            component: 'annotation',
            status: 'unhealthy' as const,
            message: `Annotation health check failed: ${error}`,
            responseTime: Date.now() - startTime,
        };
    }
}

async function checkQueueHealth() {
    const startTime = Date.now();

    try {
        // Check for pending annotations (results without annotations)
        const result = await query(`
      SELECT COUNT(*) as pending_annotations
      FROM search_results sr
      LEFT JOIN annotations a ON sr.id = a.result_id
      WHERE a.id IS NULL 
        AND sr.collected_at >= NOW() - INTERVAL '7 days'
    `);

        const responseTime = Date.now() - startTime;
        const pendingAnnotations = parseInt(result[0].pending_annotations);

        let status: 'healthy' | 'degraded' | 'unhealthy';
        let message: string;

        if (pendingAnnotations > 1000) {
            status = 'unhealthy';
            message = `High queue backlog: ${pendingAnnotations} pending`;
        } else if (pendingAnnotations > 500) {
            status = 'degraded';
            message = `Moderate queue backlog: ${pendingAnnotations} pending`;
        } else {
            status = 'healthy';
            message = `Queue healthy: ${pendingAnnotations} pending`;
        }

        return {
            component: 'queue',
            status,
            message,
            responseTime,
            metadata: {
                pendingAnnotations,
            },
        };
    } catch (error) {
        return {
            component: 'queue',
            status: 'unhealthy' as const,
            message: `Queue health check failed: ${error}`,
            responseTime: Date.now() - startTime,
        };
    }
}