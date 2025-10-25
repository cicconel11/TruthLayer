import { z } from "zod";

export const EngineEnum = z.enum(["google", "bing", "perplexity", "brave"]);

export const SearchResultSchema = z.object({
  id: z.string().uuid("search_result_id must be a UUID"),
  crawlRunId: z.string().uuid("crawl_run_id must be a UUID").nullable().default(null),
  queryId: z.string().uuid("query_id must be a UUID"),
  engine: EngineEnum,
  rank: z.number().int().min(1).max(100),
  title: z.string().min(1),
  snippet: z.string().optional(),
  url: z.string().url(),
  normalizedUrl: z.string().url(),
  domain: z.string().min(1),
  timestamp: z.coerce.date(),
  hash: z.string().length(64),
  rawHtmlPath: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
