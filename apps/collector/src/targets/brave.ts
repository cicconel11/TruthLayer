import { Browser } from "puppeteer";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { ensureRequestPermitted } from "../lib/compliance";
import { ensureBrowser, randomUserAgent, takeHtmlSnapshot, waitForResults, validateExtraction, detectBotBlock, captureDebugSnapshot } from "./utils";
import { normalizeResults, RawSerpItem } from "./normalize";
import pRetry from "p-retry";

interface CreateBraveClientOptions {
  config: CollectorConfig;
  logger: Logger;
}

export function createBraveClient({ config, logger }: CreateBraveClientOptions) {
  let browser: Browser | null = null;

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    const browserInstance = browser ?? (browser = await ensureBrowser(config));
    const page = await browserInstance.newPage();

    try {
      await page.setUserAgent(randomUserAgent(config));
      const targetUrl = `https://search.brave.com/search?q=${encodeURIComponent(query.query)}`;
      await ensureRequestPermitted(targetUrl, config, logger);

      await pRetry(
        async () => {
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        },
        { retries: 2, factor: 2 }
      );

      await new Promise(resolve => setTimeout(resolve, config.engines.brave.delayMs));

      // Check for bot detection
      const isBlocked = await detectBotBlock(page);
      if (isBlocked) {
        logger.warn("bot detection triggered", { 
          engine: "brave",
          query: query.query 
        });
        await captureDebugSnapshot(page, "brave", config.runId, query.id, "bot_detected");
        return [];
      }

      // Wait for results to load
      const foundSelector = await waitForResults(page, [
        '.card[data-type]',
        '.snippet.fdb',
        'div[data-pos]'
      ], 10000);

      if (!foundSelector) {
        logger.warn("brave no results found", { query: query.query });
      }

      const collectedAt = new Date();
      const htmlSnapshot = await page.content();
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "brave",
        runId: config.runId,
        queryId: query.id,
        html: htmlSnapshot
      });

      const rawResults = await page.evaluate((max: number) => {
        // Multiple fallback selectors for Brave results
        const selectorStrategies = [
          '.card[data-type="web"]',
          '.card[data-type="news"]', 
          '.card.svelte-n0tn90',
          '.snippet.fdb',  // Legacy fallback
          'div[data-pos]'
        ];
        
        let els: Element[] = [];
        for (const selector of selectorStrategies) {
          els = Array.from(document.querySelectorAll(selector));
          if (els.length > 0) break;
        }
        
        const items = els.slice(0, max).map((el, i) => {
          // Multiple extraction strategies
          const linkEl = el.querySelector('a[href]') as HTMLAnchorElement | null;
          const titleEl = linkEl?.querySelector('h2, .title, .result-header') || 
                          el.querySelector('h2, .title');
          const snippetEl = el.querySelector('.snippet-description, .card-body, .snippet-content');
          
          let url = linkEl?.href ?? "";
          
          // Brave redirect unwrapping + validation
          try {
            if (url.includes("search.brave.com/redirect") || url.includes("brave.com/link")) {
              const u = new URL(url);
              const target = u.searchParams.get("url") || u.searchParams.get("u");
              if (target) url = decodeURIComponent(target);
            }
            if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
              url = "";
            }
          } catch {
            url = "";
          }
          
          return {
            rank: i + 1,
            title: (titleEl?.textContent || "").trim(),
            snippet: (snippetEl?.textContent || "").trim(),
            url,
            confidence: url && titleEl ? 1.0 : 0.5  // Quality indicator
          };
        });
        
        return items;
      }, Math.min(config.maxResultsPerQuery, 20)) as RawSerpItem[];

      // Validate extraction quality
      const quality = validateExtraction(rawResults);
      logger.info("extraction quality", {
        engine: "brave",
        query: query.query,
        ...quality
      });

      if (quality.confidence < 0.3) {
        logger.warn("low extraction confidence", {
          engine: "brave",
          confidence: quality.confidence,
          warnings: quality.warnings
        });
      }

      return normalizeResults({
        engine: "brave",
        query,
        collectedAt,
        rawHtmlPath: htmlPath,
        items: rawResults
      });
    } catch (error) {
      logger.error("brave search failed", { 
        query: query.query, 
        error: (error as Error).message 
      });
      
      // Capture debug info
      try {
        const debugPath = await captureDebugSnapshot(
          page,
          "brave",
          config.runId,
          query.id,
          "search_failed"
        );
        logger.info("debug snapshot saved", { path: debugPath });
      } catch (debugError) {
        logger.warn("failed to capture debug snapshot", { error: debugError });
      }
      
      throw error;
    } finally {
      try {
        await page.close();
      } catch (closeError) {
        // Page already closed, ignore
      }
    }
  }

  return { search };
}

