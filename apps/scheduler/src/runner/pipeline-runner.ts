import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import pRetry from "p-retry";
import { createCollectorApp } from "@truthlayer/collector";
import { createAnnotationApp } from "@truthlayer/annotation";
import { createMetricsApp } from "@truthlayer/metrics";
import { BenchmarkQuerySetSchema, MetricTypeEnum, DatasetTypeEnum, PipelineRunStatusEnum, PipelineStageEnum } from "@truthlayer/schema";
import {
  createStorageClient,
  SearchResultInput,
  CrawlRunRecordInput,
  DatasetExportResult,
  StorageClient,
  PipelineRunRecordInput,
  PipelineStageLogInput,
  AuditSampleRecordInput
} from "@truthlayer/storage";
import { SchedulerConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { sanitizeLogMeta } from "../lib/sanitize";

export interface PipelineRunner {
  runOnce: () => Promise<void>;
  isRunning: () => boolean;
}

interface CreatePipelineRunnerOptions {
  config: SchedulerConfig;
  logger: Logger;
}

interface CollectorIngestionSummary {
  ingestedResults: number;
  runs: number;
  hashDuplicateCount: number;
  urlDuplicateCount: number;
}

interface AuditSummary {
  totalAnnotated: number;
  sampled: number;
}

async function readJsonFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as unknown;
}

