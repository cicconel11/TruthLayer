import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { Browser } from "puppeteer";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { ensureRequestPermitted } from "../lib/compliance";
import { ensureBrowser, randomUserAgent, takeHtmlSnapshot, waitForResults, validateExtraction, detectBotBlock, captureDebugSnapshot } from "./utils";
import { normalizeResults, RawSerpItem } from "./normalize";
import pRetry from "p-retry";

interface CreateGoogleClientOptions {
  config: CollectorConfig;
  logger: Logger;
}

export function createGoogleClient({ config, logger }: CreateGoogleClientOptions) {
  let browser: Browser | null = null;

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    const browserInstance = browser ?? (browser = await ensureBrowser(config));
    const page = await browserInstance.newPage();

    try {
      await page.setUserAgent(randomUserAgent(config));

      const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query.query)}`;
      await ensureRequestPermitted(targetUrl, config, logger);
      await pRetry(
        async () => {
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        },
        { retries: 2, factor: 2 }
      );

      await new Promise(resolve => setTimeout(resolve, config.engines.google.delayMs));

      // Check for bot detection
      const isBlocked = await detectBotBlock(page);
      if (isBlocked) {
        logger.warn("bot detection triggered", { 
          engine: "google",
          query: query.query 
        });
        await captureDebugSnapshot(page, "google", config.runId, query.id, "bot_detected");
        return [];
      }

      // Wait for results to load
      await waitForResults(page, ['div.g', '.g'], 10000);

      const collectedAt = new Date();
      const htmlSnapshot = await page.content();
      const { htmlPath: rawHtmlFile } = await takeHtmlSnapshot({
        engine: "google",
        runId: config.runId,
        queryId: query.id,
        html: htmlSnapshot
      });

      const rawResults = await page.evaluate((max: number) => {
        // Try multiple selector strategies
        const strategies = [
          { container: 'div.g', title: 'h3', link: 'a', snippet: 'div[style*="-webkit-line-clamp"]' },
          { container: '.g', title: 'h3', link: 'a[href]', snippet: '.VwiC3b' },
          { container: '[data-sokoban-container]', title: 'h3', link: 'a', snippet: 'div' }
        ];
        
        for (const strategy of strategies) {
          const containers = Array.from(document.querySelectorAll(strategy.container));
          if (containers.length === 0) continue;
          
          const items = containers.slice(0, max).map((el, i) => {
            const titleEl = el.querySelector(strategy.title);
            const linkEl = el.querySelector(strategy.link) as HTMLAnchorElement;
            const snippetEl = el.querySelector(strategy.snippet);
            
            return {
              rank: i + 1,
              title: titleEl?.textContent?.trim() ?? "",
              snippet: snippetEl?.textContent?.trim() ?? "",
              url: linkEl?.href ?? "",
              confidence: linkEl?.href ? 1.0 : 0.3
            };
          });
          
          if (items.length > 0) return items;
        }
        
        return [];
      }, Math.min(config.maxResultsPerQuery, 20)) as RawSerpItem[];

      // Validate extraction quality
      const quality = validateExtraction(rawResults);
      logger.info("extraction quality", {
        engine: "google",
        query: query.query,
        ...quality
      });

      if (quality.confidence < 0.3) {
        logger.warn("low extraction confidence", {
          engine: "google",
          confidence: quality.confidence,
          warnings: quality.warnings
        });
      }

      return normalizeResults({
        engine: "google",
        query,
        collectedAt,
        rawHtmlPath: rawHtmlFile,
        items: rawResults
      });
    } catch (error) {
      logger.error("google search failed", { 
        query: query.query, 
        error: (error as Error).message 
      });
      
      // Capture debug info
      try {
        const debugPath = await captureDebugSnapshot(
          page,
          "google",
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
