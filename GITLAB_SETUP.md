# TruthLayer GitLab CI/CD Setup

This guide explains how to set up TruthLayer to run continuously using GitLab CI/CD instead of requiring your local machine to be running.

## 🚀 Overview

The GitLab CI/CD setup allows TruthLayer to run as scheduled pipeline jobs on GitLab's infrastructure, collecting search results and generating metrics automatically.

## 📋 Prerequisites

- GitLab repository with TruthLayer code
- Supabase database (for data storage)
- API keys for search engines and OpenAI

## ⚙️ Setup Steps

### 1. Configure CI/CD Variables

Go to your GitLab project → **Settings** → **CI/CD** → **Variables**

Add the following variables (use the values from your `.env` file):

#### Required Variables:
```
OPENAI_API_KEY          # Your OpenAI API key
BRAVE_API_KEY          # Brave Search API key
STORAGE_URL            # Supabase connection string
```

#### Optional Variables:
```
BING_API_KEY           # Bing Search API key (optional)
SCHEDULER_FREQUENCY    # "hourly" or "daily" for scheduled runs
```

Copy all variables from `.gitlab-ci.env.example` and set their values.

### 2. Set Up Scheduled Pipelines

Go to your GitLab project → **CI/CD** → **Schedules**

Create a new schedule:
- **Description**: "TruthLayer Hourly Pipeline"
- **Interval Pattern**: `0 * * * *` (every hour)
- **Cron Timezone**: UTC
- **Target Branch**: `main`
- **Variables**:
  - `SCHEDULER_FREQUENCY`: `hourly`

### 3. Environment Setup

The GitLab CI pipeline automatically:
- ✅ Installs Node.js 20 and pnpm
- ✅ Sets up Chrome for Puppeteer scraping
- ✅ Installs all dependencies
- ✅ Builds the project
- ✅ Runs the TruthLayer pipeline
- ✅ Stores artifacts (data exports, reports)

## 🏃 Running the Pipeline

### Manual Runs
- Go to **CI/CD** → **Pipelines**
- Click **Run Pipeline**
- The pipeline will run once and collect fresh data

### Scheduled Runs
- Pipelines run automatically based on your schedule
- Check **CI/CD** → **Pipelines** to see run history
- View logs and artifacts from each run

## 📊 Monitoring Pipeline Runs

### Pipeline Stages:
1. **build_truthlayer** - Installs dependencies and builds code
2. **run_truthlayer_pipeline** - Executes the full TruthLayer pipeline

### Checking Results:
- **Artifacts**: Download data exports and reports from pipeline runs
- **Logs**: View detailed execution logs for debugging
- **Dashboard**: Access your TruthLayer dashboard to see collected data

## 🔧 Configuration Options

### Schedule Frequency
```yaml
# In .gitlab-ci.yml, modify the cron expressions:
run_hourly_pipeline:
  variables:
    SCHEDULER_CRON_EXPRESSION: "0 * * * *"  # Every hour

run_daily_pipeline:
  variables:
    SCHEDULER_CRON_EXPRESSION: "0 2 * * *"  # Daily at 2 AM
```

### Pipeline Timeout
```yaml
# Current timeout is 30 minutes (1800 seconds)
# Adjust in .gitlab-ci.yml if needed:
timeout 1800 node -e "..."
```

## 🐛 Troubleshooting

### Common Issues:

**Pipeline fails with "Connection timeout"**
- Check your Supabase connection string
- Ensure Supabase allows connections from GitLab CI IPs

**"Command failed: google-chrome"**
- Chrome installation may have failed
- Check the pipeline logs for installation errors

**"API key missing"**
- Ensure all required CI/CD variables are set
- Check variable names match exactly

### Debugging:
1. Run a manual pipeline with `FORCE_REFRESH=true`
2. Check the full pipeline logs
3. Download artifacts to inspect output data

## 📈 Benefits of GitLab CI/CD

- ✅ **24/7 operation** - Runs even when your computer is off
- ✅ **Scalable infrastructure** - Uses GitLab's runners
- ✅ **Cost effective** - No dedicated server needed
- ✅ **Version controlled** - Pipeline config in git
- ✅ **Monitoring** - Built-in pipeline history and logs

## 🔄 Migration from Local Setup

If you're currently running TruthLayer locally:

1. **Backup your data** from `data/` directory
2. **Set up GitLab CI/CD** following the steps above
3. **Test with manual pipeline** first
4. **Enable scheduled runs** once tested
5. **Monitor** the automated runs

The GitLab CI/CD setup provides the same functionality as local runs but with continuous operation!
