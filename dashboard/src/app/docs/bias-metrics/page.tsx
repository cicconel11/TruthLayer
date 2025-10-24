import Link from 'next/link';

export default function BiasMetricsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="mb-6">
        <Link href="/docs" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Documentation
        </Link>
      </nav>

      <div className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Bias Metrics Calculations
        </h1>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-purple-900 mb-3">Overview</h2>
          <p className="text-purple-800">
            TruthLayer employs three core bias metrics to quantify different aspects of search engine bias: 
            source diversity, engine independence, and factual reliability. Each metric provides unique 
            insights into how information visibility varies across platforms.
          </p>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Core Bias Metrics</h2>

        <div className="space-y-8 mb-8">
          {/* Domain Diversity Index */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7H3a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-blue-900">Domain Diversity Index (DDI)</h3>
                <p className="text-blue-700 text-sm">Measures variety of unique information sources</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Mathematical Formula</h4>
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="font-mono text-lg text-center text-blue-800">
                    DDI = unique_domains / total_results
                  </div>
                </div>
                <p className="text-sm text-blue-700 mt-2">
                  Range: 0.05 - 1.0 (for 20 results)
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Interpretation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-800">0.95 - 1.0:</span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Extremely diverse</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-800">0.80 - 0.94:</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Highly diverse</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-800">0.60 - 0.79:</span>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Moderately diverse</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-800">0.00 - 0.59:</span>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Low diversity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Engine Overlap Coefficient */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-900">Engine Overlap Coefficient (EOC)</h3>
                <p className="text-green-700 text-sm">Quantifies similarity between search engines</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-900 mb-2">Mathematical Formula</h4>
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="font-mono text-lg text-center text-green-800">
                    EOC = shared_urls / total_unique_urls
                  </div>
                </div>
                <p className="text-sm text-green-700 mt-2">
                  Range: 0.0 - 1.0
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-green-900 mb-2">Interpretation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-green-800">0.80 - 1.0:</span>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Very high overlap</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-800">0.60 - 0.79:</span>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">High overlap</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-800">0.40 - 0.59:</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">Moderate overlap</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-800">0.00 - 0.39:</span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Low overlap</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Factual Alignment Score */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-orange-900">Factual Alignment Score (FAS)</h3>
                <p className="text-orange-700 text-sm">Measures overall factual reliability of results</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-orange-900 mb-2">Mathematical Formula</h4>
                <div className="bg-white rounded-lg p-4 border border-orange-200">
                  <div className="font-mono text-sm text-center text-orange-800">
                    FAS = Σ(factual_score × confidence) / Σ(confidence)
                  </div>
                </div>
                <p className="text-sm text-orange-700 mt-2">
                  Range: 0.0 - 1.0 (weighted by annotation confidence)
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-orange-900 mb-2">Interpretation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-orange-800">0.7 - 1.0:</span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">High reliability</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-orange-800">0.4 - 0.6:</span>
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Medium reliability</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-orange-800">0.0 - 0.3:</span>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Low reliability</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Advanced Metrics</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Temporal Bias Drift</h3>
            <p className="text-gray-700 mb-3">
              Measures how bias metrics change over time to identify trends and sudden shifts.
            </p>
            <div className="bg-gray-50 rounded p-3 font-mono text-sm">
              TBD = (current - baseline) / baseline
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Tracks percentage change from historical baseline
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Cross-Engine Variance</h3>
            <p className="text-gray-700 mb-3">
              Measures consistency of bias metrics across different search engines.
            </p>
            <div className="bg-gray-50 rounded p-3 font-mono text-sm">
              CEBV = √(Σ(metric - mean)² / n)
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Standard deviation of metrics across engines
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Statistical Validation</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Rigorous Statistical Testing
          </h3>
          <p className="text-blue-800 mb-4">
            All bias measurements undergo comprehensive statistical validation to ensure reliability and significance.
          </p>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Significance Testing</h4>
              <p className="text-sm text-blue-700">
                Mann-Whitney U tests for comparing metrics between groups and time periods.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Confidence Intervals</h4>
              <p className="text-sm text-blue-700">
                Bootstrap methods for 95% confidence intervals around all metrics.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Anomaly Detection</h4>
              <p className="text-sm text-blue-700">
                Z-score analysis for identifying unusual bias patterns and outliers.
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Implementation Example</h2>
        
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="text-gray-300 text-sm mb-2">TypeScript Implementation</div>
          <pre className="text-green-400 text-sm overflow-x-auto">
{`function calculateDomainDiversity(results: SearchResult[]): number {
  const domains = new Set(
    results.map(r => extractDomain(r.url))
  );
  return domains.size / results.length;
}

function calculateEngineOverlap(
  engineResults: Map<string, SearchResult[]>
): number {
  const allUrls = new Set<string>();
  const urlCounts = new Map<string, number>();
  
  for (const [engine, results] of engineResults) {
    for (const result of results) {
      allUrls.add(result.url);
      urlCounts.set(result.url, 
        (urlCounts.get(result.url) || 0) + 1
      );
    }
  }
  
  const sharedUrls = Array.from(urlCounts.values())
    .filter(count => count > 1).length;
  
  return sharedUrls / allUrls.size;
}`}
          </pre>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Metric Validation</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Synthetic Data Testing</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Known input validation with expected outputs
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Edge case testing (all same domain, no overlap)
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Boundary condition verification
              </li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Cross-Validation</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Multiple LLM model comparison for annotations
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Human validation of sample results
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Inter-annotator agreement measurement
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Learn More
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link 
              href="/docs/methodology" 
              className="block p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <h4 className="font-semibold text-purple-900 mb-1">Complete Methodology</h4>
              <p className="text-sm text-purple-700">
                Overview of TruthLayer's comprehensive approach including these metrics.
              </p>
            </Link>
            <Link 
              href="/docs/dataset-usage" 
              className="block p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <h4 className="font-semibold text-orange-900 mb-1">Dataset Usage</h4>
              <p className="text-sm text-orange-700">
                Practical examples of calculating and analyzing these metrics.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}