/**
 * Query Comparison API Endpoint
 * 
 * Exposes search results and bias metrics for a specific query + runId combination.
 * This is a read-only endpoint that surfaces data already collected in scheduled runs.
 * 
 * TODO - Production Hardening:
 * - Add rate limiting (express-rate-limit or similar)
 * - Add query sanitization for PII/sensitive data
 * - Add response caching (Redis or in-memory LRU cache)
 * - Add authentication middleware
 * 
 * @see packages/schema/src/queryInsight.ts for response contract
 */

import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createStorageClient } from "@truthlayer/storage";
import type { QueryInsightResponse } from "@truthlayer/schema";
import { getLatestRunForQuery } from "../../../lib/getLatestRunForQuery";
import path from "node:path";
import { promises as fs } from "node:fs";

// Singleton pattern for DuckDB (doesn't support concurrent connections)
let storageClient: ReturnType<typeof createStorageClient> | null = null;

function getStorageClient() {
  if (!storageClient) {
    storageClient = createStorageClient();
  }
  return storageClient;
}

function resetStorageClient() {
  storageClient = null;
}

/**
 * Load benchmark queries to map query strings to queryIds
 */
async function loadBenchmarkQueries(): Promise<Array<{ id: string; query: string; topic: string }>> {
  const possiblePaths = [
    path.resolve(process.cwd(), "config/benchmark-queries.json"),
    path.resolve(process.cwd(), "../../config/benchmark-queries.json")
  ];

  for (const filePath of possiblePaths) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[query-insight] Failed to load benchmark queries", error);
      }
    }
  }

  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const queryId = searchParams.get("queryId"); 
  const runId = searchParams.get("runId");

  if (!query && !queryId) {
    return NextResponse.json(
      { error: "Missing required parameter: query or queryId" },
      { status: 400 }
    );
  }

  let storage = getStorageClient();

  try {
    // Step 1: Resolve queryId from query string if needed
    let resolvedQueryId = queryId;
    let resolvedQuery = query;

    if (!resolvedQueryId && query) {
      // TODO: Implement query->queryId lookup from benchmark queries
      const benchmarkQueries = await loadBenchmarkQueries();
      const match = benchmarkQueries.find(q => q.query === query);
      if (match) {
        resolvedQueryId = match.id;
        resolvedQuery = match.query;
      } else {
        return NextResponse.json(
          { error: "Query not found in benchmark queries" },
          { status: 404 }
        );
      }
    } else if (resolvedQueryId && !query) {
      // Lookup query text from queryId
      const benchmarkQueries = await loadBenchmarkQueries();
      const match = benchmarkQueries.find(q => q.id === queryId);
      if (match) {
        resolvedQuery = match.query;
      }
    }

    if (!resolvedQueryId) {
      return NextResponse.json(
        { error: "Could not resolve queryId" },
        { status: 400 }
      );
    }

    // Step 2: Resolve runId if not provided
    let resolvedRunId = runId;
    let timestamp = new Date();
    
    if (!resolvedRunId) {
      const latest = await getLatestRunForQuery(resolvedQueryId);
      if (!latest) {
        return NextResponse.json(
          { error: "No runs found for this query" },
          { status: 404 }
        );
      }
      resolvedRunId = latest.runId;
      timestamp = latest.timestamp;
    }

    // Step 3: Fetch search results for (queryId, runId) across all engines
    // TODO: Query search_results table WHERE query_id = ? AND crawl_run_id = ?
    // TODO: JOIN with annotations table to get domainType, factualConsistency, confidence
    // 
    // Example SQL (DuckDB):
    // SELECT 
    //   sr.engine,
    //   sr.rank,
    //   sr.title,
    //   sr.url,
    //   sr.snippet,
    //   sr.domain,
    //   sr.timestamp,
    //   a.domain_type,
    //   a.factual_consistency,
    //   a.confidence
    // FROM search_results sr
    // LEFT JOIN annotations a ON sr.id = a.search_result_id
    // WHERE sr.query_id = ? AND sr.crawl_run_id = ?
    // ORDER BY sr.engine, sr.rank
    
    const rawResults: any[] = []; // stub - will be replaced with actual query
    
    // Step 4: Group by engine
    const engineGroups: Record<string, any[]> = {};
    for (const result of rawResults) {
      if (!engineGroups[result.engine]) {
        engineGroups[result.engine] = [];
      }
      engineGroups[result.engine].push({
        rank: result.rank,
        title: result.title,
        url: result.url,
        snippet: result.snippet || "",
        domain: result.domain,
        domainType: result.domainType || "other",
        factualScore: result.factualConsistency || null,
        confidence: result.confidence || null
      });
    }

    // Step 5: Fetch aggregate metrics for (queryId, runId)
    // TODO: Query metrics table WHERE query_id = ? AND crawl_run_id = ?
    // We need to fetch all metric types and both aggregate (engine=null) and per-engine metrics
    
    const metricsRecords = await storage.fetchRecentMetricRecords("domain_diversity", 100);
    const relevantMetrics = metricsRecords.filter(
      m => m.queryId === resolvedQueryId && m.crawlRunId === resolvedRunId
    );

    const metrics: QueryInsightResponse["metrics"] = {
      aggregate: {
        overlap: 0,
        domainDiversity: 0,
        factualAlignment: 0
      },
      perEngine: {}
    };

    // TODO: Parse metrics records and populate aggregate + perEngine
    // Aggregate metrics have engine=null
    // Per-engine metrics have engine='google', 'brave', etc.
    for (const metric of relevantMetrics) {
      if (metric.engine === null) {
        // Aggregate metric
        if (metric.metricType === "domain_diversity") {
          metrics.aggregate.domainDiversity = metric.value;
        } else if (metric.metricType === "engine_overlap") {
          metrics.aggregate.overlap = metric.value;
        } else if (metric.metricType === "factual_alignment") {
          metrics.aggregate.factualAlignment = metric.value;
        }
      } else {
        // Per-engine metric
        if (!metrics.perEngine[metric.engine]) {
          metrics.perEngine[metric.engine] = {};
        }
        if (metric.metricType === "domain_diversity") {
          metrics.perEngine[metric.engine].domainDiversity = metric.value;
        } else if (metric.metricType === "factual_alignment") {
          metrics.perEngine[metric.engine].factualAlignment = metric.value;
        }
      }
    }
    
    // Step 6: Log warnings for missing engines
    const enginesPresent = Object.keys(engineGroups);
    const expectedEngines = ["google", "brave", "duckduckgo", "perplexity"];
    for (const engine of expectedEngines) {
      if (!enginesPresent.includes(engine)) {
        console.warn(
          `[query-insight] missing data for engine=${engine} runId=${resolvedRunId} query="${resolvedQuery}" (skipped due to missing API key or collection failure)`
        );
      }
    }

    const response: QueryInsightResponse = {
      query: resolvedQuery || "",
      queryId: resolvedQueryId,
      runId: resolvedRunId,
      timestamp: timestamp.toISOString(),
      engines: engineGroups,
      metrics,
      enginesPresent
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[query-insight] API error", error);
    
    // If DuckDB connection closed, reset singleton
    if (error && typeof error === 'object' && 'code' in error && error.code === 'DUCKDB_NODEJS_ERROR') {
      console.warn("[query-insight] DuckDB connection closed, resetting singleton");
      resetStorageClient();
      return NextResponse.json({ 
        error: "Connection recovered, please refresh the page" 
      }, { status: 503 });
    }
    
    return NextResponse.json(
      { error: "Failed to fetch query insights" },
      { status: 500 }
    );
  }
  // Note: Don't close storage - using singleton pattern for DuckDB
}
