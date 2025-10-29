import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import PQueue from "p-queue";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { loadQueries } from "../services/query-loader";
import { createCollector } from "../services/collector";
import { getCachedResults } from "../services/cache";

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
  const collector = await createCollector({ config, logger, runId: id });

  await fs.mkdir(config.outputDir, { recursive: true });

  return {
    id,
    async execute() {
      const queue = new PQueue({ concurrency: 4 });
      
      let cacheHits = 0;
      let cacheMisses = 0;
      
      // 7 days in milliseconds
      const cacheTtl = 7 * 24 * 60 * 60 * 1000;
      const forceRefresh = process.env.FORCE_REFRESH === "true";

      for (const query of queries) {
        queue.add(async () => {
          const outputPath = path.join(
            config.outputDir,
            `${query.id}-${query.topic}-${config.maxResultsPerQuery}.json`
          );

          // Check cache first
          if (!forceRefresh) {
            const cached = await getCachedResults(query, {
              outputDir: config.outputDir,
              maxResultsPerQuery: config.maxResultsPerQuery,
              ttlMs: cacheTtl
            });

            if (cached) {
              cacheHits++;
              logger.info("using cached results", { 
                queryId: query.id,
                engineCount: cached.length 
              });
              return;
            }
          }

          // Cache miss - scrape fresh
          cacheMisses++;
          logger.info("cache miss - collecting fresh", { queryId: query.id });
          const result = await collector.collect(query);
          
          await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
          logger.info("query collected", { queryId: query.id, engineCount: result.length });
        });
      }

      await queue.onIdle();
      
      logger.info("collection complete", {
        cacheHits,
        cacheMisses,
        totalQueries: queries.length,
        cacheHitRate: `${Math.round((cacheHits / queries.length) * 100)}%`
      });
    }
  };
}
