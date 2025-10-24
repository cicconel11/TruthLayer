-- Dashboard support tables migration
-- Creates tables for bias metrics and system monitoring

-- Bias metrics table - stores computed bias metrics over time
CREATE TABLE bias_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    engine VARCHAR(20) NOT NULL CHECK (engine IN ('google', 'bing', 'perplexity', 'brave')),
    category VARCHAR(50),
    domain_diversity DECIMAL(5,4) CHECK (domain_diversity >= 0.0 AND domain_diversity <= 1.0),
    engine_overlap DECIMAL(5,4) CHECK (engine_overlap >= 0.0 AND engine_overlap <= 1.0),
    factual_alignment DECIMAL(5,4) CHECK (factual_alignment >= 0.0 AND factual_alignment <= 1.0),
    total_queries INTEGER NOT NULL DEFAULT 0,
    total_results INTEGER NOT NULL DEFAULT 0,
    unique_domains INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(date, engine, category)
);

-- System logs table - stores application logs and events
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    message TEXT NOT NULL,
    component VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance indexes for bias metrics
CREATE INDEX idx_bias_metrics_date ON bias_metrics(date);
CREATE INDEX idx_bias_metrics_engine ON bias_metrics(engine);
CREATE INDEX idx_bias_metrics_category ON bias_metrics(category);
CREATE INDEX idx_bias_metrics_date_engine ON bias_metrics(date, engine);
CREATE INDEX idx_bias_metrics_updated_at ON bias_metrics(updated_at);

-- Performance indexes for system logs
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX idx_system_logs_component ON system_logs(component);

-- Apply updated_at trigger to bias_metrics table
CREATE TRIGGER update_bias_metrics_updated_at 
    BEFORE UPDATE ON bias_metrics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample bias metrics data for testing
INSERT INTO bias_metrics (date, engine, category, domain_diversity, engine_overlap, factual_alignment, total_queries, total_results, unique_domains)
VALUES 
    (CURRENT_DATE - INTERVAL '1 day', 'google', 'health', 0.75, 0.45, 0.82, 25, 500, 375),
    (CURRENT_DATE - INTERVAL '1 day', 'bing', 'health', 0.68, 0.52, 0.78, 25, 500, 340),
    (CURRENT_DATE - INTERVAL '1 day', 'perplexity', 'health', 0.71, 0.38, 0.85, 25, 500, 355),
    (CURRENT_DATE - INTERVAL '1 day', 'brave', 'health', 0.73, 0.41, 0.80, 25, 500, 365),
    
    (CURRENT_DATE - INTERVAL '2 days', 'google', 'politics', 0.72, 0.48, 0.76, 20, 400, 288),
    (CURRENT_DATE - INTERVAL '2 days', 'bing', 'politics', 0.65, 0.55, 0.74, 20, 400, 260),
    (CURRENT_DATE - INTERVAL '2 days', 'perplexity', 'politics', 0.69, 0.42, 0.79, 20, 400, 276),
    (CURRENT_DATE - INTERVAL '2 days', 'brave', 'politics', 0.70, 0.44, 0.77, 20, 400, 280),
    
    (CURRENT_DATE - INTERVAL '3 days', 'google', 'technology', 0.78, 0.43, 0.84, 30, 600, 468),
    (CURRENT_DATE - INTERVAL '3 days', 'bing', 'technology', 0.71, 0.50, 0.81, 30, 600, 426),
    (CURRENT_DATE - INTERVAL '3 days', 'perplexity', 'technology', 0.74, 0.39, 0.87, 30, 600, 444),
    (CURRENT_DATE - INTERVAL '3 days', 'brave', 'technology', 0.76, 0.41, 0.83, 30, 600, 456);

-- Insert some sample system logs
INSERT INTO system_logs (level, message, component, metadata)
VALUES 
    ('INFO', 'Data collection completed successfully', 'collector', '{"queries": 25, "results": 500, "duration": "45s"}'),
    ('INFO', 'Annotation pipeline processed batch', 'annotator', '{"batch_size": 100, "success_rate": 0.98}'),
    ('INFO', 'Bias metrics updated', 'metrics', '{"engines": ["google", "bing", "perplexity", "brave"]}'),
    ('WARN', 'Rate limit encountered for engine', 'collector', '{"engine": "google", "retry_after": 30}'),
    ('ERROR', 'Failed to annotate result', 'annotator', '{"result_id": "123e4567-e89b-12d3-a456-426614174000", "error": "API timeout"}');