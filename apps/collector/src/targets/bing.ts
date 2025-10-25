import { Browser } from "puppeteer";
import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { ensureRequestPermitted } from "../lib/compliance";
import { ensureBrowser, randomUserAgent, takeHtmlSnapshot } from "./utils";
import { normalizeResults, RawSerpItem } from "./normalize";
import pRetry from "p-retry";

interface CreateBingClientOptions {
  config: CollectorConfig;
  logger: Logger;
}

export function createBingClient({ config, logger }: CreateBingClientOptions) {
  let browser: Browser | null = null;

  async function search(query: BenchmarkQuery): Promise<SearchResult[]> {
    const browserInstance = browser ?? (browser = await ensureBrowser(config));
    const page = await browserInstance.newPage();

    try {
      await page.setUserAgent(randomUserAgent(config));

      const targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query.query)}`;
      await ensureRequestPermitted(targetUrl, config, logger);

      await pRetry(
        async () => {
          await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        },
        { retries: 2, factor: 2 }
      );

      await new Promise(resolve => setTimeout(resolve, config.engines.bing.delayMs));

      const collectedAt = new Date();
      const htmlSnapshot = await page.content();
      const { htmlPath } = await takeHtmlSnapshot({
        engine: "bing",
        runId: config.runId,
        queryId: query.id,
        html: htmlSnapshot
      });

      // Try robust set of selectors
      const rawResults = await page.evaluate((max: number) => {
        const selectors = [
          "li.b_algo",
          ".b_algo",
          ".b_searchResult",
          "[data-bm]"
        ];
        let els: Element[] = [];
        for (const sel of selectors) {
          els = Array.from(document.querySelectorAll(sel));
          if (els.length) break;
        }
        const items = els.slice(0, max).map((el, i) => {
          const titleEl = el.querySelector("h2 a, .b_title a, .b_topTitle a") as HTMLAnchorElement | null;
          const snippetEl = el.querySelector(".b_caption p, .b_snippet, .b_dList, .b_paractl") as HTMLElement | null;
          let url = titleEl?.href ?? "";
          // unwrap redirect
          try {
            if (url.includes("bing.com/ck/a?")) {
              const u = new URL(url);
              const raw = u.searchParams.get("u");
              if (raw) {
                try {
                  const decoded = atob(raw.replace(/_/g, "/").replace(/-/g, "+"));
                  url = decodeURIComponent(Array.from(decoded).map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                } catch {
                  url = decodeURIComponent(raw);
                }
              }
            }
          } catch {}
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
        engine: "bing",
        query,
        collectedAt,
        rawHtmlPath: htmlPath,
        items: rawResults
      });
    } catch (error) {
      logger.error("bing search failed", { query: query.query, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  return { search };
}

