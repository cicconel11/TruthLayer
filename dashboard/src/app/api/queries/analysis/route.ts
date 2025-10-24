import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { QueryAnalysis, EngineComparison } from '@/types/dashboard';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const dateRange = {
            start: searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date(),
        };

        const engines = searchParams.get('engines')?.split(',') || ['google', 'bing', 'perplexity', 'brave'];
        const categories = searchParams.get('categories')?.split(',') || [];
        const queryText = searchParams.get('queryText');
        const sortBy = searchParams.get('sortBy') || 'date';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        // Build dynamic filters
        let categoryFilter = '';
        let queryTextFilter = '';
        const params: any[] = [dateRange.start, dateRange.end, engines];
        let paramIndex = 4;

        if (categories.length > 0) {
            categoryFilter = `AND q.category = ANY($${paramIndex})`;
            params.push(categories);
            paramIndex++;
        }

        if (queryText && queryText.trim()) {
            queryTextFilter = `AND q.text ILIKE $${paramIndex}`;
            params.push(`%${queryText.trim()}%`);
            paramIndex++;
        }

        // Get queries with their basic info
        const queriesData = await query<{
            query_id: string;
            query_text: string;
            category: string;
            collected_at: string;
            total_results: string;
        }>(`
            SELECT DISTINCT
                q.id as query_id,
                q.text as query_text,
                q.category,
                MAX(sr.collected_at) as collected_at,
                COUNT(sr.id) as total_results
            FROM queries q
            JOIN search_results sr ON q.id = sr.query_id
            WHERE sr.collected_at >= $1 
                AND sr.collected_at <= $2
                AND sr.engine = ANY($3)
                ${categoryFilter}
                ${queryTextFilter}
            GROUP BY q.id, q.text, q.category
            ORDER BY 
                CASE WHEN $${paramIndex} = 'date' THEN MAX(sr.collected_at) END ${sortOrder === 'desc' ? 'DESC' : 'ASC'},
                CASE WHEN $${paramIndex} = 'results' THEN COUNT(sr.id) END ${sortOrder === 'desc' ? 'DESC' : 'ASC'},
                CASE WHEN $${paramIndex} = 'diversity' THEN 
                    AVG(CASE 
                        WHEN sr.engine = ANY($3) THEN 
                            (SELECT COUNT(DISTINCT REGEXP_REPLACE(sr2.url, '^https?://([^/]+).*', '\\1'))::float / COUNT(sr2.id)
                             FROM search_results sr2 
                             WHERE sr2.query_id = q.id AND sr2.engine = sr.engine)
                        ELSE 0 
                    END)
                END ${sortOrder === 'desc' ? 'DESC' : 'ASC'}
            LIMIT 50
        `, [...params, sortBy]);

        // Get detailed engine metrics for each query
        const queryAnalyses: QueryAnalysis[] = [];

        for (const queryData of queriesData) {
            // Get engine-specific metrics for this query
            const engineMetrics = await query<{
                engine: string;
                total_results: string;
                unique_domains: string;
                avg_rank: string;
                avg_factual_score: string;
                engine_overlap: string;
            }>(`
                WITH query_engine_stats AS (
                    SELECT 
                        sr.engine,
                        COUNT(*) as total_results,
                        COUNT(DISTINCT REGEXP_REPLACE(sr.url, '^https?://([^/]+).*', '\\1')) as unique_domains,
                        AVG(sr.rank) as avg_rank,
                        AVG(COALESCE(a.factual_score, 0)) as avg_factual_score
                    FROM search_results sr
                    LEFT JOIN annotations a ON sr.id = a.result_id
                    WHERE sr.query_id = $1 
                        AND sr.engine = ANY($2)
                        AND sr.collected_at >= $3 
                        AND sr.collected_at <= $4
                    GROUP BY sr.engine
                ),
                query_overlap AS (
                    SELECT 
                        sr.engine,
                        COUNT(*) as total_urls,
                        SUM(CASE WHEN url_counts.engine_count > 1 THEN 1 ELSE 0 END) as shared_urls
                    FROM search_results sr
                    JOIN (
                        SELECT 
                            url,
                            COUNT(DISTINCT engine) as engine_count
                        FROM search_results
                        WHERE query_id = $1 AND engine = ANY($2)
                        GROUP BY url
                    ) url_counts ON sr.url = url_counts.url
                    WHERE sr.query_id = $1 AND sr.engine = ANY($2)
                    GROUP BY sr.engine
                )
                SELECT 
                    qes.engine,
                    qes.total_results::text,
                    qes.unique_domains::text,
                    qes.avg_rank::text,
                    qes.avg_factual_score::text,
                    CASE 
                        WHEN qo.total_urls > 0 THEN (qo.shared_urls::float / qo.total_urls)::text
                        ELSE '0'
                    END as engine_overlap
                FROM query_engine_stats qes
                LEFT JOIN query_overlap qo ON qes.engine = qo.engine
                ORDER BY qes.engine
            `, [queryData.query_id, engines, dateRange.start, dateRange.end]);

            const engineComparisons: EngineComparison[] = engineMetrics.map(metric => {
                const totalResults = parseInt(metric.total_results);
                const uniqueDomains = parseInt(metric.unique_domains);

                return {
                    engine: metric.engine,
                    domainDiversity: totalResults > 0 ? uniqueDomains / totalResults : 0,
                    engineOverlap: parseFloat(metric.engine_overlap),
                    factualAlignment: parseFloat(metric.avg_factual_score),
                    totalResults: totalResults,
                    uniqueDomains: uniqueDomains,
                    averageRank: parseFloat(metric.avg_rank),
                };
            });

            queryAnalyses.push({
                queryId: queryData.query_id,
                queryText: queryData.query_text,
                category: queryData.category,
                engines: engineComparisons,
                collectedAt: new Date(queryData.collected_at),
                totalResults: parseInt(queryData.total_results),
            });
        }

        return NextResponse.json({
            success: true,
            data: queryAnalyses,
        });

    } catch (error) {
        console.error('Error fetching query analysis:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch query analysis',
            },
            { status: 500 }
        );
    }
}