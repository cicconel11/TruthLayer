import { SearchResult } from "@truthlayer/schema";
import type { SearchResultInput, StorageClient } from "./types";

export async function saveSearchResults(storage: StorageClient, results: SearchResult[]): Promise<void> {
  if (!results.length) return;
  const inputs: SearchResultInput[] = results.map((r) => ({
    id: r.id,
    crawlRunId: r.crawlRunId,
    queryId: r.queryId,
    engine: r.engine,
    rank: r.rank,
    title: r.title,
    snippet: r.snippet ?? null,
    url: r.url,
    normalizedUrl: r.normalizedUrl,
    domain: r.domain,
    timestamp: typeof r.timestamp === "string" ? new Date(r.timestamp) : r.timestamp,
    hash: r.hash,
    rawHtmlPath: r.rawHtmlPath,
    createdAt: typeof r.createdAt === "string" ? new Date(r.createdAt) : r.createdAt,
    updatedAt: typeof r.updatedAt === "string" ? new Date(r.updatedAt) : r.updatedAt
  }));

  await storage.insertSearchResults(inputs);
}

