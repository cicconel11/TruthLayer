import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import type { RawSerpItem } from "./normalize";

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const COMMON_USER_AGENTS: string[] = [
  // A small pool; env-provided UA will be included too
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
];

export function randomUserAgent(config: CollectorConfig): string {
  const pool = [config.userAgent, ...COMMON_USER_AGENTS.filter((ua) => ua !== config.userAgent)];
  return pickRandom(pool);
}

export function pickProxy(proxyUrl?: string): string | undefined {
  if (!proxyUrl) return undefined;
  // Allow comma-separated proxies from env; otherwise single value
  const parts = proxyUrl.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  return pickRandom(parts);
}

export async function ensureBrowser(config: CollectorConfig): Promise<Browser> {
  const args = ["--no-sandbox", "--disable-setuid-sandbox"];
  const proxy = pickProxy(config.proxyUrl);
  if (proxy) args.push(`--proxy-server=${proxy}`);
  return puppeteer.launch({ headless: "new", args });
}

export async function takeHtmlSnapshot(options: {
  engine: string;
  runId: string;
  queryId: string;
  html: string;
}): Promise<{ htmlPath: string; sha256Path: string; sha256: string }> {
  const baseDir = path.resolve("data/raw_html", options.engine, options.runId);
  await fs.mkdir(baseDir, { recursive: true });
  const htmlPath = path.join(baseDir, `${options.queryId}.html`);
  await fs.writeFile(htmlPath, options.html, "utf-8");
  const sha256 = createHash("sha256").update(options.html).digest("hex");
  const sha256Path = `${htmlPath}.sha256`;
  await fs.writeFile(sha256Path, `${sha256}\n`, "utf-8");
  return { htmlPath, sha256Path, sha256 };
}

/**
 * Wait for search results to appear on the page
 * @see https://pptr.dev/api/puppeteer.page
 */
export async function waitForResults(
  page: Page, 
  selectors: string[], 
  timeoutMs: number = 10000
): Promise<string | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    for (const selector of selectors) {
      const count = await page.$$eval(selector, els => els.length).catch(() => 0);
      if (count > 0) {
        return selector;  // Return which selector worked
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return null;  // No results found
}

/**
 * Quality metrics for extracted search results
 */
export interface ExtractionQuality {
  totalResults: number;
  validUrls: number;
  confidence: number;
  warnings: string[];
}

/**
 * Validate the quality of extracted search results
 */
export function validateExtraction(items: RawSerpItem[]): ExtractionQuality {
  const validUrls = items.filter(i => 
    i.url && (i.url.startsWith('http://') || i.url.startsWith('https://'))
  ).length;
  
  const warnings: string[] = [];
  
  if (items.length === 0) {
    warnings.push('No results extracted');
  }
  if (validUrls === 0 && items.length > 0) {
    warnings.push('No valid URLs extracted');
  }
  if (validUrls < items.length * 0.5) {
    warnings.push(`Low URL quality: ${validUrls}/${items.length}`);
  }
  
  const hasContent = items.filter(i => i.title && i.title.length > 3).length;
  if (hasContent < items.length * 0.7) {
    warnings.push(`Missing titles: ${items.length - hasContent}/${items.length}`);
  }
  
  const confidence = items.length === 0 ? 0 : validUrls / items.length;
  
  return {
    totalResults: items.length,
    validUrls,
    confidence,
    warnings
  };
}

/**
 * Capture debug snapshot (screenshot + HTML) for troubleshooting
 */
export async function captureDebugSnapshot(
  page: Page,
  engine: string,
  runId: string,
  queryId: string,
  reason: string
): Promise<string> {
  const timestamp = Date.now();
  const dir = path.join("data", "debug", engine, runId);
  await fs.mkdir(dir, { recursive: true });
  
  const screenshotPath = path.join(dir, `${queryId}-${timestamp}.png`);
  const htmlPath = path.join(dir, `${queryId}-${timestamp}.html`);
  
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const html = await page.content();
  await fs.writeFile(htmlPath, html);
  
  return screenshotPath;
}

/**
 * Detect if the page is showing bot detection/CAPTCHA
 */
export async function detectBotBlock(page: Page): Promise<boolean> {
  const indicators = [
    'recaptcha',
    'captcha',
    'unusual traffic',
    'automated queries',
    'not a robot',
    'verify you are human'
  ];
  
  const pageText = await page.evaluate(() => document.body.textContent || '');
  const lowerText = pageText.toLowerCase();
  
  return indicators.some(indicator => lowerText.includes(indicator));
}

