#!/bin/bash

# Test script for GitLab CI/CD pipeline
# Run this locally to validate the pipeline setup before deploying to GitLab

set -e

echo "🧪 Testing TruthLayer GitLab CI/CD Pipeline Setup"
echo "================================================="

# Check if required tools are installed
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Please install pnpm"
    exit 1
fi

echo "✅ Prerequisites OK"

# Check Node version
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Need 20+"
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION OK"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile --loglevel warn

# Build the project
echo "🔨 Building project..."
pnpm run build

# Validate configuration
echo "⚙️  Validating configuration..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp .env.example .env 2>/dev/null || echo "# Add your environment variables here" > .env
fi

# Test scheduler import
echo "🧪 Testing scheduler import..."
timeout 10 node -e "
import('./apps/scheduler/dist/index.js').then(async (m) => {
  console.log('✅ Scheduler import successful');
  const app = await m.createSchedulerApp();
  console.log('✅ Scheduler app creation successful');
}).catch(err => {
  console.error('❌ Scheduler test failed:', err.message);
  process.exit(1);
});
" || {
    echo "❌ Scheduler test failed"
    exit 1
}

echo "✅ Scheduler test passed"

# Test database connection (if STORAGE_URL is set)
if [ -n "$STORAGE_URL" ]; then
    echo "🗄️  Testing database connection..."
    node -e "
    import('./apps/storage/dist/index.cjs').then(async (m) => {
      try {
        const storage = await m.createStorageClient();
        await storage.pool.query('SELECT 1');
        console.log('✅ Database connection successful');
        await storage.close();
      } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
      }
    }).catch(err => {
      console.error('❌ Storage client test failed:', err.message);
      process.exit(1);
    });
    " || {
        echo "❌ Database test failed"
        exit 1
    }
else
    echo "⚠️  STORAGE_URL not set, skipping database test"
fi

# Test pipeline run (dry run)
echo "🔄 Testing pipeline dry run..."
timeout 30 node -e "
import('./apps/scheduler/dist/index.js').then(async (m) => {
  console.log('🚀 Starting pipeline dry run...');
  try {
    const app = await m.createSchedulerApp();
    console.log('✅ Pipeline initialization successful');
    console.log('🛑 Dry run complete (not executing actual pipeline)');
  } catch (error) {
    console.error('❌ Pipeline dry run failed:', error.message);
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Pipeline test failed:', err.message);
  process.exit(1);
});
" || {
    echo "❌ Pipeline test failed"
    exit 1
}

echo ""
echo "🎉 GitLab CI/CD Pipeline Test Complete!"
echo "=========================================="
echo "✅ All tests passed. Your TruthLayer setup is ready for GitLab CI/CD!"
echo ""
echo "📋 Next steps:"
echo "1. Push this code to your GitLab repository"
echo "2. Set up CI/CD variables in GitLab (see GITLAB_SETUP.md)"
echo "3. Create scheduled pipelines in GitLab"
echo "4. Run a manual pipeline to test"
echo ""
echo "📚 Documentation: See GITLAB_SETUP.md for detailed instructions"
