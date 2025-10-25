import { createHash, randomUUID } from "node:crypto";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";

export interface RawSerpItem {
  rank: number;
  title: string;
  snippet?: string;
  url: string;
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
    .filter((i) => typeof i.url === "string" && i.url.length)
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

