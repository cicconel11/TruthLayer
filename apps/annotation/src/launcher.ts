import { createLogger } from "./lib/logger";
import { makeAnnotationConfig } from "./lib/config";
import { createAnnotationRunner } from "./runner/annotation-runner";

export interface AnnotationApp {
  run: () => Promise<void>;
}

export async function createAnnotationApp(): Promise<AnnotationApp> {
  const logger = createLogger();
  const config = makeAnnotationConfig();
  const runner = createAnnotationRunner({ config, logger });

  return {
    async run() {
      logger.info("starting annotation run", { runId: runner.id });
      await runner.execute();
      logger.info("annotation run complete", { runId: runner.id });
    }
  };
}

