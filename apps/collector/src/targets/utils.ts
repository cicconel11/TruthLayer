import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Browser } from "puppeteer";
import puppeteer from "puppeteer";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";

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

