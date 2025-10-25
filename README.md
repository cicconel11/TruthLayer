TruthLayer – Search and AI Transparency Infrastructure
=====================================================

Mission
-------
TruthLayer captures and analyzes search engine and AI-generated results to expose visibility bias across platforms. The MVP demonstrates that cross-engine visibility differences are measurable, auditable, and explainable.

Repository Layout
-----------------
- `apps/collector` – Node.js + Puppeteer scrapers and ingestion pipeline
- `apps/annotation` – TypeScript annotation services leveraging GPT-4/Claude
- `apps/dashboard` – Next.js frontend with bias metrics visualizations
- `packages/schema` – Shared TypeScript types, SQL schema definitions, and validation helpers
- `infra` – Deployment, automation, and scheduling assets
- `data` – Storage for raw HTML snapshots, Parquet exports, and sample datasets
- `scripts` – Operational utilities and maintenance commands

Data Flow
---------
1. **Collector** – `apps/collector` executes the benchmark query set against each engine, saves normalized `SearchResult` records, and snapshots raw HTML to the storage layer.
2. **Storage** – `apps/storage` provides adapters for Postgres/DuckDB, persists crawl runs, and exposes Parquet exports with versioned metadata.
3. **Annotation** – `apps/annotation` loads unlabelled results, calls GPT-4/Claude to classify domain type and factual consistency, caches responses, and records prompt/model versions.
4. **Bias Metrics** – `apps/metrics` aggregates annotated results into domain diversity, engine overlap, and factual alignment indices with rolling windows.
5. **Dashboard & Report** – `apps/dashboard` renders the bias indices and overlap visualisations, while reporting scripts assemble CSV exports and narrative findings.
6. **Scheduler** – `apps/scheduler` orchestrates recurring collection → annotation → metrics jobs and raises alerts on failures.

Environment Setup
-----------------
1. Copy `.env.example` to `.env` and populate API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`), `ANNOTATION_PROVIDER`, `STORAGE_URL`, and optional proxy settings. Update Claude bridge paths if running the Python integration.
2. Install dependencies with `pnpm install` (workspace uses pnpm 9.12.0).
3. Build shared packages before running services: `pnpm --filter @truthlayer/config build && pnpm --filter @truthlayer/schema build`.
4. Start individual services with `pnpm dev:collector`, `pnpm --filter @truthlayer/annotation dev`, etc., or wire them together via the scheduler once orchestration is implemented.
5. Generate manual audit samples after a run with `pnpm --filter @truthlayer/annotation audit -- --run <RUN_ID>` (defaults to the most recent run) to review ≥5% of annotations.
6. Launch the visibility dashboard with `pnpm --filter @truthlayer/dashboard dev` to inspect live metrics charts, filter by engine/topic/query, and export filtered snapshots as CSV.
7. Run the end-to-end scheduler with `pnpm --filter @truthlayer/scheduler dev` to kick off the collector → annotation → metrics pipeline on a cron cadence (defaults hourly). Configure cadence and retries via `SCHEDULER_*` settings in `.env`.
8. After a scheduled run completes, find versioned Parquet exports under `data/parquet/<dataset>` and the generated transparency report in `reports/search-transparency-report-*.md`.
9. Monitor pipeline health and annotation accuracy at `http://localhost:3000/monitoring` when running the dashboard app.

MVP Phases
----------
1. **Foundations** – define scope, secure access, establish repo and secrets
2. **Data Collection Layer** – scrape multi-engine results, normalize and store
3. **Annotation Pipeline** – classify domain type and factual alignment
4. **Bias Metrics Engine** – compute domain diversity, engine overlap, factual alignment
5. **Dashboard & Reporting** – present metrics, exports, and transparency report
6. **Automation & Monitoring** – scheduling, logging, alerting, integrity checks
7. **QA & Delivery** – testing, manual audits, compliance, final deliverables

Next Steps
----------
- Implement database schema definitions (`packages/schema`)
- Scaffold collector service with per-engine adapters
- Establish annotation pipeline interfaces and prompt versioning
- Build initial bias metrics utilities and dashboard API contracts
