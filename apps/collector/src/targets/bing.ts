import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { takeHtmlSnapshot } from "./utils";
import { normalizeResults, RawSerpItem } from "./normalize";

/**
 * Bing Web Search API v7 client
 * 
 * @see https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/overview
 * @see https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/query-parameters
 */

interface CreateBingClientOptions {
  config: CollectorConfig;
  logger: Logger;
}

interface BingApiResponse {
  webPages?: {
    value?: Array<{
      name?: string;
      snippet?: string;
      url?: string;
    }>;
  };
}

export function createBingClient({ config, logger }: CreateBingClientOptions) {
  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    if (!config.bingApiKey) {
      logger.error("bing api key missing", { 
        query: query.query,
        message: "BING_API_KEY environment variable not set" 
      });
      return [];
    }

    try {
      const endpoint = "https://api.bing.microsoft.com/v7.0/search";
      const params = new URLSearchParams({
        q: query.query,
        count: Math.min(config.maxResultsPerQuery, 50).toString(),
        responseFilter: "Webpages"
      });

      const url = `${endpoint}?${params.toString()}`;

      logger.info("calling bing api", { 
        query: query.query, 
        count: config.maxResultsPerQuery 
      });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": config.bingApiKey,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error("bing api error", {
          query: query.query,
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });

        if (response.status === 401) {
          logger.error("bing api authentication failed", {
            message: "Invalid API key. Check BING_API_KEY in .env"
          });
        } else if (response.status === 429) {
          logger.error("bing api rate limit exceeded", {
            message: "Rate limit reached. Check your Azure quota."
          });
        }

        return [];
      }

      const data: BingApiResponse = await response.json();
      const collectedAt = new Date();

      // Save API response as JSON snapshot
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "bing",
        runId: config.runId,
        queryId: query.id,
        html: JSON.stringify(data, null, 2)
      });

      // Extract results from API response
      const webPages = data.webPages?.value || [];
      const rawResults: RawSerpItem[] = webPages
        .filter(item => item.url && item.name)
        .map((item, index) => ({
          rank: index + 1,
          title: (item.name || "").trim(),
          snippet: (item.snippet || "").trim(),
          url: item.url || ""
        }));

      logger.info("bing api results", {
        query: query.query,
        resultCount: rawResults.length,
        apiResponseSize: webPages.length
      });

      if (rawResults.length === 0) {
        logger.warn("bing api returned no valid results", { 
          query: query.query,
          totalResults: webPages.length
        });
      }

      return normalizeResults({
        engine: "bing",
        query,
        rawResults,
        collectedAt,
        config,
        rawHtmlPath: null // API-based, no HTML
      });
    } catch (error) {
      logger.error("bing search failed", { 
        query: query.query, 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      return [];
    }
  }

  return { search };
}
