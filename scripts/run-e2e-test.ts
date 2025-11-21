#!/usr/bin/env node
/**
 * End-to-end test runner for TruthLayer Supabase integration.
 * 
 * Runs a minimal pipeline execution (one query + one engine) and validates
 * that data is correctly written to Supabase tables.
 * 
 * Usage:
 *   DATABASE_URL=postgres://... ts-node scripts/run-e2e-test.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, createSearchRun, insertSerpResult } from "@truthlayer/core";
import { fetchPagesAndCreateSnapshots } from "@truthlayer/collector";
import { BenchmarkQuerySetSchema } from "@truthlayer/schema";

// Simple logger interface for the test script
const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : "");
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : "");
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    // Suppress debug in test output
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

async function loadBenchmarkQueries() {
  const queriesPath = path.join(projectRoot, "config/benchmark-queries.json");
  const content = await fs.readFile(queriesPath, "utf-8");
  return BenchmarkQuerySetSchema.parse(JSON.parse(content));
}

async function runE2ETest() {
  console.log("🧪 Starting TruthLayer E2E Test\n");

  try {
    // Step 1: Test database connection
    console.log("1️⃣  Testing database connection...");
    await pool.query("SELECT 1");
    console.log("   ✓ Database connection successful\n");

    // Step 2: Load first benchmark query
    console.log("2️⃣  Loading benchmark queries...");
    const queries = await loadBenchmarkQueries();
    if (queries.length === 0) {
      throw new Error("No benchmark queries found");
    }
    const testQuery = queries[0];
    const testEngine = "google";
    console.log(`   ✓ Using query: "${testQuery.query}" (${testQuery.id})`);
    console.log(`   ✓ Using engine: ${testEngine}\n`);

    // Step 3: Create a temporary query file with just one query
    const tempQueriesPath = path.join(projectRoot, "data", "e2e-test-queries.json");
    await fs.mkdir(path.dirname(tempQueriesPath), { recursive: true });
    await fs.writeFile(tempQueriesPath, JSON.stringify([testQuery], null, 2));
    
    // Set environment to use the test query file
    const originalQueryPath = process.env.BENCHMARK_QUERY_SET_PATH;
    process.env.BENCHMARK_QUERY_SET_PATH = tempQueriesPath;
    process.env.COLLECTOR_OUTPUT_DIR = path.join(projectRoot, "data", "e2e-test-serp");
    process.env.FORCE_REFRESH = "true";

    try {
      // Step 4: Run collector for just this query
      console.log("3️⃣  Running collector...");
      const { createCollectorApp } = await import("@truthlayer/collector");
      const collectorApp = await createCollectorApp();
      await collectorApp.run();
      console.log("   ✓ Collector completed\n");

      // Step 5: Manually create search_run and insert SERP results
      console.log("4️⃣  Creating search_run and inserting SERP results...");
      
      // Read collector output
      const serpDir = process.env.COLLECTOR_OUTPUT_DIR!;
      const jsonFiles = (await fs.readdir(serpDir))
        .filter(f => f.endsWith(".json"))
        .map(f => path.join(serpDir, f));

      if (jsonFiles.length === 0) {
        throw new Error("No SERP output files found");
      }

      const serpData = JSON.parse(await fs.readFile(jsonFiles[0], "utf-8"));
      if (!Array.isArray(serpData) || serpData.length === 0) {
        throw new Error("No SERP results found in output file");
      }

      // Filter results for test engine only
      const engineResults = serpData.filter((r: any) => r.engine === testEngine);
      if (engineResults.length === 0) {
        throw new Error(`No results found for engine: ${testEngine}`);
      }

      // Create search_run
      const searchRun = await createSearchRun({
        engine: testEngine,
        topicId: null,
        locale: "en-US",
        query: testQuery.query
      });
      console.log(`   ✓ Created search_run with ID: ${searchRun.id}`);

      // Insert SERP results
      let serpCount = 0;
      const urls: string[] = [];
      for (const result of engineResults.slice(0, 10)) { // Limit to 10 for testing
        try {
          await insertSerpResult({
            runId: searchRun.id,
            rank: result.rank || serpCount + 1,
            resultType: "organic",
            title: result.title || "Untitled",
            url: result.url,
            snippet: result.snippet || "",
            isAd: false
          });
          serpCount++;
          urls.push(result.url);
        } catch (err) {
          console.warn(`   ⚠️  Failed to insert SERP result: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      console.log(`   ✓ Inserted ${serpCount} SERP results\n`);

      // Step 6: Fetch pages
      console.log("5️⃣  Fetching pages and creating snapshots...");
      const uniqueUrls = Array.from(new Set(urls));
      await fetchPagesAndCreateSnapshots(uniqueUrls, {
        concurrency: 3,
        timeoutMs: 15000,
        logger
      });
      console.log(`   ✓ Page fetching completed\n`);

      // Step 7: Verify data in database
      console.log("6️⃣  Verifying data in Supabase...");

      // Check search_runs
      const runsResult = await pool.query(
        "SELECT COUNT(*) as count FROM search_runs WHERE id = $1",
        [searchRun.id]
      );
      const runsCount = parseInt(runsResult.rows[0].count, 10);
      if (runsCount === 0) {
        throw new Error("No search_runs found");
      }
      console.log(`   ✓ Found ${runsCount} search_run(s)`);

      // Check serp_results
      const serpResult = await pool.query(
        "SELECT COUNT(*) as count FROM serp_results WHERE run_id = $1",
        [searchRun.id]
      );
      const serpCountDb = parseInt(serpResult.rows[0].count, 10);
      if (serpCountDb === 0) {
        throw new Error("No serp_results found");
      }
      console.log(`   ✓ Found ${serpCountDb} serp_result(s)`);

      // Check pages
      const pagesResult = await pool.query(
        "SELECT COUNT(*) as count FROM pages WHERE url = ANY($1::text[])",
        [uniqueUrls]
      );
      const pagesCount = parseInt(pagesResult.rows[0].count, 10);
      console.log(`   ✓ Found ${pagesCount} page(s)`);

      // Check page_snapshots
      const snapshotsResult = await pool.query(
        `SELECT COUNT(*) as count FROM page_snapshots ps
         JOIN pages p ON ps.page_id = p.id
         WHERE p.url = ANY($1::text[])`,
        [uniqueUrls]
      );
      const snapshotsCount = parseInt(snapshotsResult.rows[0].count, 10);
      console.log(`   ✓ Found ${snapshotsCount} page_snapshot(s)\n`);

      // Step 8: Print summary
      console.log("✅ E2E Test Summary:");
      console.log(`   Runs: ${runsCount}`);
      console.log(`   SERPs: ${serpCountDb}`);
      console.log(`   Pages: ${pagesCount}`);
      console.log(`   Snapshots: ${snapshotsCount}\n`);

      // Cleanup
      console.log("7️⃣  Cleaning up test data...");
      await pool.query("DELETE FROM page_snapshots WHERE page_id IN (SELECT id FROM pages WHERE url = ANY($1::text[]))", [uniqueUrls]);
      await pool.query("DELETE FROM pages WHERE url = ANY($1::text[])", [uniqueUrls]);
      await pool.query("DELETE FROM serp_results WHERE run_id = $1", [searchRun.id]);
      await pool.query("DELETE FROM search_runs WHERE id = $1", [searchRun.id]);
      console.log("   ✓ Test data cleaned up\n");

      // Restore original env
      if (originalQueryPath) {
        process.env.BENCHMARK_QUERY_SET_PATH = originalQueryPath;
      } else {
        delete process.env.BENCHMARK_QUERY_SET_PATH;
      }

      console.log("🎉 E2E test passed successfully!\n");
      process.exit(0);
    } finally {
      // Cleanup temp files
      try {
        await fs.unlink(tempQueriesPath);
        await fs.rm(process.env.COLLECTOR_OUTPUT_DIR!, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error("\n❌ E2E test failed:");
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

runE2ETest().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

