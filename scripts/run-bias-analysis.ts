#!/usr/bin/env node
/**
 * Bias analysis runner - executes search runs for bias topics
 * 
 * Usage:
 *   tsx scripts/run-bias-analysis.ts [topicId]
 * 
 * If topicId is provided, runs only that topic.
 * If omitted, runs all topics from bias-topics.json
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBiasTopics, getTopicById, createSearchRun, insertSerpResult, pool } from "@truthlayer/core";
import { fetchPagesAndCreateSnapshots } from "@truthlayer/collector";
import { createCollector } from "@truthlayer/collector/src/services/collector";
import { makeCollectorConfig } from "@truthlayer/collector/src/lib/config";
import { createLogger } from "@truthlayer/collector/src/lib/logger";
import { BenchmarkQuerySchema } from "@truthlayer/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const topicId = process.argv[2];
const logger = createLogger();

interface TopicSummary {
  topicId: string;
  label: string;
  runsCreated: number;
  serpResultsInserted: number;
  pagesSnapshotted: number;
}

async function runBiasAnalysis() {
  console.log("🔍 Starting bias analysis run...\n");

  try {
    // Load topics
    let topics;
    if (topicId) {
      const topic = await getTopicById(topicId);
      if (!topic) {
        throw new Error(`Topic not found: ${topicId}`);
      }
      topics = [topic];
      console.log(`Running analysis for topic: ${topic.label} (${topic.id})\n`);
    } else {
      topics = await loadBiasTopics();
      console.log(`Running analysis for ${topics.length} topic(s)\n`);
    }

    const summaries: TopicSummary[] = [];

    // Process each topic
    for (const topic of topics) {
      console.log(`📊 Processing topic: ${topic.label} (${topic.id})`);
      
      const summary: TopicSummary = {
        topicId: topic.id,
        label: topic.label,
        runsCreated: 0,
        serpResultsInserted: 0,
        pagesSnapshotted: 0
      };

      const baseConfig = makeCollectorConfig();
      const runId = randomUUID();
      const uniqueUrls = new Set<string>();

      // Process each query and engine combination
      for (const queryText of topic.queries) {
        // Create a temporary BenchmarkQuery for the collector
        const query = BenchmarkQuerySchema.parse({
          id: randomUUID(),
          query: queryText,
          topic: topic.id,
          tags: []
        });

        for (const engine of topic.engines) {
          try {
            // Create search_run
            const searchRun = await createSearchRun({
              engine,
              topicId: null, // TODO: Add topic_id column support if needed
              locale: topic.locale,
              query: queryText
            });
            summary.runsCreated++;

            // Configure collector to only use this specific engine
            const engineConfig = {
              ...baseConfig,
              engines: {
                google: { ...baseConfig.engines.google, enabled: engine === "google" },
                bing: { ...baseConfig.engines.bing, enabled: engine === "bing" },
                perplexity: { ...baseConfig.engines.perplexity, enabled: engine === "perplexity" },
                brave: { ...baseConfig.engines.brave, enabled: engine === "brave" },
                duckduckgo: { ...baseConfig.engines.duckduckgo, enabled: engine === "duckduckgo" }
              }
            };
            const collector = await createCollector({ config: engineConfig, logger, runId });

            // Collect SERP results for this query/engine
            const allResults = await collector.collect(query);
            const engineResults = allResults.filter((r: any) => r.engine === engine);

            // Insert SERP results
            for (let i = 0; i < engineResults.length; i++) {
              const result = engineResults[i] as any;
              try {
                await insertSerpResult({
                  runId: searchRun.id,
                  rank: result.rank || i + 1,
                  resultType: "organic",
                  title: result.title || "Untitled",
                  url: result.url,
                  snippet: result.snippet || "",
                  isAd: false
                });
                summary.serpResultsInserted++;
                uniqueUrls.add(result.url);
              } catch (err) {
                logger.warn("failed to insert serp_result", {
                  runId: searchRun.id,
                  url: result.url,
                  error: err instanceof Error ? err.message : String(err)
                });
              }
            }
          } catch (err) {
            logger.error("bias analysis error", {
              topic: topic.id,
              query: queryText,
              engine,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }

      // Fetch pages and create snapshots
      if (uniqueUrls.size > 0) {
        try {
          const fetchResult = await fetchPagesAndCreateSnapshots(Array.from(uniqueUrls), {
            concurrency: 5,
            timeoutMs: 30000,
            maxRetries: 3,
            logger
          });
          summary.pagesSnapshotted = fetchResult.successCount;
        } catch (err) {
          logger.warn("page fetching failed", {
            topic: topic.id,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }

      summaries.push(summary);

      // Print summary for this topic
      console.log(`  ✓ Topic: ${summary.topicId}`);
      console.log(`    → Runs: ${summary.runsCreated}`);
      console.log(`    → SERP results: ${summary.serpResultsInserted}`);
      console.log(`    → Pages/snapshots: ${summary.pagesSnapshotted}\n`);
    }

    // Print overall summary
    console.log("✅ Bias analysis completed\n");
    console.log("Summary:");
    for (const summary of summaries) {
      console.log(`  ${summary.topicId}: ${summary.runsCreated} runs, ${summary.serpResultsInserted} SERPs, ${summary.pagesSnapshotted} pages`);
    }

  } catch (error) {
    console.error("\n❌ Bias analysis failed:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
    } else {
      console.error(`   Error: ${String(error)}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runBiasAnalysis().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

