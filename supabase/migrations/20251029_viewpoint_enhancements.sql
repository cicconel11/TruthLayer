-- Viewpoint Analysis Enhancement Migration
-- Adds support for per-engine analytics, viewpoints table, and deduplication

-- Add new columns to search_results
ALTER TABLE search_results 
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS extraction_confidence REAL,
  ADD COLUMN IF NOT EXISTS extraction_warnings JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add unique constraint on search_results to prevent logical duplicates
-- This enables safe ON CONFLICT DO UPDATE for (query_id, engine, url)
CREATE UNIQUE INDEX IF NOT EXISTS search_results_unique_idx
  ON search_results (query_id, engine, url);

-- Create viewpoints table for per-engine aggregated data
CREATE TABLE IF NOT EXISTS viewpoints (
  id UUID PRIMARY KEY,
  query_id UUID NOT NULL,
  crawl_run_id UUID,
  engine TEXT NOT NULL,
  num_results INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  citations_count INTEGER DEFAULT 0,
  overlap_hash TEXT,
  collected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(query_id, crawl_run_id, engine)
);

-- Add analytics columns to metric_records
ALTER TABLE metric_records 
  ADD COLUMN IF NOT EXISTS rate_limit_hits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_viewpoints_query_engine ON viewpoints(query_id, engine);
CREATE INDEX IF NOT EXISTS idx_search_results_source ON search_results(source);
CREATE INDEX IF NOT EXISTS idx_viewpoints_collected_at ON viewpoints(collected_at);
