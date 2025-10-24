import Link from 'next/link';

export default function DatasetUsagePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="mb-6">
        <Link href="/docs" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Documentation
        </Link>
      </nav>

      <div className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Dataset Usage Instructions
        </h1>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-orange-900 mb-3">Overview</h2>
          <p className="text-orange-800">
            TruthLayer datasets provide comprehensive search engine bias data for research, analysis, 
            and transparency initiatives. This guide covers accessing, understanding, and using our 
            datasets responsibly and effectively.
          </p>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Available Datasets</h2>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Search Results</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Raw search results from 4 engines</li>
              <li>• 250+ benchmark queries</li>
              <li>• Monthly releases (~50GB)</li>
              <li>• Parquet, CSV, JSON formats</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Bias Metrics</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Computed bias metrics</li>
              <li>• Daily updates, monthly aggregations</li>
              <li>• Trend analysis data (~1GB)</li>
              <li>• Parquet, CSV formats</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Annotations</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• LLM domain classifications</li>
              <li>• Factual reliability scores</li>
              <li>• Monthly releases (~10GB)</li>
              <li>• Parquet, JSON formats</li>
            </ul>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Access Methods</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Direct Download</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`# Download latest complete dataset
curl -O https://data.truthlayer.org/latest/truthlayer-complete-latest.parquet

# Download specific version
curl -O https://data.truthlayer.org/v2025.01/truthlayer-dataset-v2025.01.parquet

# Verify integrity
curl -O https://data.truthlayer.org/v2025.01/checksums.sha256
sha256sum -c checksums.sha256`}
              </pre>
            </div>
            <p className="text-sm text-gray-600">
              Direct HTTP downloads with integrity verification using SHA-256 checksums.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Python SDK</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`import truthlayer

# Initialize client
client = truthlayer.Client()

# Download latest dataset
dataset = client.download_dataset(version='latest', format='parquet')

# Load specific date range
results = client.load_search_results(
    start_date='2025-01-01',
    end_date='2025-01-31',
    engines=['google', 'bing'],
    categories=['health', 'politics']
)`}
              </pre>
            </div>
            <p className="text-sm text-gray-600">
              Programmatic access with filtering and analysis capabilities.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">REST API</h3>
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`# Get dataset metadata
curl "https://api.truthlayer.org/v1/datasets/2025.01/metadata"

# Download filtered data
curl "https://api.truthlayer.org/v1/datasets/2025.01/search-results?engine=google&category=health" \\
  -H "Accept: application/json" \\
  -o health-google-results.json`}
              </pre>
            </div>
            <p className="text-sm text-gray-600">
              RESTful API for custom integrations and real-time access.
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Schema</h2>
        
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Search Results Schema</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Field</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Type</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-900">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3 font-mono">result_id</td>
                  <td className="py-2 px-3">UUID</td>
                  <td className="py-2 px-3">Unique identifier for each result</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3 font-mono">query_text</td>
                  <td className="py-2 px-3">String</td>
                  <td className="py-2 px-3">Original search query</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3 font-mono">engine</td>
                  <td className="py-2 px-3">String</td>
                  <td className="py-2 px-3">Search engine (google|bing|perplexity|brave)</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3 font-mono">rank</td>
                  <td className="py-2 px-3">Integer</td>
                  <td className="py-2 px-3">Position in results (1-20)</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3 font-mono">title</td>
                  <td className="py-2 px-3">String</td>
                  <td className="py-2 px-3">Result title</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-3 font-mono">url</td>
                  <td className="py-2 px-3">String</td>
                  <td className="py-2 px-3">Full URL</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono">collected_at</td>
                  <td className="py-2 px-3">Timestamp</td>
                  <td className="py-2 px-3">When result was scraped</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Usage Examples</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Python Analysis</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`import pandas as pd
from urllib.parse import urlparse

# Load dataset
df = pd.read_parquet('truthlayer-dataset-v2025.01.parquet')

# Calculate domain diversity by engine
def extract_domain(url):
    return urlparse(url).netloc.replace('www.', '')

diversity_by_engine = df.groupby(['query_id', 'engine']).apply(
    lambda x: len(x['url'].apply(extract_domain).unique()) / len(x)
).groupby('engine').mean()

print(diversity_by_engine)`}
              </pre>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">R Analysis</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-green-400 text-sm overflow-x-auto">
{`library(dplyr)
library(arrow)

# Load dataset
df <- read_parquet("truthlayer-dataset-v2025.01.parquet")

# Engine comparison analysis
engine_comparison <- df %>%
  group_by(engine, query_category) %>%
  summarise(
    result_count = n(),
    unique_queries = n_distinct(query_id),
    avg_rank = mean(rank)
  )

print(engine_comparison)`}
              </pre>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Citation and Attribution</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Required Attribution</h3>
          <p className="text-blue-800 mb-4">
            When using TruthLayer datasets, you must provide proper attribution:
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">APA Format</h4>
              <div className="bg-white rounded p-3 text-sm font-mono text-blue-800">
                TruthLayer Team. (2025). TruthLayer Search Transparency Dataset (Version 2025.01) [Data set]. 
                Retrieved from https://data.truthlayer.org/v2025.01/
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">BibTeX Format</h4>
              <div className="bg-white rounded p-3 text-sm font-mono text-blue-800">
{`@dataset{truthlayer2025,
  title={TruthLayer Search Transparency Dataset},
  author={{TruthLayer Team}},
  year={2025},
  version={2025.01},
  url={https://data.truthlayer.org/v2025.01/}
}`}
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ethical Guidelines</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">Responsible Use</h3>
            <ul className="space-y-2 text-green-800">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Provide transparent methodology documentation
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Acknowledge dataset limitations in analysis
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Share analysis code for reproducibility
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Consider societal impact of research
              </li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 mb-3">Prohibited Uses</h3>
            <ul className="space-y-2 text-red-800">
              <li className="flex items-start">
                <span className="text-red-600 mr-2">✗</span>
                Altering data to support predetermined conclusions
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-2">✗</span>
                Misrepresenting methodology or findings
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-2">✗</span>
                Commercial use without proper attribution
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-2">✗</span>
                Using data to harm individuals or organizations
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Additional Resources
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link 
              href="/datasets" 
              className="block p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <h4 className="font-semibold text-orange-900 mb-1">Dataset Downloads</h4>
              <p className="text-sm text-orange-700">
                Direct access to all TruthLayer datasets with integrity verification.
              </p>
            </Link>
            <Link 
              href="/docs/reproducibility" 
              className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <h4 className="font-semibold text-blue-900 mb-1">Reproducibility Guidelines</h4>
              <p className="text-sm text-blue-700">
                Complete instructions for reproducing TruthLayer analysis.
              </p>
            </Link>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Need Support?
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                <p>
                  Contact{' '}
                  <a href="mailto:datasets@truthlayer.org" className="font-medium underline">
                    datasets@truthlayer.org
                  </a>{' '}
                  for dataset questions or technical support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}