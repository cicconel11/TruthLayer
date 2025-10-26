import { createHash, randomUUID } from "node:crypto";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";

export interface RawSerpItem {
  rank: number;
  title: string;
  snippet?: string;
  url: string;
  confidence?: number;  // Quality indicator (0-1)
}

export function normalizeResults(params: {
  engine: SearchResult["engine"];
  query: BenchmarkQuery;
  collectedAt: Date;
  rawHtmlPath: string;
  items: RawSerpItem[];
}): SearchResult[] {
  const { engine, query, collectedAt, rawHtmlPath, items } = params;

  return items
    .filter((i) => {
      if (typeof i.url !== "string" || !i.url.length) return false;
      // Only allow valid HTTP(S) URLs
      return i.url.startsWith('http://') || i.url.startsWith('https://');
    })
    .map((item) => {
      const normalizedUrl = item.url;
      let domain = "";
      try {
        domain = new URL(normalizedUrl).hostname;
      } catch {
        domain = normalizedUrl;
      }

      const hash = createHash("sha256")
        .update(`${normalizedUrl}|${item.title}|${item.snippet ?? ""}|${collectedAt.toISOString()}`)
        .digest("hex");

      const nowIso = collectedAt.toISOString();

      return {
        id: randomUUID(),
        crawlRunId: null,
        queryId: query.id,
        engine,
        rank: item.rank,
        title: item.title?.length ? item.title : normalizedUrl,
        snippet: item.snippet ?? "",
        url: normalizedUrl,
        normalizedUrl,
        domain,
        timestamp: nowIso,
        hash,
        rawHtmlPath,
        createdAt: nowIso,
        updatedAt: nowIso
      } satisfies SearchResult;
    });
}

