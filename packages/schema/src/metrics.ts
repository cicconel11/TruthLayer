import { z } from "zod";
import { EngineEnum } from "./search-result";

export const MetricTypeEnum = z.enum([
  "domain_diversity",
  "engine_overlap", 
  "factual_alignment",
  "viewpoint_diversity_score",
  "viewpoint_underrepresented_count",
  "viewpoint_alternative_sources_available"
]);

export const MetricRecordSchema = z.object({
  id: z.string().uuid("metric_id must be a UUID"),
  crawlRunId: z.string().uuid("crawl_run_id must be a UUID"),
  queryId: z.string().uuid("query_id must be a UUID"),
  engine: EngineEnum.nullable(),
  metricType: MetricTypeEnum,
  value: z.number(),
  extra: z.record(z.any()).optional(),
  createdAt: z.coerce.date()
});

export type MetricRecord = z.infer<typeof MetricRecordSchema>;

