import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="mb-6">
        <Link href="/docs" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Documentation
        </Link>
      </nav>

      <div className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          TruthLayer Methodology
        </h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 mb-3">Overview</h2>
          <p className="text-blue-800">
            TruthLayer employs a comprehensive methodology for measuring search engine bias through 
            systematic data collection, LLM-powered annotation, and quantitative bias metrics. 
            This approach ensures transparency, reproducibility, and scientific rigor in analyzing 
            information visibility across search platforms.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Core Components</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                Multi-engine data collection (Google, Bing, Perplexity, Brave)
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                LLM-powered content annotation and classification
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                Quantitative bias metrics calculation
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                Statistical analysis and trend detection
              </li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Principles</h3>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Transparency in all processes and calculations
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Reproducibility through detailed documentation
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Scientific rigor with statistical validation
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2">✓</span>
                Ethical data collection and usage practices
              </li>
            </ul>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Bias Metrics Framework</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">
              Domain Diversity Index (DDI)
            </h3>
            <p className="text-purple-800 mb-3">
              Measures the variety of unique information sources returned for a query.
            </p>
            <div className="bg-white rounded p-3 font-mono text-sm">
              DDI = unique_domains / total_results
            </div>
            <p className="text-sm text-purple-700 mt-2">
              Range: 0.0-1.0 (higher = more diverse sources)
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Engine Overlap Coefficient (EOC)
            </h3>
            <p className="text-blue-800 mb-3">
              Quantifies how much different search engines return the same URLs for identical queries.
            </p>
            <div className="bg-white rounded p-3 font-mono text-sm">
              EOC = shared_urls / total_unique_urls
            </div>
            <p className="text-sm text-blue-700 mt-2">
              Range: 0.0-1.0 (higher = more overlap between engines)
            </p>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Factual Alignment Score (FAS)
            </h3>
            <p className="text-green-800 mb-3">
              Measures overall factual reliability based on LLM annotations, weighted by confidence.
            </p>
            <div className="bg-white rounded p-3 font-mono text-sm">
              FAS = Σ(factual_score × confidence) / Σ(confidence)
            </div>
            <p className="text-sm text-green-700 mt-2">
              Range: 0.0-1.0 (higher = more factually reliable results)
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Collection Process</h2>
        
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="grid md:grid-cols-4 gap-4 text-center">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600 mb-2">250+</div>
              <div className="text-sm text-gray-600">Benchmark Queries</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-green-600 mb-2">4</div>
              <div className="text-sm text-gray-600">Search Engines</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-purple-600 mb-2">20</div>
              <div className="text-sm text-gray-600">Results per Query</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-orange-600 mb-2">24/7</div>
              <div className="text-sm text-gray-600">Continuous Collection</div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quality Assurance</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Validation</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• Schema validation for all collected data</li>
              <li>• Content hash verification for integrity</li>
              <li>• Duplicate detection and removal</li>
              <li>• URL validation and normalization</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Annotation Quality</h3>
            <ul className="space-y-2 text-gray-700">
              <li>• Cross-model validation with multiple LLMs</li>
              <li>• Confidence score monitoring and thresholds</li>
              <li>• Human validation of sample annotations</li>
              <li>• Prompt engineering and version control</li>
            </ul>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">
            Ethical Considerations
          </h3>
          <p className="text-yellow-800 mb-3">
            TruthLayer adheres to strict ethical guidelines in data collection and analysis:
          </p>
          <ul className="space-y-1 text-yellow-800">
            <li>• Respectful scraping with appropriate delays and rate limiting</li>
            <li>• Compliance with robots.txt and platform terms of service</li>
            <li>• No collection of personal or sensitive information</li>
            <li>• Transparent methodology and open data sharing</li>
          </ul>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Statistical Validation</h2>
        
        <p className="text-gray-700 mb-4">
          All bias measurements undergo rigorous statistical validation including:
        </p>
        
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Significance Testing</h4>
            <p className="text-sm text-gray-600">
              Mann-Whitney U tests for comparing metrics between groups and time periods.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Confidence Intervals</h4>
            <p className="text-sm text-gray-600">
              Bootstrap methods for calculating 95% confidence intervals around all metrics.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Trend Analysis</h4>
            <p className="text-sm text-gray-600">
              Time series analysis with anomaly detection for identifying significant changes.
            </p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Learn More
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link 
              href="/docs/data-collection" 
              className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <h4 className="font-semibold text-blue-900 mb-1">Data Collection Methods</h4>
              <p className="text-sm text-blue-700">
                Technical details of our data collection infrastructure and anti-detection measures.
              </p>
            </Link>
            <Link 
              href="/docs/bias-metrics" 
              className="block p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <h4 className="font-semibold text-purple-900 mb-1">Bias Metrics Calculations</h4>
              <p className="text-sm text-purple-700">
                Mathematical formulations and implementation details for all bias metrics.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}