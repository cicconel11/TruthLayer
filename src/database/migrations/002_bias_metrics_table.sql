-- Migration to add bias_metrics table for trend analysis
-- This table stores computed bias metrics over time for historical tracking

-- Bias metrics table - stores computed metrics for trend analysis
CREATE TABLE bias_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    domain_diversity_index DECIMAL(5,4) CHECK (domain_diversity_index >= 0.0 AND domain_diversity_index <= 1.0),
    engine_overlap_coefficient DECIMAL(5,4) CHECK (engine_overlap_coefficient >= 0.0 AND engine_overlap_coefficient <= 1.0),
    factual_alignment_score DECIMAL(5,4) CHECK (factual_alignment_score >= 0.0 AND factual_alignment_score <= 1.0),
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB,
    UNIQUE(query_id, calculated_at)
);

-- Performance indexes for trend analysis queries
CREATE INDEX idx_bias_metrics_calculated_at ON bias_metrics(calculated_at);
CREATE INDEX idx_bias_metrics_query_calculated ON bias_metrics(query_id, calculated_at);
CREATE INDEX idx_bias_metrics_domain_diversity ON bias_metrics(domain_diversity_index) WHERE domain_diversity_index IS NOT NULL;
CREATE INDEX idx_bias_metrics_engine_overlap ON bias_metrics(engine_overlap_coefficient) WHERE engine_overlap_coefficient IS NOT NULL;
CREATE INDEX idx_bias_metrics_factual_alignment ON bias_metrics(factual_alignment_score) WHERE factual_alignment_score IS NOT NULL;

-- Partial indexes for efficient date range queries
CREATE INDEX idx_bias_metrics_recent_7d ON bias_metrics(calculated_at, query_id) 
    WHERE calculated_at >= NOW() - INTERVAL '7 days';
CREATE INDEX idx_bias_metrics_recent_30d ON bias_metrics(calculated_at, query_id) 
    WHERE calculated_at >= NOW() - INTERVAL '30 days';