import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import PQueue from "p-queue";
import { createHash } from "node:crypto";
import { CollectorConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { loadQueries } from "../services/query-loader";
import { createCollector } from "../services/collector";
import { getCachedResults } from "../services/cache";
import { createStorageClient } from "@truthlayer/storage";
import type { SearchResult } from "@truthlayer/schema";

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
  const storage = createStorageClient();

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
              // Note: Cached results are NOT persisted here to avoid double-insertion.
              // The scheduler's ingestCollectorOutputs will handle persistence by
              // reading the JSON files from disk.
              return;
            }
          }

          // Cache miss - scrape fresh
          cacheMisses++;
          logger.info("cache miss - collecting fresh", { queryId: query.id });
          const result = await collector.collect(query);
          
          await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
          logger.info("query collected", { queryId: query.id, engineCount: result.length });

          // Persist results and viewpoints to storage
          try {
            const searchResults = result as SearchResult[];
            
            // Insert search results
            if (searchResults.length > 0) {
              await storage.insertSearchResults(searchResults.map(r => ({
                id: r.id,
                crawlRunId: r.crawlRunId,
                queryId: r.queryId,
                engine: r.engine,
                rank: r.rank,
                title: r.title,
                snippet: r.snippet,
                url: r.url,
                normalizedUrl: r.normalizedUrl,
                domain: r.domain,
                timestamp: new Date(r.timestamp),
                hash: r.hash,
                rawHtmlPath: r.rawHtmlPath,
                createdAt: new Date(r.createdAt),
                updatedAt: new Date(r.updatedAt)
              })));
            }

            // Group results by engine and compute viewpoints
            const resultsByEngine: Record<string, SearchResult[]> = {};
            for (const sr of searchResults) {
              if (!resultsByEngine[sr.engine]) {
                resultsByEngine[sr.engine] = [];
              }
              resultsByEngine[sr.engine].push(sr);
            }

            const viewpoints = Object.entries(resultsByEngine).map(([engine, engineResults]) => {
              // Extract metadata from first result (Perplexity stores summary there)
              const firstResult = engineResults[0];
              let summary: string | null = null;
              let citationsCount = 0;

              if (firstResult && firstResult.metadata) {
                try {
                  const metadata = typeof firstResult.metadata === 'string' 
                    ? JSON.parse(firstResult.metadata) 
                    : firstResult.metadata;
                  summary = metadata.summary || null;
                  citationsCount = metadata.citations?.length || 0;
                } catch (e) {
                  // Ignore parse errors
                }
              }

              // Compute simple overlap hash (concatenate sorted URLs)
              const sortedUrls = engineResults.map(r => r.normalizedUrl).sort();
              const overlapHash = createHash('sha256')
                .update(sortedUrls.join('|'))
                .digest('hex')
                .substring(0, 16);

              return {
                id: randomUUID(),
                queryId: query.id,
                crawlRunId: id,
                engine,
                numResults: engineResults.length,
                summary,
                citationsCount,
                overlapHash,
                collectedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
              };
            });

            if (viewpoints.length > 0) {
              await storage.upsertViewpoints(viewpoints);
              logger.info("viewpoints persisted", { 
                queryId: query.id, 
                engines: Object.keys(resultsByEngine) 
              });
            }
          } catch (storageError) {
            logger.error("storage persistence failed", {
              queryId: query.id,
              error: (storageError as Error).message
            });
            // Don't fail the whole collection if storage fails
          }
        });
      }

      await queue.onIdle();
      
      logger.info("collection complete", {
        cacheHits,
        cacheMisses,
        totalQueries: queries.length,
        cacheHitRate: `${Math.round((cacheHits / queries.length) * 100)}%`
      });

      // Close storage connection
      try {
        await storage.close();
      } catch (e) {
        logger.warn("failed to close storage", { error: (e as Error).message });
      }
    }
  };
}
