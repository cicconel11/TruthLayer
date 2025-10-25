import { loadEnv } from "@truthlayer/config";
import { z } from "zod";

const MetricsConfigSchema = z.object({
  runId: z.string().default(() => crypto.randomUUID()),
  storageUrl: z.string().default("duckdb://data/truthlayer.duckdb"),
  exportDir: z.string().default("data/metrics"),
  windowSize: z.number().int().min(1).default(7)
});

export type MetricsConfig = z.infer<typeof MetricsConfigSchema>;

export function makeMetricsConfig(): MetricsConfig {
  const env = loadEnv();

  return MetricsConfigSchema.parse({
    storageUrl: env.STORAGE_URL,
    exportDir: env.METRICS_EXPORT_DIR,
    windowSize: env.METRICS_WINDOW_SIZE
  });
}
