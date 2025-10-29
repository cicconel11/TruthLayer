import { loadEnv } from "@truthlayer/config";
import z from "zod";

const EngineConfigSchema = z.object({
  enabled: z.boolean().default(true),
  concurrency: z.number().int().min(1).default(1),
  delayMs: z.number().int().min(0).default(2000)
});

const CollectorConfigSchema = z.object({
  runId: z.string().default(() => crypto.randomUUID()),
  benchmarkQuerySetPath: z.string().default("config/benchmark-queries.json"),
  outputDir: z.string().default("data/serp"),
  proxyUrl: z.string().optional(),
  braveApiKey: z.string().optional(),
  bingApiKey: z.string().optional(),
  userAgent: z.string().default("TruthLayerBot/0.1 (https://truthlayer.ai)"),
  respectRobots: z.boolean().default(true),
  robotsCacheTtlMs: z.number().int().min(60000).max(86400000).default(3600000),
  engines: z.object({
    google: EngineConfigSchema,
    bing: EngineConfigSchema,
    perplexity: EngineConfigSchema,
    brave: EngineConfigSchema,
    duckduckgo: EngineConfigSchema
  }),
  maxResultsPerQuery: z.number().int().min(1).max(100).default(20),
  cacheTtlMs: z.number().int().min(0).default(7 * 24 * 60 * 60 * 1000), // 7 days
  forceRefresh: z.boolean().default(false),
  rateLimits: z.object({
    brave: z.number().min(0.1).max(10).default(1),
    perplexity: z.number().min(0.1).max(10).default(2)
  }).default({ brave: 1, perplexity: 2 })
});

export type CollectorConfig = z.infer<typeof CollectorConfigSchema>;

export function makeCollectorConfig(): CollectorConfig {
  const env = loadEnv();

  return CollectorConfigSchema.parse({
    engines: {
      google: {},
      bing: {},
      perplexity: {},
      brave: {},
      duckduckgo: {}
    },
    benchmarkQuerySetPath: env.BENCHMARK_QUERY_SET_PATH,
    outputDir: env.COLLECTOR_OUTPUT_DIR,
    proxyUrl: env.PROXY_URL,
    braveApiKey: env.BRAVE_API_KEY,
    bingApiKey: env.BING_API_KEY,
    maxResultsPerQuery: env.COLLECTOR_MAX_RESULTS,
    userAgent: env.COLLECTOR_USER_AGENT,
    respectRobots: env.COLLECTOR_RESPECT_ROBOTS,
    robotsCacheTtlMs: env.COLLECTOR_ROBOTS_CACHE_TTL_MS,
    cacheTtlMs: env.COLLECTOR_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
    forceRefresh: env.FORCE_REFRESH,
    rateLimits: {
      brave: env.BRAVE_RATE_LIMIT_RPS,
      perplexity: env.PERPLEXITY_RATE_LIMIT_RPS
    }
  });
}
