import { BenchmarkQuery } from "@truthlayer/schema";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { createEngineClient, SearchEngineClient } from "../targets";

interface CreateCollectorOptions {
  config: CollectorConfig;
  logger: Logger;
}

export interface Collector {
  collect: (query: BenchmarkQuery) => Promise<Record<string, unknown>[]>;
}

export async function createCollector({ config, logger }: CreateCollectorOptions): Promise<Collector> {
  const engines: Record<string, SearchEngineClient> = {};

  for (const engineName of Object.keys(config.engines)) {
    const engineConfig = config.engines[engineName as keyof typeof config.engines];
    if (!engineConfig.enabled) continue;
    engines[engineName] = await createEngineClient({ engine: engineName, config, logger });
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

      return results;
    }
  };
}

