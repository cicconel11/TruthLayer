import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { createGoogleClient } from "./google";
import { createBingClient } from "./bing";
import { createPerplexityClient } from "./perplexity";
import { createBraveClient } from "./brave";

export interface SearchEngineClient {
  search: (query: { id: string; query: string; topic: string }) => Promise<Record<string, unknown>[]>;
}

export async function createEngineClient({
  engine,
  config,
  logger
}: {
  engine: string;
  config: CollectorConfig;
  logger: Logger;
}): Promise<SearchEngineClient> {
  switch (engine) {
    case "google":
      return createGoogleClient({ config, logger });
    case "bing":
      return createBingClient({ config, logger });
    case "perplexity":
      return createPerplexityClient({ config, logger });
    case "brave":
      return createBraveClient({ config, logger });
    default:
      throw new Error(`Unsupported engine: ${engine}`);
  }
}
