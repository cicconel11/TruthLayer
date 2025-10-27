# TruthLayer Setup Guide

This guide will help you get TruthLayer running on your local machine.

## Prerequisites

Before starting, ensure you have:

- **Node.js** v18+ and **pnpm** installed
- **PostgreSQL** v14+ installed and running
- **Git** installed
- A terminal/command line

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/cicconel11/TruthLayer.git
cd TruthLayer
```

---

## Step 2: Install Dependencies

```bash
pnpm install
```

This will install all dependencies for the monorepo (all apps and packages).

---

## Step 3: Set Up PostgreSQL Database

### Start PostgreSQL

**macOS (Homebrew):**
```bash
brew services start postgresql@14
```

**Linux:**
```bash
sudo systemctl start postgresql
```

**Windows:**
Start PostgreSQL service from Services app or:
```bash
pg_ctl start
```

### Create Database

Find your PostgreSQL username:
```bash
whoami  # This is usually your PostgreSQL username
```

Create the `truthlayer` database:
```bash
createdb truthlayer
```

Or using `psql`:
```bash
psql postgres
CREATE DATABASE truthlayer;
\q
```

---

## Step 4: Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and update the following values:

```bash
# Database connection (update with your PostgreSQL username)
STORAGE_URL=postgres://YOUR_USERNAME@localhost:5432/truthlayer

# API Keys (optional for basic testing, required for full functionality)
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-your-key-here

# Cache settings
COLLECTOR_CACHE_TTL_DAYS=7
FORCE_REFRESH=false

# Storage settings
COLLECTOR_OUTPUT_DIR=./data/serp
COLLECTOR_RAW_HTML_DIR=./data/raw_html
```

**Important:** Replace `YOUR_USERNAME` with your actual PostgreSQL username (usually your system username).

---

## Step 5: Build All Packages

Build the monorepo packages:
```bash
pnpm --filter "./**" build
```

This compiles TypeScript code for all apps and packages.

---

## Step 6: Initialize the Database

The database tables will be created automatically on first run. You can verify the database is ready:

```bash
psql truthlayer -c "\dt"
```

You should see tables like `search_results`, `annotations`, `metric_records`, etc. (they'll be created when you first run the pipeline).

---

## Step 7: Run the Pipeline (Optional - Test Collection)

### Collect Search Results

Run the collector to scrape search engines:
```bash
node -e "import('./apps/collector/dist/index.js').then(async m => { 
  const app = await m.createCollectorApp(); 
  await app.run(); 
  console.log(' Collection completed');
})"
```

**Note:** Currently, only Perplexity works reliably. Google, Bing, and Brave are blocked by bot detection.

### Run Annotation Pipeline

Annotate collected results using LLMs:
```bash
node -e "import('./apps/annotation/dist/index.js').then(async m => { 
  const app = await m.createAnnotationApp(); 
  await app.run(); 
})"
```

**Note:** Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`.

### Compute Metrics

Calculate bias metrics from annotated data:
```bash
node -e "import('./apps/metrics/dist/index.js').then(async m => { 
  const app = await m.createMetricsApp(); 
  await app.run(); 
})"
```

---

## Step 8: Run the Dashboard

Start the Next.js dashboard to visualize metrics:

```bash
pnpm --filter @truthlayer/dashboard dev
```

Open your browser to:
**http://localhost:3000**

You should see:
- Metrics cards (Domain Diversity, Engine Overlap, Factual Alignment)
- Trend indicators showing change over time
- Charts visualizing bias metrics

---

## Troubleshooting

### Issue: `FATAL: database "truthlayer" does not exist`
**Solution:**
```bash
createdb truthlayer
```

### Issue: `FATAL: role "postgres" does not exist`
**Solution:** Update `STORAGE_URL` in `.env` with your actual PostgreSQL username:
```bash
STORAGE_URL=postgres://YOUR_USERNAME@localhost:5432/truthlayer
```

