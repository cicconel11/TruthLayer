import { createHash, randomUUID } from "node:crypto";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";

export interface RawSerpItem {
  rank: number;
  title: string;
  snippet?: string;
  url: string;
  confidence?: number;  // Quality indicator (0-1)
  source?: string;  // Collection source: 'api', 'html', etc.
  metadata?: Record<string, unknown>;  // Additional metadata (summaries, citations, etc.)
}

export function normalizeResults(params: {
  engine: SearchResult["engine"];
  query: BenchmarkQuery;
  collectedAt: Date;
  rawHtmlPath: string;
  items: RawSerpItem[];
  crawlRunId: string;
}): SearchResult[] {
  const { engine, query, collectedAt, rawHtmlPath, items, crawlRunId } = params;

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
        crawlRunId,
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
        updatedAt: nowIso,
        source: item.source,
        extractionConfidence: item.confidence ?? null,
        extractionWarnings: item.metadata?.warnings ? JSON.stringify(item.metadata.warnings) : null,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null
      } as any;
    });
}

