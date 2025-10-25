export type MetricType = "domain_diversity" | "engine_overlap" | "factual_alignment";

export type MetricRecord = {
  id: string;
  runId: string | null;
  queryId: string;
  engine: string | null;
  metricType: MetricType;
  value: number;
  delta: number | null;
  comparedToRunId: string | null;
  collectedAt: string;
  extra?: Record<string, unknown> | null;
};

export type AnnotationAggregate = {
  id: string;
  runId: string;
  queryId: string;
  engine: string | null;
  domainType: string;
  factualConsistency: string;
  count: number;
  totalAnnotations: number;
  collectedAt: string;
  createdAt: string;
  extra?: Record<string, unknown> | null;
};

export type QueryMeta = {
  query: string;
  topic: string;
  tags: string[];
};