### Issue: `Error: relation "metric_records" does not exist`
**Solution:** Tables are auto-created when you run the pipeline. Run the collector first:
```bash
node -e "import('./apps/collector/dist/index.js').then(async m => { 
  const app = await m.createCollectorApp(); 
  await app.run(); 
})"
```

### Issue: Dashboard shows "No data available"
**Solution:** Run the full pipeline (collector → annotation → metrics) to populate data.

### Issue: `pnpm: command not found`
**Solution:** Install pnpm:
```bash
npm install -g pnpm
```

### Issue: Port 3000 already in use
**Solution:** Kill the process using port 3000:
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: Build errors after pulling latest code
**Solution:** Clean and rebuild:
```bash
pnpm clean
rm -rf node_modules
pnpm install
pnpm --filter "./**" build
```

---

## Project Structure

```
TruthLayer/
├── apps/
│   ├── collector/      # Search engine scrapers
│   ├── annotation/     # LLM annotation pipeline
│   ├── metrics/        # Bias metrics computation
│   ├── dashboard/      # Next.js visualization
│   ├── scheduler/      # Pipeline orchestrator
│   └── storage/        # Database abstraction
├── packages/
│   ├── schema/         # Zod schemas & types
│   └── config/         # Environment loading
├── data/               # Local data storage
│   ├── serp/          # Collected search results
│   ├── raw_html/      # HTML snapshots
│   ├── cache/         # Cache directory
│   └── debug/         # Debug snapshots
└── config/            # Configuration files
    └── benchmark-queries.json
```

---

## Quick Test (Without API Keys)

If you don't have API keys yet, you can still test the system:

1. **View existing data:**
   ```bash
   pnpm --filter @truthlayer/dashboard dev
   ```
   Open http://localhost:3000

2. **Examine sample data:**
   ```bash
   cat data/serp/11111111-1111-1111-1111-111111111111-ai-20.json
   ```

3. **Check database:**
   ```bash
   psql truthlayer -c "SELECT COUNT(*) FROM search_results;"
   ```

---

## Running the Full Pipeline

For a complete end-to-end run:

```bash
# 1. Build everything
pnpm --filter "./**" build

# 2. Collect search results
node -e "import('./apps/collector/dist/index.js').then(async m => { 
  const app = await m.createCollectorApp(); 
  await app.run(); 
})"

# 3. Annotate results (requires API key)
node -e "import('./apps/annotation/dist/index.js').then(async m => { 
  const app = await m.createAnnotationApp(); 
  await app.run(); 
})"

# 4. Compute metrics
node -e "import('./apps/metrics/dist/index.js').then(async m => { 
  const app = await m.createMetricsApp(); 
  await app.run(); 
})"

# 5. View dashboard
pnpm --filter @truthlayer/dashboard dev
```

---

## Getting API Keys (Optional)

For full functionality, you'll need:

### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Create a new API key
4. Add to `.env`: `OPENAI_API_KEY=sk-...`

### Anthropic API Key (Alternative)
1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Create a new API key
4. Add to `.env`: `ANTHROPIC_API_KEY=sk-ant-...`

---

## Known Limitations

- **Google, Bing, Brave:** Currently blocked by bot detection/CAPTCHAs
- **Perplexity:** Works reliably 
- **API Costs:** Annotation pipeline requires OpenAI/Anthropic credits (~$0.01-0.10 per run)
- **Collection Time:** Initial collection takes 10-60 seconds per query (cached runs are instant)

---

## Next Steps

After setup:
1. Explore the dashboard at http://localhost:3000
2. Review the code in `apps/` and `packages/`
3. Check out the documentation in `docs/`
4. Try modifying `config/benchmark-queries.json` to add your own queries

---

## Getting Help

- **Documentation:** See `docs/` directory
- **Issues:** Check existing GitHub issues or create a new one
- **Code:** Review `.cursorrules` for development conventions

---

**Ready to explore search and AI transparency! **

