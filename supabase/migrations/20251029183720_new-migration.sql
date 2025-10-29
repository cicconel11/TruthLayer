-- Storage schema for TruthLayer
-- Sources:
-- - Table shapes derived from PostgresStorageClient ensure* methods in apps/storage/src/postgres-client.ts

-- Base tables
CREATE TABLE IF NOT EXISTS search_results (
  id UUID PRIMARY KEY,
  crawl_run_id UUID,
  query_id UUID NOT NULL,
  engine TEXT NOT NULL,
  rank INTEGER NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  hash TEXT NOT NULL,
  raw_html_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dependent tables
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY,
  search_result_id UUID NOT NULL REFERENCES search_results(id),
  query_id UUID NOT NULL,
  engine TEXT NOT NULL,
  domain_type TEXT NOT NULL,
  factual_consistency TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  prompt_version TEXT NOT NULL,
  model_id TEXT NOT NULL,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_records (
  id UUID PRIMARY KEY,
  crawl_run_id UUID,
  query_id UUID NOT NULL,
  engine TEXT,
  metric_type TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  delta DOUBLE PRECISION,
  compared_to_run_id UUID,
  collected_at TIMESTAMPTZ NOT NULL,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL,
  query_id UUID NOT NULL,
  engine TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT,
  result_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dataset_versions (
  id UUID PRIMARY KEY,
  dataset_type TEXT NOT NULL,
  format TEXT NOT NULL,
  path TEXT NOT NULL,
  run_id UUID,
  record_count INTEGER NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_stage_logs (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_samples (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES pipeline_runs(id),
  annotation_id UUID NOT NULL,
  query_id UUID NOT NULL,
  engine TEXT NOT NULL,
  reviewer TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS annotation_aggregates (
  id UUID PRIMARY KEY,
  run_id TEXT NOT NULL,
  query_id UUID NOT NULL,
  engine TEXT,
  domain_type TEXT NOT NULL,
  factual_consistency TEXT NOT NULL,
  count INTEGER NOT NULL,
  total_annotations INTEGER NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional indexes commonly used in queries
CREATE INDEX IF NOT EXISTS idx_search_results_query_engine_ts
  ON search_results (query_id, engine, timestamp);

CREATE INDEX IF NOT EXISTS idx_annotations_search_result
  ON annotations (search_result_id);

CREATE INDEX IF NOT EXISTS idx_metric_records_query_type_time
  ON metric_records (query_id, metric_type, collected_at);

CREATE INDEX IF NOT EXISTS idx_annotation_aggregates_query_type_time
  ON annotation_aggregates (query_id, domain_type, collected_at);


