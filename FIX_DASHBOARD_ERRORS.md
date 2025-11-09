# Fix Dashboard 404 Errors

## Issue
Browser console showing 404 errors for Next.js build files:
- main-app.js
- layout.js
- app-pages-internals.js
- page.js
- layout.css

## Root Cause
Stale or incomplete Next.js build cache after adding new components (RealtimeProvider).

## Solution Applied

### Step 1: Stop Dev Server
```bash
kill $(lsof -ti:3000)
```

### Step 2: Clean Build Cache
```bash
cd apps/dashboard
rm -rf .next
```

### Step 3: Reinstall Dependencies
```bash
cd ../..
pnpm install
```

### Step 4: Restart Dev Server
```bash
pnpm run dev:dashboard
```

## Expected Result
- No 404 errors in console
- Dashboard loads correctly
- RealtimeProvider connected

## If Issue Persists

### Check for Import Errors
```bash
# In apps/dashboard/app/layout.tsx
# Make sure RealtimeProvider import path is correct
```

**Current path should be:**
```typescript
import { RealtimeProvider } from "../components/RealtimeProvider";
```

### Verify Component Exists
```bash
ls -la apps/dashboard/components/RealtimeProvider.tsx
```

### Check Next.js Config
```bash
cat apps/dashboard/next.config.mjs
```

### Manual Full Clean
```bash
cd apps/dashboard
rm -rf .next node_modules
cd ../..
pnpm install
pnpm run dev:dashboard
```

## Prevention

When adding new files to Next.js apps:
1. Stop dev server first
2. Add new files
3. Run `pnpm install` if adding new packages
4. Restart dev server

## Common Causes

1. **Stale build cache** - Most common, fixed by `rm -rf .next`
2. **Import path issues** - Check relative paths in imports
3. **Missing dependencies** - Run `pnpm install`
4. **Port conflict** - Kill process on port 3000
5. **Symlink issues** - Rebuild with clean install

## Quick Fix Command

```bash
cd /Users/mleonard/code/TruthLayer
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
cd apps/dashboard && rm -rf .next
cd ../.. && pnpm install
pnpm run dev:dashboard
```

## Verification

1. **Open browser:** http://localhost:3000
2. **Open DevTools:** F12 or Cmd+Option+I
3. **Check Console:** Should show no 404 errors
4. **Check Network tab:** All resources should load with 200 status

## Additional Debugging

### Enable Next.js Debug Mode
```bash
DEBUG=* pnpm run dev:dashboard
```

### Check Build Output
```bash
cd apps/dashboard
pnpm run build
# Should complete without errors
```

### Verify Package Structure
```bash
ls -la apps/dashboard/components/
# Should show RealtimeProvider.tsx
```

## Status
✅ Applied fix
🔄 Ready to restart dev server

## Next Steps
Run: `pnpm run dev:dashboard`

Then check http://localhost:3000 in browser.
