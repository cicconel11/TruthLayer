# Query Comparison Feature - Implementation Summary

## ✅ Completed Implementation

All scaffolding for the Query Comparison feature has been successfully implemented and verified to build without errors.

### Files Created

#### 1. Shared Types (`packages/schema/src/queryInsight.ts`)
- **Location**: `/packages/schema/src/queryInsight.ts`
- **Exports**:
  - `QueryInsightEngineResult` - Individual search result with annotations
  - `QueryInsightMetrics` - Aggregate and per-engine metrics
  - `QueryInsightResponse` - Complete API response contract
  - Corresponding Zod schemas for runtime validation
- **Status**: ✅ Exported from `packages/schema/src/index.ts`
- **Build**: ✅ Compiles successfully

#### 2. Helper Function (`apps/dashboard/lib/getLatestRunForQuery.ts`)
- **Location**: `/apps/dashboard/lib/getLatestRunForQuery.ts`
- **Purpose**: Resolve the latest crawl_run_id for a given query
- **Status**: ⚠️ Stub implementation with TODO comments
- **Return Type**: `LatestRunResult | null`
- **Next Steps**: Wire to actual database query (see TODO comments in file)

#### 3. API Route (`apps/dashboard/app/api/query-insight/route.ts`)
- **Location**: `/apps/dashboard/app/api/query-insight/route.ts`
- **Endpoint**: `GET /api/query-insight?queryId={id}&runId={id}`
- **Status**: ⚠️ Scaffold complete with TODO markers for DB integration
- **Features**:
  - Query parameter validation
  - Singleton DuckDB client pattern
  - Graceful handling of missing engines
  - Warning logs for missing data
  - Production hardening TODOs (rate limiting, caching, auth)
- **Build**: ✅ Compiles successfully

#### 4. Dashboard Page (`apps/dashboard/app/compare/page.tsx`)
- **Location**: `/apps/dashboard/app/compare/page.tsx`
- **Route**: `/compare`
- **Status**: ✅ Fully implemented UI
- **Features**:
  - Query selection dropdown (from benchmark-queries.json)
  - Optional run ID input
  - Responsive 4-column grid for engine outputs
  - Metrics display (overlap, diversity, alignment)
  - Per-engine metrics breakdown
  - Snapshot timestamp display
  - Error handling UI
- **Build**: ✅ Compiles successfully

## 🔧 Database Wiring TODOs

The following areas require database integration (marked with TODO comments in code):

### 1. API Route - Fetch Search Results
**File**: `apps/dashboard/app/api/query-insight/route.ts` (Line ~160)

**Required Query**:
```sql
SELECT 
  sr.engine,
  sr.rank,
  sr.title,
  sr.url,
  sr.snippet,
  sr.domain,
  sr.timestamp,
  a.domain_type,
  a.factual_consistency,
  a.confidence
FROM search_results sr
LEFT JOIN annotations a ON sr.id = a.search_result_id
WHERE sr.query_id = ? AND sr.crawl_run_id = ?
ORDER BY sr.engine, sr.rank
```

**Approach Options**:
- A) Add raw SQL query using DuckDB client
- B) Add new method to `StorageClient`: `fetchAnnotatedResultsByRun(queryId, runId)`
- C) Extend existing `fetchAnnotatedResults()` to accept runId filter

### 2. API Route - Fetch Metrics
**File**: `apps/dashboard/app/api/query-insight/route.ts` (Line ~185)

**Current**: Uses `storage.fetchRecentMetricRecords()` which isn't filtered by runId

**Needed**: Filter metrics by both `queryId` and `crawlRunId`

**Approach Options**:
- A) Add filter parameters to `fetchRecentMetricRecords()`
- B) Create new method: `fetchMetricsByRun(queryId, runId)`
- C) Use raw SQL query to get metrics for specific run

### 3. Helper Function - Latest Run Resolution
**File**: `apps/dashboard/lib/getLatestRunForQuery.ts` (Line ~76)

**Required**: Query to find the most recent crawl_run_id for a query

**SQL Examples** (see file comments):
```sql
-- Option A: Query search_results
SELECT crawl_run_id, MAX(timestamp) as timestamp
FROM search_results
WHERE query_id = ? AND crawl_run_id IS NOT NULL
GROUP BY crawl_run_id
ORDER BY timestamp DESC
LIMIT 1

-- Option B: Query metrics table
SELECT crawl_run_id, MAX(collected_at) as timestamp
FROM metrics
WHERE query_id = ? AND crawl_run_id IS NOT NULL
GROUP BY crawl_run_id
ORDER BY timestamp DESC
LIMIT 1
```

