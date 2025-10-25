import { beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("loadEnv", () => {
  it("returns defaults when optional env vars are unset", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANNOTATION_MODEL;
    delete process.env.BENCHMARK_QUERY_SET_PATH;
    delete process.env.NODE_ENV;

    const { loadEnv } = await import("./env");
    const env = loadEnv();

    expect(env.NODE_ENV).toBe("development");
    expect(env.BENCHMARK_QUERY_SET_PATH).toBe("config/benchmark-queries.json");
    expect(env.ANNOTATION_MODEL).toBe("gpt-4o-mini");
    expect(env.ANNOTATION_PROMPT_VERSION).toBe("v1");
    expect(env.ANNOTATION_CACHE_DIR).toBe("data/cache/annotation");
  });

  it("coerces numeric strings into numbers", async () => {
    process.env.ANNOTATION_BATCH_SIZE = "25";
    process.env.ANNOTATION_MAX_CONCURRENCY = "5";
    process.env.ANNOTATION_POLLING_INTERVAL_MS = "7500";
    process.env.METRICS_WINDOW_SIZE = "14";

    const { loadEnv } = await import("./env");
    const env = loadEnv();

    expect(env.ANNOTATION_BATCH_SIZE).toBe(25);
    expect(env.ANNOTATION_MAX_CONCURRENCY).toBe(5);
    expect(env.ANNOTATION_POLLING_INTERVAL_MS).toBe(7500);
    expect(env.METRICS_WINDOW_SIZE).toBe(14);
  });

  it("caches parsed values across invocations", async () => {
    delete process.env.NODE_ENV;
    process.env.ANNOTATION_MODEL = "model-a";

    const { loadEnv } = await import("./env");
    const first = loadEnv();
    expect(first.ANNOTATION_MODEL).toBe("model-a");

    process.env.ANNOTATION_MODEL = "model-b";
    const second = loadEnv();
    expect(second.ANNOTATION_MODEL).toBe("model-a");
    expect(second).toBe(first);
  });
});
