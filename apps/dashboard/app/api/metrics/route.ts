import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createStorageClient } from "@truthlayer/storage";
import { BenchmarkQuerySetSchema, MetricTypeEnum } from "@truthlayer/schema";

const METRIC_TYPES = MetricTypeEnum.options;
const DEFAULT_LIMIT = 150;

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

// Singleton storage client for DuckDB (doesn't support concurrent connections)
let storageClient: ReturnType<typeof createStorageClient> | null = null;

function getStorageClient() {
  if (!storageClient) {
    storageClient = createStorageClient();
  }
  return storageClient;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT;
  const metricFilter = searchParams.get("metric");
  const engineFilter = searchParams.get("engine") ?? undefined;
  const topicFilter = searchParams.get("topic") ?? undefined;
  const queryFilter = searchParams.get("queryId") ?? undefined;

  const storage = getStorageClient();
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
    const filteredEntries = Object.entries(queryMetadata).filter(([id, meta]) => {
      if (queryFilter && id !== queryFilter) return false;
      if (topicFilter && meta.topic !== topicFilter) return false;
      return true;
    });

    const filteredQueries: Record<string, QueryMeta> = Object.fromEntries(filteredEntries);

    for (const queryId of queriesFromMetrics) {
      if (!filteredQueries[queryId]) {
        filteredQueries[queryId] = {
          query: queryId,
          topic: "Unknown",
          tags: []
        };
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

    const response = {
      metrics: metricsByType,
      aggregates: aggregatesSerialised,
      queries: filteredQueries,
      queryIds: Array.from(queriesFromMetrics),
      engines: Array.from(new Set([...engines, ...(engineFilter ? [engineFilter] : [])])),
      runIds: runIdList,
      topics: Array.from(allTopics),
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("metrics api error", error);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
  // Note: Don't close storage - using singleton pattern for DuckDB
}
