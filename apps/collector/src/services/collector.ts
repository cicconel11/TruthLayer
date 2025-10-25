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

      for (const [engineName, client] of Object.entries(engines)) {
        logger.info("collecting", { queryId: query.id, engine: engineName });
        const engineResults = await client.search(query);
        results.push(...engineResults);
      }

      return results;
    }
  };
}

