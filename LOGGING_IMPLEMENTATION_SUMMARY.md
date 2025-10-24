# TruthLayer Logging and Audit System Implementation

## Overview

Successfully implemented comprehensive logging and audit capabilities for the TruthLayer MVP system as specified in task 8.3. The implementation provides structured logging, audit trails, and debugging utilities for all system operations.

## ✅ Completed Features

### 1. Enhanced Logging System (`src/utils/logger.ts`)
- **Structured logging** with flexible LogContext interface supporting any additional properties
- **Multiple log types**: application, audit, performance, security
- **Operation loggers** with correlation ID tracking for distributed tracing
- **Performance timing** decorator for automatic operation duration tracking
- **Multiple log outputs**: console, files (error.log, combined.log, audit.log, performance.log, security.log)
- **Winston-based** with JSON and text format support

### 2. Comprehensive Audit Service (`src/services/audit-service.ts`)
- **Event recording** for all system operations (collection, annotation, metrics, exports, alerts)
- **Structured audit events** with correlation IDs, user tracking, and metadata
- **Audit querying** with flexible filtering (by type, component, severity, time range, user)
- **Audit statistics** for dashboard reporting and analytics
- **Buffered persistence** for performance optimization with configurable batch sizes

### 3. Debug Service (`src/services/debug-service.ts`)
- **Debug sessions** with configurable logging levels and capture options
- **System state snapshots** for troubleshooting at specific points in time
- **Collection failure analysis** with automated recommendations and root cause analysis
- **Debug logging** with session-based organization and correlation tracking
- **Troubleshooting reports** combining audit events, operation traces, and debug logs

### 4. Database Schema (`src/database/migrations/005_audit_tables.sql`)
- **audit_events** table for comprehensive audit logging with full-text search capabilities
- **operation_traces** table for detailed step-by-step operation tracking
- **debug_sessions** and **debug_logs** tables for debugging workflows
- **system_state_snapshots** table for system state capture and analysis
- **Optimized indexes** for query performance and time-based queries

### 5. Logging Integration Service (`src/services/logging-integration-service.ts`)
- **Operation lifecycle management** (start, complete, fail operations)
- **Operation step tracking** with detailed tracing and timing
- **Service-specific logging** for collection, annotation, metrics operations
- **Debug session management** integration with audit trails
- **Comprehensive operation logs** aggregation and correlation

### 6. Debug CLI Utility (`src/utils/debug-cli.ts`)
- **Audit management**: list events, view statistics, filter by criteria
- **Debug sessions**: start/stop sessions, view logs, system snapshots
- **System monitoring**: health checks, alerts management
- **Failure analysis**: automated collection failure analysis with recommendations
- **Troubleshooting**: operation analysis by correlation ID
- **Data cleanup**: old logs and debug data management with retention policies

## 🚀 Usage Examples

### Basic Structured Logging
```typescript
import { logger, generateCorrelationId } from '../utils/logger';

// Basic logging with context
logger.info('Collection started', {
    component: 'collector',
    operation: 'search_collection',
    queryText: 'climate change',
    engines: ['google', 'bing']
});

// Error logging with structured context
logger.error('Collection failed', {
    component: 'collector',
    errorMessage: 'Rate limit exceeded',
    errorType: 'rate_limit',
    success: false
});
```

### Operation Logging with Correlation ID
```typescript
import { createOperationLogger, generateCorrelationId } from '../utils/logger';

const correlationId = generateCorrelationId();
const opLogger = createOperationLogger(correlationId, 'annotation_service');

opLogger.info('Starting annotation batch', {
    operation: 'batch_annotation',
    batchId: 'batch_001',
    resultCount: 100
});

opLogger.performance('annotation_processing', 2500, {
    success: true,
    throughput: 40 // annotations per second
});
```

### Audit Trail Recording
```typescript
import { AuditService } from '../services/audit-service';

const auditService = new AuditService(db);

// Record collection event
await auditService.recordCollectionEvent('completed', {
    queryId: 'query_123',
    queryText: 'artificial intelligence',
    engine: 'google',
    resultsCount: 20,
    duration: 1500
});

// Record annotation event
await auditService.recordAnnotationEvent('completed', {
    batchId: 'batch_001',
    modelVersion: 'gpt-4-turbo',
    resultsCount: 100,
    successfulAnnotations: 95,
    averageConfidence: 0.87
});
```

