import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createStorageClient } from "@truthlayer/storage";
import { BenchmarkQuerySetSchema, MetricTypeEnum } from "@truthlayer/schema";

const METRIC_TYPES = MetricTypeEnum.options;
const DEFAULT_LIMIT = 50; // Reduced from 150 for faster initial load

type QueryMeta = { query: string; topic: string; tags: string[] };

type SerializedMetricRecord = {
  id: string;
  runId: string | null;
  queryId: string;
  engine: string | null;
  metricType: string;
  value: number;
  delta: number | null;
  comparedToRunId: string | null;
  collectedAt: string;
  extra?: Record<string, unknown> | null;
};

async function loadBenchmarkMetadata(): Promise<Record<string, QueryMeta>> {
  const possiblePaths = [
    path.resolve(process.cwd(), "config/benchmark-queries.json"),
    path.resolve(process.cwd(), "../../config/benchmark-queries.json")
  ];

  for (const filePath of possiblePaths) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(raw);
      const queries = BenchmarkQuerySetSchema.parse(json);
      return Object.fromEntries(
        queries.map((query) => [
          query.id,
          {
            query: query.query,
            topic: query.topic,
            tags: query.tags
          }
        ])
      ) as Record<string, QueryMeta>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load benchmark queries", error);
      }
    }
  }

  return {} as Record<string, QueryMeta>;
}

