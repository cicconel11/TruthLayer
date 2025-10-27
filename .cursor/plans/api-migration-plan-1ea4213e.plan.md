<!-- 1ea4213e-ac50-4fe5-88a1-5b011ed34a5b 7839612a-1c20-4dc1-8557-aee0c6f4379d -->
# Brave & Bing API Integration Plan

## Goal

Replace Puppeteer web scraping with REST API calls for Brave Search API and Bing Web Search API v7, ensuring fresh data with `FORCE_REFRESH=true`.

## Implementation Steps

### 1. Environment Configuration

**Add API keys to env schema** (`packages/config/src/env.ts`)

- Add `BRAVE_API_KEY: z.string().min(1).optional()` to EnvSchema (line 16-17)
- Add `BING_API_KEY: z.string().min(1).optional()` to EnvSchema (line 16-17)

**Create .env.example file** (root directory)

```bash
# Storage
STORAGE_URL=postgres://postgres:postgres@localhost:5432/truthlayer

# Search Engine API Keys
BRAVE_API_KEY=brv-xxxxxxxxxxxxxxxxxxxxxxxx
BING_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Collector Settings
FORCE_REFRESH=false
COLLECTOR_MAX_RESULTS=20
COLLECTOR_RESPECT_ROBOTS=false
```

### 2. Rewrite Brave Client (`apps/collector/src/targets/brave.ts`)

**Replace Puppeteer scraping with API calls:**

- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Authentication: `X-Subscription-Token` header
- Query parameter: `q`
- Count parameter: `count` (max results)
- Response format: JSON with `web.results[]` array containing `title`, `description`, `url`

**Key changes:**

- Remove Puppeteer imports and browser logic
- Use native `fetch()` for HTTP requests
- Read `BRAVE_API_KEY` from env via `loadEnv()`
- Map API response fields to `RawSerpItem` format
- Keep HTML snapshot logic (save API response as JSON instead)
- Maintain error handling and logging patterns

### 3. Rewrite Bing Client (`apps/collector/src/targets/bing.ts`)

**Replace Puppeteer scraping with API calls:**

- Endpoint: `https://api.bing.microsoft.com/v7.0/search`
- Authentication: `Ocp-Apim-Subscription-Key` header
- Query parameter: `q`
- Count parameter: `count` (max results)
- Response format: JSON with `webPages.value[]` array containing `name`, `snippet`, `url`

**Key changes:**

- Remove Puppeteer imports and browser logic
- Use native `fetch()` for HTTP requests  
- Read `BING_API_KEY` from env via `loadEnv()`
- Map API response fields to `RawSerpItem` format
- Remove base64 URL decoding logic (not needed for API)
- Keep HTML snapshot logic (save API response as JSON instead)
- Maintain error handling and logging patterns

### 4. Update Collector Configuration

**Modify `apps/collector/src/lib/config.ts`:**

- Add `braveApiKey` and `bingApiKey` to CollectorConfig schema
- Pass API keys from env to config object

### 5. Documentation Updates

**Update README.md:**

- Add Brave Search API setup instructions with link to https://brave.com/search/api/
- Add Bing Search v7 API setup instructions with Azure Portal steps
- Document the API key format (brv-xxx for Brave, 32-char hex for Bing)
- Add troubleshooting section for API errors (401 Unauthorized, rate limits)

**Create SETUP.md section** (or update existing):

```markdown
## API Key Setup

### Brave Search API
1. Go to https://brave.com/search/api/
2. Click "Get started for free" and create account
3. Navigate to API dashboard: https://api-dashboard.search.brave.com/
4. Create new API key
5. Copy key (starts with `brv-`)
6. Add to `.env`: BRAVE_API_KEY=brv-...

### Bing Search API v7
1. Log in to Azure Portal: https://portal.azure.com/
2. Create resource → Search for "Bing Search v7"
3. Create new Bing Search v7 resource
4. Go to "Keys and Endpoint"
5. Copy Key 1 or Key 2
6. Add to `.env`: BING_API_KEY=...
```

### 6. Testing & Validation

**Build and run:**

```bash
pnpm --filter @truthlayer/collector build
FORCE_REFRESH=true node -e "import('./apps/collector/dist/index.js').then(async m => {
  const app = await m.createCollectorApp();
  await app.run();
})"
```

**Verify logs show:**

- `"collecting","engine":"brave"` with API response
- `"collecting","engine":"bing"` with API response
- No Puppeteer browser launch messages
- Successful result extraction from JSON responses

## Technical Notes

### API Response Mapping

**Brave API → RawSerpItem:**

- `web.results[].title` → `title`
- `web.results[].description` → `snippet`
- `web.results[].url` → `url`
- Array index → `rank`

**Bing API → RawSerpItem:**

- `webPages.value[].name` → `title`
- `webPages.value[].snippet` → `snippet`
- `webPages.value[].url` → `url`
- Array index → `rank`

### Error Handling

- Check for API key presence before making requests
- Handle HTTP 401 (invalid key), 429 (rate limit), 500 (server error)
- Log API errors with response body for debugging
- Fallback to empty results array on failure (same as Puppeteer version)

### Performance Benefits

- Faster response times (no browser overhead)
- No bot detection issues
- Reduced memory usage
- More reliable rate limiting

### Cache Bypass

- `FORCE_REFRESH=true` already implemented in collector config (line 49)
- Setting it will bypass the 7-day cache TTL
- Both API calls and cache logic respect this flag

### To-dos

- [ ] Add BRAVE_API_KEY and BING_API_KEY to EnvSchema in packages/config/src/env.ts
- [ ] Create .env.example file with all required environment variables including API keys
- [ ] Rewrite apps/collector/src/targets/brave.ts to use Brave Search API instead of Puppeteer
- [ ] Rewrite apps/collector/src/targets/bing.ts to use Bing Search v7 API instead of Puppeteer
- [ ] Update apps/collector/src/lib/config.ts to pass API keys from env to config object
- [ ] Update README.md with API setup instructions and links to API dashboards
- [ ] Build collector and run with FORCE_REFRESH=true to validate API integration