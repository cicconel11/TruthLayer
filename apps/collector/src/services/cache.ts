import { promises as fs } from "fs";
import path from "path";
import { BenchmarkQuery } from "@truthlayer/schema";

export interface CacheOptions {
  outputDir: string;
  maxResultsPerQuery: number;
  ttlMs: number;
}

export async function getCachedResults(
  query: BenchmarkQuery,
  options: CacheOptions
): Promise<Record<string, unknown>[] | null> {
  const cacheFile = path.join(
    options.outputDir,
    `${query.id}-${query.topic}-${options.maxResultsPerQuery}.json`
  );

  try {
    const stats = await fs.stat(cacheFile);
    const age = Date.now() - stats.mtimeMs;

    if (age < options.ttlMs) {
      const content = await fs.readFile(cacheFile, "utf-8");
      return JSON.parse(content);
    }
  } catch {
    // Cache miss - file doesn't exist or is invalid
  }

  return null;
}

export async function setCachedResults(
  query: BenchmarkQuery,
  results: Record<string, unknown>[],
  options: CacheOptions
): Promise<void> {
  const cacheFile = path.join(
    options.outputDir,
    `${query.id}-${query.topic}-${options.maxResultsPerQuery}.json`
  );

  await fs.writeFile(cacheFile, JSON.stringify(results, null, 2));
}

