import { Browser } from "puppeteer";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { ensureRequestPermitted } from "../lib/compliance";
import { ensureBrowser, randomUserAgent, takeHtmlSnapshot } from "./utils";
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

      const collectedAt = new Date();
      const htmlSnapshot = await page.content();
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "brave",
        runId: config.runId,
        queryId: query.id,
        html: htmlSnapshot
      });

      const rawResults = await page.evaluate((max: number) => {
        const els = Array.from(document.querySelectorAll(".fdb, .snippet.fdb"));
      const items = els.slice(0, max).map((el, i) => {
        const titleEl = el.querySelector("a.result-header, a[href*='http']") as HTMLAnchorElement | null;
        const snippetEl = el.querySelector(".snippet-content, .snippet-description, .result-snippet") as HTMLElement | null;
        let url = titleEl?.href ?? "";
        
        // Check for Brave redirect URLs and validate
        try {
          if (url.includes("search.brave.com/redirect") || url.includes("brave.com/link")) {
            const u = new URL(url);
            const target = u.searchParams.get("url") || u.searchParams.get("u");
            if (target) {
              url = decodeURIComponent(target);
            }
          }
          // Validate it's a proper URL
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
          url
        };
      });
        return items;
      }, Math.min(config.maxResultsPerQuery, 20)) as RawSerpItem[];

      return normalizeResults({
        engine: "brave",
        query,
        collectedAt,
        rawHtmlPath: htmlPath,
        items: rawResults
      });
    } catch (error) {
      logger.error("brave search failed", { query: query.query, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  return { search };
}

