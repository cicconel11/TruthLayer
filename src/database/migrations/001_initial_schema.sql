-- Initial schema migration for TruthLayer MVP
-- Creates core tables for search results, queries, and annotations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Queries table - stores benchmark queries and metadata
CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Search results table - stores normalized results from all engines
CREATE TABLE search_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    engine VARCHAR(20) NOT NULL CHECK (engine IN ('google', 'bing', 'perplexity', 'brave')),
    rank INTEGER NOT NULL CHECK (rank > 0),
    title TEXT NOT NULL,
    snippet TEXT,
    url TEXT NOT NULL,
    collected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    content_hash VARCHAR(64),
    raw_html_path TEXT,
    UNIQUE(query_id, engine, rank)
);

-- Annotations table - stores LLM classification results
CREATE TABLE annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
    domain_type VARCHAR(20) CHECK (domain_type IN ('news', 'government', 'academic', 'blog', 'commercial', 'social')),
    factual_score DECIMAL(3,2) CHECK (factual_score >= 0.0 AND factual_score <= 1.0),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    reasoning TEXT,
    model_version VARCHAR(50) NOT NULL,
    annotated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(result_id, model_version)
);

-- Performance indexes
CREATE INDEX idx_search_results_collected_at ON search_results(collected_at);
CREATE INDEX idx_search_results_engine ON search_results(engine);
CREATE INDEX idx_search_results_query_engine ON search_results(query_id, engine);
CREATE INDEX idx_search_results_content_hash ON search_results(content_hash);
CREATE INDEX idx_queries_category ON queries(category);
CREATE INDEX idx_queries_created_at ON queries(created_at);
CREATE INDEX idx_annotations_domain_type ON annotations(domain_type);
CREATE INDEX idx_annotations_annotated_at ON annotations(annotated_at);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to queries table
CREATE TRIGGER update_queries_updated_at 
    BEFORE UPDATE ON queries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();