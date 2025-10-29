import { createStorageClient } from "@truthlayer/storage";

export interface LatestRunResult {
  runId: string;
  timestamp: Date;
}

/**
 * Resolves the latest crawl_run_id for a given query
 * 
 * TODO: Wire to actual database query once we determine the best approach:
 * - Option A: Query search_results table for latest crawl_run_id for queryId
 *   SELECT crawl_run_id, MAX(timestamp) as timestamp
 *   FROM search_results
 *   WHERE query_id = ? AND crawl_run_id IS NOT NULL
 *   GROUP BY crawl_run_id
 *   ORDER BY timestamp DESC
 *   LIMIT 1
 * 
 * - Option B: Add a helper method to StorageClient
 *   storage.fetchLatestRunForQuery(queryId)
 * 
 * - Option C: Query metrics table for most recent entry
 *   SELECT crawl_run_id, MAX(collected_at) as timestamp
 *   FROM metrics
 *   WHERE query_id = ? AND crawl_run_id IS NOT NULL
 *   GROUP BY crawl_run_id
 *   ORDER BY timestamp DESC
 *   LIMIT 1
 * 
 * @see https://duckdb.org/docs/sql/query_syntax/groupby
 */
export async function getLatestRunForQuery(queryId: string): Promise<LatestRunResult | null> {
  const storage = createStorageClient();
  
  try {
    // TODO: Replace with actual DB query
    // For now, stub with dummy data for type safety
    console.warn("[getLatestRunForQuery] Using stub implementation - needs DB wiring", { queryId });
    
    return null; // Will return actual data once wired
  } catch (error) {
    console.error("[getLatestRunForQuery] failed", { queryId, error: (error as Error).message });
    return null;
  }
}

