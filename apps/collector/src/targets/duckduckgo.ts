import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { takeHtmlSnapshot } from "./utils";
import { normalizeResults, RawSerpItem } from "./normalize";
import { load } from "cheerio";

/**
 * DuckDuckGo Search Client
 * 
 * Uses DuckDuckGo's Instant Answer API as primary source,
 * with HTML scraping fallback for better result coverage.
 * 
 * @see https://api.duckduckgo.com/
 * @see https://duckduckgo.com/api
 */

interface CreateDuckDuckGoClientOptions {
  config: CollectorConfig;
  logger: Logger;
  runId: string;
}

interface DuckDuckGoApiResponse {
  Abstract?: string;
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
    Icon?: {
      URL?: string;
    };
    Topics?: Array<{
      Text?: string;
      FirstURL?: string;
    }>;
  }>;
}

export function createDuckDuckGoClient({ config, logger, runId }: CreateDuckDuckGoClientOptions) {
  async function searchViaApi(query: BenchmarkQuery): Promise<RawSerpItem[]> {
    try {
      const endpoint = "https://api.duckduckgo.com/";
      const params = new URLSearchParams({
        q: query.query,
        format: "json",
        no_redirect: "1",
        no_html: "1"
      });

      const url = `${endpoint}?${params.toString()}`;

      logger.info("calling duckduckgo api", { 
        query: query.query 
      });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        logger.error("duckduckgo api error", {
          query: query.query,
          status: response.status,
          statusText: response.statusText
        });
        return [];
      }

      const data: DuckDuckGoApiResponse = await response.json();
      const rawResults: RawSerpItem[] = [];

      // Debug logging
      logger.info("duckduckgo api response debug", {
        query: query.query,
        hasAbstract: !!data.Abstract,
        hasAbstractURL: !!data.AbstractURL,
        relatedTopicsCount: data.RelatedTopics?.length || 0,
        relatedTopicsType: data.RelatedTopics ? typeof data.RelatedTopics[0] : 'none'
      });

      // Extract main abstract result if present
      if (data.AbstractURL && data.Abstract) {
        rawResults.push({
          rank: 1,
          title: data.Heading || data.Abstract.substring(0, 100),
          snippet: data.AbstractText || data.Abstract,
          url: data.AbstractURL,
          source: "api"
        });
      }

      // Extract related topics (can be nested)
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          // Direct topic with URL
          if (topic.FirstURL && topic.Text) {
            rawResults.push({
              rank: rawResults.length + 1,
              title: topic.Text.split(" - ")[0].trim(),
              snippet: topic.Text,
              url: topic.FirstURL,
              source: "api"
            });
          }
          // Nested topics array
          else if (topic.Topics && Array.isArray(topic.Topics)) {
            for (const nestedTopic of topic.Topics) {
              if (nestedTopic.FirstURL && nestedTopic.Text) {
                rawResults.push({
                  rank: rawResults.length + 1,
                  title: nestedTopic.Text.split(" - ")[0].trim(),
                  snippet: nestedTopic.Text,
                  url: nestedTopic.FirstURL,
                  source: "api"
                });
              }
            }
          }
        }
      }

      logger.info("duckduckgo api results", {
        query: query.query,
        resultCount: rawResults.length,
        source: "api"
      });

      return rawResults.slice(0, config.maxResultsPerQuery);
    } catch (error) {
      logger.error("duckduckgo api failed", { 
        query: query.query, 
        error: (error as Error).message
      });
      return [];
    }
  }

  async function searchViaHtml(query: BenchmarkQuery): Promise<RawSerpItem[]> {
    try {
      const endpoint = "https://duckduckgo.com/html/";
      const params = new URLSearchParams({
        q: query.query
      });

      const url = `${endpoint}?${params.toString()}`;

      logger.info("calling duckduckgo html", { 
        query: query.query 
      });

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "text/html",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        logger.error("duckduckgo html error", {
          query: query.query,
          status: response.status,
          statusText: response.statusText
        });
        return [];
      }

      const html = await response.text();
      const $ = load(html);
      const rawResults: RawSerpItem[] = [];

      // Parse organic results
      $(".result").each((index, element) => {
        if (index >= config.maxResultsPerQuery) return false;

        const $result = $(element);
        const $link = $result.find(".result__a");
        const $snippet = $result.find(".result__snippet");

        let url = $link.attr("href");
        const title = $link.text().trim();
        const snippet = $snippet.text().trim();

        // Fix protocol-relative URLs
        if (url && url.startsWith('//')) {
          url = 'https:' + url;
        }

        if (url && title) {
          rawResults.push({
            rank: index + 1,
            title,
            snippet,
            url,
            source: "html"
          });
        }
      });

      logger.info("duckduckgo html results", {
        query: query.query,
        resultCount: rawResults.length,
        source: "html"
      });

      return rawResults;
    } catch (error) {
      logger.error("duckduckgo html scraping failed", { 
        query: query.query, 
        error: (error as Error).message
      });
      return [];
    }
  }

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    try {
      // Try API first
      let rawResults = await searchViaApi(query);

      // Fallback to HTML if API returns insufficient results
      if (rawResults.length < 3) {
        logger.info("duckduckgo api returned insufficient results, falling back to html", {
          query: query.query,
          apiResults: rawResults.length
        });
        rawResults = await searchViaHtml(query);
      }

      const collectedAt = new Date();

      // Save raw response (API or HTML)
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "duckduckgo",
        runId: config.runId,
        queryId: query.id,
        html: JSON.stringify({ results: rawResults, collectedAt: collectedAt.toISOString() }, null, 2)
      });

      logger.info("duckduckgo before normalization", {
        query: query.query,
        rawResultsCount: rawResults.length,
        sampleUrl: rawResults[0]?.url,
        sampleTitle: rawResults[0]?.title
      });

      if (rawResults.length === 0) {
        logger.warn("duckduckgo returned no valid results", { 
          query: query.query
        });
      }

      const normalized = normalizeResults({
        engine: "duckduckgo",
        query,
        collectedAt,
        rawHtmlPath: htmlPath,
        items: rawResults,
        crawlRunId: runId
      });

      logger.info("duckduckgo after normalization", {
        query: query.query,
        normalizedCount: normalized.length
      });

      return normalized;
    } catch (error) {
      logger.error("duckduckgo search failed", { 
        query: query.query, 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      return [];
    }
  }

  return { search };
}

