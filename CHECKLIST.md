# TruthLayer Setup Checklist ✅

Use this checklist to verify your TruthLayer installation is working correctly.

## Prerequisites Check

- [ ] **Node.js v18+** installed
  ```bash
  node --version  # Should show v18.x.x or higher
  ```

- [ ] **pnpm** installed
  ```bash
  pnpm --version  # Should show 8.x.x or higher
  ```

- [ ] **PostgreSQL v14+** installed and running
  ```bash
  psql --version  # Should show 14.x or higher
  ```

- [ ] **Git** installed
  ```bash
  git --version
  ```

---

## Installation Steps

- [ ] **1. Clone repository**
  ```bash
  git clone https://github.com/cicconel11/TruthLayer.git
  cd TruthLayer
  ```

- [ ] **2. Install dependencies**
  ```bash
  pnpm install
  ```
  ✅ Should complete without errors

- [ ] **3. Set up PostgreSQL database**
  ```bash
  # Find your username
  whoami
  
  # Create database
  createdb truthlayer
  ```
  ✅ Database should be created successfully

- [ ] **4. Configure environment**
  ```bash
  cp .env.example .env
  # Edit .env and update STORAGE_URL with your username
  ```
  ✅ `.env` file should exist with your PostgreSQL username

- [ ] **5. Build packages**
  ```bash
  pnpm --filter "./**" build
  ```
  ✅ All packages should build successfully

---

## Verification Tests

### Test 1: Database Connection

- [ ] **Connect to database**
  ```bash
  psql truthlayer -c "SELECT 1;"
  ```
  ✅ Should return:
  ```
   ?column? 
  ----------
          1
  ```

### Test 2: Check Existing Data

- [ ] **View sample SERP data**
  ```bash
  cat data/serp/11111111-1111-1111-1111-111111111111-ai-20.json
  ```
  ✅ Should show JSON with search results

- [ ] **Check database tables**
  ```bash
  psql truthlayer -c "\dt"
  ```
  ✅ Should show tables: `search_results`, `annotations`, `metric_records`, etc.
  (If empty, tables will be created on first pipeline run)

### Test 3: Dashboard

- [ ] **Start dashboard**
  ```bash
  pnpm --filter @truthlayer/dashboard dev
  ```
  ✅ Should start without errors on http://localhost:3000

- [ ] **Open browser to http://localhost:3000**
  ✅ Should see:
  - Metrics cards with numbers
  - Charts displaying data
  - No console errors

### Test 4: Collector (Optional)

- [ ] **Run collector**
  ```bash
  node -e "import('./apps/collector/dist/index.js').then(async m => { 
    const app = await m.createCollectorApp(); 
    await app.run(); 
    console.log('✅ Collection completed');
  })"
  ```
  ✅ Should complete and create files in `data/serp/`
  
  **Note:** Currently only Perplexity works (Google/Bing/Brave blocked by bot detection)

### Test 5: Annotation (Optional - Requires API Key)

- [ ] **Add API key to .env**
  ```bash
  OPENAI_API_KEY=sk-your-key-here
  ```

- [ ] **Run annotation**
  ```bash
  node -e "import('./apps/annotation/dist/index.js').then(async m => { 
    const app = await m.createAnnotationApp(); 
    await app.run(); 
  })"
  ```
  ✅ Should annotate results and store in database

### Test 6: Metrics

- [ ] **Run metrics computation**
  ```bash
  node -e "import('./apps/metrics/dist/index.js').then(async m => { 
    const app = await m.createMetricsApp(); 
    await app.run(); 
  })"
  ```
  ✅ Should calculate and export metrics

---

## Common Issues & Solutions

### ❌ `FATAL: database "truthlayer" does not exist`
```bash
createdb truthlayer
```

### ❌ `FATAL: role "postgres" does not exist`
Update `STORAGE_URL` in `.env`:
```bash
STORAGE_URL=postgres://YOUR_ACTUAL_USERNAME@localhost:5432/truthlayer
```

### ❌ `pnpm: command not found`
```bash
npm install -g pnpm
```

### ❌ Port 3000 already in use
```bash
lsof -ti:3000 | xargs kill -9
```

### ❌ Build errors
```bash
rm -rf node_modules
pnpm install
pnpm --filter "./**" build
```

---

## Success Criteria ✅

Your setup is complete when:

✅ Dashboard loads at http://localhost:3000  
✅ No errors in browser console  
✅ Metrics cards show data  
✅ Charts render properly  
✅ Database connection works  
✅ All builds complete successfully  

---

## Next Steps

Once everything is working:

1. **Explore the code**
   - Review `apps/` for different services
   - Check `packages/` for shared libraries
   - Read `.cursorrules` for development conventions

2. **Try running the pipeline**
   - Collector → Annotation → Metrics → Dashboard
   - See `SETUP.md` for detailed commands

3. **Make changes**
   - Add new queries to `config/benchmark-queries.json`
   - Modify scrapers in `apps/collector/src/targets/`
   - Enhance dashboard visualizations

4. **Read documentation**
   - `docs/design.md` - Architecture overview
   - `docs/requirements.md` - System requirements
   - `docs/tasks.md` - Development roadmap

---

**Need help?** Check `SETUP.md` for detailed troubleshooting or create a GitHub issue.

**Happy coding! 🚀**

