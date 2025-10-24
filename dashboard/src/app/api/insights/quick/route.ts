import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const dateRange = {
            start: searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date(),
        };

        const engines = searchParams.get('engines')?.split(',') || ['google', 'bing', 'perplexity', 'brave'];
        const categories = searchParams.get('categories')?.split(',') || [];

        // Build dynamic filters
        let categoryFilter = '';
        const params: any[] = [dateRange.start, dateRange.end, engines];

        if (categories.length > 0) {
            categoryFilter = 'AND q.category = ANY($4)';
            params.push(categories);
        }

        // Get basic statistics
        const [stats] = await query<{
            total_queries: string;
            total_results: string;
            unique_domains: string;
            avg_diversity: string;
            avg_factual: string;
        }>(`
            SELECT 
                COUNT(DISTINCT q.id) as total_queries,
                COUNT(sr.id) as total_results,
                COUNT(DISTINCT REGEXP_REPLACE(sr.url, '^https?://([^/]+).*', '\\1')) as unique_domains,
                AVG(
                    CASE 
                        WHEN query_stats.total_results > 0 
                        THEN query_stats.unique_domains::float / query_stats.total_results 
                        ELSE 0 
                    END
                ) as avg_diversity,
                AVG(COALESCE(a.factual_score, 0)) as avg_factual
            FROM queries q
            JOIN search_results sr ON q.id = sr.query_id
            LEFT JOIN annotations a ON sr.id = a.result_id
            LEFT JOIN (
                SELECT 
                    sr2.query_id,
                    COUNT(*) as total_results,
                    COUNT(DISTINCT REGEXP_REPLACE(sr2.url, '^https?://([^/]+).*', '\\1')) as unique_domains
                FROM search_results sr2
                WHERE sr2.collected_at >= $1 AND sr2.collected_at <= $2
                    AND sr2.engine = ANY($3)
                GROUP BY sr2.query_id
            ) query_stats ON q.id = query_stats.query_id
            WHERE sr.collected_at >= $1 
                AND sr.collected_at <= $2
                AND sr.engine = ANY($3)
                ${categoryFilter}
        `, params);

        // Get engine performance comparison
        const engineStats = await query<{
            engine: string;
            avg_diversity: string;
            avg_factual: string;
            total_results: string;
        }>(`
            SELECT 
                sr.engine,
                AVG(
                    CASE 
                        WHEN engine_query_stats.total_results > 0 
                        THEN engine_query_stats.unique_domains::float / engine_query_stats.total_results 
                        ELSE 0 
                    END
                ) as avg_diversity,
                AVG(COALESCE(a.factual_score, 0)) as avg_factual,
                COUNT(sr.id) as total_results
            FROM search_results sr
            LEFT JOIN annotations a ON sr.id = a.result_id
            LEFT JOIN queries q ON sr.query_id = q.id
            LEFT JOIN (
                SELECT 
                    sr2.query_id,
                    sr2.engine,
                    COUNT(*) as total_results,
                    COUNT(DISTINCT REGEXP_REPLACE(sr2.url, '^https?://([^/]+).*', '\\1')) as unique_domains
                FROM search_results sr2
                WHERE sr2.collected_at >= $1 AND sr2.collected_at <= $2
                GROUP BY sr2.query_id, sr2.engine
            ) engine_query_stats ON sr.query_id = engine_query_stats.query_id AND sr.engine = engine_query_stats.engine
            WHERE sr.collected_at >= $1 
                AND sr.collected_at <= $2
                AND sr.engine = ANY($3)
                ${categoryFilter}
            GROUP BY sr.engine
            ORDER BY avg_diversity DESC
        `, params);

        // Generate insights based on the data
        const findings: string[] = [];
        const recommendations: string[] = [];

        if (stats) {
            const totalQueries = parseInt(stats.total_queries);
            const totalResults = parseInt(stats.total_results);
            const uniqueDomains = parseInt(stats.unique_domains);
            const avgDiversity = parseFloat(stats.avg_diversity);
            const avgFactual = parseFloat(stats.avg_factual);

            // Diversity insights
            if (avgDiversity > 0.7) {
                findings.push(`High domain diversity (${(avgDiversity * 100).toFixed(1)}%) indicates good source variety`);
            } else if (avgDiversity < 0.3) {
                findings.push(`Low domain diversity (${(avgDiversity * 100).toFixed(1)}%) suggests limited source variety`);
                recommendations.push('Consider analyzing queries with higher diversity scores');
            }

            // Factual alignment insights
            if (avgFactual > 0.8) {
                findings.push(`Strong factual alignment (${(avgFactual * 100).toFixed(1)}%) across results`);
            } else if (avgFactual < 0.6) {
                findings.push(`Moderate factual alignment (${(avgFactual * 100).toFixed(1)}%) - review needed`);
                recommendations.push('Focus on queries with higher factual consistency');
            }

            // Engine comparison insights
            if (engineStats.length > 1) {
                const bestEngine = engineStats[0];
                const worstEngine = engineStats[engineStats.length - 1];
                const diversityGap = parseFloat(bestEngine.avg_diversity) - parseFloat(worstEngine.avg_diversity);

                if (diversityGap > 0.2) {
                    findings.push(`Significant diversity gap between ${bestEngine.engine} and ${worstEngine.engine} (${(diversityGap * 100).toFixed(1)}%)`);
                    recommendations.push(`Investigate why ${worstEngine.engine} shows lower diversity`);
                }
            }

            // Data volume insights
            if (totalQueries < 10) {
                recommendations.push('Increase query sample size for more reliable insights');
            }

            if (totalResults / totalQueries < 15) {
                findings.push('Lower than expected results per query - possible collection issues');
            }
        }

        // Add category-specific insights
        if (categories.length === 1) {
            const category = categories[0];
            switch (category) {
                case 'health':
                    recommendations.push('Health queries often show higher bias - monitor factual alignment closely');
                    break;
                case 'politics':
                    recommendations.push('Political queries may have significant engine differences - compare carefully');
                    break;
                case 'technology':
                    recommendations.push('Tech queries typically show good diversity - investigate any anomalies');
                    break;
            }
        }

        const insights = {
            totalQueries: parseInt(stats?.total_queries || '0'),
            totalResults: parseInt(stats?.total_results || '0'),
            uniqueDomains: parseInt(stats?.unique_domains || '0'),
            avgDiversity: parseFloat(stats?.avg_diversity || '0'),
            avgFactual: parseFloat(stats?.avg_factual || '0'),
            engineStats: engineStats.map(e => ({
                engine: e.engine,
                avgDiversity: parseFloat(e.avg_diversity),
                avgFactual: parseFloat(e.avg_factual),
                totalResults: parseInt(e.total_results),
            })),
            findings,
            recommendations,
        };

        return NextResponse.json({
            success: true,
            data: insights,
        });

    } catch (error) {
        console.error('Error fetching quick insights:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch insights',
            },
            { status: 500 }
        );
    }
}