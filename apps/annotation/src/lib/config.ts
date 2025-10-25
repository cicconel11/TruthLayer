import { loadEnv } from "@truthlayer/config";
import { z } from "zod";

const AnnotationConfigSchema = z.object({
  runId: z.string().default(() => crypto.randomUUID()),
  batchSize: z.number().int().min(1).max(50).default(10),
  maxConcurrency: z.number().int().min(1).max(10).default(3),
  provider: z.enum(["openai", "claude", "auto"]).default("openai"),
  openaiApiKey: z.string().min(1).optional(),
  anthropicApiKey: z.string().min(1).optional(),
  model: z.string().default("gpt-4o-mini"),
  promptVersion: z.string().default("v1"),
  cacheDir: z.string().default("data/cache/annotation"),
  pollingIntervalMs: z.number().int().min(1000).default(5000),
  claudePythonExecutable: z.string().default("python3"),
  claudeBridgePath: z.string().default("apps/annotation/python/claude_bridge.py"),
  defaultConfidence: z.number().min(0).max(1).default(0.7),
  auditSampleSize: z.number().int().min(0).max(100).default(5)
});

export type AnnotationConfig = z.infer<typeof AnnotationConfigSchema>;

export function makeAnnotationConfig(): AnnotationConfig {
  const env = loadEnv();

  const config = AnnotationConfigSchema.parse({
    provider: env.ANNOTATION_PROVIDER,
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    batchSize: env.ANNOTATION_BATCH_SIZE,
    maxConcurrency: env.ANNOTATION_MAX_CONCURRENCY,
    model: env.ANNOTATION_MODEL,
    promptVersion: env.ANNOTATION_PROMPT_VERSION,
    cacheDir: env.ANNOTATION_CACHE_DIR,
    pollingIntervalMs: env.ANNOTATION_POLLING_INTERVAL_MS,
    claudePythonExecutable: env.ANNOTATION_CLAUDE_PYTHON,
    claudeBridgePath: env.ANNOTATION_CLAUDE_SCRIPT,
    defaultConfidence: env.ANNOTATION_CONFIDENCE_DEFAULT,
    auditSampleSize: env.ANNOTATION_AUDIT_SAMPLE_SIZE
  });

  if (config.provider === "openai" && !config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required when ANNOTATION_PROVIDER=openai");
  }

  if (config.provider === "claude" && !config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when ANNOTATION_PROVIDER=claude");
  }

  if (config.provider === "auto" && !config.openaiApiKey && !config.anthropicApiKey) {
    throw new Error("Either OPENAI_API_KEY or ANTHROPIC_API_KEY must be set when ANNOTATION_PROVIDER=auto");
  }

  return config;
}
