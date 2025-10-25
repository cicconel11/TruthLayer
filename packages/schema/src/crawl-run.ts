import { z } from "zod";
import { EngineEnum } from "./search-result";

export const CrawlRunStatusEnum = z.enum(["pending", "running", "completed", "failed"]);

export const CrawlRunSchema = z.object({
  id: z.string().uuid("crawl_run_id must be a UUID"),
  batchId: z.string().uuid("batch_id must be a UUID"),
  queryId: z.string().uuid("query_id must be a UUID"),
  engine: EngineEnum,
  status: CrawlRunStatusEnum,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
  resultCount: z.number().int().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type CrawlRun = z.infer<typeof CrawlRunSchema>;

