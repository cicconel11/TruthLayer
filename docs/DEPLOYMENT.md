# TruthLayer Deployment Guide

This guide covers deploying TruthLayer to various environments with proper configuration.

## Table of Contents

- [Environment Matrices](#environment-matrices)
- [Deployment Options](#deployment-options)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Build Configuration](#build-configuration)
- [Monitoring and Logging](#monitoring-and-logging)

## Environment Matrices

### Required vs Optional Variables

| Variable | Development | Staging | Production | Notes |
|----------|------------|---------|------------|-------|
| `NODE_ENV` | development | production | production | Auto-set by platform |
| `STORAGE_URL` | Optional (DuckDB) | Required | Required | Postgres connection string |
| `OPENAI_API_KEY` | Optional | Recommended | Required | For LLM annotations |
| `BRAVE_API_KEY` | Optional | Recommended | Required | Brave Search API |
| `BING_API_KEY` | Optional | Optional | Recommended | Bing Search API |
| `GOOGLE_API_KEY` | Optional | Optional | Recommended | Google Search API |
| `GOOGLE_CSE_ID` | Optional | Optional | Recommended | Google Custom Search Engine ID |
| `PERPLEXITY_API_KEY` | Optional | Optional | Optional | Perplexity AI API |
| `DDG_APP_TOKEN` | Optional | Optional | Optional | DuckDuckGo App Token |

### Feature Flags by Environment

| Feature | Development | Staging | Production |
|---------|------------|---------|------------|
| LLM Annotations | Heuristics | Mixed | OpenAI |
| Realtime Updates (SSE) | Enabled | Enabled | Enabled |
| Rate Limiting | Relaxed | Strict | Strict |
| Logging Level | debug | info | warn |
| Cache TTL | 1 hour | 6 hours | 24 hours |

## Deployment Options

### Option 1: Vercel (Dashboard Only)

**Best for:** Frontend dashboard with API routes

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Configure Project:**
   ```bash
   cd apps/dashboard
   vercel
   ```

3. **Set Environment Variables:**
   ```bash
   vercel env add STORAGE_URL
   vercel env add OPENAI_API_KEY
   vercel env add BRAVE_API_KEY
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

**Limitations:**
- No background jobs (use separate service for collector/scheduler)
- 10s function timeout (use Edge runtime for SSE)
- Serverless cold starts

### Option 2: Railway (Full Stack)

**Best for:** Complete pipeline deployment with Postgres

1. **Create Railway Project:**
   ```bash
   railway login
   railway init
   ```

2. **Add Postgres:**
   ```bash
   railway add postgres
   ```

3. **Configure Services:**
   ```yaml
   # railway.toml
   [build]
   builder = "NIXPACKS"
   buildCommand = "pnpm install && pnpm run build"

   [deploy]
   startCommand = "pnpm run start:dev"
   healthcheckPath = "/api/health"
   restartPolicyType = "ON_FAILURE"

   [[services]]
   name = "dashboard"
   buildPath = "apps/dashboard"

   [[services]]
   name = "collector"
   buildPath = "apps/collector"
   ```

4. **Deploy:**
   ```bash
   railway up
   ```

### Option 3: Docker Compose (Self-Hosted)

**Best for:** Full control, on-premise deployment

1. **Build Images:**
   ```bash
   docker compose build
   ```

2. **Configure Secrets:**
   ```bash
   cp .env.example .env
   # Edit .env with your keys
   ```

3. **Start Services:**
   ```bash
   docker compose up -d
   ```

**Services:**
- Dashboard (port 3000)
- Collector (background)
- Scheduler (background)
- Postgres (port 5432)
- Metrics API (port 3001)

### Option 4: Kubernetes (Enterprise)

**Best for:** High availability, auto-scaling

See `k8s/` directory for manifests:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/dashboard.yaml
kubectl apply -f k8s/collector.yaml
kubectl apply -f k8s/scheduler.yaml
```

## Database Setup

### Postgres (Recommended for Production)

**Managed Providers:**

#### Neon (Serverless)
```bash
# Sign up at neon.tech
# Get connection string
STORAGE_URL=postgres://user:pass@ep-xyz.neon.tech/truthlayer?sslmode=require
```

#### Supabase
```bash
# Sign up at supabase.com
# Get connection string from Settings > Database
STORAGE_URL=postgres://postgres.xyz:pass@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

#### Railway
```bash
# Add Postgres plugin
# Railway auto-injects DATABASE_URL
# Copy to STORAGE_URL
```

**Self-Hosted:**
```bash
docker run -d \
  --name truthlayer-db \
  -e POSTGRES_PASSWORD=<secure-password> \
  -e POSTGRES_USER=truthlayer \
  -e POSTGRES_DB=truthlayer \
  -v truthlayer-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  postgres:16-alpine

# Create extension (if needed for future features)
psql $STORAGE_URL -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

### DuckDB (Development Only)

```bash
# Auto-created on first run
# File location: apps/collector/data/truthlayer.duckdb
```

## Environment Variables

### Complete Reference

```bash
# ======================
# Runtime Environment
# ======================
NODE_ENV=production

# ======================
# Database
# ======================
STORAGE_URL=postgres://user:pass@host:5432/db

# ======================
# LLM Providers
# ======================
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...
ANNOTATION_MODEL=gpt-4o-mini
ANNOTATION_PROVIDER=openai  # or "claude" or "auto"
ANNOTATION_BATCH_SIZE=20
ANNOTATION_MAX_CONCURRENCY=3

# ======================
# Search Engine APIs
# ======================
GOOGLE_API_KEY=AIza...
GOOGLE_CSE_ID=your-search-engine-id
BING_API_KEY=your-bing-key
BRAVE_API_KEY=brv-...
DDG_APP_TOKEN=your-ddg-token
PERPLEXITY_API_KEY=pplx-...

# ======================
# Rate Limiting
# ======================
BRAVE_RATE_LIMIT_RPS=1
PERPLEXITY_RATE_LIMIT_RPS=2

# ======================
# Collector Configuration
# ======================
BENCHMARK_QUERY_SET_PATH=config/benchmark-queries.json
COLLECTOR_OUTPUT_DIR=data/serp
COLLECTOR_MAX_RESULTS=20
COLLECTOR_CACHE_TTL_DAYS=7
FORCE_REFRESH=false

# ======================
# Scheduler
# ======================
SCHEDULER_CRON_EXPRESSION="0 * * * *"  # Every hour
SCHEDULER_RUN_ON_START=true
SCHEDULER_MAX_RETRIES=3
SCHEDULER_RETRY_DELAY_MS=10000
SCHEDULER_TIMEZONE=UTC

# ======================
# Metrics
# ======================
METRICS_EXPORT_DIR=data/metrics
METRICS_WINDOW_SIZE=7

# ======================
# Logging
# ======================
LOG_LEVEL=info  # debug | info | warn | error
```

## Build Configuration

### TypeScript Build

```bash
# Type check all packages
pnpm run typecheck

# Build all packages
pnpm run build

# Build specific package
pnpm --filter @truthlayer/dashboard build
```

### Optimization for Production

**Next.js (Dashboard):**
```javascript
// next.config.mjs
export default {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true
};
```

**Node Services:**
```bash
# Use production deps only
pnpm install --prod

# Enable production optimizations
NODE_ENV=production node dist/index.js
```

## Monitoring and Logging

### Health Checks

Each service exposes `/health` endpoint:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"2025-11-09T...","uptime":12345}
```

### Structured Logging

All services use Winston with JSON output:

```json
{
  "level": "info",
  "message": "Collection completed",
  "timestamp": "2025-11-09T10:30:00.000Z",
  "runId": "run_abc123",
  "queryCount": 50,
  "duration": 12500
}
```

**Log Aggregation:**
- Vercel: Built-in logs in dashboard
- Railway: View logs via CLI or dashboard
- Docker: `docker compose logs -f <service>`
- Kubernetes: `kubectl logs -f deployment/<name>`

### Error Tracking

Consider integrating:
- **Sentry:** Exception tracking
- **LogRocket:** Session replay
- **Datadog:** Full observability

See [OBSERVABILITY.md](./OBSERVABILITY.md) for detailed monitoring setup.

## Troubleshooting Deployment

### Issue: Cold Start Timeouts

**Symptom:** First request to dashboard takes >10s

**Solution:**
- Use Edge runtime for API routes
- Enable warmup pings
- Increase function timeout
- Consider Railway/Fly.io instead of serverless

### Issue: Database Connection Pool Exhausted

**Symptom:** `too many clients already` error

**Solution:**
```typescript
// Use connection pooling
const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

### Issue: Rate Limiting Blocks Collection

**Symptom:** 429 errors from search engines

**Solution:**
```bash
# Adjust rate limits in .env
BRAVE_RATE_LIMIT_RPS=0.5
PERPLEXITY_RATE_LIMIT_RPS=1

# Enable caching
COLLECTOR_CACHE_TTL_DAYS=30
```

### Issue: OOM (Out of Memory)

**Symptom:** Process killed during annotation

**Solution:**
```bash
# Reduce batch size
ANNOTATION_BATCH_SIZE=10
ANNOTATION_MAX_CONCURRENCY=2

# Increase memory limit
NODE_OPTIONS="--max-old-space-size=2048"
```

## Security Checklist

- [ ] All API keys stored in secrets manager
- [ ] Database credentials use strong passwords
- [ ] Postgres uses SSL connections
- [ ] CORS properly configured
- [ ] Rate limiting enabled on public endpoints
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies scanned for vulnerabilities
- [ ] Environment variables never logged

## Performance Benchmarks

Expected performance on typical hardware:

| Task | Duration | Notes |
|------|----------|-------|
| Single query collection | 2-5s | All 5 engines |
| Annotation (batch of 100) | 30-60s | With OpenAI |
| Metrics computation | 5-10s | 50 queries |
| Dashboard initial load | 1-2s | Cached data |
| SSE connection latency | <500ms | Realtime updates |

---

**Next Steps:**
- Review [OBSERVABILITY.md](./OBSERVABILITY.md) for monitoring setup
- See [README.md](../README.md) for development workflow
- Check [SETUP.md](../SETUP.md) for local development
