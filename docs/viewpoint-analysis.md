# Viewpoint Analysis System

## Overview

The Viewpoint Analysis system provides per-engine analytics and transparency for search results collected from Google, Bing, Brave, Perplexity, and DuckDuckGo.

## Architecture

### Data Flow

```
Benchmark Queries
    ↓
Collector (with Rate Limiting)
    ↓
Normalizer (adds source, confidence, metadata)
    ↓
Storage (search_results + viewpoints tables)
    ↓
API Endpoints (per-engine blocks)
    ↓
Dashboard UI (engine filters + analytics)
```

## Key Features

### 1. Per-Engine Rate Limiting

**Brave Search**: 1 req/sec (free tier)
- Configured via `BRAVE_RATE_LIMIT_RPS` env variable
- Uses token bucket algorithm with jitter
- Tracks `rateLimitHits` in metrics

**Configuration:**
```bash
BRAVE_RATE_LIMIT_RPS=1  # default
PERPLEXITY_RATE_LIMIT_RPS=2  # default
```

### 2. Source Tracking

Results include a `source` field indicating collection method:
- **`api`**: Retrieved from official API (Brave, DuckDuckGo API)
- **`html`**: Scraped from HTML (Perplexity, DuckDuckGo fallback)

### 3. Extraction Quality Metrics

Each result includes:
- `extraction_confidence` (0-1): Quality score for extraction
- `extraction_warnings`: JSON array of warnings during extraction
- `metadata`: JSONB field with additional data (summaries, citations, etc.)

### 4. Perplexity AI Summaries

Perplexity results include:
- **Summary**: AI-generated answer text
- **Citations**: Array of source URLs
- Stored in first result's `metadata` field

### 5. Viewpoints Table

Aggregate per-engine metadata:
- `query_id`, `crawl_run_id`, `engine` (unique constraint)
- `num_results`: Count of results
- `summary`: Perplexity AI summary (if available)
- `citations_count`: Number of citations
- `overlap_hash`: Hash of result URLs for deduplication analysis

## Database Schema

### New Columns in `search_results`

```sql
ALTER TABLE search_results 
  ADD COLUMN source TEXT,
  ADD COLUMN extraction_confidence REAL,
  ADD COLUMN extraction_warnings JSONB,
  ADD COLUMN metadata JSONB;
```

### New `viewpoints` Table

```sql
CREATE TABLE viewpoints (
  id UUID PRIMARY KEY,
  query_id UUID NOT NULL,
  crawl_run_id UUID,
  engine TEXT NOT NULL,
  num_results INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  citations_count INTEGER DEFAULT 0,
  overlap_hash TEXT,
  collected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(query_id, crawl_run_id, engine)
);
```

### New Columns in `metric_records`

```sql
ALTER TABLE metric_records 
  ADD COLUMN rate_limit_hits INTEGER DEFAULT 0,
  ADD COLUMN duration_ms INTEGER;
```

## API Endpoints

### GET /api/viewpoints

Returns viewpoint analysis for a query with per-engine blocks.

**Query Parameters:**
- `q` or `query`: Search query string
- `maxAlternatives`: Max results to return (default: 5)
- `analysis`: Include analysis reasoning (default: true)
- `format`: Response format - json or csv (default: json)

**Response Shape:**
```typescript
{
  query: string;
  diversityScore: number;
  domainDistribution: Record<string, number>;
  engines: {
    [engine: string]: {
      status: "success" | "skipped";
      reason?: string;  // If skipped
      results: Array<{
        rank: number;
        title: string;
        url: string;
        domain: string;
        domainType: string;
        source?: "api" | "html";
      }>;
      count: number;
      summary?: string;  // Perplexity only
      citationsCount?: number;  // Perplexity only
      analytics: {
        rateLimitHits: number;
        durationMs: number;
        extractionConfidence: number;
        warnings: string[];
      };
    };
  };
}
```

### GET /api/query-insight

Returns detailed insights for a specific query + run combination.

**Query Parameters:**
- `query` or `queryId`: Query identifier
- `runId`: Optional run ID (defaults to latest)

## Usage Examples

### Running Collection

```bash
# Build all packages
pnpm --filter "./**" build

# Run collector (persists to storage)
node -e "import('./apps/collector/dist/index.js').then(async m => {
  const app = await m.createCollectorApp();
  await app.run();
})"
```

