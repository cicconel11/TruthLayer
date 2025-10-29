import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  AnnotatedResultView,
  AnnotatedResultViewSchema,
  AnnotationAggregateRecord,
  AnnotationAggregateRecordSchema,
  AnnotationRecord,
  AnnotationRecordSchema,
  AuditSampleSchema,
  DatasetVersion,
  DatasetVersionSchema,
  DatasetTypeEnum,
  DatasetFormatEnum,
  PipelineRun,
  PipelineStageLog,
  SearchResult,
  SearchResultSchema
} from "@truthlayer/schema";
import {
  AnnotationAggregateRecordInput,
  AnnotationRecordInput,
  SearchResultInput,
  CrawlRunRecordInput,
  FetchAnnotatedResultsOptions,
  FetchPendingAnnotationsOptions,
  FetchAnnotationAggregateOptions,
  MetricRecordInput,
  DatasetExportOptions,
  DatasetExportResult,
  AuditSampleRecordInput,
  PipelineRunRecordInput,
  PipelineStageLogInput,
  FetchPipelineRunOptions,
  StorageClient
} from "./types";

interface InMemoryStorageState {
  searchResults: SearchResult[];
  annotations: AnnotationRecord[];
  annotatedResults: AnnotatedResultView[];
  metrics: MetricRecordInput[];
  annotationAggregates: AnnotationAggregateRecord[];
  crawlRuns: CrawlRunRecordInput[];
  datasetVersions: DatasetVersion[];
  pipelineRuns: PipelineRun[];
  pipelineStages: PipelineStageLog[];
  auditSamples: AuditSampleRecordInput[];
  viewpoints: import("./types").ViewpointRecordInput[];
}

