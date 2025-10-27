import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { loadEnv } from "@truthlayer/config";
import { normalizeResults, RawSerpItem } from "./normalize";
import pRetry from "p-retry";

interface CreateBraveClientOptions {
  config: CollectorConfig;
  logger: Logger;
}

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  language?: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveWebResult[];
  };
  error?: {
    code: string;
    message: string;
  };
}

export function createBraveClient({ config, logger }: CreateBraveClientOptions) {
  const env = loadEnv();
  const apiKey = env.BRAVE_API_KEY;

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    // If API key not configured, log warning and return empty
    if (!apiKey) {
      logger.warn("Brave API key not configured", {
        engine: "brave",
        query: query.query,
        hint: "Set BRAVE_API_KEY in .env"
      });
      return [];
    }

    try {
      const maxResults = Math.min(config.maxResultsPerQuery, 20); // Brave API max is 20
      const apiUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query.query)}&count=${maxResults}`;

      const response = await pRetry(
        async () => {
          const res = await fetch(apiUrl, {
            headers: {
              "Accept": "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": apiKey
            }
          });
          
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Brave API error: ${res.status} ${errorText}`);
          }
          return res.json() as Promise<BraveSearchResponse>;
        },
        { retries: 2, factor: 2 }
      );

      if (response.error) {
        logger.error("Brave API returned error", {
          engine: "brave",
          query: query.query,
          error: response.error.message
        });
        return [];
      }

      if (!response.web || !response.web.results || response.web.results.length === 0) {
        logger.warn("Brave API returned no results", {
          engine: "brave",
          query: query.query
        });
        return [];
      }

      const collectedAt = new Date();
      const rawResults: RawSerpItem[] = response.web.results.map((result, index) => ({
        rank: index + 1,
        title: result.title || "",
        snippet: result.description || "",
        url: result.url || "",
        confidence: 1.0
      }));

      logger.info("Brave API search successful", {
        engine: "brave",
        query: query.query,
        resultCount: rawResults.length
      });

      const normalized = normalizeResults({
        engine: "brave",
        query,
        rawResults,
        collectedAt,
        config,
        rawHtmlPath: null // API-based, no HTML
      });

      return normalized;
    } catch (error) {
      logger.error("Brave API search failed", {
        engine: "brave",
        query: query.query,
        error: (error as Error).message
      });
      return [];
    }
  }

  async function close() {
    // No browser to close for API client
    logger.info("Brave API client closed");
  }

  return { search, close };
}
