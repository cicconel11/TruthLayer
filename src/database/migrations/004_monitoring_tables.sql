-- Monitoring tables migration
-- Creates tables for system monitoring, alerts, and performance tracking

-- System health checks table - stores health check results over time
CREATE TABLE system_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    message TEXT,
    response_time INTEGER, -- in milliseconds
    metadata JSONB,
    checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- System alerts table - stores generated alerts and their acknowledgment status
CREATE TABLE system_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id VARCHAR(100) UNIQUE NOT NULL, -- External alert identifier
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,
    metadata JSONB,
    acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- System performance metrics table - stores detailed performance metrics over time
CREATE TABLE system_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL, -- 'scheduler', 'queue', 'collection', 'annotation'
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(20), -- 'percentage', 'count', 'seconds', 'rate'
    metadata JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Collection job status table - tracks individual collection job executions
CREATE TABLE collection_job_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    query_set VARCHAR(50),
    engine VARCHAR(20) CHECK (engine IN ('google', 'bing', 'perplexity', 'brave')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'running', 'completed', 'failed', 'timeout')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    results_collected INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

-- Annotation job status table - tracks annotation pipeline executions
CREATE TABLE annotation_job_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'running', 'completed', 'failed', 'timeout')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    results_processed INTEGER DEFAULT 0,
    successful_annotations INTEGER DEFAULT 0,
    failed_annotations INTEGER DEFAULT 0,
    average_confidence DECIMAL(3,2),
    error_message TEXT,
    metadata JSONB
);

-- Performance indexes for monitoring queries
CREATE INDEX idx_system_health_checks_component ON system_health_checks(component);
CREATE INDEX idx_system_health_checks_checked_at ON system_health_checks(checked_at);
CREATE INDEX idx_system_health_checks_status ON system_health_checks(status);

CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_system_alerts_acknowledged ON system_alerts(acknowledged);
CREATE INDEX idx_system_alerts_created_at ON system_alerts(created_at);
CREATE INDEX idx_system_alerts_source ON system_alerts(source);

CREATE INDEX idx_system_performance_metrics_type ON system_performance_metrics(metric_type);
CREATE INDEX idx_system_performance_metrics_recorded_at ON system_performance_metrics(recorded_at);
CREATE INDEX idx_system_performance_metrics_type_name ON system_performance_metrics(metric_type, metric_name);

CREATE INDEX idx_collection_job_executions_status ON collection_job_executions(status);
CREATE INDEX idx_collection_job_executions_started_at ON collection_job_executions(started_at);
CREATE INDEX idx_collection_job_executions_engine ON collection_job_executions(engine);

CREATE INDEX idx_annotation_job_executions_status ON annotation_job_executions(status);
CREATE INDEX idx_annotation_job_executions_started_at ON annotation_job_executions(started_at);
CREATE INDEX idx_annotation_job_executions_model ON annotation_job_executions(model_version);

-- Partial indexes for recent data queries
CREATE INDEX idx_system_health_checks_recent_24h ON system_health_checks(checked_at, component) 
    WHERE checked_at >= NOW() - INTERVAL '24 hours';

CREATE INDEX idx_collection_job_executions_recent_7d ON collection_job_executions(started_at, status) 
    WHERE started_at >= NOW() - INTERVAL '7 days';

CREATE INDEX idx_annotation_job_executions_recent_7d ON annotation_job_executions(started_at, status) 
    WHERE started_at >= NOW() - INTERVAL '7 days';

-- Insert some sample monitoring data for testing
INSERT INTO system_health_checks (component, status, message, response_time, metadata)
VALUES 
    ('database', 'healthy', 'Database responding normally', 45, '{"connection_pool": "active"}'),
    ('collection', 'healthy', '4 engines active, good collection rate', 120, '{"active_engines": 4, "success_rate": 0.95}'),
    ('annotation', 'degraded', 'Moderate annotation queue backlog', 200, '{"queue_size": 350, "processing_rate": 45}'),
    ('queue', 'healthy', 'Queue processing normally', 30, '{"pending": 120, "throughput": 60}');

INSERT INTO system_alerts (alert_id, severity, title, message, source, metadata)
VALUES 
    ('collection_google_low_success', 'warning', 'Low Collection Success Rate - Google', 'Google collection success rate is 72.5% (145/200)', 'collection_monitor', '{"engine": "google", "success_rate": 0.725}'),
    ('queue_backlog_moderate', 'warning', 'Annotation Queue Backlog', '350 search results pending annotation', 'annotation_monitor', '{"pending_count": 350}');

INSERT INTO system_performance_metrics (metric_type, metric_name, metric_value, unit, metadata)
VALUES 
    ('collection', 'success_rate', 0.92, 'percentage', '{"engine": "all"}'),
    ('collection', 'total_collected', 1250, 'count', '{"time_period": "24h"}'),
    ('annotation', 'queue_size', 350, 'count', '{}'),
    ('annotation', 'processing_rate', 45, 'rate', '{"unit": "per_minute"}'),
    ('scheduler', 'failure_rate', 0.05, 'percentage', '{}'),
    ('queue', 'throughput', 60, 'rate', '{"unit": "per_minute"}');

INSERT INTO collection_job_executions (job_name, query_set, engine, status, completed_at, duration_seconds, results_collected, errors_encountered)
VALUES 
    ('daily_health_queries', 'health', 'google', 'completed', NOW() - INTERVAL '2 hours', 180, 500, 2),
    ('daily_health_queries', 'health', 'bing', 'completed', NOW() - INTERVAL '2 hours', 165, 485, 5),
    ('daily_health_queries', 'health', 'perplexity', 'completed', NOW() - INTERVAL '2 hours', 195, 492, 1),
    ('daily_health_queries', 'health', 'brave', 'failed', NOW() - INTERVAL '2 hours', 45, 0, 1, 'Rate limit exceeded'),
    ('daily_politics_queries', 'politics', 'google', 'completed', NOW() - INTERVAL '4 hours', 220, 400, 3);

INSERT INTO annotation_job_executions (batch_id, model_version, status, completed_at, duration_seconds, results_processed, successful_annotations, failed_annotations, average_confidence)
VALUES 
    ('batch_20241023_001', 'gpt-4-turbo', 'completed', NOW() - INTERVAL '1 hour', 450, 200, 195, 5, 0.87),
    ('batch_20241023_002', 'gpt-4-turbo', 'completed', NOW() - INTERVAL '3 hours', 380, 150, 148, 2, 0.89),
    ('batch_20241023_003', 'gpt-4-turbo', 'running', NULL, NULL, 75, 70, 5, 0.85);