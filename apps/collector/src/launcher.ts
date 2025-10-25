import { Logger } from "winston";
import { createLogger } from "./lib/logger";
import { makeCollectorConfig } from "./lib/config";
import { createJobRunner } from "./runner/job-runner";

export interface CollectorApp {
  run: () => Promise<void>;
}

export async function createCollectorApp(): Promise<CollectorApp> {
  const logger = createLogger();
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

