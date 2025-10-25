# Quick Commit Guide

## Changes Ready to Commit

All implementation is complete. Here are the files that have been modified or created:

### New Files
- `.github/workflows/truthlayer-pipeline.yml` - GitHub Actions workflow for automated pipeline
- `IMPLEMENTATION_SUMMARY.md` - Detailed implementation documentation
- `COMMIT_GUIDE.md` - This file

### Modified Files
- `apps/collector/src/targets/bing.ts` - Fixed base64 URL decoding
- `apps/collector/src/targets/brave.ts` - Added URL validation and redirect handling
- `apps/collector/src/targets/normalize.ts` - Enhanced URL filtering
- `apps/dashboard/app/components/dashboard-view.tsx` - Fixed Chart.js TypeScript types

---

## Commit Command

```bash
git add .github/workflows/truthlayer-pipeline.yml \
        apps/collector/src/targets/bing.ts \
        apps/collector/src/targets/brave.ts \
        apps/collector/src/targets/normalize.ts \
        apps/dashboard/app/components/dashboard-view.tsx \
        IMPLEMENTATION_SUMMARY.md \
        COMMIT_GUIDE.md

git commit -m "feat: fix Bing/Brave URL decoding and add GitHub Actions automation

- Improve Bing base64 URL decoding with proper validation
- Add Brave redirect detection and URL validation  
- Enhance URL filtering in normalize.ts to prevent invalid URLs
- Fix Chart.js TypeScript compatibility in dashboard
- Add GitHub Actions workflow for daily pipeline automation

Resolves issues with Zod validation failures on malformed URLs.
Enables automated data collection and metrics computation."

git push origin mattbranch
```

---

## After Pushing

### 1. Configure GitHub Secrets
- Go to your repository on GitHub
- Navigate to **Settings → Secrets and variables → Actions**
- Click **New repository secret**
- Add:
  - **Name:** `OPENAI_API_KEY`
  - **Value:** Your OpenAI API key

### 2. Test the Workflow
- Go to **Actions** tab
- Select **TruthLayer Pipeline**
- Click **Run workflow**
- Select `mattbranch` branch
- Click the green **Run workflow** button

### 3. Monitor the Run
- Watch the workflow execute in real-time
- Check each step completes successfully
- Download the metrics artifacts when complete

---

## Local Testing (Optional but Recommended)

Before pushing, you can test locally:

```bash
# Rebuild all packages
pnpm --filter "./**" build

# Run the pipeline
node -e "import('./apps/scheduler/dist/index.js').then(async m => { 
  const app = await m.createSchedulerApp(); 
  await app.trigger(); 
})"

# Check dashboard
pnpm --filter @truthlayer/dashboard dev
# Visit http://localhost:3000
```

---

## Quick Status Check

✅ **Completed:**
- Bing URL decoding fixed
- Brave URL validation added
- URL filtering enhanced
- Dashboard TypeScript errors fixed
- GitHub Actions workflow created

⏳ **Requires User Action:**
- Push to GitHub
- Configure `OPENAI_API_KEY` secret
- Test manual workflow trigger
- Monitor automated runs

---

## Questions?

See `IMPLEMENTATION_SUMMARY.md` for detailed documentation, debugging tips, and next steps.