async function listCollectorJsonFiles(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(directory, entry.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function verifyCollectorOutput(directory: string, logger: Logger) {
  try {
    const jsonFiles = await listCollectorJsonFiles(directory);

    if (!jsonFiles.length) {
      logger.warn("collector verification", sanitizeLogMeta({ message: "no JSON output files detected", directory }));
      return;
    }

    for (const file of jsonFiles) {
      try {
        const data = await readJsonFile(file);
        if (!Array.isArray(data)) {
          logger.warn("collector verification", sanitizeLogMeta({ file, issue: "output is not an array" }));
          continue;
        }

        for (const item of data) {
          if (!item || typeof item !== "object") {
            logger.warn("collector verification", sanitizeLogMeta({ file, issue: "invalid result item" }));
            break;
          }
          const required = ["id", "url", "engine", "queryId"] as const;
          const missing = required.filter((key) => !(key in item));
          if (missing.length) {
            logger.warn("collector verification", sanitizeLogMeta({ file, issue: "missing fields", missing }));
            break;
          }
        }
      } catch (error) {
        logger.warn("collector verification", sanitizeLogMeta({ file, issue: "failed to parse", error }));
      }
    }
  } catch (error) {
    logger.error("collector verification failed", sanitizeLogMeta({ error, directory }));
  }
}

async function ingestCollectorOutputs(
  directory: string,
  runId: string,
  collectorOutputDir: string,
  storage: StorageClient,
  logger: Logger
): Promise<CollectorIngestionSummary> {
  const jsonFiles = await listCollectorJsonFiles(directory);
  if (!jsonFiles.length) {
    logger.warn("collector ingestion", sanitizeLogMeta({ message: "no JSON output files to ingest", directory }));
    return {
      ingestedResults: 0,
      runs: 0,
      hashDuplicateCount: 0,
      urlDuplicateCount: 0
    };
  }

  const searchResults: SearchResultInput[] = [];
  const crawlRunMap = new Map<string, CrawlRunRecordInput>();
  const duplicateHashes = new Map<string, number>();
  const duplicateUrls = new Map<string, number>();

  try {
    for (const file of jsonFiles) {
      let payload: unknown;
      try {
        payload = await readJsonFile(file);
      } catch (error) {
        logger.warn("collector ingestion", sanitizeLogMeta({ file, issue: "failed to parse JSON", error }));
        continue;
      }

      if (!Array.isArray(payload)) {
        logger.warn("collector ingestion", sanitizeLogMeta({ file, issue: "unexpected payload shape" }));
        continue;
      }

      for (const item of payload) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;

        const queryId = typeof record.queryId === "string" ? record.queryId : undefined;
        const engine = typeof record.engine === "string" ? record.engine : undefined;
        const url = typeof record.url === "string" ? record.url : undefined;
        const title = typeof record.title === "string" && record.title.length ? record.title : url;
        if (!queryId || !engine || !url || !title) continue;

        const rank = typeof record.rank === "number" ? record.rank : Number.parseInt(String(record.rank ?? 0), 10) || 0;
        const snippet = typeof record.snippet === "string" ? record.snippet : undefined;
        const normalizedUrl = typeof record.normalizedUrl === "string" ? record.normalizedUrl : url;
        let domain: string;
        if (typeof record.domain === "string" && record.domain.length) {
          domain = record.domain;
        } else {
          try {
            domain = new URL(url).hostname;
          } catch {
            domain = url;
          }
        }
        const timestampValue = typeof record.timestamp === "string" ? record.timestamp : undefined;
        const timestamp = timestampValue ? new Date(timestampValue) : new Date();

        const crawlKey = `${queryId}|${engine}`;
        let crawlRun = crawlRunMap.get(crawlKey);
        if (!crawlRun) {
          const crawlRunId = typeof record.crawlRunId === "string" ? record.crawlRunId : randomUUID();
          crawlRun = {
            id: crawlRunId,
            batchId: runId,
            queryId,
            engine,
            status: "completed",
            startedAt: timestamp,
            completedAt: timestamp,
            error: null,
            resultCount: 0,
            createdAt: timestamp,
            updatedAt: timestamp
          } satisfies CrawlRunRecordInput;
          crawlRunMap.set(crawlKey, crawlRun);
        }
        crawlRun.resultCount += 1;
        crawlRun.updatedAt = new Date();
        crawlRun.completedAt = timestamp;

        const hashCandidate = typeof record.hash === "string" ? record.hash : null;
        const hash = hashCandidate && hashCandidate.length === 64
          ? hashCandidate
          : createHash("sha256")
              .update(`${url}|${title}|${snippet ?? ""}|${timestamp.toISOString()}`)
              .digest("hex");

        const hashKey = `${queryId}|${hash}`;
        duplicateHashes.set(hashKey, (duplicateHashes.get(hashKey) ?? 0) + 1);
        duplicateUrls.set(url, (duplicateUrls.get(url) ?? 0) + 1);

        const rawHtmlPath = typeof record.rawHtmlPath === "string" && record.rawHtmlPath.length
          ? record.rawHtmlPath
          : path.join(collectorOutputDir, "raw_html", `${engine}-${queryId}.html`);

        const createdAtValue = typeof record.createdAt === "string" ? new Date(record.createdAt) : timestamp;
        const updatedAtValue = typeof record.updatedAt === "string" ? new Date(record.updatedAt) : timestamp;

        const searchResult: SearchResultInput = {
          id: typeof record.id === "string" ? record.id : randomUUID(),
          crawlRunId: crawlRun.id,
          queryId,
          engine,
          rank,
          title: title ?? url,
          snippet,
          url,
          normalizedUrl,
          domain,
          timestamp,
          hash,
          rawHtmlPath,
          createdAt: createdAtValue,
          updatedAt: updatedAtValue
        };

        searchResults.push(searchResult);
      }
    }

    console.log(`[Scheduler] Collected ${searchResults.length} search results from ${jsonFiles.length} files`);
    console.log(`[Scheduler] Built ${crawlRunMap.size} crawl run records`);
    
    if (crawlRunMap.size) {
      // Deduplicate crawl runs by ID (multiple files may have same crawlRunId from previous runs)
      const crawlRuns = Array.from(crawlRunMap.values());
      const dedupCrawlMap = new Map<string, CrawlRunRecordInput>();
      crawlRuns.forEach(cr => dedupCrawlMap.set(cr.id, cr));
      const dedupedCrawlRuns = Array.from(dedupCrawlMap.values());
      
      if (dedupedCrawlRuns.length < crawlRuns.length) {
        console.log(`[Scheduler] Deduped crawl runs: ${crawlRuns.length} → ${dedupedCrawlRuns.length}`);
      }
      
      console.log(`[Scheduler] Calling recordCrawlRuns with ${dedupedCrawlRuns.length} records...`);
      try {
        await storage.recordCrawlRuns(dedupedCrawlRuns);
        console.log(`[Scheduler] recordCrawlRuns completed successfully`);
      } catch (err) {
        console.error(`[Scheduler] recordCrawlRuns FAILED:`, err);
        throw err;
      }
    }

    const hashDuplicates = Array.from(duplicateHashes.values()).filter((count) => count > 1).length;
    const urlDuplicates = Array.from(duplicateUrls.values()).filter((count) => count > 1).length;

    if (searchResults.length) {
      // Deduplicate at scheduler level before passing to storage
      // This prevents ON CONFLICT errors when multiple files contain the same (query_id, engine, url)
      const dedupMap = new Map<string, SearchResultInput>();
      searchResults.forEach(r => {
        const key = `${r.queryId}-${r.engine}-${r.url}`;
        dedupMap.set(key, r); // Keep last occurrence
      });
      
      const dedupedResults = Array.from(dedupMap.values());
      const duplicatesRemoved = searchResults.length - dedupedResults.length;
      
      console.log(`[Scheduler] Deduplicating search results: ${searchResults.length} → ${dedupedResults.length} (removed ${duplicatesRemoved})`);
      
      if (duplicatesRemoved > 0) {
        logger.info(
          "scheduler deduplication",
          sanitizeLogMeta({
            original: searchResults.length,
            deduped: dedupedResults.length,
            removed: duplicatesRemoved
          })
        );
      }
      
      try {
        await storage.insertSearchResults(dedupedResults);
        console.log(`[Scheduler] Successfully inserted ${dedupedResults.length} search results`);
      } catch (insertError) {
        console.error(`[Scheduler] insertSearchResults failed:`, insertError);
        throw insertError;
      }
      
      logger.info(
        "collector ingestion",
        sanitizeLogMeta({
          ingestedResults: dedupedResults.length,
          runs: crawlRunMap.size
        })
      );
      if (hashDuplicates) {
        logger.warn(
          "collector ingestion duplicates",
          sanitizeLogMeta({
            type: "hash",
            count: hashDuplicates
          })
        );
      }
      if (urlDuplicates) {
        logger.warn(
          "collector ingestion duplicates",
          sanitizeLogMeta({
            type: "url",
            count: urlDuplicates
          })
        );
      }

      return {
        ingestedResults: searchResults.length,
        runs: crawlRunMap.size,
        hashDuplicateCount: hashDuplicates,
        urlDuplicateCount: urlDuplicates
      };
    }

    logger.warn("collector ingestion", sanitizeLogMeta({ message: "no valid records extracted" }));
    return {
      ingestedResults: 0,
      runs: crawlRunMap.size,
      hashDuplicateCount: hashDuplicates,
      urlDuplicateCount: urlDuplicates
    };
  } catch (error) {
    logger.error("collector ingestion failed", sanitizeLogMeta({ error }));
    throw error;
  }
}

async function exportDatasets(
  runId: string,
  storage: StorageClient,
  logger: Logger
): Promise<DatasetExportResult[]> {
  const exports: DatasetExportResult[] = [];
  const outputDir = path.resolve("data/parquet");

  for (const datasetType of [
    DatasetTypeEnum.enum.search_results,
    DatasetTypeEnum.enum.annotated_results,
    DatasetTypeEnum.enum.metrics
  ]) {
    try {
      const result = await storage.exportDataset({
        datasetType,
        outputDir,
        runId
      });
      exports.push(result);
      logger.info(
        "dataset exported",
        sanitizeLogMeta({
          datasetType,
          path: result.filePath,
          recordCount: result.version.recordCount
        })
      );
    } catch (error) {
      logger.warn("dataset export skipped", sanitizeLogMeta({ datasetType, error: (error as Error).message }));
    }
  }

  return exports;
}

function sampleRandom<T>(items: T[], count: number): T[] {
  if (count >= items.length) return [...items];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

async function createAuditSamples(
  storage: StorageClient,
  runId: string,
  since: Date,
  samplePercent: number,
  logger: Logger
): Promise<AuditSummary> {
  const annotated = await storage.fetchAnnotatedResults({ since });
  if (!annotated.length) {
    return { totalAnnotated: 0, sampled: 0 };
  }

  const sampleCount = Math.max(1, Math.ceil((annotated.length * samplePercent) / 100));
  const sampled = sampleRandom(annotated, sampleCount);

  const samples: AuditSampleRecordInput[] = sampled.map((result) => ({
    id: randomUUID(),
    runId,
    annotationId: result.annotationId,
    queryId: result.queryId,
    engine: result.engine,
    reviewer: null,
    status: "pending",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  await storage.recordAuditSamples(samples);
  logger.info(
    "audit samples recorded",
    sanitizeLogMeta({ runId, totalAnnotated: annotated.length, sampled: samples.length })
  );

  return { totalAnnotated: annotated.length, sampled: samples.length };
}

async function loadBenchmarkMetadata() {
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
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return {} as Record<string, { query: string; topic: string; tags: string[] }>;
}

async function generateTransparencyReport(
  runId: string,
  datasetExports: DatasetExportResult[],
  storage: StorageClient,
  logger: Logger
) {
  try {
    const [domainMetrics, overlapMetrics, factualMetrics] = await Promise.all([
      storage.fetchRecentMetricRecords(MetricTypeEnum.enum.domain_diversity, 100),
      storage.fetchRecentMetricRecords(MetricTypeEnum.enum.engine_overlap, 100),
      storage.fetchRecentMetricRecords(MetricTypeEnum.enum.factual_alignment, 100)
    ]);

    const queryMeta = await loadBenchmarkMetadata();

    const reduceLatest = (records: typeof domainMetrics) => {
      const map = new Map<string, (typeof records)[number]>();
      const sorted = [...records].sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime());
      for (const record of sorted) {
        if (!map.has(record.queryId)) {
          map.set(record.queryId, record);
        }
      }
      return Array.from(map.values());
    };

    const domainLatest = reduceLatest(domainMetrics)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const overlapLatest = reduceLatest(overlapMetrics)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const factualLatest = reduceLatest(factualMetrics)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const average = (records: typeof domainMetrics) => {
      if (!records.length) return 0;
      const sum = records.reduce((acc, record) => acc + record.value, 0);
      return sum / records.length;
    };

    const reportLines: string[] = [];
    const timestamp = new Date();
    reportLines.push(`# Search Transparency Report ${timestamp.toISOString()}`);
    reportLines.push("");
    reportLines.push(`- Pipeline Run ID: ${runId}`);
    reportLines.push(`- Generated At: ${timestamp.toISOString()}`);
    reportLines.push(`- Dataset Exports: ${datasetExports.length}`);
    reportLines.push("");

    if (datasetExports.length) {
      reportLines.push("## Dataset Versions");
      for (const entry of datasetExports) {
        reportLines.push(
          `- **${entry.version.datasetType}** → ${entry.filePath} (records: ${entry.version.recordCount})`
        );
      }
      reportLines.push("");
    }

    const writeTable = (
      title: string,
      records: (typeof domainLatest),
      formatter: (value: number) => string
    ) => {
      reportLines.push(title);
      reportLines.push("| Query | Topic | Value | Delta |");
      reportLines.push("| --- | --- | --- | --- |");
      for (const record of records) {
        const meta = queryMeta[record.queryId];
        const queryLabel = meta ? meta.query : record.queryId;
        const topicLabel = meta ? meta.topic : "Unknown";
        const valueLabel = formatter(record.value);
        const deltaLabel = record.delta !== null ? formatter(record.delta) : "–";
        reportLines.push(`| ${queryLabel} | ${topicLabel} | ${valueLabel} | ${deltaLabel} |`);
      }
      reportLines.push("");
    };

    const percentage = (value: number) => `${(value * 100).toFixed(1)}%`;
    writeTable("## Highest Domain Diversity", domainLatest, (value) => value.toFixed(1));
    writeTable("## Highest Engine Overlap", overlapLatest, percentage);
    writeTable("## Highest Factual Alignment", factualLatest, percentage);

    reportLines.push("## Averages (last 100 records)");
    reportLines.push(`- Domain Diversity: ${average(domainMetrics).toFixed(2)}`);
    reportLines.push(`- Engine Overlap: ${percentage(average(overlapMetrics))}`);
    reportLines.push(`- Factual Alignment: ${percentage(average(factualMetrics))}`);
    reportLines.push("");

    const reportsDir = path.resolve("reports");
    await fs.mkdir(reportsDir, { recursive: true });
    const filePath = path.join(
      reportsDir,
      `search-transparency-report-${timestamp.toISOString().replace(/[:.]/g, "-")}.md`
    );
    await fs.writeFile(filePath, reportLines.join("\n"), "utf-8");
    logger.info("transparency report generated", sanitizeLogMeta({ filePath }));
  } catch (error) {
    logger.warn("transparency report generation failed", sanitizeLogMeta({ error }));
  }
}

export function createPipelineRunner({ config, logger }: CreatePipelineRunnerOptions): PipelineRunner {
  let running = false;
  let storageClient: StorageClient | null = null;

  async function executeStage(
    stage: PipelineStageEnum,
    runId: string,
    fn: () => Promise<Record<string, unknown> | void>
  ): Promise<Record<string, unknown>> {
    const stageId = randomUUID();
    let attempts = 0;
    const startedAt = new Date();

    const upsertStage = async (
      status: PipelineRunStatusEnum,
      metadata: Record<string, unknown>,
      error: string | null,
      completedAt: Date | null
    ) => {
      if (!storageClient) return;
      await storageClient.recordPipelineStage({
        id: stageId,
        runId,
        stage,
        status,
        attempts,
        startedAt,
        completedAt,
        error,
        metadata,
        createdAt: startedAt,
        updatedAt: completedAt ?? new Date()
      });
    };

    await upsertStage(PipelineRunStatusEnum.enum.running, {}, null, null);

    try {
      const metadata = (await pRetry(async () => {
        attempts += 1;
        await upsertStage(PipelineRunStatusEnum.enum.running, {}, null, null);
        const result = await fn();
        return result ?? {};
      }, {
        retries: config.maxRetries,
        factor: 1,
        minTimeout: config.retryDelayMs,
        maxTimeout: config.retryDelayMs,
        onFailedAttempt: (error) => {
        logger.warn(
          "pipeline stage retry",
          sanitizeLogMeta({
            stage,
            attemptNumber: error.attemptNumber,
            retriesLeft: error.retriesLeft,
            error: error.message
          })
        );
        }
      })) as Record<string, unknown>;

      const completedAt = new Date();
      await upsertStage(PipelineRunStatusEnum.enum.completed, metadata, null, completedAt);
      return metadata;
    } catch (error) {
      const failedAt = new Date();
      await upsertStage(
        PipelineRunStatusEnum.enum.failed,
        {},
        (error as Error).message,
        failedAt
      );
      throw error;
    }
  }

  return {
    isRunning: () => running,
    async runOnce() {
      if (running) {
        logger.warn("pipeline already running, skipping concurrent trigger");
        return;
      }

      running = true;
      const startedAt = new Date();
      const runId = randomUUID();
      storageClient = createStorageClient();

      logger.info("scheduler pipeline starting", sanitizeLogMeta({ runId, startedAt }));

      const recordRun = async (
        status: PipelineRunStatusEnum,
        error: string | null,
        metadata: Record<string, unknown>,
        completedAt: Date | null
      ) => {
        if (!storageClient) return;
        await storageClient.recordPipelineRun({
          id: runId,
          status,
          startedAt,
          completedAt,
          error,
          metadata,
          createdAt: startedAt,
          updatedAt: completedAt ?? new Date()
        });
      };

      await recordRun(PipelineRunStatusEnum.enum.running, null, {}, null);

      try {
        const collectorSummary = await executeStage(PipelineStageEnum.enum.collector, runId, async () => {
          const app = await createCollectorApp();
          await app.run();
          await verifyCollectorOutput(config.collectorOutputDir, logger);
          const summary = await ingestCollectorOutputs(
            config.collectorOutputDir,
            runId,
            config.collectorOutputDir,
            storageClient!,
            logger
          );
          return summary;
        });

        const annotationSummary = await executeStage(PipelineStageEnum.enum.annotation, runId, async () => {
          const app = await createAnnotationApp();
          await app.run();
          return { status: "completed" };
        });

        const auditSummary = await createAuditSamples(
          storageClient!,
          runId,
          startedAt,
          config.manualAuditSamplePercent,
          logger
        );

        const metricsSummary = await executeStage(PipelineStageEnum.enum.metrics, runId, async () => {
          const app = createMetricsApp();
          await app.run();
          const exports = await exportDatasets(runId, storageClient!, logger);
          await generateTransparencyReport(runId, exports, storageClient!, logger);
          return {
            datasetExports: exports.map((entry) => entry.filePath),
            exportCount: exports.length
          };
        });

        await recordRun(
          PipelineRunStatusEnum.enum.completed,
          null,
          {
            runId,
            collector: collectorSummary,
            annotation: { ...annotationSummary, audit: auditSummary },
            metrics: metricsSummary
          },
          new Date()
        );

        logger.info(
          "scheduler pipeline completed",
          sanitizeLogMeta({
            runId,
            durationMs: Date.now() - startedAt.getTime()
          })
        );
      } catch (error) {
        await recordRun(
          PipelineRunStatusEnum.enum.failed,
          (error as Error).message,
          { runId },
          new Date()
        );
        logger.error(
          "scheduler pipeline failed",
          sanitizeLogMeta({
            runId,
            durationMs: Date.now() - startedAt.getTime(),
            error
          })
        );
        throw error;
      } finally {
        running = false;
        if (storageClient) {
          await storageClient.close();
          storageClient = null;
        }
      }
    }
  };
}
