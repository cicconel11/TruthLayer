import { describe, expect, it, vi } from "vitest";
import { ensureRequestPermitted } from "./compliance";

const logger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn()
} as any;

const baseConfig = {
  runId: "test",
  benchmarkQuerySetPath: "config/benchmark-queries.json",
  outputDir: "data/serp",
  proxyUrl: undefined,
  userAgent: "TruthLayerBot/0.1",
  respectRobots: true,
  robotsCacheTtlMs: 60_000,
  engines: {
    google: { enabled: true, concurrency: 1, delayMs: 0 },
    bing: { enabled: true, concurrency: 1, delayMs: 0 },
    perplexity: { enabled: true, concurrency: 1, delayMs: 0 },
    brave: { enabled: true, concurrency: 1, delayMs: 0 }
  },
  maxResultsPerQuery: 20
};

describe("compliance", () => {
  it("allows fetching when robots.txt is missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("Not Found", { status: 404 }));
    await expect(ensureRequestPermitted("https://example.com/path", baseConfig as any, logger)).resolves.toBeUndefined();
  });

  it("respects disallow rules", async () => {
    const robots = `User-agent: *\nDisallow: /private`; // simple robots
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(robots, { status: 200 }));
    await expect(
      ensureRequestPermitted("https://sample.com/private/data", baseConfig as any, logger)
    ).rejects.toThrow(/disallows/);
  });

  it("allows other paths when disallow doesn't match", async () => {
    const robots = `User-agent: *\nDisallow: /private`;
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(robots, { status: 200 }));
    await expect(
      ensureRequestPermitted("https://sample.com/public/info", baseConfig as any, logger)
    ).resolves.toBeUndefined();
  });
});

