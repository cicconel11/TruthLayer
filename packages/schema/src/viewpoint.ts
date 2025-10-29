import { z } from "zod";
import { EngineEnum } from "./search-result";

/**
 * Viewpoint Schema - Per-engine aggregate metadata
 * 
 * Tracks aggregate information for each engine's results per query/run,
 * including AI-generated summaries (for Perplexity), citation counts,
 * and overlap analysis.
 * 
 * @see apps/storage/src/types.ts ViewpointRecordInput
 */
export const ViewpointSchema = z.object({
  id: z.string().uuid("viewpoint_id must be a UUID"),
  queryId: z.string().uuid("query_id must be a UUID"),
  crawlRunId: z.string().uuid("crawl_run_id must be a UUID").nullable(),
  engine: EngineEnum,
  numResults: z.number().int().min(0, "num_results must be non-negative"),
  summary: z.string().nullable().optional(),
  citationsCount: z.number().int().min(0).default(0),
  overlapHash: z.string().nullable().optional(),
  collectedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type Viewpoint = z.infer<typeof ViewpointSchema>;

