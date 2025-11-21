# GitLab Scheduled Pipeline Setup

This guide explains how to set up scheduled pipeline runs for TruthLayer's Supabase integration.

## Overview

Scheduled runs execute the full TruthLayer pipeline (collector → annotation → metrics) and write results directly to Supabase Postgres. This enables automated bias monitoring and transparency reporting.

## Prerequisites

1. **Supabase Database**: A Supabase Postgres instance with the TruthLayer schema applied
2. **GitLab Project**: Access to the GitLab project with CI/CD enabled
3. **Environment Variables**: Required API keys and database credentials

## Step 1: Set Up CI/CD Variables

Navigate to **Settings → CI/CD → Variables** in your GitLab project.

### Required Variables

#### `DATABASE_URL` (Required)
- **Type**: Variable
- **Protected**: ✅ Yes
- **Masked**: ✅ Yes
- **Value**: Your Supabase Postgres connection string
  - Format: `postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
  - Find this in Supabase Dashboard → Settings → Database → Connection string (Pooler mode)

#### Optional: Search Engine API Keys
- `GOOGLE_API_KEY` - For Google Custom Search
- `GOOGLE_CSE_ID` - Google Custom Search Engine ID
- `BING_API_KEY` - For Bing Search API
- `BRAVE_API_KEY` - For Brave Search API
- `PERPLEXITY_API_KEY` - For Perplexity API

#### Optional: LLM API Keys (for annotations)
- `OPENAI_API_KEY` - For GPT-based annotations
- `ANTHROPIC_API_KEY` - For Claude-based annotations

## Step 2: Create Pipeline Schedule

1. Navigate to **CI/CD → Schedules** in your GitLab project
2. Click **New schedule**
3. Configure the schedule:

### Basic Configuration

- **Description**: `TruthLayer Daily Scrape`
- **Interval Pattern**: Use cron syntax (see examples below)
- **Target Branch**: `main` (or your default branch)
- **Active**: ✅ Checked

### Recommended Schedule Examples

#### Every 6 Hours
```
0 */6 * * *
```
Runs at: 00:00, 06:00, 12:00, 18:00 UTC

#### Daily at 2 AM UTC
```
0 2 * * *
```
Runs once per day at 2:00 AM UTC

#### Every 12 Hours
```
0 */12 * * *
```
Runs at: 00:00, 12:00 UTC

#### Weekly (Monday at 2 AM)
```
0 2 * * 1
```

### Advanced: Custom Variables

You can override default behavior per schedule:

- `FORCE_REFRESH=true` - Force fresh data collection (ignore cache)
- `COLLECTOR_MAX_RESULTS=10` - Limit results per query
- `ANNOTATION_PROVIDER=openai` - Choose annotation provider

## Step 3: Verify Schedule Execution

1. After creating the schedule, wait for the next scheduled time
2. Check **CI/CD → Pipelines** to see the pipeline execution
3. Look for the `truthlayer_scheduled_run` job in the `scrape` stage
4. Verify logs show:
   - Database connection successful
   - Search runs created
   - SERP results inserted
   - Pages fetched and snapshots created

## Step 4: Monitor Results

### In Supabase

Query the database to verify data:

```sql
-- Check recent search runs
SELECT id, engine, query, started_at, status
FROM search_runs
ORDER BY started_at DESC
LIMIT 10;

-- Check SERP results
SELECT COUNT(*) as total_results, engine
FROM serp_results
GROUP BY engine;

-- Check page snapshots
SELECT COUNT(*) as total_snapshots
FROM page_snapshots;
```

### In GitLab

- **CI/CD → Pipelines**: View execution history
- **CI/CD → Jobs**: Check individual job logs
- **CI/CD → Schedules**: View and edit schedules

## Troubleshooting

### Pipeline Fails with "DATABASE_URL is not set"

**Solution**: Ensure `DATABASE_URL` is set as a CI/CD variable and marked as "Protected" if your schedule targets a protected branch.

### Pipeline Times Out

**Solution**: Increase the timeout in `.gitlab-ci.yml` or reduce the number of queries/engines being processed.

### No Results in Database

**Possible causes**:
1. Collector failed silently - check collector logs
2. API keys missing or invalid - verify all required keys are set
3. Database connection issues - verify `DATABASE_URL` is correct

### Rate Limiting Errors

**Solution**: 
- Reduce `COLLECTOR_MAX_RESULTS` variable
- Increase delays between requests
- Use fewer engines per run

## Best Practices

1. **Start Small**: Begin with a single query and one engine to validate the setup
2. **Monitor Costs**: Track Supabase usage and API costs
3. **Set Alerts**: Configure GitLab notifications for failed pipelines
4. **Regular Cleanup**: Archive old data periodically to manage database size
5. **Test First**: Use manual pipeline triggers to test before enabling schedules

## Example: Complete Setup

1. **Set Variables**:
   ```
   DATABASE_URL=postgres://postgres.xxx:xxx@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   GOOGLE_API_KEY=your-key
   GOOGLE_CSE_ID=your-cse-id
   ```

2. **Create Schedule**:
   - Description: "TruthLayer 6-Hour Scrape"
   - Cron: `0 */6 * * *`
   - Branch: `main`
   - Variables: (none, use defaults)

3. **Verify**:
   - Wait for first run
   - Check pipeline logs
   - Query Supabase to confirm data

## Next Steps

- Review collected data in Supabase
- Set up dashboard queries using the SQL views
- Configure annotation pipeline if needed
- Set up monitoring and alerts

## Bias Report Pipelines

The `truthlayer_bias_report` job generates automated bias analysis reports by analyzing domain distribution variance across search engines for controversial topics.

### Enabling Bias Reports

1. **Ensure Data Collection**: The bias report job requires data from bias analysis runs. Use `tl bias:run` to collect data for topics defined in `configs/bias-topics.json`.

2. **Schedule Configuration**: The bias report job automatically runs on scheduled pipelines. To enable it:
   - Create or edit a pipeline schedule in **CI/CD → Schedules**
   - The job will run automatically when `$CI_PIPELINE_SOURCE == "schedule"`

3. **Recommended Schedule**: Run bias reports once per day, after scraper jobs have completed:
   ```
   0 3 * * *  # Daily at 3 AM UTC (1 hour after 2 AM scrape)
   ```

### Accessing Reports

1. **Pipeline Artifacts**: After a scheduled pipeline completes, navigate to:
   - **CI/CD → Pipelines** → Select the pipeline
   - **CI/CD → Jobs** → Click on `truthlayer_bias_report` job
   - Download `bias-report.json` from the job artifacts

2. **Report Format**: The report is a JSON file containing:
   - `generatedAt`: ISO timestamp of report generation
   - `topics`: Array of topic analyses with:
     - `topicId`: Topic identifier
     - `label`: Human-readable topic name
     - `numDomains`: Total number of unique domains found
     - `numHighVarianceDomains`: Domains with variance > 0.02
     - `maxVarianceDomain`: Domain with highest variance
     - `domains`: Top 10 domains with highest variance, including per-engine shares

3. **Artifact Retention**: Reports are retained for 7 days. Download important reports for long-term storage.

### Understanding Bias Metrics

- **result_share**: The proportion of results from a domain within a specific engine (0-1)
- **share_variance**: Variance of result_share across engines for the same domain
- **is_high_variance**: Boolean flag indicating variance > 0.02 threshold

High variance indicates potential bias: domains that appear disproportionately in some engines compared to others for the same topic. This suggests search engines may be prioritizing different sources, which could indicate algorithmic bias or different ranking strategies.

