import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { loadEnv } from "@truthlayer/config";
import { normalizeResults, RawSerpItem } from "./normalize";
import pRetry from "p-retry";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

interface CreateGoogleClientOptions {
  config: CollectorConfig;
  logger: Logger;
  runId: string;
}

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet?: string;
  displayLink?: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  error?: {
    code: number;
    message: string;
  };
}

export function createGoogleClient({ config, logger, runId }: CreateGoogleClientOptions) {
  const env = loadEnv();
  const apiKey = env.GOOGLE_API_KEY;
  const searchEngineId = env.GOOGLE_SEARCH_ENGINE_ID;

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    // If API keys not configured, log warning and return empty
    if (!apiKey || !searchEngineId) {
      logger.warn("Google API credentials not configured", {
        engine: "google",
        query: query.query,
        hint: "Set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env"
      });
      return [];
    }

    try {
      const maxResults = Math.min(config.maxResultsPerQuery, 10); // Google API max is 10 per request
      const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query.query)}&num=${maxResults}`;

      const response = await pRetry(
        async () => {
          const res = await fetch(apiUrl);
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Google API error: ${res.status} ${errorText}`);
          }
          return res.json() as Promise<GoogleSearchResponse>;
        },
        { retries: 2, factor: 2 }
      );

      if (response.error) {
        logger.error("Google API returned error", {
          engine: "google",
          query: query.query,
          error: response.error.message
        });
        return [];
      }

      if (!response.items || response.items.length === 0) {
        logger.warn("Google API returned no results", {
          engine: "google",
          query: query.query
        });
        return [];
      }

      const collectedAt = new Date();
      const rawResults: RawSerpItem[] = response.items.map((item, index) => ({
        rank: index + 1,
        title: item.title || "",
        snippet: item.snippet || "",
        url: item.link || "",
        confidence: 1.0
      }));

      logger.info("Google API search successful", {
        engine: "google",
        query: query.query,
        resultCount: rawResults.length
      });

      const normalized = normalizeResults({
        engine: "google",
        query,
        items: rawResults,
        collectedAt,
        rawHtmlPath: null, // API-based, no HTML
        crawlRunId: runId
      });

      return normalized;
    } catch (error) {
      logger.error("Google API search failed", {
        engine: "google",
        query: query.query,
        error: (error as Error).message
      });
      return [];
    }
  }

  async function close() {
    // No browser to close for API client
    logger.info("Google API client closed");
  }

  return { search, close };
}
