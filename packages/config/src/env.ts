import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const BooleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no", ""].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  BRAVE_API_KEY: z.string().min(1).optional(),
  BING_API_KEY: z.string().min(1).optional(),
  PROXY_URL: z.string().min(1).optional(),
  STORAGE_URL: z.string().min(1).optional(),
  BENCHMARK_QUERY_SET_PATH: z.string().min(1).default("config/benchmark-queries.json"),
  COLLECTOR_OUTPUT_DIR: z.string().min(1).default("data/serp"),
  COLLECTOR_MAX_RESULTS: z.coerce.number().int().min(1).max(100).optional(),
  COLLECTOR_USER_AGENT: z.string().min(1).default("TruthLayerBot/0.1 (https://truthlayer.ai)"),
  COLLECTOR_RESPECT_ROBOTS: BooleanFromEnv.optional().default(true),
  COLLECTOR_ROBOTS_CACHE_TTL_MS: z.coerce.number().int().min(60000).max(86400000).default(3600000),
  COLLECTOR_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  FORCE_REFRESH: z.enum(["true", "false"]).default("false").transform(v => v === "true"),
  ANNOTATION_CACHE_DIR: z.string().min(1).default("data/cache/annotation"),
  ANNOTATION_MODEL: z.string().min(1).default("gpt-4o-mini"),
  ANNOTATION_PROMPT_VERSION: z.string().min(1).default("v1"),
  ANNOTATION_PROVIDER: z.enum(["openai", "claude", "auto"]).default("openai"),
  ANNOTATION_CLAUDE_PYTHON: z.string().min(1).default("python3"),
  ANNOTATION_CLAUDE_SCRIPT: z.string().min(1).default("apps/annotation/python/claude_bridge.py"),
  ANNOTATION_CONFIDENCE_DEFAULT: z.coerce.number().min(0).max(1).default(0.7),
  ANNOTATION_BATCH_SIZE: z.coerce.number().int().min(1).max(50).optional(),
  ANNOTATION_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).optional(),
  ANNOTATION_POLLING_INTERVAL_MS: z.coerce.number().int().min(1000).optional(),
  ANNOTATION_AUDIT_SAMPLE_SIZE: z.coerce.number().int().min(0).max(100).optional(),
  SCHEDULER_CRON_EXPRESSION: z.string().default("0 * * * *"),
  SCHEDULER_RUN_ON_START: BooleanFromEnv.optional().default(true),
  SCHEDULER_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  SCHEDULER_RETRY_DELAY_MS: z.coerce.number().int().min(1000).max(600000).default(10000),
  SCHEDULER_TIMEZONE: z.string().default("UTC"),
  SCHEDULER_MANUAL_AUDIT_PERCENT: z.coerce.number().int().min(1).max(100).default(5),
  METRICS_EXPORT_DIR: z.string().min(1).default("data/metrics"),
  METRICS_WINDOW_SIZE: z.coerce.number().int().min(1).max(90).optional(),
  LOG_LEVEL: z.string().optional()
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let cachedEnv: EnvConfig | null = null;
let envLoaded = false;

function applyEnvFile() {
  if (envLoaded) return;
  envLoaded = true;

  const envPath = path.resolve(process.cwd(), ".env");

  try {
    const content = readFileSync(envPath, "utf-8");

    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = line.slice(0, separatorIndex).trim();
      if (!key) continue;

      const rawValue = line.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export function loadEnv(): EnvConfig {
  if (!cachedEnv) {
    applyEnvFile();
    cachedEnv = EnvSchema.parse(process.env);
  }

  return cachedEnv;
}
