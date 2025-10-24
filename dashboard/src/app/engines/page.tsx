'use client';

import { useEffect, useState } from 'react';
import { EngineComparison, ApiResponse, DashboardFilters } from '@/types/dashboard';
import { subDays } from 'date-fns';
import FilterPanel from '@/components/FilterPanel';
import { useRealTimeUpdates } from '@/components/RealTimeUpdates';
import { EngineComparisonChart } from '@/components/charts';

export default function EngineComparisonPage() {
  const [engines, setEngines] = useState<EngineComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: {
      start: subDays(new Date(), 30),
      end: new Date(),
    },
    engines: ['google', 'bing', 'perplexity', 'brave'],
    categories: [],
  });

  // Use real-time updates
  const { lastUpdate, isConnected } = useRealTimeUpdates(() => {
    fetchEngineComparison();
  });

  useEffect(() => {
    fetchEngineComparison();
  }, [filters]);

  const fetchEngineComparison = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start: filters.dateRange.start.toISOString(),
        end: filters.dateRange.end.toISOString(),
      });

      if (filters.categories.length > 0) {
        params.append('category', filters.categories[0]);
      }

      const response = await fetch(`/api/metrics/engines?${params}`);
      const result: ApiResponse<EngineComparison[]> = await response.json();
      
      if (result.success && result.data) {
        setEngines(result.data);
      } else {
        setError(result.error || 'Failed to fetch engine comparison data');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching engine comparison:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={fetchEngineComparison}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Engine Comparison</h2>
        <p className="mt-2 text-gray-600">
          Side-by-side analysis of bias metrics across search engines
        </p>
      </div>

      {/* Filters */}
      <FilterPanel 
        filters={filters} 
        onFiltersChange={setFilters}
        showAdvanced={true}
      />

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {engines.map((engine) => (
          <EngineCard key={engine.engine} engine={engine} />
        ))}
      </div>

      {/* Detailed Comparison Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Metrics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engine
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain Diversity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engine Overlap
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Factual Alignment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Results
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unique Domains
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Rank
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {engines.map((engine) => (
                <tr key={engine.engine} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <EngineIcon engine={engine.engine} />
                      <span className="ml-2 text-sm font-medium text-gray-900 capitalize">
                        {engine.engine}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <MetricCell value={engine.domainDiversity} type="percentage" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <MetricCell value={engine.engineOverlap} type="percentage" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <MetricCell value={engine.factualAlignment} type="percentage" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {engine.totalResults.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {engine.uniqueDomains.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {engine.averageRank.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Radar Comparison</h3>
          <div className="h-80">
            <EngineComparisonChart
              data={engines}
              type="radar"
              height={320}
              responsive={true}
            />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bar Comparison</h3>
          <div className="h-80">
            <EngineComparisonChart
              data={engines}
              type="bar"
              height={320}
              responsive={true}
            />
          </div>
        </div>
      </div>

      {/* Comparative Analysis */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparative Analysis</h3>
        <ComparisonInsights engines={engines} />
      </div>
    </div>
  );
}



interface EngineCardProps {
  engine: EngineComparison;
}

function EngineCard({ engine }: EngineCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-4">
        <EngineIcon engine={engine.engine} />
        <h3 className="ml-2 text-lg font-semibold text-gray-900 capitalize">
          {engine.engine}
        </h3>
      </div>

      <div className="space-y-4">
        <MetricDisplay
          label="Domain Diversity"
          value={engine.domainDiversity}
          type="percentage"
          description="Unique sources per query"
        />
        <MetricDisplay
          label="Engine Overlap"
          value={engine.engineOverlap}
          type="percentage"
          description="Shared results with other engines"
        />
        <MetricDisplay
          label="Factual Alignment"
          value={engine.factualAlignment}
          type="percentage"
          description="Average factual consistency"
        />
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Results:</span>
            <span className="ml-1 font-medium">{engine.totalResults.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Domains:</span>
            <span className="ml-1 font-medium">{engine.uniqueDomains.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricDisplayProps {
  label: string;
  value: number;
  type: 'percentage' | 'number';
  description: string;
}

function MetricDisplay({ label, value, type, description }: MetricDisplayProps) {
  const displayValue = type === 'percentage' ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
  const percentage = type === 'percentage' ? value * 100 : (value / 1) * 100;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{displayValue}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

interface MetricCellProps {
  value: number;
  type: 'percentage' | 'number';
}

function MetricCell({ value, type }: MetricCellProps) {
  const displayValue = type === 'percentage' ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
  const colorClass = value > 0.7 ? 'text-green-600' : value > 0.4 ? 'text-yellow-600' : 'text-red-600';

  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {displayValue}
    </span>
  );
}

function EngineIcon({ engine }: { engine: string }) {
  const icons = {
    google: '🔍',
    bing: '🔎',
    perplexity: '🤖',
    brave: '🦁',
  };

  return (
    <span className="text-xl">
      {icons[engine as keyof typeof icons] || '🔍'}
    </span>
  );
}

interface ComparisonInsightsProps {
  engines: EngineComparison[];
}

function ComparisonInsights({ engines }: ComparisonInsightsProps) {
  if (engines.length === 0) {
    return <p className="text-gray-500">No data available for comparison.</p>;
  }

  const sortedByDiversity = [...engines].sort((a, b) => b.domainDiversity - a.domainDiversity);
  const sortedByOverlap = [...engines].sort((a, b) => b.engineOverlap - a.engineOverlap);
  const sortedByFactual = [...engines].sort((a, b) => b.factualAlignment - a.factualAlignment);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Highest Domain Diversity</h4>
        <div className="space-y-2">
          {sortedByDiversity.slice(0, 3).map((engine, index) => (
            <div key={engine.engine} className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">#{index + 1}</span>
                <EngineIcon engine={engine.engine} />
                <span className="ml-2 text-sm font-medium capitalize">{engine.engine}</span>
              </div>
              <span className="text-sm text-gray-600">
                {(engine.domainDiversity * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-2">Highest Engine Overlap</h4>
        <div className="space-y-2">
          {sortedByOverlap.slice(0, 3).map((engine, index) => (
            <div key={engine.engine} className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">#{index + 1}</span>
                <EngineIcon engine={engine.engine} />
                <span className="ml-2 text-sm font-medium capitalize">{engine.engine}</span>
              </div>
              <span className="text-sm text-gray-600">
                {(engine.engineOverlap * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-2">Highest Factual Alignment</h4>
        <div className="space-y-2">
          {sortedByFactual.slice(0, 3).map((engine, index) => (
            <div key={engine.engine} className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">#{index + 1}</span>
                <EngineIcon engine={engine.engine} />
                <span className="ml-2 text-sm font-medium capitalize">{engine.engine}</span>
              </div>
              <span className="text-sm text-gray-600">
                {(engine.factualAlignment * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}