import { loadEnv } from "@truthlayer/config";
import { createDuckDBStorageClient } from "./duckdb-client";
import { createInMemoryStorageClient } from "./in-memory";
import { createPostgresStorageClient } from "./postgres-client";
import { StorageClient } from "./types";

export { createInMemoryStorageClient };
export * from "./types";
export * from "./save";

export interface CreateStorageClientOptions {
  url?: string;
}

export function createStorageClient(options: CreateStorageClientOptions = {}): StorageClient {
  const env = loadEnv();
  const url = options.url ?? env.STORAGE_URL ?? "duckdb://data/truthlayer.duckdb";

  if (url.startsWith("duckdb://") || url === "duckdb::memory:" || url === ":memory:" || url.startsWith("duckdb:")) {
    return createDuckDBStorageClient(url);
  }

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return createPostgresStorageClient(url);
  }

  if (url.startsWith("memory://")) {
    return createInMemoryStorageClient();
  }

  throw new Error(`Unsupported storage URL: ${url}`);
}
