import type {
  AnnotatedResultView,
  AnnotationAggregateRecord,
  AnnotationRecord,
  SearchResult,
  MetricRecord,
  DatasetVersion,
  PipelineRun,
  PipelineStageLog
} from "@truthlayer/schema";

type DomainType = AnnotationRecord["domainType"];
type FactualConsistency = AnnotationRecord["factualConsistency"];
type MetricType = MetricRecord["metricType"];
type DatasetType = DatasetVersion["datasetType"];
type DatasetFormat = DatasetVersion["format"];
type PipelineRunStatus = PipelineRun["status"];
type PipelineStage = PipelineStageLog["stage"];

export interface FetchAnnotatedResultsOptions {
  since?: Date;
  until?: Date;
  queryIds?: string[];
  runIds?: string[];
  domainTypes?: DomainType[];
  factualConsistency?: FactualConsistency[];
  engines?: string[];
}

export interface FetchAlternativeSourcesOptions {
  domainTypes?: DomainType[];
  factualConsistency?: FactualConsistency[];
  excludeUrls?: string[];
  queryKeywords?: string[];
  limit?: number;
  since?: Date;
}

export interface FetchPendingAnnotationsOptions {
  limit?: number;
  queryIds?: string[];
  engines?: string[];
}

export interface AnnotationRecordInput {
  id: string;
  searchResultId: string;
  queryId: string;
  engine: string;
  domainType: DomainType;
  factualConsistency: FactualConsistency;
  confidence: number | null;
  promptVersion: string;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
  extra?: Record<string, unknown>;
}

export interface SearchResultInput {
  id: string;
  crawlRunId: string | null;
  queryId: string;
  engine: string;
  rank: number;
  title: string;
  snippet?: string | null;
  url: string;
  normalizedUrl: string;
  domain: string;
  timestamp: Date;
  hash: string;
  rawHtmlPath: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrawlRunRecordInput {
  id: string;
  batchId: string;
  queryId: string;
  engine: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  resultCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricRecordInput {
  id: string;
  crawlRunId: string | null;
  queryId: string;
  engine: string | null;
  metricType: MetricType;
  value: number;
  delta: number | null;
  comparedToRunId: string | null;
  collectedAt: Date;
  extra?: Record<string, unknown>;
  createdAt: Date;
}

export interface AnnotationAggregateRecordInput {
  id: string;
  runId: string;
  queryId: string;
  engine: string | null;
  domainType: DomainType;
  factualConsistency: FactualConsistency;
  count: number;
  totalAnnotations: number;
  collectedAt: Date;
  createdAt: Date;
  extra?: Record<string, unknown>;
}

export interface FetchAnnotationAggregateOptions {
  runIds?: string[];
  queryIds?: string[];
  engines?: string[];
  domainTypes?: DomainType[];
}

export interface DatasetExportOptions {
  datasetType: DatasetType;
  format?: DatasetFormat;
  outputDir: string;
  runId?: string | null;
  filters?: {
    queryIds?: string[];
    engines?: string[];
    since?: Date;
    until?: Date;
  };
}

export interface DatasetExportResult {
  version: DatasetVersion;
  filePath: string;
}

export interface AuditSampleRecordInput {
  id: string;
  runId: string;
  annotationId: string;
  queryId: string;
  engine: string;
  reviewer: string | null;
  status: "pending" | "approved" | "flagged";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineRunRecordInput {
  id: string;
  status: PipelineRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStageLogInput {
  id: string;
  runId: string;
  stage: PipelineStage;
  status: PipelineRunStatus;
  attempts: number;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FetchPipelineRunOptions {
  limit?: number;
}

export interface StorageClient {
  fetchPendingAnnotations(options: FetchPendingAnnotationsOptions): Promise<SearchResult[]>;
  insertAnnotationRecords(records: AnnotationRecordInput[]): Promise<void>;
  insertSearchResults(records: SearchResultInput[]): Promise<void>;
  recordCrawlRuns(records: CrawlRunRecordInput[]): Promise<void>;
  fetchAnnotatedResults(options: FetchAnnotatedResultsOptions): Promise<AnnotatedResultView[]>;
  fetchAlternativeSources(options: FetchAlternativeSourcesOptions): Promise<AnnotatedResultView[]>;
  insertMetricRecords(records: MetricRecordInput[]): Promise<void>;
  fetchRecentMetricRecords(metricType: MetricType, limit: number): Promise<MetricRecordInput[]>;
  upsertAnnotationAggregates(records: AnnotationAggregateRecordInput[]): Promise<void>;
  fetchAnnotationAggregates(options: FetchAnnotationAggregateOptions): Promise<AnnotationAggregateRecord[]>;
  exportDataset(options: DatasetExportOptions): Promise<DatasetExportResult>;
  recordPipelineRun(input: PipelineRunRecordInput): Promise<void>;
  recordPipelineStage(input: PipelineStageLogInput): Promise<void>;
  fetchPipelineRuns(options?: FetchPipelineRunOptions): Promise<PipelineRun[]>;
  fetchPipelineStages(runId: string): Promise<PipelineStageLog[]>;
  recordAuditSamples(samples: AuditSampleRecordInput[]): Promise<void>;
  fetchAuditSamples(runId: string): Promise<AuditSampleRecordInput[]>;
  close(): Promise<void>;
}
