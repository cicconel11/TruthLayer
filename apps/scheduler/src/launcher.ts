import { CronJob } from "cron";
import { SchedulerConfig, makeSchedulerConfig } from "./lib/config";
import { createLogger, Logger } from "./lib/logger";
import { createPipelineRunner } from "./runner/pipeline-runner";

export interface SchedulerApp {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  trigger: () => Promise<void>;
}

interface SetupResult {
  config: SchedulerConfig;
  logger: Logger;
  job: CronJob | null;
}

export async function createSchedulerApp(): Promise<SchedulerApp> {
  const config = makeSchedulerConfig();
  const logger = createLogger();
  const runner = createPipelineRunner({ config, logger });
  let cronJob: CronJob | null = null;

  async function trigger() {
    try {
      await runner.runOnce();
    } catch (error) {
      logger.error("scheduled pipeline execution failed", { error });
    }
  }

  async function startCron() {
    if (cronJob) return;
    cronJob = new CronJob(config.cronExpression, () => {
      logger.info("cron trigger fired", { expression: config.cronExpression, timezone: config.timezone });
      void trigger();
    },
    null,
    false,
    config.timezone);
    cronJob.start();
    logger.info("scheduler cron started", { expression: config.cronExpression, timezone: config.timezone });
  }

  async function stopCron() {
    if (cronJob) {
      cronJob.stop();
      cronJob = null;
      logger.info("scheduler cron stopped");
    }
  }

  return {
    async start() {
      if (config.runOnStart) {
        logger.info("scheduler run-on-start enabled, executing pipeline immediately");
        await trigger();
      }
      await startCron();
    },

    async stop() {
      await stopCron();
    },

    async trigger() {
      await trigger();
    }
  };
}

