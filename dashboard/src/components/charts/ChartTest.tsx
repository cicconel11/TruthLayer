'use client';

import { useState } from 'react';
import { BiasMetricsChart, EngineComparisonChart, DomainDistributionChart, TrendAnalysisChart } from './index';
import { MetricsTrend, EngineComparison, DomainDistribution } from '@/types/dashboard';

// Mock data for testing
const mockTrends: MetricsTrend[] = [
  { date: '2024-01-01', domainDiversity: 0.65, engineOverlap: 0.45, factualAlignment: 0.78, engine: 'google' },
  { date: '2024-01-02', domainDiversity: 0.68, engineOverlap: 0.42, factualAlignment: 0.81, engine: 'google' },
  { date: '2024-01-03', domainDiversity: 0.62, engineOverlap: 0.48, factualAlignment: 0.75, engine: 'google' },
  { date: '2024-01-01', domainDiversity: 0.58, engineOverlap: 0.52, factualAlignment: 0.72, engine: 'bing' },
  { date: '2024-01-02', domainDiversity: 0.61, engineOverlap: 0.49, factualAlignment: 0.74, engine: 'bing' },
  { date: '2024-01-03', domainDiversity: 0.59, engineOverlap: 0.51, factualAlignment: 0.73, engine: 'bing' },
];

const mockEngines: EngineComparison[] = [
  { engine: 'google', domainDiversity: 0.65, engineOverlap: 0.45, factualAlignment: 0.78, totalResults: 1250, uniqueDomains: 85, averageRank: 10.5 },
  { engine: 'bing', domainDiversity: 0.59, engineOverlap: 0.51, factualAlignment: 0.73, totalResults: 1180, uniqueDomains: 78, averageRank: 11.2 },
  { engine: 'perplexity', domainDiversity: 0.72, engineOverlap: 0.38, factualAlignment: 0.85, totalResults: 980, uniqueDomains: 92, averageRank: 8.7 },
  { engine: 'brave', domainDiversity: 0.61, engineOverlap: 0.47, factualAlignment: 0.76, totalResults: 1100, uniqueDomains: 81, averageRank: 10.8 },
];

const mockDomains: DomainDistribution[] = [
  { domainType: 'news', count: 45, percentage: 35.2, engine: 'google' },
  { domainType: 'commercial', count: 32, percentage: 25.0, engine: 'google' },
  { domainType: 'academic', count: 28, percentage: 21.9, engine: 'google' },
  { domainType: 'government', count: 15, percentage: 11.7, engine: 'google' },
  { domainType: 'blog', count: 8, percentage: 6.2, engine: 'google' },
];

export default function ChartTest() {
  const [selectedChart, setSelectedChart] = useState<'bias' | 'engine' | 'domain' | 'trend'>('bias');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Chart Components Test</h2>
        
        {/* Chart Selector */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setSelectedChart('bias')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedChart === 'bias' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Bias Metrics
          </button>
          <button
            onClick={() => setSelectedChart('engine')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedChart === 'engine' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Engine Comparison
          </button>
          <button
            onClick={() => setSelectedChart('domain')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedChart === 'domain' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Domain Distribution
          </button>
          <button
            onClick={() => setSelectedChart('trend')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              selectedChart === 'trend' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Trend Analysis
          </button>
        </div>
      </div>

      {/* Chart Display */}
      <div className="bg-white rounded-lg shadow p-6">
        {selectedChart === 'bias' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Bias Metrics Chart</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Line Chart</h4>
                <div className="h-64">
                  <BiasMetricsChart
                    data={mockTrends}
                    type="line"
                    metric="domainDiversity"
                    height={256}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Bar Chart</h4>
                <div className="h-64">
                  <BiasMetricsChart
                    data={mockTrends}
                    type="bar"
                    metric="factualAlignment"
                    height={256}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Doughnut Chart</h4>
                <div className="h-64">
                  <BiasMetricsChart
                    data={mockTrends}
                    type="doughnut"
                    metric="engineOverlap"
                    height={256}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedChart === 'engine' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Engine Comparison Chart</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Bar Comparison</h4>
                <div className="h-80">
                  <EngineComparisonChart
                    data={mockEngines}
                    type="bar"
                    height={320}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Radar Comparison</h4>
                <div className="h-80">
                  <EngineComparisonChart
                    data={mockEngines}
                    type="radar"
                    height={320}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedChart === 'domain' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Domain Distribution Chart</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Bar Distribution</h4>
                <div className="h-80">
                  <DomainDistributionChart
                    data={mockDomains}
                    type="bar"
                    engine="google"
                    height={320}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Pie Distribution</h4>
                <div className="h-80">
                  <DomainDistributionChart
                    data={mockDomains}
                    type="pie"
                    engine="google"
                    height={320}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedChart === 'trend' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Trend Analysis Chart</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2">Line Trend</h4>
                <div className="h-80">
                  <TrendAnalysisChart
                    data={mockTrends}
                    type="line"
                    metrics={['domainDiversity']}
                    height={320}
                  />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">Area Trend</h4>
                <div className="h-80">
                  <TrendAnalysisChart
                    data={mockTrends}
                    type="area"
                    metrics={['domainDiversity', 'factualAlignment']}
                    height={320}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}