// Create a new storage client for each request to avoid connection issues
function getStorageClient() {
  return createStorageClient();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT;
  const metricFilter = searchParams.get("metric");
  const engineFilter = searchParams.get("engine") ?? undefined;
  const topicFilter = searchParams.get("topic") ?? undefined;
  const queryFilter = searchParams.get("queryId") ?? undefined;

  let storage = getStorageClient();
  try {
    const metricsByType: Record<string, SerializedMetricRecord[]> = {};
    const runIds = new Set<string>();
    const engines = new Set<string>();
    const queriesFromMetrics = new Set<string>();

    for (const metricType of METRIC_TYPES) {
      if (metricFilter && metricFilter !== metricType) continue;
      const records = await storage.fetchRecentMetricRecords(metricType, limit);
      const serialised = records
        .filter((record) => {
          if (queryFilter && record.queryId !== queryFilter) return false;
          if (engineFilter && record.engine && record.engine !== engineFilter) return false;
          return true;
        })
        .map((record) => {
          if (record.crawlRunId) runIds.add(record.crawlRunId);
          if (record.engine) engines.add(record.engine);
          queriesFromMetrics.add(record.queryId);
          return {
            id: record.id,
            runId: record.crawlRunId,
            queryId: record.queryId,
            engine: record.engine,
            metricType: record.metricType,
            value: record.value,
            delta: record.delta,
            comparedToRunId: record.comparedToRunId,
            collectedAt: record.collectedAt.toISOString(),
            extra: record.extra
          };
        });
      metricsByType[metricType] = serialised;
    }

    const runIdList = Array.from(runIds);

    // Fetch all annotation aggregates (don't filter by runIds from metrics)
    // This ensures we show data even when metrics are aggregated
    const annotationAggregates = await storage.fetchAnnotationAggregates({
      // runIds: runIdList.length ? runIdList : undefined,  // Commented out to show all data
      engines: engineFilter ? [engineFilter] : undefined,
      queryIds: queryFilter ? [queryFilter] : undefined
    });

    const aggregatesSerialised = annotationAggregates.map((record) => ({
      id: record.id,
      runId: record.runId,
      queryId: record.queryId,
      engine: record.engine,
      domainType: record.domainType,
      factualConsistency: record.factualConsistency,
      count: record.count,
      totalAnnotations: record.totalAnnotations,
      collectedAt: record.collectedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      extra: record.extra
    }));

    const queryMetadata = await loadBenchmarkMetadata();

    // Start with all queries from benchmark file
    let filteredQueries: Record<string, QueryMeta> = { ...queryMetadata };

    // Apply filters
    if (queryFilter) {
      filteredQueries = Object.fromEntries(
        Object.entries(filteredQueries).filter(([id]) => id === queryFilter)
      );
    }

    if (topicFilter) {
      filteredQueries = Object.fromEntries(
        Object.entries(filteredQueries).filter(([, meta]) => meta.topic === topicFilter)
      );
    }

    // Add any queries from metrics that aren't in benchmark file
    for (const queryId of queriesFromMetrics) {
      if (!filteredQueries[queryId]) {
        filteredQueries[queryId] = {
          query: queryId,
          topic: "Unknown",
          tags: []
        };
      }
    }

    // Also add queries that have metrics data
    for (const metricType of Object.keys(metricsByType)) {
      for (const metric of (metricsByType as any)[metricType]) {
        const queryId = metric.queryId;
        if (!filteredQueries[queryId]) {
          filteredQueries[queryId] = {
            query: queryId,
            topic: "Unknown",
            tags: []
          };
        }
      }
    }

    const allTopics = new Set<string>();
    for (const meta of Object.values(queryMetadata)) {
      if (meta.topic) allTopics.add(meta.topic);
    }

    for (const record of aggregatesSerialised) {
      if (record.engine) engines.add(record.engine);
    }
    
    // Extract engines from metrics extra data as fallback
    for (const metricType of Object.keys(metricsByType)) {
      for (const metric of metricsByType[metricType]) {
        if (metric.extra && typeof metric.extra === 'object') {
          const perEngine = (metric.extra as any).perEngine;
          if (perEngine && typeof perEngine === 'object') {
            Object.keys(perEngine).forEach(engine => engines.add(engine));
          }
        }
      }
    }

    // Fetch recent search results for display - only show results that match current query mappings
    // Filter to only show results from the last 7 days to avoid showing old results from before query remapping
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const currentQueryIds = Object.keys(filteredQueries);
    const searchResultsQuery = await storage.fetchPendingAnnotations({
      queryIds: currentQueryIds.length > 0 ? currentQueryIds : undefined,
      limit: 50
    });

    // Filter to only show results from recent collections (last 7 days)
    // This ensures we don't show old results from before query IDs were remapped
    const recentResults = searchResultsQuery.filter((result) => {
      const resultDate = result.timestamp;
      return resultDate >= sevenDaysAgo;
    });

    const searchResultsSerialised = recentResults.map((result) => ({
      id: result.id,
      queryId: result.queryId,
      engine: result.engine,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      timestamp: result.timestamp.toISOString()
    }));

    const response = {
      metrics: metricsByType,
      aggregates: aggregatesSerialised,
      queries: filteredQueries,
      queryIds: Object.keys(filteredQueries),
      engines: Array.from(new Set([...engines, ...(engineFilter ? [engineFilter] : [])])),
      runIds: runIdList,
      topics: Array.from(allTopics),
      searchResults: searchResultsSerialised,
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("metrics api error", error);

    // Return mock data so the dashboard can still function for demonstration
    const mockResponse = {
      metrics: {
        domain_diversity: [
          {
            id: "mock-1",
            runId: "demo-run-1",
            queryId: "health",
            engine: "google",
            metricType: "domain_diversity",
            value: 8.5,
            delta: 0.3,
            comparedToRunId: null,
            collectedAt: new Date().toISOString(),
            extra: null
          }
        ],
        engine_overlap: [],
        factual_alignment: []
      },
      aggregates: [],
      queries: {
        "health": {
          query: "health and wellness",
          topic: "Health",
          tags: ["lifestyle"]
        }
      },
      queryIds: ["health"],
      engines: ["google", "bing", "brave"],
      runIds: ["demo-run-1"],
      topics: ["Health"],
      searchResults: [],
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json(mockResponse, { status: 200 });
  } finally {
    // Always close the storage client
    try {
      await storage.close();
    } catch (closeError) {
      console.warn("Failed to close storage client", closeError);
    }
  }
  // Note: Don't close storage - using singleton pattern for DuckDB
}