export function createInMemoryStorageClient(initialState?: Partial<InMemoryStorageState>): StorageClient {
  const state: InMemoryStorageState = {
    searchResults: initialState?.searchResults
      ? initialState.searchResults.map((record) => SearchResultSchema.parse(record))
      : [],
    annotations: initialState?.annotations
      ? initialState.annotations.map((record) => AnnotationRecordSchema.parse(record))
      : [],
    annotatedResults: initialState?.annotatedResults
      ? initialState.annotatedResults.map((result) => AnnotatedResultViewSchema.parse(result))
      : [],
    metrics: initialState?.metrics ? [...initialState.metrics] : [],
    annotationAggregates: initialState?.annotationAggregates ? [...initialState.annotationAggregates] : [],
    crawlRuns: initialState?.crawlRuns ? [...initialState.crawlRuns] : [],
    datasetVersions: initialState?.datasetVersions ? [...initialState.datasetVersions] : [],
    pipelineRuns: initialState?.pipelineRuns ? [...initialState.pipelineRuns] : [],
    pipelineStages: initialState?.pipelineStages ? [...initialState.pipelineStages] : [],
    auditSamples: initialState?.auditSamples ? [...initialState.auditSamples] : [],
    viewpoints: initialState?.viewpoints ? [...initialState.viewpoints] : []
  };

  return {
    async fetchPendingAnnotations(options: FetchPendingAnnotationsOptions): Promise<SearchResult[]> {
      const annotatedIds = new Set(state.annotations.map((annotation) => annotation.searchResultId));
      let results = state.searchResults.filter((result) => !annotatedIds.has(result.id));

      if (options.queryIds && options.queryIds.length) {
        const allowed = new Set(options.queryIds);
        results = results.filter((result) => allowed.has(result.queryId));
      }

      if (options.engines && options.engines.length) {
        const allowed = new Set(options.engines);
        results = results.filter((result) => allowed.has(result.engine));
      }

      if (options.limit !== undefined) {
        results = results.slice(0, options.limit);
      }

      return results;
    },

    async insertAnnotationRecords(records: AnnotationRecordInput[]): Promise<void> {
      for (const record of records) {
        const parsed = AnnotationRecordSchema.parse({
          ...record,
          extra: record.extra ?? undefined
        });
        const existingIndex = state.annotations.findIndex((item) => item.id === parsed.id);
        if (existingIndex >= 0) {
          state.annotations[existingIndex] = parsed;
        } else {
          state.annotations.push(parsed);
        }

        const searchResult = state.searchResults.find((result) => result.id === parsed.searchResultId);
        if (searchResult) {
          const annotatedView = AnnotatedResultViewSchema.parse({
            runId: searchResult.crawlRunId ?? `${searchResult.queryId}-${searchResult.timestamp.toISOString()}`,
            batchId: undefined,
            annotationId: parsed.id,
            queryId: parsed.queryId,
            engine: parsed.engine,
            normalizedUrl: searchResult.normalizedUrl,
            domain: searchResult.domain,
            rank: searchResult.rank,
            factualConsistency: parsed.factualConsistency,
            domainType: parsed.domainType,
            collectedAt: searchResult.timestamp
          });

          const existingResultIndex = state.annotatedResults.findIndex(
            (result) => result.annotationId === parsed.id
          );

          if (existingResultIndex >= 0) {
            state.annotatedResults[existingResultIndex] = annotatedView;
          } else {
            state.annotatedResults.push(annotatedView);
          }
        }
      }
    },

    async insertSearchResults(records: SearchResultInput[]): Promise<void> {
      for (const record of records) {
        const parsed = SearchResultSchema.parse({
          ...record,
          snippet: record.snippet ?? undefined
        });
        const existingIndex = state.searchResults.findIndex((result) => result.id === parsed.id);
        if (existingIndex >= 0) {
          state.searchResults[existingIndex] = parsed;
        } else {
          state.searchResults.push(parsed);
        }
      }
    },

    async recordCrawlRuns(records: CrawlRunRecordInput[]): Promise<void> {
      for (const record of records) {
        const existingIndex = state.crawlRuns.findIndex((run) => run.id === record.id);
        if (existingIndex >= 0) {
          state.crawlRuns[existingIndex] = record;
        } else {
          state.crawlRuns.push(record);
        }
      }
    },

    async fetchAnnotatedResults(options: FetchAnnotatedResultsOptions): Promise<AnnotatedResultView[]> {
      return state.annotatedResults.filter((result) => {
        if (options.since && result.collectedAt < options.since) return false;
        if (options.until && result.collectedAt > options.until) return false;
        if (options.queryIds && options.queryIds.length && !options.queryIds.includes(result.queryId)) return false;
        if (options.runIds && options.runIds.length && !options.runIds.includes(result.runId)) return false;
        return true;
      });
    },

    async fetchAlternativeSources(options: import("./types").FetchAlternativeSourcesOptions): Promise<AnnotatedResultView[]> {
      const limit = options.limit || 50;
      return state.annotatedResults
        .filter((result) => {
          if (options.since && result.collectedAt < options.since) return false;
          if (options.domainTypes && !options.domainTypes.includes(result.domainType)) return false;
          if (options.factualConsistency && !options.factualConsistency.includes(result.factualConsistency)) return false;
          if (options.excludeUrls && options.excludeUrls.includes(result.normalizedUrl)) return false;
          if (options.queryKeywords && options.queryKeywords.length > 0) {
            const searchText = `${result.domain} ${result.normalizedUrl}`.toLowerCase();
            const hasKeyword = options.queryKeywords.some(keyword => searchText.includes(keyword.toLowerCase()));
            if (!hasKeyword) return false;
          }
          return true;
        })
        .slice(0, limit);
    },

    async insertMetricRecords(records: MetricRecordInput[]): Promise<void> {
      if (!records.length) return;
      const ids = new Set(records.map((record) => record.id));
      state.metrics = state.metrics.filter((record) => !ids.has(record.id));
      state.metrics.push(...records);
    },

    async upsertAnnotationAggregates(records: AnnotationAggregateRecordInput[]): Promise<void> {
      if (!records.length) return;
      const ids = new Set(records.map((record) => record.id));
      state.annotationAggregates = state.annotationAggregates.filter((record) => !ids.has(record.id));
      state.annotationAggregates.push(
        ...records.map((record) =>
          AnnotationAggregateRecordSchema.parse({
            ...record,
            extra: record.extra ?? undefined
          })
        )
      );
    },

    async fetchAnnotationAggregates(options: FetchAnnotationAggregateOptions): Promise<AnnotationAggregateRecord[]> {
      return state.annotationAggregates.filter((record) => {
        if (options.runIds && options.runIds.length && !options.runIds.includes(record.runId)) return false;
        if (options.queryIds && options.queryIds.length && !options.queryIds.includes(record.queryId)) return false;
        if (options.engines && options.engines.length && !options.engines.includes(record.engine ?? "")) return false;
        if (options.domainTypes && options.domainTypes.length && !options.domainTypes.includes(record.domainType)) return false;
        return true;
      });
    },

    async recordAuditSamples(samples: AuditSampleRecordInput[]): Promise<void> {
      if (!samples.length) return;
      const ids = new Set(samples.map((sample) => sample.id));
      state.auditSamples = state.auditSamples.filter((sample) => !ids.has(sample.id));
      state.auditSamples.push(...samples.map((sample) => AuditSampleSchema.parse(sample)));
    },

    async fetchAuditSamples(runId: string): Promise<AuditSampleRecordInput[]> {
      return state.auditSamples
        .filter((sample) => sample.runId === runId)
        .map((sample) => AuditSampleSchema.parse(sample));
    },

    async fetchRecentMetricRecords(
      metricType: MetricRecordInput["metricType"],
      limit: number
    ): Promise<MetricRecordInput[]> {
      return state.metrics
        .filter((record) => record.metricType === metricType)
        .sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime())
        .slice(0, limit);
    },

    async exportDataset(options: DatasetExportOptions): Promise<DatasetExportResult> {
      const format = options.format ?? DatasetFormatEnum.enum.parquet;
      if (format !== DatasetFormatEnum.enum.parquet) {
        throw new Error("In-memory exporter only simulates Parquet output");
      }

      const timestamp = new Date();
      const directory = `${options.outputDir}/${options.datasetType}`;
      const filename = `${options.datasetType}-${timestamp.toISOString().replace(/[:.]/g, "-")}.parquet.json`;
      await fs.promises.mkdir(directory, { recursive: true });

      let dataset: unknown[] = [];
      switch (options.datasetType) {
        case DatasetTypeEnum.enum.search_results:
          dataset = [...state.searchResults];
          break;
        case DatasetTypeEnum.enum.annotated_results:
          dataset = [...state.annotatedResults];
          break;
        case DatasetTypeEnum.enum.metrics:
          dataset = [...state.metrics];
          break;
        default:
          dataset = [];
      }

      const filePath = `${directory}/${filename}`;
      await fs.promises.writeFile(filePath, JSON.stringify(dataset, null, 2), "utf-8");

      const version = DatasetVersionSchema.parse({
        id: randomUUID(),
        datasetType: options.datasetType,
        format: DatasetFormatEnum.enum.parquet,
        path: filePath,
        runId: options.runId ?? null,
        recordCount: dataset.length,
        metadata: {
          datasetType: options.datasetType,
          filters: options.filters ?? {},
          generatedAt: timestamp.toISOString()
        },
        createdAt: timestamp
      });

      state.datasetVersions.push(version);

      return {
        version,
        filePath
      };
    },

    async recordPipelineRun(input: PipelineRunRecordInput): Promise<void> {
      const existingIndex = state.pipelineRuns.findIndex((run) => run.id === input.id);
      const record: PipelineRun = {
        id: input.id,
        status: input.status,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        error: input.error,
        metadata: input.metadata,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt
      };
      if (existingIndex >= 0) {
        state.pipelineRuns[existingIndex] = record;
      } else {
        state.pipelineRuns.push(record);
      }
    },

    async recordPipelineStage(input: PipelineStageLogInput): Promise<void> {
      const existingIndex = state.pipelineStages.findIndex((stage) => stage.id === input.id);
      const record: PipelineStageLog = {
        id: input.id,
        runId: input.runId,
        stage: input.stage,
        status: input.status,
        attempts: input.attempts,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        error: input.error,
        metadata: input.metadata,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt
      };
      if (existingIndex >= 0) {
        state.pipelineStages[existingIndex] = record;
      } else {
        state.pipelineStages.push(record);
      }
    },

    async fetchPipelineRuns(options: FetchPipelineRunOptions = {}): Promise<PipelineRun[]> {
      const limit = options.limit ?? 50;
      return state.pipelineRuns
        .slice()
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, limit);
    },

    async fetchPipelineStages(runId: string): Promise<PipelineStageLog[]> {
      return state.pipelineStages
        .filter((stage) => stage.runId === runId)
        .slice()
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    },

    async upsertViewpoints(records: import("./types").ViewpointRecordInput[]): Promise<void> {
      if (!records.length) return;
      
      for (const record of records) {
        // Remove existing record with same query_id, crawl_run_id, engine
        const existingIndex = state.viewpoints.findIndex(
          (v) => v.queryId === record.queryId && 
                 v.crawlRunId === record.crawlRunId && 
                 v.engine === record.engine
        );
        
        if (existingIndex >= 0) {
          state.viewpoints[existingIndex] = record;
        } else {
          state.viewpoints.push(record);
        }
      }
    },

    async fetchViewpointsByQuery(options: import("./types").FetchViewpointsByQueryOptions): Promise<import("./types").ViewpointRecordInput[]> {
      return state.viewpoints
        .filter((viewpoint) => {
          if (viewpoint.queryId !== options.queryId) return false;
          if (options.runId && viewpoint.crawlRunId !== options.runId) return false;
          if (options.engines && options.engines.length > 0 && !options.engines.includes(viewpoint.engine)) return false;
          return true;
        })
        .sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime());
    },

    async close(): Promise<void> {
      // no-op for in-memory storage
    }
  };
}
