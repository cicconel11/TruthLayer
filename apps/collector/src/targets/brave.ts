import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { takeHtmlSnapshot } from "./utils";
import { normalizeResults, RawSerpItem } from "./normalize";

/**
 * Brave Search API client
 * 
 * @see https://api.search.brave.com/app/documentation/web-search/get-started
 * @see https://brave.com/search/api/
 */

interface CreateBraveClientOptions {
  config: CollectorConfig;
  logger: Logger;
  runId: string;
}

interface BraveApiResponse {
  web?: {
    results?: Array<{
      title?: string;
      description?: string;
      url?: string;
    }>;
  };
}

export function createBraveClient({ config, logger, runId }: CreateBraveClientOptions) {
  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    if (!config.braveApiKey) {
      logger.error("brave api key missing", { 
        query: query.query,
        message: "BRAVE_API_KEY environment variable not set" 
      });
      return [];
    }

    try {
      const endpoint = "https://api.search.brave.com/res/v1/web/search";
      const params = new URLSearchParams({
        q: query.query,
        count: Math.min(config.maxResultsPerQuery, 20).toString()
      });

      const url = `${endpoint}?${params.toString()}`;

      logger.info("calling brave api", { 
        query: query.query, 
        count: config.maxResultsPerQuery 
      });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Subscription-Token": config.braveApiKey,
          "Accept": "application/json",
          "Accept-Encoding": "gzip"
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error("brave api error", {
          query: query.query,
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });

        if (response.status === 401) {
          logger.error("brave api authentication failed", {
            message: "Invalid API key. Check BRAVE_API_KEY in .env"
          });
        } else if (response.status === 429) {
          logger.error("brave api rate limit exceeded", {
            message: "Rate limit reached. Check your plan at https://api-dashboard.search.brave.com/"
          });
        }

        return [];
      }

      const data: BraveApiResponse = await response.json();
      const collectedAt = new Date();

      // Save API response as JSON snapshot
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "brave",
        runId: config.runId,
        queryId: query.id,
        html: JSON.stringify(data, null, 2)
      });

      // Extract results from API response
      const webResults = data.web?.results || [];
      const rawResults: RawSerpItem[] = webResults
        .filter(item => item.url && item.title)
        .map((item, index) => ({
          rank: index + 1,
          title: (item.title || "").trim(),
          snippet: (item.description || "").trim(),
          url: item.url || ""
        }));

      logger.info("brave api results", {
        query: query.query,
        resultCount: rawResults.length,
        apiResponseSize: webResults.length
      });

      if (rawResults.length === 0) {
        logger.warn("brave api returned no valid results", { 
          query: query.query,
          totalResults: webResults.length
        });
      }

      return normalizeResults({
        engine: "brave",
        query,
        items: rawResults,
        collectedAt,
        rawHtmlPath: null, // API-based, no HTML
        crawlRunId: runId
      });
    } catch (error) {
      logger.error("brave search failed", { 
        query: query.query, 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      return [];
    }
  }

  return { search };
}
