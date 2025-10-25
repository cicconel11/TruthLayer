import { createLogger } from "./lib/logger";
import { makeMetricsConfig } from "./lib/config";
import { createMetricsRunner } from "./runner/metrics-runner";

export interface MetricsApp {
  run: () => Promise<void>;
}

export function createMetricsApp(): MetricsApp {
  const logger = createLogger();
  const config = makeMetricsConfig();
  const runner = createMetricsRunner({ config, logger });

  return {
    async run() {
      logger.info("starting metrics run", { runId: runner.id });
      await runner.execute();
      logger.info("metrics run complete", { runId: runner.id });
    }
  };
}

