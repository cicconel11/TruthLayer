/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-case-declarations */
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createStorageClient } from "@truthlayer/storage";
import { MetricTypeEnum, DomainTypeEnum } from "@truthlayer/schema";

const DEFAULT_LIMIT = 150;

// Minimal logger interface used locally
interface Logger {
  info: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}

// Query parameters interface
interface ViewpointRequest {
  searchParams: {
    q?: string;
    query?: string;
    maxAlternatives?: string;
    analysis?: 'true' | 'false';
    format?: 'json' | 'csv';
  };
}

const METRIC_TYPES = MetricTypeEnum.options;

/**
 * GET /api/viewpoints
 * Analyze viewpoint diversity and suggest alternative sources for a search query
 * 
 * Query parameters:
 * - q or query: The search query to analyze
 * - maxAlternatives: Maximum number of alternative sources to return (default: 5)
 * - analysis: Include full analysis with reasoning (default: true)
 * - format: Response format - json or csv (default: json)
 * 
 * Example:
 * GET /api/viewpoints?q=climate+change&maxAlternatives=10&analysis=true&format=json
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  
  console.log('[VIEWPOINTS-DEBUG] API endpoint called');
  
  // Quick test response to verify the endpoint is working
  if (request.url.includes('test=true')) {
    return NextResponse.json({
      message: "API is working",
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const query = searchParams.get('q') ?? searchParams.get('query') ?? '';
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { 
          error: "Query parameter is required",
          usage: "GET /api/viewpoints?q=search-query"
        },
        { status: 400 }
      );
    }

    // Parse optional parameters
    const maxAlternatives = Math.min(
      Number.parseInt(searchParams.get('maxAlternatives') ?? '5', 10),
      20
    );

    const includeAnalysis = (searchParams.get('analysis') ?? 'true') !== 'false';
    const format = (searchParams.get('format') ?? 'json').toLowerCase();

    // Create logger instance
    const logger: Logger = {
      info: (message: string, context?: Record<string, unknown>) => {
        // eslint-disable-next-line no-console
        console.log(`[VIEWPOINTS-INFO] ${message}`, context);
      },
      error: (message: string, context?: Record<string, unknown>) => {
        // eslint-disable-next-line no-console
        console.error(`[VIEWPOINTS-ERROR] ${message}`, context);
      },
      warn: (message: string, context?: Record<string, unknown>) => {
        // eslint-disable-next-line no-console
        console.warn(`[VIEWPOINTS-WARN] ${message}`, context);
      },
      debug: (message: string, context?: Record<string, unknown>) => {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug(`[VIEWPOINTS-DEBUG] ${message}`, context);
        }
      }
    } as Logger;

    // Initialize storage client
    const storage = createStorageClient();

    logger.info("request received", {
      query,
      maxAlternatives,
      includeAnalysis,
      format,
      userAgent: request.headers.get('user-agent')
    });

    // Very lightweight analysis using stored annotated results as proxy
    const keywords = (query || '')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3)
      .slice(0, 6);

    // Try to read annotated results; fall back to pending search results if none
    type UnifiedItem = {
      normalizedUrl: string;
      domain: string;
      domainType: string;
      engine: string;
      rank: number;
      factualConsistency: string | null;
      title?: string;
      snippet?: string | null;
    };

    let annotated = [] as Awaited<ReturnType<typeof storage.fetchAnnotatedResults>>;
    try {
      annotated = await storage.fetchAnnotatedResults({});
    } catch (e) {
      logger.warn('annotated results unavailable; will try pending search results', { error: (e as Error).message });
      annotated = [];
    }

    let items: UnifiedItem[] = annotated.map(a => ({
      normalizedUrl: a.normalizedUrl,
      domain: a.domain,
      domainType: a.domainType,
      engine: a.engine,
      rank: a.rank,
      factualConsistency: a.factualConsistency,
      title: '',
      snippet: ''
    }));

    if (items.length === 0) {
      try {
        const pending = await storage.fetchPendingAnnotations({ limit: 200 });
        items = pending.map(p => ({
          normalizedUrl: p.normalizedUrl,
          domain: p.domain,
          domainType: 'other',
          engine: p.engine,
          rank: p.rank,
          factualConsistency: null,
          title: p.title,
          snippet: p.snippet ?? ''
        }));
      } catch (e) {
        logger.warn('pending search results unavailable; using empty dataset', { error: (e as Error).message });
      }
    }

    // Filter results that contain similar keywords to the query
    const queryKeywords = (query || '').toLowerCase().split(/\s+/).filter(w => w.length >= 3);
    let relevantResults: UnifiedItem[] = [];
    if (items.length > 0) {
      relevantResults = items.filter(result => {
        const searchText = `${result.title ?? ''} ${result.snippet ?? ''} ${result.domain} ${result.normalizedUrl}`.toLowerCase();
        return queryKeywords.some(keyword => keyword && searchText.includes(keyword));
      });
    }

    // If no relevant results found, use the most recent results as fallback
    const alternatives = (relevantResults.length > 0 ? relevantResults : items)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, Math.max(5, maxAlternatives));
    
    // Ensure we have diverse sources across engines - limit per engine
    const engineGroups: Record<string, any[]> = {};
    for (const alt of alternatives) {
      const engine = alt.engine || 'unknown';
      if (!engineGroups[engine]) engineGroups[engine] = [];
      if (engineGroups[engine].length < 2) { // Max 2 per engine
        engineGroups[engine].push(alt);
      }
    }
    
    // Flatten back to array, preserving diversity
    const diverseAlternatives = [];
    const maxPerEngine = Math.ceil(maxAlternatives / Object.keys(engineGroups).length) || 1;
    for (const engine of Object.keys(engineGroups)) {
      diverseAlternatives.push(...engineGroups[engine].slice(0, maxPerEngine));
    }
    
    // If we still need more, add from remaining pool
    const usedUrls = new Set(diverseAlternatives.map(a => a.normalizedUrl));
    const remaining = alternatives.filter(alt => !usedUrls.has(alt.normalizedUrl));
    diverseAlternatives.push(...remaining.slice(0, maxAlternatives - diverseAlternatives.length));

    // Compute simple domain distribution and diversity score
    const total = diverseAlternatives.length || 1;
    const domainTypes = Object.values(DomainTypeEnum.enum);
    const domainDistribution: Record<string, number> = Object.fromEntries(
      domainTypes.map((t) => [t, 0])
    );
    for (const res of diverseAlternatives || []) {
      domainDistribution[res.domainType] = (domainDistribution[res.domainType] || 0) + 1;
    }
    for (const key of Object.keys(domainDistribution)) {
      domainDistribution[key] = domainDistribution[key] / total;
    }

    // Weighted diversity score similar to metrics package
    const weights: Record<string, number> = {
      government: 1.5,
      academic: 1.3,
      news: 1.0,
      blog: 0.7,
      other: 0.5
    };
    let weighted = 0;
    for (const [type, pct] of Object.entries(domainDistribution)) {
      if (pct > 0) weighted += pct * (weights[type] ?? 0.5);
    }
    let diversityScore = Math.round(Math.max(0, Math.min(100, weighted * 100)));

    // Identify underrepresented types (simple thresholds)
    const thresholds: Record<string, number> = {
      government: 0.15,
      academic: 0.1,
      news: 0.4,
      blog: 0.2,
      other: 0.15
    };
    const underrepresentedTypes = Object.keys(thresholds)
      .filter((t) => (domainDistribution[t] || 0) < thresholds[t])
      .sort(
        (a, b) => thresholds[b] - (domainDistribution[b] || 0) - (thresholds[a] - (domainDistribution[a] || 0))
      );

    const analysis = {
      query: (query || '').trim(),
      diversityScore,
      domainDistribution,
      underrepresentedTypes,
      collectedAt: new Date().toISOString(),
      reasoning: [
        `Found ${diverseAlternatives.length} potential alternative sources`,
        `Underrepresented: ${underrepresentedTypes.join(', ') || 'none'}`
      ],
      alternativeSources: diverseAlternatives.map((a) => ({
        url: a.normalizedUrl,
        domain: a.domain,
        domainType: a.domainType,
        engine: a.engine,
        rank: a.rank,
        factualConsistency: a.factualConsistency,
        title: '',
        snippet: '',
        reasons: [] as string[]
      }))
    } as any;

    const processingTime = Date.now() - startTime;

    // Prepare response data
    let responseData: any;
    
    switch (format) {
      case 'csv': {
        // Flatten for CSV
        const header = 'query,url,title,domain,domain_type,factual_consistency,rank,engine,snippet,reasons';
        const rows = analysis.alternativeSources.map((source: any) => [
          `"${analysis.query}"`,
          `"${source.url}"`,
          `"${source.title ?? ''}"`,
          `"${source.domain}"`,
          source.domainType,
          source.factualConsistency,
          source.rank,
          source.engine,
          `"${source.snippet ?? ''}"`,
          `"${(source.reasons ?? []).join('; ')}"`
        ].join(','));

        return new Response([header, ...rows].join('\n'), {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="viewpoints-${encodeURIComponent(query || '')}.csv"`
          }
        });
      }

      case 'json':
      default: {
        const result = {
          query: analysis.query,
          diversityScore: analysis.diversityScore,
          domainDistribution: analysis.domainDistribution,
          underrepresentedTypes,
          alternatives: analysis.alternativeSources,
          reasoning: includeAnalysis ? analysis.reasoning : [],
          collectedAt: analysis.collectedAt,
          processingTime
        };

        return NextResponse.json(result, {
          status: 200,
          headers: {
            'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[VIEWPOINTS-ERROR] Request failed', { 
      error: (error as Error).message,
      stack: (error as Error).stack,
      processingTime,
      query
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to analyze viewpoints",
        processingTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

function getDiversityRating(score: number): string {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "moderate";
  if (score >= 20) return "low";
  return "very low";
}

// (no additional route exports allowed by Next.js)
