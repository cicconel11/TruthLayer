-- SQL Views for TruthLayer Analytics
-- These views power dashboard queries and analytics for bias monitoring

-- Latest run per topic/engine
-- Useful for finding the most recent search execution for each topic/engine combination
CREATE OR REPLACE VIEW v_latest_runs AS
SELECT DISTINCT ON (topic_id, engine)
  id,
  topic_id,
  engine,
  locale,
  query,
  started_at,
  completed_at,
  status
FROM search_runs
ORDER BY topic_id, engine, started_at DESC;

-- SERP domain distribution
-- Shows which domains appear in SERP results for each run
-- Useful for analyzing domain diversity and bias patterns
CREATE OR REPLACE VIEW v_serp_domain_distribution AS
SELECT
  sr.run_id,
  sr.engine,
  LOWER(SPLIT_PART(sr.url, '/', 3)) AS domain,
  COUNT(*) AS result_count,
  AVG(sr.rank) AS avg_rank,
  MIN(sr.rank) AS min_rank,
  MAX(sr.rank) AS max_rank
FROM serp_results sr
JOIN search_runs s ON sr.run_id = s.id
GROUP BY sr.run_id, sr.engine, domain
ORDER BY sr.run_id, result_count DESC;

-- Page snapshot recency
-- Shows the most recent snapshots for each page
-- Useful for tracking content changes over time
CREATE OR REPLACE VIEW v_page_recent_snapshots AS
SELECT
  p.id AS page_id,
  p.url,
  p.url_hash,
  p.first_seen_at,
  p.last_seen_at,
  ps.id AS snapshot_id,
  ps.http_status,
  ps.captured_at,
  ps.content_hash,
  LENGTH(ps.content_text) AS content_length
FROM pages p
JOIN page_snapshots ps ON ps.page_id = p.id
ORDER BY ps.captured_at DESC;

-- Additional helpful indexes for view performance
CREATE INDEX IF NOT EXISTS idx_search_runs_topic_engine_started
  ON search_runs (topic_id, engine, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_serp_results_run_engine
  ON serp_results (run_id, engine);

-- Note: These views will power dashboard queries later.
-- They provide efficient access to:
-- - Latest search runs for monitoring
-- - Domain distribution analysis for bias detection
-- - Page content history for change tracking

