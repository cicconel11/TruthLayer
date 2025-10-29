import { BenchmarkQuery } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { createEngineClient, SearchEngineClient } from "../targets";

interface CreateCollectorOptions {
  config: CollectorConfig;
  logger: Logger;
  runId: string;
}

export interface Collector {
  collect: (query: BenchmarkQuery) => Promise<Record<string, unknown>[]>;
}

export async function createCollector({ config, logger, runId }: CreateCollectorOptions): Promise<Collector> {
  const engines: Record<string, SearchEngineClient> = {};

  for (const engineName of Object.keys(config.engines)) {
    const engineConfig = config.engines[engineName as keyof typeof config.engines];
    if (!engineConfig.enabled) continue;
    engines[engineName] = await createEngineClient({ engine: engineName, config, logger, runId });
  }

  return {
    async collect(query) {
      const results: Record<string, unknown>[] = [];

      // Run all engines in parallel instead of sequentially
      const enginePromises = Object.entries(engines).map(async ([engineName, client]) => {
        try {
          logger.info("collecting", { queryId: query.id, engine: engineName });
          const engineResults = await client.search(query);
          return engineResults;
        } catch (error) {
          logger.error("engine collection failed", { 
            queryId: query.id, 
            engine: engineName,
            error: (error as Error).message 
          });
          return [];
        }
      });

      // Wait for all engines to complete
      const allResults = await Promise.all(enginePromises);
      
      // Flatten results
      for (const engineResults of allResults) {
        results.push(...engineResults);
      }

      // Log per-query summary
      const engineCounts: Record<string, number> = {};
      for (const result of results) {
        const engine = (result as any).engine;
        if (engine) {
          engineCounts[engine] = (engineCounts[engine] || 0) + 1;
        }
      }

      const enabledEngines = Object.keys(engineCounts);
      logger.info("query collection complete", {
        query: query.query,
        queryId: query.id,
        engines: enabledEngines,
        results: engineCounts,
        totalResults: results.length
      });

      return results;
    }
  };
}

