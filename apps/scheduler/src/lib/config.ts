import { loadEnv } from "@truthlayer/config";
import { z } from "zod";

const SchedulerConfigSchema = z.object({
  runId: z.string().default(() => crypto.randomUUID()),
  cronExpression: z.string().default("0 * * * *"),
  timezone: z.string().default("UTC"),
  runOnStart: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelayMs: z.number().int().min(1000).max(600000).default(10000),
  collectorOutputDir: z.string().default("data/serp"),
  manualAuditSamplePercent: z.number().int().min(1).max(100).default(5)
});

export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>;

export function makeSchedulerConfig(): SchedulerConfig {
  const env = loadEnv();

  return SchedulerConfigSchema.parse({
    cronExpression: env.SCHEDULER_CRON_EXPRESSION,
    timezone: env.SCHEDULER_TIMEZONE,
    runOnStart: env.SCHEDULER_RUN_ON_START,
    maxRetries: env.SCHEDULER_MAX_RETRIES,
    retryDelayMs: env.SCHEDULER_RETRY_DELAY_MS,
    collectorOutputDir: env.COLLECTOR_OUTPUT_DIR,
    manualAuditSamplePercent: env.SCHEDULER_MANUAL_AUDIT_PERCENT
  });
}
