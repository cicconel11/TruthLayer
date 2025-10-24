import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          TruthLayer Documentation
        </h1>
        <p className="text-xl text-gray-600 leading-relaxed">
          Comprehensive documentation for understanding TruthLayer's methodology, 
          accessing datasets, and conducting search engine bias analysis.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-2 rounded-lg mr-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Methodology</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Complete methodology covering data collection, annotation pipelines, 
            bias metrics calculations, and quality assurance procedures.
          </p>
          <Link 
            href="/docs/methodology" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Read Methodology
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center mb-4">
            <div className="bg-green-100 p-2 rounded-lg mr-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Data Collection</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Technical details of data collection infrastructure, anti-detection 
            measures, and quality controls for gathering search results.
          </p>
          <Link 
            href="/docs/data-collection" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Learn Collection Methods
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center mb-4">
            <div className="bg-purple-100 p-2 rounded-lg mr-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Bias Metrics</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Mathematical formulations and implementation details for all bias 
            metrics including domain diversity, engine overlap, and factual alignment.
          </p>
          <Link 
            href="/docs/bias-metrics" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Explore Metrics
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center mb-4">
            <div className="bg-orange-100 p-2 rounded-lg mr-3">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Dataset Usage</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Complete guide for accessing, understanding, and using TruthLayer 
            datasets for research, analysis, and transparency initiatives.
          </p>
          <Link 
            href="/docs/dataset-usage" 
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            Access Datasets
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quick Start</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">For Researchers</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Access datasets and analysis tools</li>
              <li>• Understand bias measurement methods</li>
              <li>• Follow citation guidelines</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">For Developers</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Setup reproduction environment</li>
              <li>• Implement collection pipelines</li>
              <li>• Validate analysis results</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">For Policymakers</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Review scientific methodology</li>
              <li>• Examine policy-relevant findings</li>
              <li>• Apply transparency insights</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Additional Resources</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              <Link href="/docs/reproducibility" className="text-blue-600 hover:text-blue-800">
                Reproducibility Guidelines
              </Link>
            </h3>
            <p className="text-sm text-gray-600">
              Comprehensive guidelines for reproducing TruthLayer analysis and validating methodology.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              <Link href="/datasets" className="text-blue-600 hover:text-blue-800">
                Dataset Downloads
              </Link>
            </h3>
            <p className="text-sm text-gray-600">
              Direct access to TruthLayer datasets in multiple formats with integrity verification.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Need Help?
            </h3>
            <div className="mt-1 text-sm text-blue-700">
              <p>
                Contact us at{' '}
                <a href="mailto:docs@truthlayer.org" className="font-medium underline">
                  docs@truthlayer.org
                </a>{' '}
                for documentation questions or technical support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}