import { BenchmarkQuery, SearchResult } from "@truthlayer/schema";
import { Browser } from "puppeteer";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { ensureRequestPermitted } from "../lib/compliance";
import { ensureBrowser, randomUserAgent, takeHtmlSnapshot } from "./utils";
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

      const collectedAt = new Date();
      const htmlSnapshot = await page.content();
      const { htmlPath: rawHtmlFile } = await takeHtmlSnapshot({
        engine: "google",
        runId: config.runId,
        queryId: query.id,
        html: htmlSnapshot
      });

      const rawResults = await page.$$eval("div.g", (elements) =>
        elements.slice(0, 20).map((element, index) => {
          const titleElement = element.querySelector("h3");
          const linkElement = element.querySelector("a");
          const snippetElement = element.querySelector("div[style='-webkit-line-clamp:2']");

          return {
            rank: index + 1,
            title: titleElement?.textContent ?? "",
            snippet: snippetElement?.textContent ?? "",
            url: linkElement?.getAttribute("href") ?? ""
          };
        }) as RawSerpItem[]
      );

      return normalizeResults({
        engine: "google",
        query,
        collectedAt,
        rawHtmlPath: rawHtmlFile,
        items: rawResults
      });
    } catch (error) {
      logger.error("google search failed", { query: query.query, error });
      throw error;
    } finally {
      await page.close();
    }
  }

  return { search };
}