**Recommended**: Option A (search_results table is the source of truth)

### 4. Query Lookup Enhancement
**File**: `apps/dashboard/app/api/query-insight/route.ts` (Line ~84)

**Current**: Loads benchmark-queries.json from filesystem

**Consider**: 
- Caching the benchmark queries in memory
- Adding an index for faster lookup
- Supporting fuzzy query matching

## 📊 Data Flow

```
User selects query → Frontend /compare page
                         ↓
                   GET /api/query-insight?queryId=X&runId=Y
                         ↓
              ┌──────────┴──────────┐
              ↓                     ↓
      Resolve runId          Fetch Results
   (if not provided)      (search_results +
              ↓             annotations)
   getLatestRunForQuery          ↓
              ↓            Group by engine
              └──────────┬─────────┘
                         ↓
                   Fetch Metrics
              (aggregate + per-engine)
                         ↓
                  Build Response
              (QueryInsightResponse)
                         ↓
                   JSON Response
                         ↓
                  Frontend renders
              (Engine grids + metrics)
```

## 🧪 Testing Instructions

### 1. Verify Build
```bash
# Build schema package
cd packages/schema
pnpm build

# Build dashboard
cd ../../apps/dashboard
pnpm build
```
✅ **Status**: Both builds pass successfully

### 2. Start Development Server
```bash
cd apps/dashboard
pnpm dev
```

### 3. Access the Feature
- Navigate to `http://localhost:3000/compare`
- Select a query from the dropdown
- (Optional) Enter a run ID
- Click "Compare"

### 4. Expected Behavior (Current)
- ⚠️ API will return empty results (no DB wiring yet)
- ⚠️ Console will show warning: `[getLatestRunForQuery] Using stub implementation`
- ✅ UI should render without errors
- ✅ Error messages should display gracefully

### 5. After DB Wiring
- ✅ API should return actual search results
- ✅ Annotations should populate factualScore field
- ✅ Metrics should show real aggregate and per-engine data
- ✅ Missing engines should show "No data" message

## 🔐 Production Hardening Checklist

Before deploying to production, implement these TODOs (marked in API route):

- [ ] Add rate limiting (e.g., 10 requests per minute per IP)
- [ ] Add query sanitization for PII/sensitive data
- [ ] Add response caching (Redis or in-memory LRU)
- [ ] Add authentication middleware
- [ ] Add request logging for audit trail
- [ ] Add CORS configuration if needed
- [ ] Add input validation middleware
- [ ] Add response compression

## 📝 Type Safety

All components use shared types from `@truthlayer/schema`:

```typescript
import { 
  QueryInsightResponse, 
  QueryInsightEngineResult, 
  QueryInsightMetrics 
} from '@truthlayer/schema';
```

This ensures:
- Frontend and backend stay synchronized
- Compile-time type checking
- Runtime validation with Zod schemas
- Self-documenting API contract

## 🎯 Next Steps

1. **Choose DB Integration Approach**: Decide between:
   - Adding methods to `StorageClient` interface (recommended for consistency)
   - Using raw SQL queries in API route (faster to implement)

2. **Implement Search Results Query**: Join search_results with annotations

3. **Implement Metrics Query**: Filter metrics by (queryId, runId)

4. **Implement Latest Run Helper**: Query for most recent crawl_run_id

5. **Test with Real Data**: Use existing data in `data/serp/` directory

6. **Add Error Handling**: Handle edge cases (no results, missing annotations, etc.)

7. **Performance Optimization**: Add caching, indexing, query optimization

8. **Production Hardening**: Implement security and performance TODOs

## 📖 Documentation References

- **DuckDB Node.js API**: https://duckdb.org/docs/api/nodejs/overview
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **Zod Validation**: https://zod.dev/

## ✨ Feature Highlights

### User-Facing Benefits
- **Compare Engines**: Side-by-side view of how different engines answered the same query
- **Bias Metrics**: Quantitative measures of diversity, overlap, and factual alignment
- **Historical Snapshots**: View past runs to track changes over time
- **Non-Technical UX**: Clear, readable interface for journalists/investors

### Technical Benefits
- **Type-Safe**: Full TypeScript coverage from DB to UI
- **Extensible**: Easy to add new engines or metrics
- **Maintainable**: Shared types prevent drift between frontend/backend
- **Documented**: Extensive TODO comments guide future implementation

---

**Implementation Date**: October 29, 2025  
**Build Status**: ✅ All packages compile successfully  
**Ready for**: Database integration and testing

