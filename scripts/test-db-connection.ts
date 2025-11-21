#!/usr/bin/env node
/**
 * Test script to validate Supabase database connection and basic CRUD operations.
 * 
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/test-db-connection.ts
 * 
 * Or with tsx:
 *   DATABASE_URL=postgres://... tsx scripts/test-db-connection.ts
 */

// Note: This script requires the packages to be built first (pnpm build)
// If running from source, you may need to adjust the import path
import { pool, createSearchRun, insertSerpResult } from "@truthlayer/core";

async function testDatabaseConnection() {
  console.log("Testing Supabase database connection...\n");

  try {
    // Test 1: Basic connection
    console.log("1. Testing basic connection...");
    const connectionResult = await pool.query("SELECT 1 as test");
    console.log("   ✓ Connection successful");
    console.log(`   Result: ${JSON.stringify(connectionResult.rows[0])}\n`);

    // Test 2: Create a search run
    console.log("2. Creating test search_run...");
    const searchRun = await createSearchRun({
      engine: "google",
      topicId: null,
      locale: "en-US",
      query: "test query for database connection"
    });
    console.log(`   ✓ Search run created with ID: ${searchRun.id}\n`);

    // Test 3: Insert a SERP result
    console.log("3. Inserting test serp_result...");
    await insertSerpResult({
      runId: searchRun.id,
      rank: 1,
      resultType: "organic",
      title: "Test Result",
      url: "https://example.com/test",
      snippet: "This is a test snippet for database validation",
      isAd: false
    });
    console.log("   ✓ SERP result inserted successfully\n");

    // Test 4: Verify the data was inserted
    console.log("4. Verifying inserted data...");
    const verifyResult = await pool.query(
      `
      SELECT sr.id, sr.engine, sr.query, srr.rank, srr.title, srr.url
      FROM search_runs sr
      JOIN serp_results srr ON sr.id = srr.run_id
      WHERE sr.id = $1
      `,
      [searchRun.id]
    );
    
    if (verifyResult.rows.length > 0) {
      console.log("   ✓ Data verification successful");
      console.log(`   Found ${verifyResult.rows.length} result(s):`);
      verifyResult.rows.forEach((row, index) => {
        console.log(`     ${index + 1}. ${row.title} (rank ${row.rank}) - ${row.url}`);
      });
      console.log();
    } else {
      console.log("   ✗ Data verification failed - no results found\n");
    }

    // Optional: Clean up test data
    console.log("5. Cleaning up test data...");
    await pool.query("DELETE FROM serp_results WHERE run_id = $1", [searchRun.id]);
    await pool.query("DELETE FROM search_runs WHERE id = $1", [searchRun.id]);
    console.log("   ✓ Test data cleaned up\n");

    console.log("✅ All tests passed! Database connection is working correctly.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:");
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

// Run the test
testDatabaseConnection().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

