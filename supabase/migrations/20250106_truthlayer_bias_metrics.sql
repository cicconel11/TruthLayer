-- Bias Metrics SQL Views for TruthLayer
-- These views enable domain distribution analysis and bias detection across search engines

-- Normalized domains view
-- Extracts and normalizes domains from SERP results for consistent analysis
CREATE OR REPLACE VIEW v_serp_normalized_domains AS
SELECT
  r.id AS run_id,
  r.topic_id,
  r.engine,
  r.locale,
  LOWER(SPLIT_PART(s.url, '/', 3)) AS domain,
  COUNT(*) AS result_count,
  MIN(s.rank) AS best_position
FROM search_runs r
JOIN serp_results s ON s.run_id = r.id
GROUP BY r.id, r.topic_id, r.engine, r.locale, LOWER(SPLIT_PART(s.url, '/', 3));

-- Domain comparison view
-- Compares domain distributions across engines for the same topic
CREATE OR REPLACE VIEW v_bias_domain_comparison AS
SELECT
  topic_id,
  domain,
  engine,
  result_count,
  best_position
FROM v_serp_normalized_domains;

-- Bias domain scores view
-- Computes bias scores by calculating result share per domain/engine and variance across engines
-- High variance indicates potential bias (domains appear more in some engines than others)
CREATE OR REPLACE VIEW v_bias_domain_scores AS
WITH domain_totals AS (
  -- Total results per domain per topic
  SELECT
    topic_id,
    domain,
    SUM(result_count) AS total_results
  FROM v_serp_normalized_domains
  WHERE topic_id IS NOT NULL
  GROUP BY topic_id, domain
),
engine_totals AS (
  -- Total results per engine per topic
  SELECT
    topic_id,
    engine,
    SUM(result_count) AS total_engine_results
  FROM v_serp_normalized_domains
  WHERE topic_id IS NOT NULL
  GROUP BY topic_id, engine
),
domain_engine_shares AS (
  -- Result share per domain/engine combination
  -- Share is the proportion of results from this domain within this engine's results
  SELECT
    d.topic_id,
    d.domain,
    d.engine,
    d.result_count,
    et.total_engine_results AS engine_total,
    CASE
      WHEN et.total_engine_results > 0 THEN d.result_count::NUMERIC / et.total_engine_results
      ELSE 0
    END AS result_share
  FROM v_serp_normalized_domains d
  JOIN engine_totals et ON d.topic_id = et.topic_id AND d.engine = et.engine
  WHERE d.topic_id IS NOT NULL
),
share_variance AS (
  -- Calculate variance of result_share across engines for each domain
  SELECT
    topic_id,
    domain,
    engine,
    result_share,
    VARIANCE(result_share) OVER (PARTITION BY topic_id, domain) AS share_variance
  FROM domain_engine_shares
)
SELECT
  topic_id,
  domain,
  engine,
  result_share,
  share_variance,
  CASE
    WHEN share_variance > 0.02 THEN TRUE
    ELSE FALSE
  END AS is_high_variance
FROM share_variance;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_serp_results_run_id_rank
  ON serp_results (run_id, rank);

CREATE INDEX IF NOT EXISTS idx_search_runs_topic_engine
  ON search_runs (topic_id, engine)
  WHERE topic_id IS NOT NULL;

-- Note: These views enable bias analysis by:
-- 1. Normalizing domains for consistent comparison
-- 2. Comparing domain distributions across engines
-- 3. Computing variance scores to identify potential bias
-- High variance (is_high_variance = true) indicates domains that appear
-- disproportionately in some engines compared to others for the same topic.

