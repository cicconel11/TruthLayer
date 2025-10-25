import { Browser } from "puppeteer";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { ensureRequestPermitted } from "../lib/compliance";
import { ensureBrowser, randomUserAgent, takeHtmlSnapshot } from "./utils";
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

      const collectedAt = new Date();
      const htmlSnapshot = await page.content();
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "perplexity",
        runId: config.runId,
        queryId: query.id,
        html: htmlSnapshot
      });

      // Perplexity is a SPA; fallback to extracting outbound links from result list
      const rawResults = await page.evaluate((max: number) => {
        // Attempt various containers where results appear
        const containers = Array.from(
          document.querySelectorAll(
            "[data-testid='search-results'] a[href^='http'], main a[href^='http']:not([href*='perplexity.ai'])"
          )
        ) as HTMLAnchorElement[];

        const unique: string[] = [];
        const items: { rank: number; title: string; snippet?: string; url: string }[] = [];

        for (const a of containers) {
          const href = a.href;
          if (!href || href.includes("perplexity.ai")) continue;
          if (unique.includes(href)) continue;
          unique.push(href);
          const parent = a.closest("article, li, div");
          const title = (a.textContent || "").trim();
          const snippet = (parent?.textContent || "").replace(title, "").trim().slice(0, 500);
          items.push({ rank: items.length + 1, title, snippet, url: href });
          if (items.length >= max) break;
        }
        return items;
      }, Math.min(config.maxResultsPerQuery, 20)) as RawSerpItem[];

      return normalizeResults({
        engine: "perplexity",
        query,
        collectedAt,
        rawHtmlPath: htmlPath,
        items: rawResults
      });
    } catch (error) {
      logger.error("perplexity search failed", { query: query.query, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  return { search };
}

