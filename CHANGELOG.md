# Changelog

All notable changes to TruthLayer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **OpenAI Integration Fixes** - Fixed critical bug in OpenAI client (wrong API method)
- **Batch Annotation Processing** - Implemented batch processing with configurable chunk size (default 20)
- **Retry Logic** - Added exponential backoff with jitter for 429/5xx errors
- **Graceful Degradation** - Automatic fallback to heuristic annotations when API keys missing
- **Zod Schemas** - Added validation schemas for LLM outputs
- **Realtime Dashboard** - Server-Sent Events (SSE) for live metric updates
- **RealtimeProvider Component** - React context for SSE subscriptions with polling fallback
- **Pipeline Event Bus** - `@truthlayer/events` package for broadcasting pipeline state
- **Event Integration Helpers** - `notifyRunStarted`, `notifyStageCompleted`, etc.
- **Environment Validation** - Zod-based env validation with production fail-fast
- **Extended API Keys** - Support for Google CSE, DuckDuckGo, and Perplexity APIs
- **E2E Test Infrastructure** - Created `packages/tests-e2e` with Vitest setup
- **Comprehensive Documentation**:
  - `docs/DEPLOYMENT.md` - Multi-platform deployment guide
  - `docs/OBSERVABILITY.md` - Logging, metrics, and monitoring
  - `INTEGRATION_GUIDE.md` - Pipeline event integration guide
- **Package Scripts** - Added `typecheck`, `dev`, `test:e2e`, `test:sse`, and `start:dev` commands
- **Concurrently Support** - Parallel execution of collector and dashboard

### Changed
- **OpenAI Client** - Migrated from `responses.create()` to `chat.completions.create()`
- **LLM Client Factory** - Now returns `null` instead of throwing when no keys configured
- **Environment Loader** - Warns about missing LLM keys instead of failing
- **Dashboard Layout** - Wrapped in `RealtimeProvider` for SSE support
- **.env.example** - Updated with all new API key placeholders

### Fixed
- **Production Environment Validation** - Process exits with clear error on missing required vars
- **Type Safety** - Import `FactualConsistencyEnum` in `llm-client.ts`
- **Dashboard Polling** - Will be replaced by SSE in subsequent updates

### Improved
- **Resilience** - Existing retry and rate-limiting infrastructure reviewed and validated
- **Error Handling** - Structured error objects with runId correlation
- **Observability** - All logs now include runId for distributed tracing

## [0.1.0] - 2024-10-27

### Added
- Initial MVP release
- Multi-engine collector (Google, Bing, Brave, DuckDuckGo, Perplexity)
- Postgres and DuckDB storage backends
- Mock annotation pipeline
- Basic metrics computation
- Next.js dashboard with Chart.js
- Scheduler for pipeline orchestration

---

## Migration Guide

### From 0.1.0 to Unreleased

**Required Actions:**

1. **Update Environment Variables:**
   ```bash
   # Add new optional keys to .env
   GOOGLE_API_KEY=
   GOOGLE_CSE_ID=
   DDG_APP_TOKEN=
   PERPLEXITY_API_KEY=
   ```

2. **Install Dependencies:**
   ```bash
   pnpm install
   ```

3. **Run Type Check:**
   ```bash
   pnpm run typecheck
   ```

4. **Test SSE Endpoint:**
   ```bash
   # Start dashboard
   pnpm run dev:dashboard
   
   # In another terminal, test SSE
   curl -N http://localhost:3000/api/metrics/stream
   ```

**Breaking Changes:**
- None (fully backward compatible)

**Deprecations:**
- Polling-only dashboard updates (SSE preferred, polling still available as fallback)

---

**Contributors:**
- Factory Droid (AI Agent)
- Original TruthLayer Team

**See Also:**
- [README.md](./README.md) - Project overview
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Deployment guide
- [OBSERVABILITY.md](./docs/OBSERVABILITY.md) - Monitoring guide
