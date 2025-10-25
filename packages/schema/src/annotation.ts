import { z } from "zod";
import { EngineEnum } from "./search-result";

export const DomainTypeEnum = z.enum([
  "news",
  "government",
  "academic",
  "blog",
  "other"
]);

export const FactualConsistencyEnum = z.enum([
  "aligned",
  "contradicted",
  "unclear",
  "not_applicable"
]);

export const AnnotationRecordSchema = z.object({
  id: z.string().uuid("annotation_id must be a UUID"),
  searchResultId: z.string().uuid("search_result_id must be a UUID"),
  queryId: z.string().uuid("query_id must be a UUID"),
  engine: EngineEnum,
  domainType: DomainTypeEnum,
  factualConsistency: FactualConsistencyEnum,
  confidence: z.number().min(0).max(1).nullable().default(null),
  promptVersion: z.string().min(1),
  modelId: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type AnnotationRecord = z.infer<typeof AnnotationRecordSchema>;

export const AnnotationAggregateRecordSchema = z.object({
  id: z.string().uuid("annotation_aggregate_id must be a UUID"),
  runId: z.string().min(1, "run_id is required"),
  queryId: z.string().uuid("query_id must be a UUID"),
  engine: EngineEnum.nullable(),
  domainType: DomainTypeEnum,
  factualConsistency: FactualConsistencyEnum,
  count: z.number().int().min(0),
  totalAnnotations: z.number().int().min(0),
  collectedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  extra: z.record(z.any()).optional()
});

export type AnnotationAggregateRecord = z.infer<typeof AnnotationAggregateRecordSchema>;

export const AnnotatedResultViewSchema = z.object({
  runId: z.string().min(1),
  batchId: z.string().min(1).optional(),
  annotationId: z.string().uuid("annotation_id must be a UUID"),
  queryId: z.string().uuid("query_id must be a UUID"),
  engine: EngineEnum,
  normalizedUrl: z.string().min(1),
  domain: z.string().min(1),
  rank: z.number().int().min(1).max(100),
  factualConsistency: FactualConsistencyEnum,
  domainType: DomainTypeEnum,
  collectedAt: z.coerce.date()
});

export type AnnotatedResultView = z.infer<typeof AnnotatedResultViewSchema>;
