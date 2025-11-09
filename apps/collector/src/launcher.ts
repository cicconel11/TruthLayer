import { Logger } from "winston";
import { createLogger } from "./lib/logger";
import { makeCollectorConfig } from "./lib/config";
import { createJobRunner } from "./runner/job-runner";
import { validateAnnotationConfig } from "./annotate/annotator";
import { initMetrics } from "./lib/metrics";

export interface CollectorApp {
  run: () => Promise<void>;
}

export async function createCollectorApp(): Promise<CollectorApp> {
  const logger = createLogger();

  // Initialize metrics collection
  initMetrics();

  // Validate annotation configuration on startup
  try {
    await validateAnnotationConfig();
    logger.info("annotation configuration validated successfully");
  } catch (error: any) {
    logger.warn("annotation configuration validation failed, proceeding with mock annotations", { error: error.message });
    // Don't throw error - allow collector to run with mock annotations
  }

  const config = makeCollectorConfig();
  const runner = await createJobRunner({ config, logger });

  return {
    async run() {
      logger.info("starting collector", { runId: runner.id });
      await runner.execute();
      logger.info("collector completed", { runId: runner.id });
    }
  };
}

