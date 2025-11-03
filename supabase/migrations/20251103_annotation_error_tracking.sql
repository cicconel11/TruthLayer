-- Annotation Error Tracking Migration
-- Adds columns to track annotation failures, retries, and fallback usage

-- Add error tracking columns to search_results
ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS annotation_error_code text,
  ADD COLUMN IF NOT EXISTS annotation_error_msg text,
  ADD COLUMN IF NOT EXISTS annotation_attempts int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS annotation_source text, -- 'llm' | 'heuristic_fallback'
  ADD COLUMN IF NOT EXISTS annotation_status text; -- 'OK' | 'LLM_FAILED' | 'SKIPPED_EMPTY' | 'SKIPPED_BAD_URL' | 'RETRY_LATER'

-- Add indexes for efficient querying of annotation status
CREATE INDEX IF NOT EXISTS idx_search_results_annotation_status
  ON search_results (annotation_status);

CREATE INDEX IF NOT EXISTS idx_search_results_annotation_attempts
  ON search_results (annotation_attempts);

CREATE INDEX IF NOT EXISTS idx_search_results_last_attempt_at
  ON search_results (last_attempt_at);

-- Add comment explaining the new columns
COMMENT ON COLUMN search_results.annotation_error_code IS 'Error code from annotation service (e.g., rate_limit_exceeded, timeout)';
COMMENT ON COLUMN search_results.annotation_error_msg IS 'Human-readable error message from annotation service';
COMMENT ON COLUMN search_results.annotation_attempts IS 'Number of annotation attempts made for this result';
COMMENT ON COLUMN search_results.last_attempt_at IS 'Timestamp of the last annotation attempt';
COMMENT ON COLUMN search_results.annotation_source IS 'Source of the annotation: llm or heuristic_fallback';
COMMENT ON COLUMN search_results.annotation_status IS 'Current status of annotation process';
