-- Supabase Postgres v2 schema for TruthLayer SERP collection pipeline
-- This schema coexists with the existing schema (search_results, crawl_runs, etc.)
-- Sources:
-- - New tables for direct Supabase integration in scheduled cron jobs
-- - Tables: search_runs, serp_results, pages, page_snapshots

-- Search runs table: tracks each scheduled search execution
CREATE TABLE IF NOT EXISTS search_runs (
  id BIGSERIAL PRIMARY KEY,
  engine TEXT NOT NULL,
  topic_id BIGINT NULL,
  locale TEXT NOT NULL DEFAULT 'en-US',
  query TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- SERP results table: stores individual search result entries
CREATE TABLE IF NOT EXISTS serp_results (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES search_runs(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  result_type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  snippet TEXT NOT NULL,
  is_ad BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pages table: tracks unique pages that have been crawled
CREATE TABLE IF NOT EXISTS pages (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  url_hash TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Page snapshots table: stores content snapshots of pages at specific points in time
CREATE TABLE IF NOT EXISTS page_snapshots (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  http_status INTEGER NOT NULL,
  content_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_serp_results_run_rank
  ON serp_results (run_id, rank);

CREATE INDEX IF NOT EXISTS idx_serp_results_url
  ON serp_results (url);

CREATE INDEX IF NOT EXISTS idx_page_snapshots_page_captured
  ON page_snapshots (page_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_runs_engine_status
  ON search_runs (engine, status);

CREATE INDEX IF NOT EXISTS idx_search_runs_started_at
  ON search_runs (started_at DESC);

