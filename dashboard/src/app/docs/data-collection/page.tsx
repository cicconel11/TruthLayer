import Link from 'next/link';

export default function DataCollectionPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <nav className="mb-6">
        <Link href="/docs" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Documentation
        </Link>
      </nav>

      <div className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Data Collection Methods
        </h1>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-green-900 mb-3">Overview</h2>
          <p className="text-green-800">
            TruthLayer's data collection infrastructure systematically gathers search results 
            from multiple engines while respecting platform policies and maintaining high 
            data quality standards through advanced anti-detection measures.
          </p>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Supported Search Engines</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold text-sm">G</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Google Search</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Traditional web search with personalization disabled</li>
              <li>• 20 organic results per query</li>
              <li>• Advanced parsing of rich snippets and knowledge panels</li>
              <li>• Rate limiting: 2-8 second delays</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 font-bold text-sm">B</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Bing Search</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Microsoft's search platform with standard settings</li>
              <li>• Rich snippet extraction and knowledge integration</li>
              <li>• Bing-specific DOM structure parsing</li>
              <li>• Consistent result normalization</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-purple-600 font-bold text-sm">P</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Perplexity AI</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• AI-powered conversational search interface</li>
              <li>• Source citation extraction from AI responses</li>
              <li>• Interactive search with follow-up capabilities</li>
              <li>• Unique AI-generated summary analysis</li>
            </ul>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-orange-600 font-bold text-sm">B</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Brave Search</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Privacy-focused independent search index</li>
              <li>• No tracking or personalization</li>
              <li>• Alternative perspective to major engines</li>
              <li>• Standard web result structure</li>
            </ul>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Anti-Detection Infrastructure</h2>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">
            Respectful Scraping Approach
          </h3>
          <p className="text-yellow-800">
            Our collection methods prioritize respectful interaction with search platforms 
            while maintaining data quality and research integrity.
          </p>
        </div>

        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Proxy Management</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Residential Proxy Pool</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Rotating IP addresses from multiple countries</li>
                  <li>• Health monitoring and automatic failover</li>
                  <li>• Geographic distribution for natural patterns</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Request Distribution</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Load balancing across proxy endpoints</li>
                  <li>• Failure tracking and proxy rotation</li>
                  <li>• Connection pooling for efficiency</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Browser Fingerprinting</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Realistic User Agents</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Rotation of common browser user agents</li>
                  <li>• Platform-specific configurations</li>
                  <li>• Version consistency and updates</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Browser Behavior</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Realistic viewport sizes and settings</li>
                  <li>• Natural mouse movements and timing</li>
                  <li>• Standard HTTP headers and cookies</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">CAPTCHA and Challenge Handling</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Automated Solving</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Integration with CAPTCHA solving services</li>
                  <li>• Support for reCAPTCHA and hCaptcha</li>
                  <li>• Fallback mechanisms for complex challenges</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Cloudflare Bypass</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Automatic challenge detection and handling</li>
                  <li>• Turnstile CAPTCHA integration</li>
                  <li>• Browser verification simulation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Request Management</h2>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Rate Limiting</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Minimum Delay:</span>
                <span className="font-mono">2 seconds</span>
              </div>
              <div className="flex justify-between">
                <span>Maximum Delay:</span>
                <span className="font-mono">8 seconds</span>
              </div>
              <div className="flex justify-between">
                <span>Random Jitter:</span>
                <span className="font-mono">±1 second</span>
              </div>
              <div className="flex justify-between">
                <span>Failure Backoff:</span>
                <span className="font-mono">Exponential</span>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">Error Handling</h3>
            <ul className="space-y-1 text-sm text-green-800">
              <li>• Automatic retry with exponential backoff</li>
              <li>• Maximum 3 retry attempts per request</li>
              <li>• Graceful degradation on persistent failures</li>
              <li>• Comprehensive error logging and monitoring</li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-3">Concurrency</h3>
            <ul className="space-y-1 text-sm text-purple-800">
              <li>• Maximum 2 concurrent requests per engine</li>
              <li>• Semaphore-based concurrency control</li>
              <li>• Resource pooling and cleanup</li>
              <li>• Memory usage monitoring and limits</li>
            </ul>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Quality Controls</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Schema Validation</h3>
            <p className="text-gray-700 mb-4">
              All collected data undergoes strict validation to ensure consistency and completeness:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
              <div className="text-gray-600 mb-2">// Required fields validation</div>
              <div>✓ title: string (non-empty)</div>
              <div>✓ url: string (valid HTTP/HTTPS)</div>
              <div>✓ rank: number (1-20)</div>
              <div>✓ engine: enum (google|bing|perplexity|brave)</div>
              <div>✓ timestamp: Date (valid ISO format)</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Content Deduplication</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Hash-Based Detection</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• SHA-256 hashing of content</li>
                  <li>• Cross-collection cycle deduplication</li>
                  <li>• URL normalization and canonicalization</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Quality Metrics</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Completeness tracking per query</li>
                  <li>• Success rate monitoring by engine</li>
                  <li>• Data integrity verification</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Monitoring and Alerting</h2>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-red-900 mb-3">
            Collection Success Monitoring
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-red-600 mb-1">95%</div>
              <div className="text-sm text-red-800">Target Success Rate</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 mb-1">90%</div>
              <div className="text-sm text-red-800">Alert Threshold</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 mb-1">5%</div>
              <div className="text-sm text-red-800">Max Error Rate</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Learn More
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Link 
              href="/docs/methodology" 
              className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <h4 className="font-semibold text-blue-900 mb-1">Complete Methodology</h4>
              <p className="text-sm text-blue-700">
                Overview of TruthLayer's comprehensive approach to bias measurement.
              </p>
            </Link>
            <Link 
              href="/docs/reproducibility" 
              className="block p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <h4 className="font-semibold text-green-900 mb-1">Reproducibility Guidelines</h4>
              <p className="text-sm text-green-700">
                Step-by-step instructions for reproducing our data collection process.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}