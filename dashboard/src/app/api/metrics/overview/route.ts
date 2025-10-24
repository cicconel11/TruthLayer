import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { MetricsOverview } from '@/types/dashboard';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const dateRange = {
            start: searchParams.get('start') ? new Date(searchParams.get('start')!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: searchParams.get('end') ? new Date(searchParams.get('end')!) : new Date(),
        };

        // Get total counts
        const [totalQueries] = await query<{ count: string }>(`
      SELECT COUNT(*) as count 
      FROM queries 
      WHERE created_at >= $1 AND created_at <= $2
    `, [dateRange.start, dateRange.end]);

        const [totalResults] = await query<{ count: string }>(`
      SELECT COUNT(*) as count 
      FROM search_results 
      WHERE collected_at >= $1 AND collected_at <= $2
    `, [dateRange.start, dateRange.end]);

        const [totalAnnotations] = await query<{ count: string }>(`
      SELECT COUNT(*) as count 
      FROM annotations 
      WHERE annotated_at >= $1 AND annotated_at <= $2
    `, [dateRange.start, dateRange.end]);

        // Calculate bias metrics
        const domainDiversityResults = await query<{
            query_id: string;
            engine: string;
            unique_domains: string;
            total_results: string;
        }>(`
      SELECT 
        sr.query_id,
        sr.engine,
        COUNT(DISTINCT REGEXP_REPLACE(sr.url, '^https?://([^/]+).*', '\\1')) as unique_domains,
        COUNT(*) as total_results
      FROM search_results sr
      WHERE sr.collected_at >= $1 AND sr.collected_at <= $2
      GROUP BY sr.query_id, sr.engine
    `, [dateRange.start, dateRange.end]);

        const avgDomainDiversity = domainDiversityResults.length > 0
            ? domainDiversityResults.reduce((sum, row) =>
                sum + (parseInt(row.unique_domains) / parseInt(row.total_results)), 0
            ) / domainDiversityResults.length
            : 0;

        // Calculate engine overlap
        const engineOverlapResults = await query<{
            query_id: string;
            shared_urls: string;
            total_unique_urls: string;
        }>(`
      WITH query_engine_urls AS (
        SELECT 
          sr.query_id,
          sr.url,
          COUNT(DISTINCT sr.engine) as engine_count,
          COUNT(*) as total_engines
        FROM search_results sr
        WHERE sr.collected_at >= $1 AND sr.collected_at <= $2
        GROUP BY sr.query_id, sr.url
      ),
      query_stats AS (
        SELECT 
          query_id,
          COUNT(*) as total_unique_urls,
          SUM(CASE WHEN engine_count > 1 THEN 1 ELSE 0 END) as shared_urls
        FROM query_engine_urls
        GROUP BY query_id
      )
      SELECT 
        query_id,
        shared_urls::text,
        total_unique_urls::text
      FROM query_stats
      WHERE total_unique_urls > 0
    `, [dateRange.start, dateRange.end]);

        const avgEngineOverlap = engineOverlapResults.length > 0
            ? engineOverlapResults.reduce((sum, row) =>
                sum + (parseInt(row.shared_urls) / parseInt(row.total_unique_urls)), 0
            ) / engineOverlapResults.length
            : 0;

        // Calculate factual alignment
        const [factualAlignmentResult] = await query<{ avg_score: string }>(`
      SELECT AVG(a.factual_score) as avg_score
      FROM annotations a
      JOIN search_results sr ON a.result_id = sr.id
      WHERE sr.collected_at >= $1 AND sr.collected_at <= $2
      AND a.factual_score IS NOT NULL
    `, [dateRange.start, dateRange.end]);

        const avgFactualAlignment = factualAlignmentResult?.avg_score
            ? parseFloat(factualAlignmentResult.avg_score)
            : 0;

        // Get last updated timestamp
        const [lastUpdatedResult] = await query<{ last_updated: Date }>(`
      SELECT MAX(collected_at) as last_updated
      FROM search_results
    `);

        const overview: MetricsOverview = {
            totalQueries: parseInt(totalQueries.count),
            totalResults: parseInt(totalResults.count),
            totalAnnotations: parseInt(totalAnnotations.count),
            averageDomainDiversity: avgDomainDiversity,
            averageEngineOverlap: avgEngineOverlap,
            averageFactualAlignment: avgFactualAlignment,
            lastUpdated: lastUpdatedResult?.last_updated || new Date(),
        };

        return NextResponse.json({
            success: true,
            data: overview,
        });

    } catch (error) {
        console.error('Error fetching metrics overview:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch metrics overview',
            },
            { status: 500 }
        );
    }
}