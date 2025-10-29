import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import PQueue from "p-queue";
import {
  AnnotationAggregateRecordInput,
  AnnotationRecordInput,
  FetchPendingAnnotationsOptions,
  StorageClient,
  createStorageClient
} from "@truthlayer/storage";
import { AnnotationConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import {
  LLMAnnotationResult,
  LLMAnnotationInput,
  createLLMClient,
  defaultAnnotationResult
} from "../services/llm-client";
import { inferDomainType, inferFactualConsistency } from "../services/heuristics";
import { DomainTypeEnum, FactualConsistencyEnum, SearchResult } from "@truthlayer/schema";

interface AnnotationTask {
  result: SearchResult;
  runId: string;
  collectedAt: Date;
}

interface AnnotationCachePayload {
  annotationRecord: {
    id: string;
    domainType: DomainTypeEnum;
    factualConsistency: FactualConsistencyEnum;
    confidence: number | null;
    promptVersion: string;
    modelId: string;
    provider: string;
    reasoning?: string;
    extra?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  runId: string;
  queryId: string;
  engine: string;
  collectedAt: string;
  raw: unknown;
}

interface AggregateAccumulator {
  runId: string;
  queryId: string;
  engine: string;
  total: number;
  collectedAt: Date;
  counts: Map<string, number>;
  providers: Set<string>;
}

function toAnnotationInput(task: AnnotationTask): LLMAnnotationInput {
  return {
    title: task.result.title,
    snippet: task.result.snippet,
    url: task.result.url,
    domain: task.result.domain,
    engine: task.result.engine,
    queryId: task.result.queryId
  };
}

function generateRunId(result: SearchResult): string {
  return result.crawlRunId ?? `${result.queryId}-${result.timestamp.toISOString()}`;
}

function hashToUUID(value: string): string {
  const hash = createHash("sha1").update(value).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // set version 5 bits
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // set variant bits
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function readCache(cacheDir: string, id: string): Promise<AnnotationCachePayload | null> {
  const cacheKey = path.join(cacheDir, `${id}.json`);
  try {
    const cached = await fs.readFile(cacheKey, "utf-8");
    return JSON.parse(cached) as AnnotationCachePayload;
  } catch {
    return null;
  }
}

async function writeCache(cacheDir: string, id: string, payload: AnnotationCachePayload): Promise<void> {
  const cacheKey = path.join(cacheDir, `${id}.json`);
  await fs.writeFile(cacheKey, JSON.stringify(payload, null, 2));
}

interface AnnotationRunner {
  id: string;
  execute: () => Promise<void>;
}

interface CreateAnnotationRunnerOptions {
  config: AnnotationConfig;
  logger: Logger;
  storage?: StorageClient;
}

export function createAnnotationRunner({
  config,
  logger,
  storage
}: CreateAnnotationRunnerOptions): AnnotationRunner {
  const llmClient = createLLMClient({ config, logger });
  const storageClient = storage ?? createStorageClient({});
  const id = config.runId;

  async function ensureCacheDir() {
    await fs.mkdir(config.cacheDir, { recursive: true });
  }

  async function loadPendingTasks(): Promise<AnnotationTask[]> {
    const options: FetchPendingAnnotationsOptions = {
      limit: config.batchSize
    };

    const results = await storageClient.fetchPendingAnnotations(options);
    return results.map((result) => ({
      result,
      runId: generateRunId(result),
      collectedAt: result.timestamp
    }));
  }

  async function createAnnotationRecord(
    task: AnnotationTask,
    annotation: LLMAnnotationResult
  ): Promise<AnnotationRecordInput> {
    const confidence = annotation.confidence ?? config.defaultConfidence;
    const now = new Date();

    return {
      id: randomUUID(),
      searchResultId: task.result.id,
      queryId: task.result.queryId,
      engine: task.result.engine,
      domainType: annotation.domainType,
      factualConsistency: annotation.factualConsistency,
      confidence,
      promptVersion: config.promptVersion,
      modelId: annotation.modelId,
      createdAt: now,
      updatedAt: now,
      extra: {
        provider: annotation.provider,
        reasoning: annotation.reasoning,
        raw: annotation.raw
      }
    };
  }

  function accumulateAggregate(
    aggregateMap: Map<string, AggregateAccumulator>,
    task: AnnotationTask,
    record: AnnotationRecordInput
  ) {
    const aggregateKey = `${task.runId}|${task.result.queryId}|${task.result.engine}`;
    const combinationKey = `${record.domainType}|${record.factualConsistency}`;

    let accumulator = aggregateMap.get(aggregateKey);
    if (!accumulator) {
      accumulator = {
        runId: task.runId,
        queryId: task.result.queryId,
        engine: task.result.engine,
        total: 0,
        collectedAt: task.collectedAt,
        counts: new Map<string, number>(),
        providers: new Set<string>()
      };
      aggregateMap.set(aggregateKey, accumulator);
    }

    accumulator.total += 1;
    if (task.collectedAt < accumulator.collectedAt) {
      accumulator.collectedAt = task.collectedAt;
    }

    accumulator.counts.set(
      combinationKey,
      (accumulator.counts.get(combinationKey) ?? 0) + 1
    );

    const provider = typeof record.extra?.provider === "string" ? record.extra?.provider : undefined;
    if (provider) {
      accumulator.providers.add(provider);
    }
  }

  function buildAggregateRecords(
    aggregateMap: Map<string, AggregateAccumulator>,
    createdAt: Date
  ): AnnotationAggregateRecordInput[] {
    const records: AnnotationAggregateRecordInput[] = [];

    for (const accumulator of aggregateMap.values()) {
      for (const [combinationKey, count] of accumulator.counts.entries()) {
        const [domainType, factualConsistency] = combinationKey.split("|") as [
          DomainTypeEnum,
          FactualConsistencyEnum
        ];

        const aggregateId = hashToUUID(
          `${accumulator.runId}|${accumulator.queryId}|${accumulator.engine}|${domainType}|${factualConsistency}`
        );

        records.push({
          id: aggregateId,
          runId: accumulator.runId,
          queryId: accumulator.queryId,
          engine: accumulator.engine,
          domainType,
          factualConsistency,
          count,
          totalAnnotations: accumulator.total,
          collectedAt: accumulator.collectedAt,
          createdAt,
          extra: {
            source: "annotation-service",
            providers: Array.from(accumulator.providers)
          }
        });
      }
    }

    return records;
  }

  async function processTask(
    task: AnnotationTask,
    aggregateMap: Map<string, AggregateAccumulator>,
    pendingRecords: AnnotationRecordInput[]
  ) {
    const cached = await readCache(config.cacheDir, task.result.id);

    if (cached) {
      const confidence = cached.annotationRecord.confidence ?? config.defaultConfidence;
      const record: AnnotationRecordInput = {
        id: cached.annotationRecord.id,
        searchResultId: task.result.id,
        queryId: task.result.queryId,
        engine: task.result.engine,
        domainType: cached.annotationRecord.domainType,
        factualConsistency: cached.annotationRecord.factualConsistency,
        confidence,
        promptVersion: cached.annotationRecord.promptVersion,
        modelId: cached.annotationRecord.modelId,
        createdAt: new Date(cached.annotationRecord.createdAt),
        updatedAt: new Date(cached.annotationRecord.updatedAt),
        extra: {
          provider: cached.annotationRecord.provider,
          reasoning: cached.annotationRecord.reasoning,
          ...(cached.annotationRecord.extra ?? {})
        }
      };

      pendingRecords.push(record);
      accumulateAggregate(aggregateMap, task, record);
      logger.info("annotation cache hit", { taskId: task.result.id, provider: cached.annotationRecord.provider });
      return;
    }

    const input = toAnnotationInput(task);
    const shouldSkipLLM = !input.snippet || input.snippet.trim().length === 0;

    const annotation: LLMAnnotationResult = shouldSkipLLM
      ? {
          ...defaultAnnotationResult(input, llmClient.provider),
          domainType: inferDomainType(task.result.domain),
          factualConsistency: inferFactualConsistency(task.result.snippet)
        }
      : await llmClient.annotate(input);

    const record = await createAnnotationRecord(task, annotation);
    pendingRecords.push(record);
    accumulateAggregate(aggregateMap, task, record);

    const cachePayload: AnnotationCachePayload = {
      annotationRecord: {
        id: record.id,
        domainType: record.domainType,
        factualConsistency: record.factualConsistency,
        confidence: record.confidence,
        promptVersion: record.promptVersion,
        modelId: record.modelId,
        provider: annotation.provider,
        reasoning: annotation.reasoning,
        extra: record.extra,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      },
      runId: task.runId,
      queryId: task.result.queryId,
      engine: task.result.engine,
      collectedAt: task.collectedAt.toISOString(),
      raw: annotation.raw
    };

    await writeCache(config.cacheDir, task.result.id, cachePayload);
    logger.info("annotation complete", {
      taskId: task.result.id,
      domainType: record.domainType,
      factualConsistency: record.factualConsistency,
      provider: annotation.provider
    });
  }

  return {
    id,
    async execute() {
      await ensureCacheDir();
      const aggregateMap = new Map<string, AggregateAccumulator>();
      const pendingRecords: AnnotationRecordInput[] = [];

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const tasks = await loadPendingTasks();
          if (!tasks.length) {
            logger.info("no pending annotations", { runId: id });
            break;
          }

          const queue = new PQueue({ concurrency: config.maxConcurrency });

          for (const task of tasks) {
            queue.add(async () => {
              try {
                await processTask(task, aggregateMap, pendingRecords);
              } catch (error) {
                logger.error("annotation failed", { taskId: task.result.id, error });
              }
            });
          }

          await queue.onIdle();

          if (pendingRecords.length) {
            await storageClient.insertAnnotationRecords([...pendingRecords]);
            pendingRecords.length = 0;
          }

          if (tasks.length < config.batchSize) {
            break;
          }
        }

        const aggregateRecords = buildAggregateRecords(aggregateMap, new Date());
        if (aggregateRecords.length) {
          await storageClient.upsertAnnotationAggregates(aggregateRecords);
        }

        logger.info("annotation run complete", {
          runId: id,
          aggregateCount: aggregateRecords.length
        });
      } finally {
        if (!storage) {
          await storageClient.close();
        }
      }
    }
  };
}
