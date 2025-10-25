import { URL } from "node:url";
import { createHash } from "node:crypto";
import { CollectorConfig } from "./config";
import { Logger } from "./logger";

interface RobotsRuleSet {
  fetchedAt: number;
  disallow: string[];
}

const robotsCache = new Map<string, RobotsRuleSet>();

function parseRobotsTxt(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const disallow: string[] = [];
  let applies = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [directiveRaw, valueRaw] = line.split(":", 2);
    if (!directiveRaw || valueRaw === undefined) continue;
    const directive = directiveRaw.trim().toLowerCase();
    const value = valueRaw.trim();

    if (directive === "user-agent") {
      applies = value === "*";
    } else if (directive === "disallow" && applies && value.length) {
      disallow.push(value);
    }
  }

  return disallow;
}

async function fetchRobotsTxt(host: string, logger: Logger): Promise<RobotsRuleSet> {
  const now = Date.now();
  const cached = robotsCache.get(host);
  if (cached && now - cached.fetchedAt < 60_000) {
    return cached;
  }

  try {
    const response = await fetch(`https://${host}/robots.txt`, {
      redirect: "follow"
    });
    if (!response.ok) {
      const ruleSet = { fetchedAt: now, disallow: [] };
      robotsCache.set(host, ruleSet);
      return ruleSet;
    }

    const body = await response.text();
    const ruleSet = {
      fetchedAt: now,
      disallow: parseRobotsTxt(body)
    };
    robotsCache.set(host, ruleSet);
    return ruleSet;
  } catch (error) {
    logger.warn("robots fetch failed", { host, error });
    const ruleSet = { fetchedAt: now, disallow: [] };
    robotsCache.set(host, ruleSet);
    return ruleSet;
  }
}

function isPathDisallowed(pathname: string, disallowRules: string[]): boolean {
  if (!disallowRules.length) return false;
  const target = pathname.endsWith("/") ? pathname : `${pathname}`;
  return disallowRules.some((rule) => rule !== "/" && target.startsWith(rule));
}

export async function ensureRequestPermitted(
  url: string,
  config: CollectorConfig,
  logger: Logger
): Promise<void> {
  if (!config.respectRobots) return;

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    const cacheKey = createHash("sha1").update(host).digest("hex");
    let ruleSet = robotsCache.get(cacheKey);
    const now = Date.now();
    if (!ruleSet || now - ruleSet.fetchedAt > config.robotsCacheTtlMs) {
      ruleSet = await fetchRobotsTxt(host, logger);
      robotsCache.set(cacheKey, ruleSet);
    }

    if (isPathDisallowed(parsedUrl.pathname, ruleSet.disallow)) {
      throw new Error(`Robots.txt disallows crawling ${parsedUrl.pathname} on ${host}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to evaluate robots compliance for ${url}`);
  }
}

