# TruthLayer Observability Guide

Complete guide to logging, monitoring, and debugging TruthLayer systems.

## Table of Contents

- [Logging Strategy](#logging-strategy)
- [Metrics and Monitoring](#metrics-and-monitoring)
- [Tracing and Correlation](#tracing-and-correlation)
- [Alerting](#alerting)
- [Debugging](#debugging)

## Logging Strategy

### Log Levels

TruthLayer uses Winston with structured logging:

| Level | Use Case | Example |
|-------|----------|---------|
| `error` | Critical failures | API key invalid, DB connection lost |
| `warn` | Degraded operation | Rate limit hit, fallback to heuristics |
| `info` | Normal operations | Collection started, metrics computed |
| `debug` | Detailed diagnostics | HTTP requests, retry attempts |

### Configuration

```bash
# Environment variable
LOG_LEVEL=info  # or debug, warn, error

# Runtime override (development)
NODE_ENV=development LOG_LEVEL=debug pnpm run dev
```

### Structured Log Format

All logs follow this schema:

```json
{
  "level": "info",
  "message": "Collection completed successfully",
  "timestamp": "2025-11-09T14:30:45.123Z",
  "service": "collector",
  "runId": "run_2025-11-09_143022",
  "queryId": "query_abc123",
  "engine": "brave",
  "duration": 2500,
  "resultCount": 18,
  "extra": {
    "apiCallCount": 1,
    "cacheHit": false
  }
}
```

### Log Correlation with Run IDs

Every pipeline run generates a unique `runId`:

```typescript
import { randomUUID } from "crypto";

const runId = `run_${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
// Example: run_20251109T143045

// All logs for this run include runId
logger.info("Starting collection", { runId, queryCount: 50 });
```

**Query runId:**
```bash
# In production logs
grep "run_20251109T143045" logs/*.log

# In Postgres
SELECT * FROM search_results WHERE run_id = 'run_20251109T143045';
```

## Metrics and Monitoring

### Built-in Metrics

TruthLayer exposes metrics via `/api/metrics` endpoint:

```json
{
  "system": {
    "uptime": 12345,
    "memoryUsage": {
      "heapUsed": 123456789,
      "heapTotal": 234567890,
      "external": 12345678
    },
    "cpuUsage": 0.45
  },
  "pipeline": {
    "totalRuns": 234,
    "successfulRuns": 230,
    "failedRuns": 4,
    "averageDuration": 45000,
    "lastRunAt": "2025-11-09T14:30:00.000Z"
  },
  "collector": {
    "totalQueries": 11700,
    "totalResults": 234000,
    "engineStats": {
      "brave": { "queries": 2340, "errors": 12, "avgLatency": 2100 },
      "google": { "queries": 2340, "errors": 5, "avgLatency": 1800 }
    }
  },
  "annotation": {
    "totalAnnotations": 234000,
    "llmAnnotations": 220000,
    "heuristicAnnotations": 14000,
    "averageConfidence": 0.82,
    "provider": "openai"
  }
}
```

### Custom Dashboards

#### Grafana Setup

1. **Install Prometheus Exporter:**
   ```bash
   pnpm add prom-client
   ```

2. **Create metrics endpoint:**
   ```typescript
   // apps/dashboard/app/api/metrics/prometheus/route.ts
   import { register } from "prom-client";
   
   export async function GET() {
     const metrics = await register.metrics();
     return new Response(metrics, {
       headers: { "Content-Type": register.contentType }
     });
   }
   ```

3. **Configure Prometheus:**
   ```yaml
   # prometheus.yml
   scrape_configs:
     - job_name: 'truthlayer'
       static_configs:
         - targets: ['localhost:3000']
       metrics_path: '/api/metrics/prometheus'
       scrape_interval: 15s
   ```

4. **Import Grafana Dashboard:**
   - ID: `truthlayer-overview`
   - Panels: Collection rate, error rate, latency percentiles

#### Datadog Integration

```typescript
// packages/config/src/datadog.ts
import { StatsD } from "hot-shots";

export const dogstatsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  prefix: 'truthlayer.',
  tags: [`env:${process.env.NODE_ENV}`]
});

// Usage
dogstatsd.increment('collection.started', { engine: 'brave' });
dogstatsd.timing('collection.duration', duration, { engine: 'brave' });
dogstatsd.gauge('annotation.confidence', confidence);
```

### Key Metrics to Track

| Metric | Type | Purpose | Alert Threshold |
|--------|------|---------|-----------------|
| `collection.duration` | Histogram | Query collection time | p95 > 10s |
| `collection.errors` | Counter | Failed collections | > 5% |
| `annotation.llm_failures` | Counter | LLM annotation failures | > 10% |
| `api.rate_limit_hits` | Counter | Rate limit encounters | > 20/hour |
| `database.query_duration` | Histogram | DB query performance | p95 > 1s |
| `sse.active_connections` | Gauge | Realtime connections | > 100 |
| `memory.heap_used` | Gauge | Memory usage | > 90% |

## Tracing and Correlation

### OpenTelemetry Integration (Optional)

```typescript
// packages/config/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();
```

### Distributed Tracing Pattern

```typescript
import { randomUUID } from "crypto";

// Parent span (pipeline run)
const traceId = randomUUID();
const runId = `run_${Date.now()}`;

// Child spans
logger.info("Collection started", { traceId, runId, spanId: "collect" });
logger.info("Annotation started", { traceId, runId, spanId: "annotate", parentSpanId: "collect" });
logger.info("Metrics computed", { traceId, runId, spanId: "metrics", parentSpanId: "annotate" });
```

## Alerting

### Critical Alerts

Configure alerts for:

1. **Service Down**
   ```bash
   # Health check fails 3 consecutive times
   curl -f http://localhost:3000/api/health || alert
   ```

2. **Database Connection Lost**
   ```typescript
   logger.error("Database connection failed", {
     error: err.message,
     alert: "pagerduty",
     severity: "critical"
   });
   ```

3. **API Key Exhausted**
   ```typescript
   if (response.status === 429 && retryAfter > 3600) {
     logger.error("Rate limit exhausted", {
       engine: "brave",
       retryAfter,
       alert: "slack",
       severity: "high"
     });
   }
   ```

4. **Annotation Failure Rate High**
   ```typescript
   const failureRate = failures / total;
   if (failureRate > 0.15) {
     logger.warn("High annotation failure rate", {
       failureRate,
       total,
       alert: "slack",
       severity: "medium"
     });
   }
   ```

### Alert Routing

```typescript
// packages/config/src/alerting.ts
export async function sendAlert(message: string, severity: "critical" | "high" | "medium") {
  if (severity === "critical") {
    await fetch(process.env.PAGERDUTY_WEBHOOK, {
      method: "POST",
      body: JSON.stringify({ message, severity })
    });
  } else {
    await fetch(process.env.SLACK_WEBHOOK, {
      method: "POST",
      body: JSON.stringify({ text: message })
    });
  }
}
```

## Debugging

### Development Tools

#### 1. Enable Debug Logging

```bash
LOG_LEVEL=debug pnpm run dev
```

#### 2. Inspect Database State

```bash
# Recent runs
pnpm run check-db-state

# Specific run
SELECT * FROM search_results WHERE run_id = 'run_abc123';
SELECT * FROM annotation_records WHERE search_result_id IN (
  SELECT id FROM search_results WHERE run_id = 'run_abc123'
);
```

#### 3. Replay Failed Annotations

```typescript
// scripts/replay-annotations.ts
import { createStorageClient } from "@truthlayer/storage";

const storage = createStorageClient();
const failedResults = await storage.fetchPendingAnnotations({ limit: 100 });

for (const result of failedResults) {
  logger.info("Retrying annotation", { resultId: result.id });
  // Re-run annotation
}
```

#### 4. Test Single Query

```bash
# Test collection for one query
node test-single-query.js "climate change policy"

# Test full pipeline
node test-full-metrics-computation.js
```

### Production Debugging

#### 1. Live Log Streaming

```bash
# Vercel
vercel logs --follow

# Railway
railway logs --follow

# Docker
docker compose logs -f collector

# Kubernetes
kubectl logs -f deployment/truthlayer-collector
```

#### 2. Query Performance

```sql
-- Slow queries
SELECT query, COUNT(*) as count, AVG(duration) as avg_duration
FROM (
  SELECT query_id as query,
         EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000 as duration
  FROM search_results
  WHERE created_at > NOW() - INTERVAL '1 hour'
) subquery
GROUP BY query
HAVING AVG(duration) > 5000
ORDER BY avg_duration DESC;
```

#### 3. Memory Profiling

```bash
# Start with heap snapshot
node --inspect dist/index.js

# Connect Chrome DevTools to localhost:9229
# Take heap snapshots before/after collection
```

#### 4. SSE Connection Debugging

```bash
# Test SSE endpoint
curl -N -H "Accept: text/event-stream" http://localhost:3000/api/metrics/stream

# Expected output:
# data: {"type":"connected","timestamp":"2025-11-09T..."}
# data: {"type":"heartbeat","timestamp":"2025-11-09T..."}
```

### Common Issues and Solutions

#### Issue: "No LLM API keys configured"

**Symptom:**
```
⚠️  No LLM API keys configured - annotations will use heuristics only
```

**Solution:**
```bash
# Add to .env
OPENAI_API_KEY=sk-proj-...

# Verify
pnpm run typecheck && pnpm run dev
```

#### Issue: High annotation latency

**Symptom:**
```json
{"level":"warn","message":"Annotation took 15000ms","duration":15000}
```

**Solution:**
```bash
# Reduce batch size
ANNOTATION_BATCH_SIZE=10
ANNOTATION_MAX_CONCURRENCY=2

# Use faster model
ANNOTATION_MODEL=gpt-3.5-turbo
```

#### Issue: SSE connections drop

**Symptom:**
```
Connection lost. Attempting to reconnect...
```

**Solution:**
1. Check reverse proxy timeout settings (nginx, cloudflare)
2. Increase heartbeat frequency:
   ```typescript
   setInterval(() => broadcastHeartbeat(), 10000); // 10s instead of 20s
   ```
3. Enable fallback to polling

---

**Monitoring Checklist:**
- [ ] Structured logging enabled
- [ ] RunId correlation working
- [ ] Health checks responding
- [ ] Key metrics tracked
- [ ] Alerts configured
- [ ] Dashboard accessible
- [ ] Backup/retention policies set

**Recommended Tools:**
- **Logs:** Grafana Loki, Datadog, Logtail
- **Metrics:** Prometheus + Grafana, Datadog
- **Tracing:** Jaeger, Datadog APM, Honeycomb
- **Errors:** Sentry, Rollbar
- **Uptime:** UptimeRobot, Pingdom

---

**Next:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
- [README.md](../README.md) - Project overview
