import { Pool } from "pg";
import { createHash } from "node:crypto";

/**
 * Determines the database connection string from environment variables.
 * Prefers DATABASE_URL, falls back to STORAGE_URL if it's a Postgres URL.
 */
function getConnectionString(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return databaseUrl;
  }

  const storageUrl = process.env.STORAGE_URL;
  if (storageUrl && (storageUrl.startsWith("postgres://") || storageUrl.startsWith("postgresql://"))) {
    return storageUrl;
  }

  throw new Error("DATABASE_URL is not set (and STORAGE_URL is not a Postgres URL)");
}

const connectionString = getConnectionString();

/**
 * Shared PostgreSQL connection pool for Supabase.
 * Configured with max 10 connections for efficient resource usage.
 */
export const pool = new Pool({
  connectionString,
  max: 10,
});

export type SearchRun = {
  id: number;
};

/**
 * Creates a new search run record in the search_runs table.
 *
 * @param params - Search run parameters
 * @returns Promise resolving to the created search run with its ID
 */
export async function createSearchRun(params: {
  engine: string;
  topicId: number | null;
  locale: string;
  query: string;
}): Promise<SearchRun> {
  const { engine, topicId, locale, query } = params;
  const res = await pool.query(
    `
    INSERT INTO search_runs (engine, topic_id, locale, query)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [engine, topicId, locale, query]
  );
  return { id: res.rows[0].id };
}

/**
 * Inserts a SERP result into the serp_results table.
 *
 * @param params - SERP result parameters
 */
export async function insertSerpResult(params: {
  runId: number;
  rank: number;
  resultType: string;
  title: string;
  url: string;
  snippet: string;
  isAd: boolean;
}): Promise<void> {
  const { runId, rank, resultType, title, url, snippet, isAd } = params;
  await pool.query(
    `
    INSERT INTO serp_results (run_id, rank, result_type, title, url, snippet, is_ad)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [runId, rank, resultType, title, url, snippet, isAd]
  );
}

/**
 * Upserts a page record and creates a new snapshot.
 * If the page already exists (by url_hash), updates last_seen_at.
 * Always creates a new snapshot record.
 *
 * @param params - Page and snapshot parameters
 */
export async function upsertPageAndSnapshot(params: {
  url: string;
  httpStatus: number;
  contentText: string;
  contentHash: string;
}): Promise<void> {
  const { url, httpStatus, contentText, contentHash } = params;

  // Compute URL hash using MD5
  const urlHash = createHash("md5").update(url).digest("hex");

  // Upsert page
  const pageRes = await pool.query(
    `
    INSERT INTO pages (url_hash, url)
    VALUES ($1, $2)
    ON CONFLICT (url_hash)
    DO UPDATE SET last_seen_at = NOW()
    RETURNING id
    `,
    [urlHash, url]
  );
  const pageId = pageRes.rows[0].id;

  // Insert snapshot
  await pool.query(
    `
    INSERT INTO page_snapshots (page_id, http_status, content_text, content_hash)
    VALUES ($1, $2, $3, $4)
    `,
    [pageId, httpStatus, contentText, contentHash]
  );
}

