-- Audit tables migration
-- Creates comprehensive audit logging tables for system operations

-- Main audit events table - stores all system operation audit trails
CREATE TABLE audit_events (
    id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'collection_started', 'collection_completed', 'collection_failed',
        'annotation_started', 'annotation_completed', 'annotation_failed',
        'metrics_calculated', 'data_exported', 'system_alert_created',
        'system_alert_acknowledged', 'data_integrity_check', 'scheduler_job_executed',
        'query_processed', 'user_action', 'system_configuration_changed'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    component VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    correlation_id VARCHAR(100),
    duration INTEGER, -- in milliseconds
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    stack_trace TEXT
);

-- Operation traces table - detailed step-by-step operation logging
CREATE TABLE operation_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    correlation_id VARCHAR(100) NOT NULL,
    operation_name VARCHAR(100) NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    step_order INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    duration INTEGER, -- in milliseconds
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
    input_data JSONB,
    output_data JSONB,
    error_details JSONB,
    metadata JSONB DEFAULT '{}'
);

-- Debug sessions table - for troubleshooting and debugging
CREATE TABLE debug_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_name VARCHAR(100) NOT NULL,
    component VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'completed', 'aborted')),
    debug_level VARCHAR(20) NOT NULL CHECK (debug_level IN ('trace', 'debug', 'info', 'warn', 'error')),
    configuration JSONB DEFAULT '{}',
    summary TEXT,
    created_by VARCHAR(100)
);

-- Debug logs table - detailed debug information
CREATE TABLE debug_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES debug_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(20) NOT NULL CHECK (level IN ('trace', 'debug', 'info', 'warn', 'error')),
    component VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    stack_trace TEXT,
    correlation_id VARCHAR(100)
);

-- System state snapshots table - for debugging system state at specific points
CREATE TABLE system_state_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_name VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    component VARCHAR(50) NOT NULL,
    state_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    correlation_id VARCHAR(100),
    created_by VARCHAR(100)
);

-- Performance indexes for audit queries
CREATE INDEX idx_audit_events_timestamp ON audit_events(timestamp);
CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_component ON audit_events(component);
CREATE INDEX idx_audit_events_severity ON audit_events(severity);
CREATE INDEX idx_audit_events_success ON audit_events(success);
CREATE INDEX idx_audit_events_correlation_id ON audit_events(correlation_id);
CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);

CREATE INDEX idx_operation_traces_correlation_id ON operation_traces(correlation_id);
CREATE INDEX idx_operation_traces_operation_name ON operation_traces(operation_name);
CREATE INDEX idx_operation_traces_timestamp ON operation_traces(timestamp);
CREATE INDEX idx_operation_traces_status ON operation_traces(status);

CREATE INDEX idx_debug_sessions_component ON debug_sessions(component);
CREATE INDEX idx_debug_sessions_started_at ON debug_sessions(started_at);
CREATE INDEX idx_debug_sessions_status ON debug_sessions(status);

CREATE INDEX idx_debug_logs_session_id ON debug_logs(session_id);
CREATE INDEX idx_debug_logs_timestamp ON debug_logs(timestamp);
CREATE INDEX idx_debug_logs_level ON debug_logs(level);
CREATE INDEX idx_debug_logs_component ON debug_logs(component);
CREATE INDEX idx_debug_logs_correlation_id ON debug_logs(correlation_id);