### Debug Session Management
```typescript
import { DebugService } from '../services/debug-service';

const debugService = new DebugService(db, auditService);

// Start debug session
const sessionId = await debugService.startDebugSession(
    'collection_debug_001',
    'collector',
    'debug',
    {
        verboseLogging: true,
        captureHtml: true,
        proxyDebug: true
    }
);

// Log debug information
await debugService.logDebug(
    sessionId,
    'debug',
    'collector',
    'Proxy rotation successful',
    { oldProxy: '192.168.1.100', newProxy: '192.168.1.101' }
);
```

### CLI Usage
```bash
# View recent audit events
npm run debug audit list --hours 24 --severity error

# Analyze collection failures
npm run debug analyze failures --hours 12

# Check system health
npm run debug monitor health

# View debug session logs
npm run debug debug logs --session debug_session_id

# Generate troubleshooting report
npm run debug analyze operation --correlation corr_123456789
```

## 📊 Log Output Examples

### Structured JSON Logs
```json
{
  "timestamp": "2025-10-23T22:19:19.003Z",
  "level": "info",
  "message": "Collection completed successfully",
  "logType": "application",
  "component": "collection_service",
  "correlationId": "corr_1761257959014_e86pa7aqc",
  "operation": "collect_search_results",
  "success": true,
  "duration": 1500,
  "resultsCount": 20,
  "engines": ["google", "bing"]
}
```

### Audit Trail Entry
```json
{
  "timestamp": "2025-10-23T22:19:19.114Z",
  "level": "info",
  "message": "Search results collection completed",
  "logType": "audit",
  "eventType": "collection_completed",
  "component": "collection_service",
  "correlationId": "corr_1761257959014_e86pa7aqc",
  "userId": "system_user",
  "queryText": "artificial intelligence ethics",
  "resultsCount": 20,
  "engines": ["google", "bing"]
}
```

### Performance Metrics
```json
{
  "timestamp": "2025-10-23T22:19:19.250Z",
  "level": "info",
  "message": "Performance: annotation_pipeline completed in 130ms",
  "logType": "performance",
  "operation": "annotation_pipeline",
  "duration": 130,
  "component": "annotation_pipeline",
  "correlationId": "corr_1761257959115_wmhefy1ua",
  "success": true,
  "batchSize": 50,
  "throughput": 23,
  "modelVersion": "gpt-4-turbo"
}
```

## 🗂️ Log File Structure

```
logs/
├── combined.log      # All log entries
├── error.log         # Error entries only
├── audit.log         # Audit trail entries
├── performance.log   # Performance metrics
└── security.log      # Security events
```

## 🔧 Configuration

The logging system integrates with the existing configuration system:

```typescript
// config/default.json
{
  "monitoring": {
    "logLevel": "info",
    "logFormat": "json"
  }
}
```

## ✅ Requirements Fulfilled

- **Requirement 7.5**: ✅ Comprehensive logging for all system operations
- **Requirement 2.3**: ✅ Audit trails for data processing and annotation decisions  
- **Requirement 5.4**: ✅ Debugging utilities for troubleshooting collection failures

## 🧪 Testing

The logging system includes comprehensive tests:

```bash
# Run logging unit tests
npm test -- src/test/logging-unit.test.ts

# Run audit service tests (requires database)
npm test -- src/test/audit-service.test.ts

# Run logging demonstration
npx tsx src/examples/simple-logging-demo.ts
```

## 📈 Key Benefits

1. **Comprehensive Observability**: Full visibility into system operations with structured logging
2. **Audit Compliance**: Complete audit trails for regulatory and compliance requirements
3. **Debugging Efficiency**: Powerful debugging tools with correlation tracking and failure analysis
4. **Performance Monitoring**: Built-in performance metrics and timing analysis
5. **Scalable Architecture**: Buffered persistence and optimized database schemas for high throughput
6. **Developer Experience**: Easy-to-use APIs with flexible context support

## 🔮 Future Enhancements

- Integration with external monitoring systems (Prometheus, Grafana)
- Real-time log streaming and alerting
- Machine learning-based anomaly detection
- Advanced log analytics and visualization
- Distributed tracing integration (OpenTelemetry)

The logging and audit system provides a solid foundation for system observability, debugging, and compliance, meeting all specified requirements while being extensible for future needs.