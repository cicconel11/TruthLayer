import { Browser } from "puppeteer";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { ensureRequestPermitted } from "../lib/compliance";
import { ensureBrowser, randomUserAgent, takeHtmlSnapshot, waitForResults, validateExtraction, detectBotBlock, captureDebugSnapshot } from "./utils";
import { normalizeResults, RawSerpItem } from "./normalize";
import pRetry from "p-retry";

interface CreatePerplexityClientOptions {
  config: CollectorConfig;
  logger: Logger;
}

export function createPerplexityClient({ config, logger }: CreatePerplexityClientOptions) {
  let browser: Browser | null = null;

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    const browserInstance = browser ?? (browser = await ensureBrowser(config));
    const page = await browserInstance.newPage();

    try {
      await page.setUserAgent(randomUserAgent(config));

      const targetUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(query.query)}`;
      await ensureRequestPermitted(targetUrl, config, logger);

      await pRetry(
        async () => {
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
        },
        { retries: 2, factor: 2 }
      );

      await new Promise(resolve => setTimeout(resolve, config.engines.perplexity.delayMs));

      // Check for bot detection
      const isBlocked = await detectBotBlock(page);
      if (isBlocked) {
        logger.warn("bot detection triggered", { 
          engine: "perplexity",
          query: query.query 
        });
        await captureDebugSnapshot(page, "perplexity", config.runId, query.id, "bot_detected");
        return [];
      }

      // Wait for results to load
      await waitForResults(page, [
        '[data-testid="search-results"]', 
        'main a[href^="http"]'
      ], 15000);

      const collectedAt = new Date();
      const htmlSnapshot = await page.content();
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "perplexity",
        runId: config.runId,
        queryId: query.id,
        html: htmlSnapshot
      });

      // Perplexity is a SPA; use multi-strategy extraction
      const rawResults = await page.evaluate((max: number) => {
        const selectorStrategies = [
          '[data-testid="search-results"] a[href^="http"]',
          'main a[href^="http"]:not([href*="perplexity.ai"])',
          'article a[href^="http"]',
          '.prose a[href^="http"]'
        ];
        
        const seen = new Set<string>();
        const items: any[] = [];
        
        for (const selector of selectorStrategies) {
          const links = Array.from(document.querySelectorAll(selector)) as HTMLAnchorElement[];
          
          for (const a of links) {
            const href = a.href;
            if (!href || href.includes("perplexity.ai") || seen.has(href)) continue;
            
            seen.add(href);
            const parent = a.closest("article, li, div");
            const title = a.textContent?.trim() || "";
            const snippet = parent?.textContent?.replace(title, "").trim().slice(0, 500) || "";
            
            items.push({
              rank: items.length + 1,
              title,
              snippet,
              url: href,
              confidence: title.length > 5 ? 1.0 : 0.5
            });
            
            if (items.length >= max) break;
          }
          
          if (items.length >= max) break;
        }
        
        return items;
      }, Math.min(config.maxResultsPerQuery, 20)) as RawSerpItem[];

      // Validate extraction quality
      const quality = validateExtraction(rawResults);
      logger.info("extraction quality", {
        engine: "perplexity",
        query: query.query,
        ...quality
      });

      if (quality.confidence < 0.3) {
        logger.warn("low extraction confidence", {
          engine: "perplexity",
          confidence: quality.confidence,
          warnings: quality.warnings
        });
      }

      return normalizeResults({
        engine: "perplexity",
        query,
        collectedAt,
        rawHtmlPath: htmlPath,
        items: rawResults
      });
    } catch (error) {
      logger.error("perplexity search failed", { 
        query: query.query, 
        error: (error as Error).message 
      });
      
      // Capture debug info
      try {
        const debugPath = await captureDebugSnapshot(
          page,
          "perplexity",
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