CREATE INDEX idx_system_state_snapshots_timestamp ON system_state_snapshots(timestamp);
CREATE INDEX idx_system_state_snapshots_component ON system_state_snapshots(component);
CREATE INDEX idx_system_state_snapshots_correlation_id ON system_state_snapshots(correlation_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_audit_events_component_timestamp ON audit_events(component, timestamp);
CREATE INDEX idx_audit_events_type_timestamp ON audit_events(event_type, timestamp);
CREATE INDEX idx_audit_events_severity_timestamp ON audit_events(severity, timestamp);

-- Partial indexes for recent data queries (last 7 days)
CREATE INDEX idx_audit_events_recent_7d ON audit_events(timestamp, event_type) 
    WHERE timestamp >= NOW() - INTERVAL '7 days';

CREATE INDEX idx_operation_traces_recent_7d ON operation_traces(timestamp, correlation_id) 
    WHERE timestamp >= NOW() - INTERVAL '7 days';

CREATE INDEX idx_debug_logs_recent_24h ON debug_logs(timestamp, level) 
    WHERE timestamp >= NOW() - INTERVAL '24 hours';

-- Insert sample audit data for testing
INSERT INTO audit_events (
    id, event_type, severity, component, action, description, 
    correlation_id, duration, success, metadata
) VALUES 
    ('audit_test_001', 'collection_started', 'info', 'collector', 'start_collection', 
     'Started collection for health queries on Google', 'corr_001', NULL, true, 
     '{"query_set": "health", "engine": "google", "query_count": 25}'),
    
    ('audit_test_002', 'collection_completed', 'info', 'collector', 'complete_collection', 
     'Completed collection for health queries on Google', 'corr_001', 45000, true, 
     '{"query_set": "health", "engine": "google", "results_collected": 500}'),
     
    ('audit_test_003', 'annotation_started', 'info', 'annotation_pipeline', 'start_annotation', 
     'Started annotation batch for 500 search results', 'corr_002', NULL, true, 
     '{"batch_id": "batch_001", "model_version": "gpt-4-turbo", "result_count": 500}'),
     
    ('audit_test_004', 'collection_failed', 'error', 'collector', 'collection_error', 
     'Collection failed for politics queries on Brave due to rate limiting', 'corr_003', 15000, false, 
     '{"query_set": "politics", "engine": "brave", "error_type": "rate_limit"}'),
     
    ('audit_test_005', 'metrics_calculated', 'info', 'metrics_engine', 'calculate_bias_metrics', 
     'Calculated domain diversity and engine overlap metrics', 'corr_004', 8000, true, 
     '{"metrics_type": "bias_analysis", "query_set": "health", "time_range": "24h"}'),
     
    ('audit_test_006', 'data_exported', 'info', 'export_service', 'export_csv', 
     'Exported 1250 search results as CSV', 'corr_005', 12000, true, 
     '{"format": "csv", "record_count": 1250, "filters": {"engine": "all", "date_range": "7d"}}'),
     
    ('audit_test_007', 'system_alert_created', 'warning', 'monitoring_service', 'create_alert', 
     'Created alert for low collection success rate', 'corr_006', NULL, true, 
     '{"alert_id": "alert_001", "alert_severity": "warning", "source": "collection_monitor"}'),
     
    ('audit_test_008', 'data_integrity_check', 'info', 'data_integrity_service', 'integrity_validation', 
     'Data integrity check completed successfully', 'corr_007', 25000, true, 
     '{"check_type": "comprehensive", "errors": 0, "warnings": 2, "records_checked": 5000}');

INSERT INTO operation_traces (
    correlation_id, operation_name, step_name, step_order, 
    duration, status, input_data, output_data, metadata
) VALUES 
    ('corr_001', 'google_collection', 'initialize_scraper', 1, 
     2000, 'completed', '{"proxy_enabled": true, "user_agent": "chrome"}', 
     '{"scraper_id": "google_001", "proxy_ip": "192.168.1.100"}', '{}'),
     
    ('corr_001', 'google_collection', 'execute_queries', 2, 
     40000, 'completed', '{"query_count": 25, "results_per_query": 20}', 
     '{"total_results": 500, "successful_queries": 25, "failed_queries": 0}', '{}'),
     
    ('corr_001', 'google_collection', 'normalize_results', 3, 
     3000, 'completed', '{"raw_results": 500}', 
     '{"normalized_results": 500, "validation_errors": 0}', '{}'),
     
    ('corr_002', 'annotation_batch', 'prepare_batch', 1, 
     5000, 'completed', '{"result_count": 500, "batch_size": 50}', 
     '{"batches_created": 10, "total_tokens_estimated": 45000}', '{}'),
     
    ('corr_002', 'annotation_batch', 'process_annotations', 2, 
     120000, 'completed', '{"batches": 10, "model": "gpt-4-turbo"}', 
     '{"successful_annotations": 495, "failed_annotations": 5, "avg_confidence": 0.87}', '{}');

INSERT INTO debug_sessions (
    session_name, component, status, debug_level, 
    configuration, summary, created_by
) VALUES 
    ('collection_debug_001', 'collector', 'completed', 'debug', 
     '{"verbose_logging": true, "capture_html": true, "proxy_debug": true}', 
     'Debugged Google collection issues - resolved proxy rotation problem', 'system'),
     
    ('annotation_debug_001', 'annotation_pipeline', 'active', 'trace', 
     '{"log_prompts": true, "log_responses": true, "capture_timing": true}', 
     NULL, 'admin'),
     
    ('metrics_debug_001', 'metrics_engine', 'completed', 'info', 
     '{"validate_calculations": true, "log_intermediate_steps": true}', 
     'Verified bias metric calculations are accurate', 'system');

INSERT INTO debug_logs (
    session_id, level, component, message, context, correlation_id
) VALUES 
    ((SELECT id FROM debug_sessions WHERE session_name = 'collection_debug_001'), 
     'debug', 'collector', 'Proxy rotation successful', 
     '{"old_proxy": "192.168.1.100", "new_proxy": "192.168.1.101", "rotation_reason": "rate_limit"}', 'corr_001'),
     
    ((SELECT id FROM debug_sessions WHERE session_name = 'collection_debug_001'), 
     'info', 'collector', 'HTML capture enabled for debugging', 
     '{"capture_path": "/tmp/debug_html", "file_count": 25}', 'corr_001'),
     
    ((SELECT id FROM debug_sessions WHERE session_name = 'annotation_debug_001'), 
     'trace', 'annotation_pipeline', 'Prompt sent to LLM', 
     '{"prompt_length": 1250, "model": "gpt-4-turbo", "temperature": 0.1}', 'corr_002'),
     
    ((SELECT id FROM debug_sessions WHERE session_name = 'metrics_debug_001'), 
     'debug', 'metrics_engine', 'Domain diversity calculation step', 
     '{"unique_domains": 15, "total_results": 20, "diversity_index": 0.75}', 'corr_004');

INSERT INTO system_state_snapshots (
    snapshot_name, component, state_data, metadata, correlation_id, created_by
) VALUES 
    ('collection_state_001', 'collector', 
     '{"active_scrapers": 4, "proxy_pool_size": 10, "queue_size": 0, "success_rate": 0.95}', 
     '{"snapshot_reason": "performance_analysis", "trigger": "scheduled"}', 'corr_001', 'system'),
     
    ('annotation_state_001', 'annotation_pipeline', 
     '{"queue_size": 350, "processing_rate": 45, "model_status": "healthy", "api_quota_remaining": 85000}', 
     '{"snapshot_reason": "capacity_planning", "trigger": "manual"}', 'corr_002', 'admin'),
     
    ('metrics_state_001', 'metrics_engine', 
     '{"last_calculation": "2024-10-23T10:30:00Z", "cached_metrics": 125, "calculation_time": 8000}', 
     '{"snapshot_reason": "performance_optimization", "trigger": "automated"}', 'corr_004', 'system');