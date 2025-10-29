import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { createGoogleClient } from "./google";
import { createBingClient } from "./bing";
import { createPerplexityClient } from "./perplexity";
import { createBraveClient } from "./brave";
import { createDuckDuckGoClient } from "./duckduckgo";

export interface SearchEngineClient {
  search: (query: { id: string; query: string; topic: string }) => Promise<Record<string, unknown>[]>;
}

export async function createEngineClient({
  engine,
  config,
  logger,
  runId
}: {
  engine: string;
  config: CollectorConfig;
  logger: Logger;
  runId: string;
}): Promise<SearchEngineClient> {
  switch (engine) {
    case "google":
      return createGoogleClient({ config, logger, runId });
    case "bing":
      return createBingClient({ config, logger, runId });
    case "perplexity":
      return createPerplexityClient({ config, logger, runId });
    case "brave":
      return createBraveClient({ config, logger, runId });
    case "duckduckgo":
      return createDuckDuckGoClient({ config, logger, runId });
    default:
      throw new Error(`Unsupported engine: ${engine}`);
  }
}
