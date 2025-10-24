-- Migration to add generated_reports table for storing transparency reports
-- This table stores generated reports with their configuration and content

-- Generated reports table - stores transparency reports
CREATE TABLE generated_reports (
    id VARCHAR(100) PRIMARY KEY,
    title TEXT NOT NULL,
    config JSONB NOT NULL,
    metadata JSONB NOT NULL,
    content TEXT NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance indexes for report queries
CREATE INDEX idx_generated_reports_generated_at ON generated_reports(generated_at);
CREATE INDEX idx_generated_reports_title ON generated_reports(title);
CREATE INDEX idx_generated_reports_config_format ON generated_reports((config->>'format'));
CREATE INDEX idx_generated_reports_config_time_period ON generated_reports((config->>'timePeriod'));

-- GIN index for efficient JSONB queries on config and metadata
CREATE INDEX idx_generated_reports_config_gin ON generated_reports USING GIN (config);
CREATE INDEX idx_generated_reports_metadata_gin ON generated_reports USING GIN (metadata);