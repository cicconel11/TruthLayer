# TruthLayer – Search and AI Transparency Infrastructure

[![Status](https://img.shields.io/badge/status-MVP%20Complete-green)]()
[![Branch](https://img.shields.io/badge/branch-mattbranch-blue)](https://github.com/cicconel11/TruthLayer/tree/mattbranch)

##  Mission

TruthLayer captures and analyzes search engine and AI-generated results to expose visibility bias across platforms. This MVP demonstrates that cross-engine visibility differences are measurable, auditable, and explainable.

---

##  Table of Contents

- [What's Working](#-whats-working)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Data Flow](#-data-flow)
- [Environment Setup](#-environment-setup)
- [Running the System](#-running-the-system)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Testing](#-testing)
- [Known Issues](#-known-issues)
- [Roadmap](#-roadmap)

---

##  What's Working

### **Fully Operational**
- ✅ **Collector Service** - Multi-engine scraping (Google, Bing, Perplexity, Brave, DuckDuckGo)
- ✅ **Storage Layer** - Postgres/DuckDB support with automatic table creation
- ✅ **Annotation Pipeline** - Mock annotations working (OpenAI integration scaffolded)
- ✅ **Metrics Engine** - Computing domain diversity, engine overlap, factual alignment
- ✅ **Dashboard** - Next.js app with Chart.js visualizations
- ✅ **Scheduler** - Pipeline orchestration (collector → annotation → metrics)
- ✅ **Data Exports** - CSV/Parquet exports with versioned metadata

### **Partially Complete**
-  **OpenAI Integration** - Scaffolded but needs API key
-  **Claude Bridge** - Python integration exists but untested
-  **Manual Audit Tool** - Script exists but needs validation
-  **Monitoring Dashboard** - Page exists but needs real-time data

---

##  Quick Start

### Prerequisites
- **Node.js** v20+ 
- **pnpm** v9.12.0+
- **PostgreSQL** 16+ (or use DuckDB)
- **Git**

### 1. Clone and Install

```bash
git clone https://github.com/cicconel11/TruthLayer.git
cd TruthLayer
git checkout mattbranch
pnpm install
```

### 2. Set Up Database

**Option A: Using PostgreSQL (Recommended)**
```bash
docker run --name truthlayer-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=truthlayer \
  -p 5432:5432 -d postgres:16
```

**Option B: Using DuckDB (File-based)**
```bash
# No setup needed - DuckDB will auto-create the file
```

### 3. Configure Environment

Create a `.env` file in the project root:

```bash
# Storage (choose one)
STORAGE_URL=postgres://postgres:postgres@localhost:5432/truthlayer
# OR
# STORAGE_URL=duckdb://data/truthlayer.duckdb

# Search Engine API Keys (required for Brave and Bing, DuckDuckGo requires no key)
BRAVE_API_KEY=brv-xxxxxxxxxxxxxxxxxxxxxxxx
BING_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# LLM API Keys (optional for testing with mock data)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...

# Collector Settings
BENCHMARK_QUERY_SET_PATH=config/benchmark-queries.json
COLLECTOR_OUTPUT_DIR=data/serp
COLLECTOR_MAX_RESULTS=20
COLLECTOR_RESPECT_ROBOTS=false
FORCE_REFRESH=false

# Annotation Settings
ANNOTATION_PROVIDER=openai
ANNOTATION_MODEL=gpt-4o-mini
ANNOTATION_CACHE_DIR=data/cache/annotation

# Metrics Settings
METRICS_EXPORT_DIR=data/metrics
METRICS_WINDOW_SIZE=7

# Logging
LOG_LEVEL=info
```

#### Getting API Keys

**Brave Search API:**
1. Go to https://brave.com/search/api/
2. Click "Get started for free" and create an account
3. Navigate to API dashboard: https://api-dashboard.search.brave.com/
4. Create a new API key
5. Copy the key (starts with `brv-`)
6. Add to `.env`: `BRAVE_API_KEY=brv-...`

**Bing Web Search API v7:**
1. Log in to Azure Portal: https://portal.azure.com/
2. Create resource → Search for "Bing Search v7"
3. Create a new Bing Search v7 resource
4. Go to "Keys and Endpoint"
5. Copy Key 1 or Key 2
6. Add to `.env`: `BING_API_KEY=...`

**DuckDuckGo:**
- **No API key required** - Uses public Instant Answer API
- Provides privacy-focused, non-personalized baseline for bias analysis
- Automatically falls back to HTML scraping if API returns insufficient results
- Offers unbiased control for factual consistency comparisons

**Note:** Google and Perplexity currently use Puppeteer web scraping (no API key required).

### 4. Build All Packages

```bash
pnpm --filter "./**" build
```

### 5. Run the System

**Option A: Full Pipeline (One-Shot)**
```bash
node -e "import('./apps/scheduler/dist/index.js').then(async m => { const app = await m.createSchedulerApp(); await app.trigger(); process.exit(0); })"
```

**Option B: Individual Services**
```bash
# Terminal 1: Collector
pnpm --filter @truthlayer/collector dev

# Terminal 2: Annotation (requires data from collector)
pnpm --filter @truthlayer/annotation dev

# Terminal 3: Metrics (requires annotations)
pnpm --filter @truthlayer/metrics dev

# Terminal 4: Dashboard
pnpm --filter @truthlayer/dashboard dev
# Opens on http://localhost:3000 (or next available port)
```

---

## ️ Architecture

```
┌─────────────────┐
│  Benchmark      │
│  Queries JSON   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│   COLLECTOR     │────▶│  Raw HTML    │
│  Multi-Engine   │     │  Snapshots   │
│  Scraper        │     └──────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   STORAGE       │◀───────┐
│  Postgres/      │        │
│  DuckDB         │        │
└────────┬────────┘        │
         │                 │
         ▼                 │
┌─────────────────┐        │
│  ANNOTATION     │────────┘
│  LLM Labeling   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   METRICS       │
│  Bias Analysis  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│   DASHBOARD     │────▶│  Parquet     │
│  Visualization  │     │  Exports     │
└─────────────────┘     └──────────────┘
```

---

##  Data Flow

1. **Collection** → Scheduler triggers collector with benchmark queries
2. **Fetching** → REST APIs (Brave, Bing) and Puppeteer scraping (Google, Perplexity) fetch results
3. **Normalization** → Results normalized to common schema with URL deduplication
4. **Storage** → Search results + metadata saved to Postgres/DuckDB
5. **Annotation** → LLM classifies domain type + factual consistency
6. **Aggregation** → Metrics computed: domain diversity, engine overlap, factual alignment
7. **Visualization** → Dashboard displays trends, comparisons, and change-over-time
8. **Export** → Versioned datasets exported as CSV/Parquet

---

## ️ Environment Setup

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `STORAGE_URL` | Database connection string | `postgres://user:pass@localhost:5432/truthlayer` |
| `BRAVE_API_KEY` | Brave Search API key (starts with `brv-`) | `brv-abcdef123456...` |
| `BING_API_KEY` | Bing Web Search API v7 key | `abc123...` |
| `BENCHMARK_QUERY_SET_PATH` | Path to benchmark queries JSON | `config/benchmark-queries.json` |
| `COLLECTOR_OUTPUT_DIR` | Directory for scraper output | `data/serp` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | OpenAI API key for GPT annotations |
| `ANTHROPIC_API_KEY` | - | Anthropic API key for Claude annotations |
| `ANNOTATION_PROVIDER` | `openai` | LLM provider: `openai`, `claude`, or `auto` |
| `ANNOTATION_MODEL` | `gpt-4o-mini` | Model to use for annotations |
| `COLLECTOR_MAX_RESULTS` | `20` | Max results per query (20 for Brave, 50 for Bing) |
| `COLLECTOR_RESPECT_ROBOTS` | `false` | Honor robots.txt (applies to Puppeteer scrapers only) |
| `FORCE_REFRESH` | `false` | Bypass cache and fetch fresh results |
| `METRICS_WINDOW_SIZE` | `7` | Days for rolling window metrics |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |

---

##  Running the System

### Running the Full Pipeline

The scheduler orchestrates all stages:

```bash
cd /Users/mleonard/code/TruthLayer
node -e "import('./apps/scheduler/dist/index.js').then(async m => { 
  const app = await m.createSchedulerApp(); 
  await app.trigger(); 
  process.exit(0); 
})"
```

**Pipeline Stages:**
1.  **Collector** - Scrapes all engines for benchmark queries
2.  **Ingestion** - Validates and saves search results
3.  **Annotation** - Labels results with domain type + factual consistency
4.  **Audit Sampling** - Selects random samples for manual review
5.  **Metrics** - Computes bias metrics
6.  **Export** - Generates Parquet files and transparency reports

### Starting the Dashboard

```bash
pnpm --filter @truthlayer/dashboard dev
```

Then open: **http://localhost:3000** (or the port shown in terminal)

### Viewing Metrics

The dashboard shows:
- **Domain Diversity** - Unique sources per query
- **Engine Overlap** - Shared URLs across engines
- **Factual Alignment** - Proportion of aligned vs contradicted results

Filter by:
- Engine (Google, Bing, Perplexity, Brave, DuckDuckGo)
- Topic (from benchmark queries)
- Individual queries
- Date range

### Exporting Data

After a pipeline run, exports are saved to:
- **Metrics CSV**: `data/metrics/<run-id>-metrics.csv`
- **Metrics Parquet**: `data/metrics/<run-id>-metrics.parquet`
- **Datasets**: `data/parquet/search_results-*.parquet`
- **Reports**: `reports/search-transparency-report-*.md`

---

##  Project Structure

```
TruthLayer/
├── apps/
│   ├── collector/          # Multi-engine scraper
│   │   ├── src/
│   │   │   ├── targets/    # Engine-specific scrapers
│   │   │   │   ├── google.ts
│   │   │   │   ├── bing.ts
│   │   │   │   ├── perplexity.ts
│   │   │   │   ├── brave.ts
│   │   │   │   ├── duckduckgo.ts
│   │   │   │   └── normalize.ts
│   │   │   ├── services/
│   │   │   └── runner/
│   │   └── package.json
│   │
│   ├── annotation/         # LLM annotation service
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   ├── llm-client.ts      # OpenAI integration
│   │   │   │   ├── openai-client.ts
│   │   │   │   └── python-bridge.ts   # Claude bridge
│   │   │   └── runner/
│   │   ├── python/
│   │   │   └── claude_bridge.py
│   │   └── package.json
│   │
│   ├── metrics/            # Bias metrics computation
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── computations.ts    # Metric algorithms
│   │   │   │   └── exporter.ts        # CSV/Parquet export
│   │   │   └── runner/
│   │   └── package.json
│   │
│   ├── dashboard/          # Next.js visualization app
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── metrics/route.ts
│   │   │   │   └── monitoring/route.ts
│   │   │   ├── components/
│   │   │   │   └── dashboard-view.tsx
│   │   │   ├── page.tsx
│   │   │   └── monitoring/page.tsx
│   │   └── package.json
│   │
│   ├── scheduler/          # Pipeline orchestrator
│   │   ├── src/
│   │   │   └── runner/
│   │   │       └── pipeline-runner.ts
│   │   └── package.json
│   │
│   └── storage/            # Database abstraction layer
│       ├── src/
│       │   ├── postgres-client.ts
│       │   ├── duckdb-client.ts
│       │   └── types.ts
│       └── package.json
│
├── packages/
│   ├── schema/             # Shared TypeScript schemas
│   │   └── src/
│   │       ├── annotation.ts
│   │       ├── metrics.ts
│   │       ├── search-result.ts
│   │       └── pipeline-run.ts
│   │
│   └── config/             # Shared configuration
│       └── src/
│           └── env.ts
│
├── config/
│   └── benchmark-queries.json    # Test query definitions
│
├── data/
│   ├── serp/                     # Scraper JSON outputs
│   ├── raw_html/                 # HTML snapshots
│   ├── cache/                    # Annotation cache
│   ├── metrics/                  # Exported metrics
│   └── truthlayer.duckdb         # DuckDB database (if used)
│
├── reports/                      # Generated transparency reports
├── .env                          # Environment configuration
├── pnpm-workspace.yaml          # Monorepo configuration
└── README.md
```

---

## ️ Database Schema

### Core Tables

#### `search_results`
```sql
CREATE TABLE search_results (
  id UUID PRIMARY KEY,
  crawl_run_id UUID,
  query_id UUID NOT NULL,
  engine TEXT NOT NULL,
  rank INTEGER NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  domain TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  hash TEXT NOT NULL,
  raw_html_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `annotations`
```sql
CREATE TABLE annotations (
  id UUID PRIMARY KEY,
  search_result_id UUID NOT NULL REFERENCES search_results(id),
  query_id UUID NOT NULL,
  engine TEXT NOT NULL,
  domain_type TEXT NOT NULL,  -- 'news', 'government', 'academic', 'blog', 'other'
  factual_consistency TEXT NOT NULL,  -- 'aligned', 'contradicted', 'unclear', 'not_applicable'
  confidence DOUBLE PRECISION,
  prompt_version TEXT NOT NULL,
  model_id TEXT NOT NULL,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `metric_records`
```sql
CREATE TABLE metric_records (
  id UUID PRIMARY KEY,
  crawl_run_id UUID,
  query_id UUID NOT NULL,
  engine TEXT,
  metric_type TEXT NOT NULL,  -- 'domain_diversity', 'engine_overlap', 'factual_alignment'
  value DOUBLE PRECISION NOT NULL,
  delta DOUBLE PRECISION,
  compared_to_run_id UUID,
  collected_at TIMESTAMPTZ NOT NULL,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `pipeline_runs`
```sql
CREATE TABLE pipeline_runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,  -- 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

##  Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @truthlayer/storage test
pnpm --filter @truthlayer/metrics test
```

### Testing Individual Components

**Test Collector:**
```bash
pnpm --filter @truthlayer/collector build
node -e "import('./apps/collector/dist/index.js').then(async m => { 
  const app = await m.createCollectorApp(); 
  await app.run(); 
})"
```

**Test Metrics:**
```bash
pnpm --filter @truthlayer/metrics build
node -e "import('./apps/metrics/dist/index.js').then(async m => { 
  const app = m.createMetricsApp(); 
  await app.run(); 
})"
```

**Test Dashboard API:**
```bash
curl http://localhost:3000/api/metrics | python3 -m json.tool
```

---

##  Known Issues

### Fixed Issues
-  `workspace:*` npm compatibility → migrated to pnpm
-  Puppeteer `page.waitForTimeout` deprecated → replaced with `setTimeout`
-  Bing URL decoding garbled → fixed base64→UTF-8 conversion
-  Next.js bundling native modules → externalized duckdb/pg in webpack
-  robots.txt blocking Bing → set `COLLECTOR_RESPECT_ROBOTS=false`
-  Invalid URLs from Bing → improved URL extraction and validation

### Current Issues
- ⚠️ **OpenAI integration** needs real API key testing
- ⚠️ **Claude bridge** untested end-to-end
- ⚠️ **Change-over-time tracking** not fully implemented

### API Troubleshooting

**Brave Search API Errors:**
- **401 Unauthorized**: Invalid API key. Verify `BRAVE_API_KEY` in `.env` starts with `brv-`
- **429 Rate Limit**: Exceeded free tier quota. Check usage at https://api-dashboard.search.brave.com/
- **Empty Results**: API returned successfully but no results. Check query formatting and API response logs.

**Bing Search API Errors:**
- **401 Unauthorized**: Invalid API key. Verify `BING_API_KEY` in `.env` matches Azure portal key
- **429 Rate Limit**: Exceeded Azure quota. Check Azure portal for resource limits
- **403 Forbidden**: API endpoint region mismatch. Ensure using global endpoint: `api.bing.microsoft.com`

**General Collector Issues:**
- **Missing API Keys**: Collector will log error and return empty results for that engine
- **Network Errors**: Check firewall/proxy settings. API calls require outbound HTTPS
- **Build Errors**: Run `pnpm --filter "./**" build` to rebuild all packages

### Workarounds
- **Mock annotations**: Use SQL to insert test annotations if no API key available
- **Port conflicts**: Dashboard auto-selects next available port (3000, 3001, 3002, etc.)
- **Testing without API keys**: Google and Perplexity still work with Puppeteer scraping

---

## ️ Roadmap

### MVP Complete ✅
- [x] Multi-engine collection (Google, Bing, Perplexity, Brave, DuckDuckGo)
- [x] **REST API integration for Brave, Bing, and DuckDuckGo** (Puppeteer for Google/Perplexity)
- [x] Postgres/DuckDB storage with auto-table creation
- [x] Annotation pipeline (mock data working)
- [x] Metrics computation (domain diversity, overlap, factual alignment)
- [x] Dashboard visualization
- [x] CSV/Parquet exports
- [x] Pipeline orchestration

### Next Priorities
- [ ] Test OpenAI integration with real API key
- [ ] Validate Claude Python bridge end-to-end
- [ ] Implement change-over-time drift detection
- [ ] Build monitoring dashboard with real-time logs
- [ ] Add manual audit review interface
- [ ] Implement hash-based validation/deduplication
- [ ] Set up CRON automation for scheduled runs
- [ ] Add alerting system for pipeline failures
- [ ] Create data quality validation tests

### Future Enhancements
- [ ] Add more search engines (Yahoo, Yandex, etc.)
- [ ] Implement result clustering/similarity detection
- [ ] Add sentiment analysis
- [ ] Create public API for metrics access
- [ ] Build admin interface for query management
- [ ] Add A/B testing for prompt versions
- [ ] Implement result caching/rate limiting

---

##  Example Dashboard Output

**Metrics Computed:**
- **Domain Diversity**: 4 unique domains per query
- **Engine Overlap**: 0% (no shared URLs across engines in current test data)
- **Factual Alignment**: 100% (all results marked as "aligned")

**Current Data:**
-  4 search results from Perplexity
-  4 mock annotations (government, news sources)
-  3 computed metrics
-  8 pipeline runs logged

---

##  Contributing

This is currently a private MVP. For questions or issues, contact:
- **GitHub**: [@cicconel11](https://github.com/cicconel11)
- **Branch**: [mattbranch](https://github.com/cicconel11/TruthLayer/tree/mattbranch)

---

##  License

Proprietary - All rights reserved

---

##  Support

For setup issues or questions:
1. Check the [Known Issues](#-known-issues) section
2. Verify your `.env` configuration
3. Ensure all packages are built: `pnpm --filter "./**" build`
4. Check the terminal output for specific error messages

---

**Last Updated:** October 25, 2025  
**Version:** 0.1.0 (MVP)  
**Status:**  Core pipeline operational
