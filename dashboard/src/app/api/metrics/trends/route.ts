import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { MetricsTrend } from '@/types/dashboard';
import { format, subDays, eachDayOfInterval } from 'date-fns';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const days = parseInt(searchParams.get('days') || '30');
        const engines = searchParams.get('engines')?.split(',') || ['google', 'bing', 'perplexity', 'brave'];

        const endDate = new Date();
        const startDate = subDays(endDate, days);

        // Generate all dates in the range
        const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

        // Get daily metrics for each engine
        const metricsData = await query<{
            date: string;
            engine: string;
            domain_diversity: string;
            engine_overlap: string;
            factual_alignment: string;
        }>(`
      WITH daily_metrics AS (
        SELECT 
          DATE(sr.collected_at) as date,
          sr.engine,
          sr.query_id,
          COUNT(DISTINCT REGEXP_REPLACE(sr.url, '^https?://([^/]+).*', '\\1')) as unique_domains,
          COUNT(*) as total_results,
          AVG(COALESCE(a.factual_score, 0)) as avg_factual_score
        FROM search_results sr
        LEFT JOIN annotations a ON sr.id = a.result_id
        WHERE sr.collected_at >= $1 
          AND sr.collected_at <= $2
          AND sr.engine = ANY($3)
        GROUP BY DATE(sr.collected_at), sr.engine, sr.query_id
      ),
      daily_aggregated AS (
        SELECT 
          date,
          engine,
          AVG(unique_domains::float / GREATEST(total_results, 1)) as domain_diversity,
          AVG(avg_factual_score) as factual_alignment
        FROM daily_metrics
        GROUP BY date, engine
      ),
      daily_overlap AS (
        SELECT 
          DATE(sr.collected_at) as date,
          sr.query_id,
          COUNT(DISTINCT sr.url) as total_unique_urls,
          SUM(CASE WHEN url_count.engine_count > 1 THEN 1 ELSE 0 END) as shared_urls
        FROM search_results sr
        JOIN (
          SELECT 
            url, 
            query_id,
            COUNT(DISTINCT engine) as engine_count
          FROM search_results
          WHERE collected_at >= $1 AND collected_at <= $2
          GROUP BY url, query_id
        ) url_count ON sr.url = url_count.url AND sr.query_id = url_count.query_id
        WHERE sr.collected_at >= $1 
          AND sr.collected_at <= $2
          AND sr.engine = ANY($3)
        GROUP BY DATE(sr.collected_at), sr.query_id
      ),
      daily_overlap_avg AS (
        SELECT 
          date,
          AVG(shared_urls::float / GREATEST(total_unique_urls, 1)) as engine_overlap
        FROM daily_overlap
        GROUP BY date
      )
      SELECT 
        da.date::text,
        da.engine,
        COALESCE(da.domain_diversity, 0)::text as domain_diversity,
        COALESCE(doa.engine_overlap, 0)::text as engine_overlap,
        COALESCE(da.factual_alignment, 0)::text as factual_alignment
      FROM daily_aggregated da
      LEFT JOIN daily_overlap_avg doa ON da.date = doa.date
      ORDER BY da.date, da.engine
    `, [startDate, endDate, engines]);

        // Create a complete dataset with all dates and engines
        const trends: MetricsTrend[] = [];

        for (const date of dateRange) {
            const dateStr = format(date, 'yyyy-MM-dd');

            for (const engine of engines) {
                const existingData = metricsData.find(
                    row => row.date === dateStr && row.engine === engine
                );

                trends.push({
                    date: dateStr,
                    engine,
                    domainDiversity: existingData ? parseFloat(existingData.domain_diversity) : 0,
                    engineOverlap: existingData ? parseFloat(existingData.engine_overlap) : 0,
                    factualAlignment: existingData ? parseFloat(existingData.factual_alignment) : 0,
                });
            }
        }

        return NextResponse.json({
            success: true,
            data: trends,
        });

    } catch (error) {
        console.error('Error fetching metrics trends:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch metrics trends',
            },
            { status: 500 }
        );
    }
}