### Querying Viewpoints

```bash
# Get viewpoint analysis for a query
curl "http://localhost:3000/api/viewpoints?q=climate+change"

# Get CSV export
curl "http://localhost:3000/api/viewpoints?q=climate+change&format=csv" > viewpoints.csv
```

### Database Queries

```sql
-- View all viewpoints for a query
SELECT * FROM viewpoints WHERE query_id = '...';

-- View results with source tracking
SELECT engine, source, COUNT(*) as count
FROM search_results
WHERE query_id = '...'
GROUP BY engine, source;

-- Check rate limiting stats
SELECT 
  engine,
  AVG(rate_limit_hits) as avg_hits,
  AVG(duration_ms) as avg_duration_ms
FROM metric_records
WHERE metric_type = 'collection_stats'
GROUP BY engine;
```

## Error Handling

### Missing API Keys

If an engine's API key is missing, the system:
1. Logs a warning
2. Returns an empty results array for that engine
3. Marks the engine as "skipped" in the API response
4. Provides a user-readable reason in the UI

### Rate Limiting

When rate limits are hit:
1. Request waits for next available token
2. `rateLimitHits` counter increments
3. Logged with `durationMs` metric
4. Displayed in UI with retry count

### Extraction Failures

When extraction fails or has low confidence:
1. `extraction_confidence` set to 0-1 range
2. `extraction_warnings` populated with error details
3. Logged for debugging
4. Displayed in analytics section of UI

## Monitoring

### Key Metrics

- **Cache Hit Rate**: Percentage of cached vs fresh collections
- **Rate Limit Hits**: Frequency of rate limiting per engine
- **Extraction Confidence**: Average quality score per engine
- **Results Count**: Number of results per engine per query
- **Duration**: Collection time per engine

### Logs

```bash
# View collection logs
grep "viewpoints persisted" logs/collector.log

# View rate limit hits
grep "rate limit" logs/collector.log

# View extraction warnings
grep "extraction quality" logs/collector.log
```

## Testing

### Manual Testing

```bash
# 1. Run a test collection
BRAVE_API_KEY=your_key pnpm --filter @truthlayer/collector dev

# 2. Check viewpoints were created
psql $DATABASE_URL -c "SELECT engine, num_results FROM viewpoints ORDER BY engine;"

# 3. Test API endpoint
curl "http://localhost:3000/api/viewpoints?q=test+query"
```

### Simulating Rate Limiting

```bash
# Set very low rate limit
BRAVE_RATE_LIMIT_RPS=0.1 pnpm --filter @truthlayer/collector dev

# Observe rate limiting in logs
tail -f logs/collector.log | grep "rate limit"
```

## Troubleshooting

### Issue: No viewpoints created

**Cause**: Collector not persisting to storage

**Solution**: 
- Check `STORAGE_URL` environment variable
- Verify database connection
- Check collector logs for storage errors

### Issue: Missing Perplexity summaries

**Cause**: Summary selectors may have changed

**Solution**:
- Check `apps/collector/src/targets/perplexity.ts` selectors
- Update selectors based on current Perplexity DOM structure
- Test extraction with live page

### Issue: Rate limiting not working

**Cause**: Configuration not loaded

**Solution**:
- Verify `BRAVE_RATE_LIMIT_RPS` in `.env`
- Check config loading in `apps/collector/src/lib/config.ts`
- Review rate limiter initialization in `brave.ts`

## Future Enhancements

- [ ] Multi-engine overlap analysis
- [ ] Sentiment analysis per engine
- [ ] Historical trend tracking
- [ ] Automated anomaly detection
- [ ] Real-time monitoring dashboard
- [ ] Engine bias scoring
- [ ] Export to data visualization tools

## References

- **Rate Limiting Algorithm**: [Token Bucket (Wikipedia)](https://en.wikipedia.org/wiki/Token_bucket)
- **Brave Search API**: https://brave.com/search/api/
- **DuckDuckGo API**: https://api.duckduckgo.com/
- **Perplexity AI**: https://www.perplexity.ai/

---

**Last Updated**: October 29, 2024  
**Version**: 1.0.0  
**Status**: MVP Complete

