import Link from 'next/link';

export default function ReproducibilityPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="mb-6">
        <Link href="/docs" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Documentation
        </Link>
      </nav>

      <div className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Reproducibility Guidelines
        </h1>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-green-900 mb-3">Overview</h2>
          <p className="text-green-800">
            These comprehensive guidelines ensure that TruthLayer's search engine bias analysis 
            can be independently replicated by researchers worldwide, maintaining the highest 
            standards of scientific rigor and transparency.
          </p>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">System Requirements</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Minimum Hardware</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex justify-between">
                <span>CPU:</span>
                <span className="font-mono text-sm">4 cores, 2.5GHz+</span>
              </li>
              <li className="flex justify-between">
                <span>RAM:</span>
                <span className="font-mono text-sm">16GB minimum</span>
              </li>
              <li className="flex justify-between">
                <span>Storage:</span>
                <span className="font-mono text-sm">100GB available</span>
              </li>
              <li className="flex justify-between">
                <span>Network:</span>
                <span className="font-mono text-sm">10+ Mbps stable</span>
              </li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Software Dependencies</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex justify-between">
                <span>Node.js:</span>
                <span className="font-mono text-sm">≥ 18.0.0</span>
              </li>
              <li className="flex justify-between">
                <span>PostgreSQL:</span>
                <span className="font-mono text-sm">≥ 13.0</span>
              </li>
              <li className="flex justify-between">
                <span>Chromium:</span>
                <span className="font-mono text-sm">Latest stable</span>
              </li>
              <li className="flex justify-between">
                <span>Git:</span>
                <span className="font-mono text-sm">Latest</span>
              </li>
            </ul>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Installation Process</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Repository Setup</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`# Clone the repository
git clone https://github.com/truthlayer/truthlayer-mvp.git
cd truthlayer-mvp

# Verify git commit hash for reproducibility
git log --oneline -1

# Install dependencies with exact versions
npm ci  # Uses package-lock.json for exact versions`}
              </pre>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Database Configuration</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`# Create PostgreSQL database
createdb truthlayer_reproduction

# Set database URL
export DATABASE_URL="postgresql://username:password@localhost:5432/truthlayer_reproduction"

# Run migrations
npm run db:migrate

# Verify schema
npm run db:verify-schema`}
              </pre>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Environment Configuration</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`# Copy environment template
cp .env.example .env.reproduction

# Configure required variables
cat > .env.reproduction << EOF
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/truthlayer_reproduction

# LLM APIs (required for annotation reproduction)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Reproducibility settings
RANDOM_SEED=42
DETERMINISTIC_MODE=true
LOG_LEVEL=debug
EOF`}
              </pre>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Collection Reproduction</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Deterministic Collection
          </h3>
          <p className="text-blue-800 mb-4">
            TruthLayer supports deterministic data collection for reproducible results using 
            fixed random seeds and controlled parameters.
          </p>
          
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-blue-900 font-semibold mb-2">Collection Command</div>
            <div className="font-mono text-sm text-blue-800">
              npm run collect:reproduce --queries benchmark-queries-2025.json --seed 42
            </div>
          </div>
        </div>

        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Query Set Validation</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Benchmark Queries</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• 250 total queries across 4 categories</li>
                  <li>• Health, politics, technology, science</li>
                  <li>• Validated for completeness and format</li>
                  <li>• Version-controlled with checksums</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Validation Checks</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Duplicate detection and removal</li>
                  <li>• Query length and format validation</li>
                  <li>• Category distribution verification</li>
                  <li>• Character encoding consistency</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Collection Parameters</h3>
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 mb-1">2-8s</div>
                <div className="text-sm text-gray-600">Request Delays</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 mb-1">20</div>
                <div className="text-sm text-gray-600">Results per Query</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 mb-1">42</div>
                <div className="text-sm text-gray-600">Random Seed</div>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Annotation Reproduction</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">LLM Configuration</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Primary Model</div>
                  <div className="text-gray-700">gpt-4-turbo-2024-04-09</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Temperature</div>
                  <div className="text-gray-700">0.1 (deterministic)</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Seed</div>
                  <div className="text-gray-700">42 (reproducible)</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Batch Size</div>
                  <div className="text-gray-700">10 results</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Annotation Execution</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`# Run annotation with exact configuration
npm run annotate:reproduce -- \\
  --model gpt-4-turbo-2024-04-09 \\
  --temperature 0.1 \\
  --seed 42 \\
  --batch-size 10 \\
  --start-date 2025-01-01 \\
  --end-date 2025-01-31`}
              </pre>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Validation Procedures</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reference Comparison</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Download reference dataset for validation
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Compare metrics within tolerance thresholds
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Statistical significance testing
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Discrepancy analysis and documentation
              </li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Tolerance Thresholds</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Domain Diversity:</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">±2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Engine Overlap:</span>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">±3%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Factual Alignment:</span>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">±5%</span>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quality Assurance Checklist</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Pre-Reproduction</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-blue-600" />
                <span className="text-gray-700">Environment meets minimum requirements</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-blue-600" />
                <span className="text-gray-700">All dependencies installed with correct versions</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-blue-600" />
                <span className="text-gray-700">Database schema matches reference</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-blue-600" />
                <span className="text-gray-700">API keys configured and validated</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-blue-600" />
                <span className="text-gray-700">Random seed set for deterministic execution</span>
              </label>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Post-Reproduction</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-green-600" />
                <span className="text-gray-700">All expected data collected</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-green-600" />
                <span className="text-gray-700">Metrics calculated successfully</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-green-600" />
                <span className="text-gray-700">Results compared with reference data</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-green-600" />
                <span className="text-gray-700">Metrics within tolerance thresholds</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-3 h-4 w-4 text-green-600" />
                <span className="text-gray-700">Validation report generated</span>
              </label>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Docker Setup (Alternative)</h2>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Containerized Reproduction</h3>
          <p className="text-gray-700 mb-4">
            For simplified setup, use our Docker container with all dependencies pre-configured:
          </p>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-green-400 text-sm overflow-x-auto">
{`# Build reproduction container
docker build -f Dockerfile.reproduction -t truthlayer-reproduction .

# Run with environment file
docker run --env-file .env.reproduction truthlayer-reproduction

# Interactive mode for debugging
docker run -it --env-file .env.reproduction truthlayer-reproduction bash`}
            </pre>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Troubleshooting</h2>
        
        <div className="space-y-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">Collection Failures</h4>
            <div className="text-sm text-yellow-800">
              <p className="mb-2">If data collection fails:</p>
              <ul className="space-y-1 ml-4">
                <li>• Check proxy status: <code className="bg-yellow-100 px-1 rounded">npm run proxy:test</code></li>
                <li>• Verify browser config: <code className="bg-yellow-100 px-1 rounded">npm run browser:test</code></li>
                <li>• Review logs: <code className="bg-yellow-100 px-1 rounded">tail -f logs/collection.log</code></li>
              </ul>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-900 mb-2">Metric Discrepancies</h4>
            <div className="text-sm text-red-800">
              <p className="mb-2">If calculated metrics don't match reference:</p>
              <ul className="space-y-1 ml-4">
                <li>• Recalculate with debug: <code className="bg-red-100 px-1 rounded">npm run metrics:calculate --debug</code></li>
                <li>• Compare steps: <code className="bg-red-100 px-1 rounded">npm run metrics:compare --show-steps</code></li>
                <li>• Validate functions: <code className="bg-red-100 px-1 rounded">npm run test:statistics</code></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Additional Resources
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link 
              href="/docs/methodology" 
              className="block p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <h4 className="font-semibold text-green-900 mb-1">Complete Methodology</h4>
              <p className="text-sm text-green-700">
                Understand the full scientific approach behind TruthLayer's bias measurement.
              </p>
            </Link>
            <Link 
              href="/docs/dataset-usage" 
              className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <h4 className="font-semibold text-blue-900 mb-1">Dataset Usage</h4>
              <p className="text-sm text-blue-700">
                Learn how to access and analyze TruthLayer datasets effectively.
              </p>
            </Link>
          </div>
        </div>

        <div className="mt-8 p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Reproduction Support
              </h3>
              <div className="mt-1 text-sm text-green-700">
                <p>
                  For reproduction assistance, contact{' '}
                  <a href="mailto:reproducibility@truthlayer.org" className="font-medium underline">
                    reproducibility@truthlayer.org
                  </a>{' '}
                  with your environment details and error logs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}