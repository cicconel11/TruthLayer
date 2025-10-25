import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import PQueue from "p-queue";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { loadQueries } from "../services/query-loader";
import { createCollector } from "../services/collector";

export interface JobRunner {
  id: string;
  execute: () => Promise<void>;
}

interface CreateJobRunnerOptions {
  config: CollectorConfig;
  logger: Logger;
}

export async function createJobRunner({ config, logger }: CreateJobRunnerOptions): Promise<JobRunner> {
  const id = config.runId ?? randomUUID();
  const queries = await loadQueries(config.benchmarkQuerySetPath);
  const collector = await createCollector({ config, logger });

  await fs.mkdir(config.outputDir, { recursive: true });

  return {
    id,
    async execute() {
      const queue = new PQueue({ concurrency: 4 });

      for (const query of queries) {
        queue.add(async () => {
          const result = await collector.collect(query);
          const outputPath = path.join(
            config.outputDir,
            `${query.id}-${query.topic}-${config.maxResultsPerQuery}.json`
          );
          await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
          logger.info("query collected", { queryId: query.id, engineCount: result.length });
        });
      }

      await queue.onIdle();
    }
  };
}
