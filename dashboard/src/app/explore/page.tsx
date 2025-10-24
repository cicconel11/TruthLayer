'use client';

import { useState, useEffect } from 'react';
import { DashboardFilters, DomainDistribution } from '@/types/dashboard';
import { subDays } from 'date-fns';
import FilterPanel from '@/components/FilterPanel';
import QueryExplorer from '@/components/QueryExplorer';
import RealTimeUpdates, { useRealTimeUpdates } from '@/components/RealTimeUpdates';
import { DomainDistributionChart } from '@/components/charts';

export default function ExplorePage() {
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: {
      start: subDays(new Date(), 30),
      end: new Date(),
    },
    engines: ['google', 'bing', 'perplexity', 'brave'],
    categories: [],
    queryText: '',
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // Use real-time updates to refresh data
  const { lastUpdate, isConnected } = useRealTimeUpdates(() => {
    setRefreshKey(prev => prev + 1);
  });

  const handleFiltersChange = (newFilters: DashboardFilters) => {
    setFilters(newFilters);
  };

  const handleDataRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Data Explorer</h2>
          <p className="mt-2 text-gray-600">
            Interactive filtering and drill-down analysis of search engine bias data
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <RealTimeUpdates 
            onDataUpdate={handleDataRefresh}
            showNotifications={false}
          />
          <button
            onClick={handleDataRefresh}
            className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        showQueryFilter={true}
        showAdvanced={true}
      />

      {/* Active Filters Summary */}
      <ActiveFiltersSummary filters={filters} />

      {/* Domain Distribution Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Domain Distribution by Engine</h3>
          <div className="h-80">
            <DomainDistributionVisualization filters={filters} type="bar" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Domain Distribution</h3>
          <div className="h-80">
            <DomainDistributionVisualization filters={filters} type="pie" />
          </div>
        </div>
      </div>

      {/* Query Explorer */}
      <div key={refreshKey}>
        <QueryExplorer filters={filters} />
      </div>

      {/* Real-time Updates Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuickInsights filters={filters} />
        </div>
        <div>
          <RealTimeUpdates onDataUpdate={handleDataRefresh} />
        </div>
      </div>
    </div>
  );
}

interface ActiveFiltersSummaryProps {
  filters: DashboardFilters;
}

function ActiveFiltersSummary({ filters }: ActiveFiltersSummaryProps) {
  const getFilterSummary = () => {
    const parts = [];
    
    // Date range
    const daysDiff = Math.ceil((filters.dateRange.end.getTime() - filters.dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`${daysDiff} days`);
    
    // Engines
    if (filters.engines.length < 4) {
      parts.push(`${filters.engines.length} engines`);
    } else {
      parts.push('all engines');
    }
    
    // Categories
    if (filters.categories.length > 0) {
      parts.push(`${filters.categories.length} categories`);
    }
    
    // Query text
    if (filters.queryText && filters.queryText.trim()) {
      parts.push(`query: "${filters.queryText.trim()}"`);
    }
    
    return parts.join(' • ');
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center space-x-2">
        <span className="text-blue-800 font-medium">Active Filters:</span>
        <span className="text-blue-700">{getFilterSummary()}</span>
      </div>
    </div>
  );
}

interface QuickInsightsProps {
  filters: DashboardFilters;
}

function QuickInsights({ filters }: QuickInsightsProps) {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [filters]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start: filters.dateRange.start.toISOString(),
        end: filters.dateRange.end.toISOString(),
        engines: filters.engines.join(','),
      });

      if (filters.categories.length > 0) {
        params.append('categories', filters.categories.join(','));
      }

      const response = await fetch(`/api/insights/quick?${params}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setInsights(result.data);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h3>
        <p className="text-gray-500">No insights available for current filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h3>
      
      <div className="space-y-4">
        {/* Data Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {insights.totalQueries || 0}
            </div>
            <div className="text-sm text-gray-500">Queries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {insights.totalResults || 0}
            </div>
            <div className="text-sm text-gray-500">Results</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {insights.uniqueDomains || 0}
            </div>
            <div className="text-sm text-gray-500">Domains</div>
          </div>
        </div>

        {/* Key Findings */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-2">Key Findings</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            {insights.findings?.map((finding: string, index: number) => (
              <li key={index} className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                {finding}
              </li>
            )) || [
              <li key="default" className="flex items-start">
                <span className="text-primary-600 mr-2">•</span>
                Analysis based on current filter selection
              </li>
            ]}
          </ul>
        </div>

        {/* Recommendations */}
        {insights.recommendations && insights.recommendations.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              {insights.recommendations.map((rec: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-600 mr-2">→</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

interface DomainDistributionVisualizationProps {
  filters: DashboardFilters;
  type: 'bar' | 'pie';
}

function DomainDistributionVisualization({ filters, type }: DomainDistributionVisualizationProps) {
  const [domainData, setDomainData] = useState<DomainDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomainData();
  }, [filters]);

  const fetchDomainData = async () => {
    try {
      setLoading(true);
      
      // Mock domain distribution data since we don't have the API endpoint yet
      const mockData: DomainDistribution[] = [
        { domainType: 'news', count: 45, percentage: 35.2, engine: 'google' },
        { domainType: 'commercial', count: 32, percentage: 25.0, engine: 'google' },
        { domainType: 'academic', count: 28, percentage: 21.9, engine: 'google' },
        { domainType: 'government', count: 15, percentage: 11.7, engine: 'google' },
        { domainType: 'blog', count: 8, percentage: 6.2, engine: 'google' },
        
        { domainType: 'news', count: 38, percentage: 31.4, engine: 'bing' },
        { domainType: 'commercial', count: 35, percentage: 28.9, engine: 'bing' },
        { domainType: 'academic', count: 22, percentage: 18.2, engine: 'bing' },
        { domainType: 'government', count: 18, percentage: 14.9, engine: 'bing' },
        { domainType: 'blog', count: 8, percentage: 6.6, engine: 'bing' },
        
        { domainType: 'academic', count: 42, percentage: 38.5, engine: 'perplexity' },
        { domainType: 'news', count: 35, percentage: 32.1, engine: 'perplexity' },
        { domainType: 'government', count: 18, percentage: 16.5, engine: 'perplexity' },
        { domainType: 'commercial', count: 10, percentage: 9.2, engine: 'perplexity' },
        { domainType: 'blog', count: 4, percentage: 3.7, engine: 'perplexity' },
        
        { domainType: 'news', count: 40, percentage: 33.6, engine: 'brave' },
        { domainType: 'commercial', count: 30, percentage: 25.2, engine: 'brave' },
        { domainType: 'academic', count: 25, percentage: 21.0, engine: 'brave' },
        { domainType: 'blog', count: 15, percentage: 12.6, engine: 'brave' },
        { domainType: 'government', count: 9, percentage: 7.6, engine: 'brave' },
      ];

      // Filter by selected engines
      const filteredData = mockData.filter(d => filters.engines.includes(d.engine));
      setDomainData(filteredData);
    } catch (error) {
      console.error('Error fetching domain data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <DomainDistributionChart
      data={domainData}
      type={type}
      height={320}
      responsive={true}
    />
  );
}