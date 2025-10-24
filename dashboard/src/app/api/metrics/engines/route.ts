import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { EngineComparison } from '@/types/dashboard';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const dateRange = {
            start: searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date(),
        };
        const category = searchParams.get('category');

        let categoryFilter = '';
        const params: any[] = [dateRange.start, dateRange.end];

        if (category) {
            categoryFilter = 'AND q.category = $3';
            params.push(category);
        }

        // Get comprehensive engine comparison metrics
        const engineMetrics = await query<{
            engine: string;
            total_results: string;
            unique_domains: string;
            avg_rank: string;
            avg_factual_score: string;
            query_count: string;
        }>(`
      WITH engine_stats AS (
        SELECT 
          sr.engine,
          COUNT(*) as total_results,
          COUNT(DISTINCT REGEXP_REPLACE(sr.url, '^https?://([^/]+).*', '\\1')) as unique_domains,
          AVG(sr.rank) as avg_rank,
          AVG(COALESCE(a.factual_score, 0)) as avg_factual_score,
          COUNT(DISTINCT sr.query_id) as query_count
        FROM search_results sr
        LEFT JOIN annotations a ON sr.id = a.result_id
        LEFT JOIN queries q ON sr.query_id = q.id
        WHERE sr.collected_at >= $1 
          AND sr.collected_at <= $2
          ${categoryFilter}
        GROUP BY sr.engine
      )
      SELECT 
        engine,
        total_results::text,
        unique_domains::text,
        avg_rank::text,
        avg_factual_score::text,
        query_count::text
      FROM engine_stats
      ORDER BY engine
    `, params);

        // Calculate engine overlap for each engine pair
        const overlapData = await query<{
            engine: string;
            overlap_coefficient: string;
        }>(`
      WITH engine_urls AS (
        SELECT 
          sr.engine,
          sr.query_id,
          sr.url,
          COUNT(*) OVER (PARTITION BY sr.query_id, sr.url) as url_frequency
        FROM search_results sr
        LEFT JOIN queries q ON sr.query_id = q.id
        WHERE sr.collected_at >= $1 
          AND sr.collected_at <= $2
          ${categoryFilter}
      ),
      engine_overlap AS (
        SELECT 
          engine,
          COUNT(*) as total_urls,
          SUM(CASE WHEN url_frequency > 1 THEN 1 ELSE 0 END) as shared_urls
        FROM engine_urls
        GROUP BY engine
      )
      SELECT 
        engine,
        CASE 
          WHEN total_urls > 0 THEN (shared_urls::float / total_urls)::text
          ELSE '0'
        END as overlap_coefficient
      FROM engine_overlap
      ORDER BY engine
    `, params);

        // Combine the data
        const engineComparisons: EngineComparison[] = engineMetrics.map(metric => {
            const overlap = overlapData.find(o => o.engine === metric.engine);
            const totalResults = parseInt(metric.total_results);
            const uniqueDomains = parseInt(metric.unique_domains);

            return {
                engine: metric.engine,
                domainDiversity: totalResults > 0 ? uniqueDomains / totalResults : 0,
                engineOverlap: overlap ? parseFloat(overlap.overlap_coefficient) : 0,
                factualAlignment: parseFloat(metric.avg_factual_score),
                totalResults: totalResults,
                uniqueDomains: uniqueDomains,
                averageRank: parseFloat(metric.avg_rank),
            };
        });

        return NextResponse.json({
            success: true,
            data: engineComparisons,
        });

    } catch (error) {
        console.error('Error fetching engine comparison:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch engine comparison data',
            },
            { status: 500 }
        );
    }
}