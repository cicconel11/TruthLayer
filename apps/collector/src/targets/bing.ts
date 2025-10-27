import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { loadEnv } from "@truthlayer/config";
import { normalizeResults, RawSerpItem } from "./normalize";
import pRetry from "p-retry";

interface CreateBingClientOptions {
  config: CollectorConfig;
  logger: Logger;
}

interface BingWebPage {
  name: string;
  url: string;
  snippet?: string;
  displayUrl?: string;
}

interface BingSearchResponse {
  webPages?: {
    value: BingWebPage[];
  };
  error?: {
    code: string;
    message: string;
  };
}

export function createBingClient({ config, logger }: CreateBingClientOptions) {
  const env = loadEnv();
  const apiKey = env.BING_API_KEY;

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    // If API key not configured, log warning and return empty
    if (!apiKey) {
      logger.warn("Bing API key not configured", {
        engine: "bing",
        query: query.query,
        hint: "Set BING_API_KEY in .env"
      });
      return [];
    }

    try {
      const maxResults = Math.min(config.maxResultsPerQuery, 50); // Bing API max is 50
      const apiUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query.query)}&count=${maxResults}`;

      const response = await pRetry(
        async () => {
          const res = await fetch(apiUrl, {
            headers: {
              "Ocp-Apim-Subscription-Key": apiKey
            }
          });
          
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Bing API error: ${res.status} ${errorText}`);
          }
          return res.json() as Promise<BingSearchResponse>;
        },
        { retries: 2, factor: 2 }
      );

      if (response.error) {
        logger.error("Bing API returned error", {
          engine: "bing",
          query: query.query,
          error: response.error.message
        });
        return [];
      }

      if (!response.webPages || !response.webPages.value || response.webPages.value.length === 0) {
        logger.warn("Bing API returned no results", {
          engine: "bing",
          query: query.query
        });
        return [];
      }

      const collectedAt = new Date();
      const rawResults: RawSerpItem[] = response.webPages.value.map((page, index) => ({
        rank: index + 1,
        title: page.name || "",
        snippet: page.snippet || "",
        url: page.url || "",
        confidence: 1.0
      }));

      logger.info("Bing API search successful", {
        engine: "bing",
        query: query.query,
        resultCount: rawResults.length
      });

      const normalized = normalizeResults({
        engine: "bing",
        query,
        rawResults,
        collectedAt,
        config,
        rawHtmlPath: null // API-based, no HTML
      });

      return normalized;
    } catch (error) {
      logger.error("Bing API search failed", {
        engine: "bing",
        query: query.query,
        error: (error as Error).message
      });
      return [];
    }
  }

  async function close() {
    // No browser to close for API client
    logger.info("Bing API client closed");
  }

  return { search, close };
}
