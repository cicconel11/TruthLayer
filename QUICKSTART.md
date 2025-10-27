# 🚀 TruthLayer Quick Start

**Get TruthLayer running in 5 minutes!**

---

## 1. Prerequisites

Make sure you have:
- Node.js v18+
- pnpm
- PostgreSQL v14+

---

## 2. Clone & Install

```bash
git clone https://github.com/cicconel11/TruthLayer.git
cd TruthLayer
pnpm install
```

---

## 3. Setup Database

```bash
# Find your PostgreSQL username
whoami

# Create database
createdb truthlayer
```

---

## 4. Configure Environment

```bash
# Copy example config
cp .env.example .env

# Edit .env and update this line:
# STORAGE_URL=postgres://YOUR_USERNAME@localhost:5432/truthlayer
```

**Replace `YOUR_USERNAME` with the output from `whoami`**

---

## 5. Build & Run

```bash
# Build all packages
pnpm --filter "./**" build

# Start dashboard
pnpm --filter @truthlayer/dashboard dev
```

**Open:** http://localhost:3000 🎉

---

## 6. Verify It Works

You should see:
- ✅ Dashboard loads without errors
- ✅ Metrics cards show data
- ✅ Charts render properly

---

## Need Help?

- **Detailed Setup:** See `SETUP.md`
- **Verification:** Use `CHECKLIST.md`
- **Troubleshooting:** Check the troubleshooting section in `SETUP.md`

---

## What's Next?

### Run the Full Pipeline

```bash
# 1. Collect search results (only Perplexity works currently)
node -e "import('./apps/collector/dist/index.js').then(async m => { 
  const app = await m.createCollectorApp(); 
  await app.run(); 
})"

# 2. Annotate results (requires OPENAI_API_KEY in .env)
node -e "import('./apps/annotation/dist/index.js').then(async m => { 
  const app = await m.createAnnotationApp(); 
  await app.run(); 
})"

# 3. Compute metrics
node -e "import('./apps/metrics/dist/index.js').then(async m => { 
  const app = await m.createMetricsApp(); 
  await app.run(); 
})"

# 4. View updated dashboard
# Already running at http://localhost:3000
```

---

## Current Status

### ✅ Working:
- **Perplexity** scraper (8 results per query)
- Cache layer (7-day TTL)
- Parallel engine execution
- Full annotation pipeline
- Metrics computation
- Interactive dashboard

### ⚠️ Known Issues:
- **Google, Bing, Brave:** Blocked by bot detection/CAPTCHAs
  - Working on API integration alternatives

---

## Common Issues

### Database connection fails
```bash
# Check PostgreSQL is running
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Start if needed
brew services start postgresql@14  # macOS
sudo systemctl start postgresql  # Linux
```

### Port 3000 in use
```bash
lsof -ti:3000 | xargs kill -9
```

### Build errors
```bash
rm -rf node_modules
pnpm install
pnpm --filter "./**" build
```

---

**That's it! You're ready to explore search transparency! 🔍✨**

For detailed documentation, see:
- `SETUP.md` - Complete installation guide
- `CHECKLIST.md` - Verification checklist
- `docs/` - Architecture and requirements
- `.cursorrules` - Development conventions

