'use client';

import { useState, useEffect } from 'react';
import { QueryAnalysis, DashboardFilters, ApiResponse } from '../types/dashboard';
import { format } from 'date-fns';

interface QueryExplorerProps {
  filters: DashboardFilters;
}

export default function QueryExplorer({ filters }: QueryExplorerProps) {
  const [queries, setQueries] = useState<QueryAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuery, setSelectedQuery] = useState<QueryAnalysis | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'results' | 'diversity'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchQueries();
  }, [filters, sortBy, sortOrder]);

  const fetchQueries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        start: filters.dateRange.start.toISOString(),
        end: filters.dateRange.end.toISOString(),
        engines: filters.engines.join(','),
        sortBy,
        sortOrder,
      });

      if (filters.categories.length > 0) {
        params.append('categories', filters.categories.join(','));
      }

      if (filters.queryText && filters.queryText.trim()) {
        params.append('queryText', filters.queryText.trim());
      }

      const response = await fetch(`/api/queries/analysis?${params}`);
      const result: ApiResponse<QueryAnalysis[]> = await response.json();
      
      if (result.success && result.data) {
        setQueries(result.data);
      } else {
        setError(result.error || 'Failed to fetch query analysis');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching queries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (column: typeof sortBy) => {
    if (sortBy !== column) return '↕️';
    return sortOrder === 'asc' ? '↗️' : '↘️';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div data-testid="loading-spinner" className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={fetchQueries}
                  className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Query List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Query Analysis ({queries.length} queries)
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Sort by:</span>
              <button
                onClick={() => handleSort('date')}
                className={`text-sm px-2 py-1 rounded ${
                  sortBy === 'date' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Date {getSortIcon('date')}
              </button>
              <button
                onClick={() => handleSort('results')}
                className={`text-sm px-2 py-1 rounded ${
                  sortBy === 'results' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Results {getSortIcon('results')}
              </button>
              <button
                onClick={() => handleSort('diversity')}
                className={`text-sm px-2 py-1 rounded ${
                  sortBy === 'diversity' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Diversity {getSortIcon('diversity')}
              </button>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {queries.map((query) => (
            <QueryRow
              key={query.queryId}
              query={query}
              isSelected={selectedQuery?.queryId === query.queryId}
              onSelect={() => setSelectedQuery(selectedQuery?.queryId === query.queryId ? null : query)}
            />
          ))}
        </div>

        {queries.length === 0 && (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">No queries found matching the current filters.</p>
          </div>
        )}
      </div>

      {/* Query Details */}
      {selectedQuery && (
        <QueryDetails query={selectedQuery} />
      )}
    </div>
  );
}

interface QueryRowProps {
  query: QueryAnalysis;
  isSelected: boolean;
  onSelect: () => void;
}

function QueryRow({ query, isSelected, onSelect }: QueryRowProps) {
  const avgDiversity = query.engines.reduce((sum, e) => sum + e.domainDiversity, 0) / query.engines.length;
  const avgFactual = query.engines.reduce((sum, e) => sum + e.factualAlignment, 0) / query.engines.length;

  return (
    <div
      className={`px-6 py-4 cursor-pointer transition-colors ${
        isSelected ? 'bg-primary-50 border-l-4 border-primary-500' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              "{query.queryText}"
            </h4>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              query.category === 'health' ? 'bg-red-100 text-red-800' :
              query.category === 'politics' ? 'bg-blue-100 text-blue-800' :
              query.category === 'technology' ? 'bg-green-100 text-green-800' :
              'bg-purple-100 text-purple-800'
            }`}>
              {query.category}
            </span>
          </div>
          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
            <span>{format(query.collectedAt, 'MMM dd, yyyy HH:mm')}</span>
            <span>{query.totalResults} results</span>
            <span>{query.engines.length} engines</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-sm font-medium text-gray-900">
              {(avgDiversity * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Diversity</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-900">
              {(avgFactual * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">Factual</div>
          </div>
          <div className="text-gray-400">
            {isSelected ? '▼' : '▶'}
          </div>
        </div>
      </div>
    </div>
  );
}

interface QueryDetailsProps {
  query: QueryAnalysis;
}

function QueryDetails({ query }: QueryDetailsProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Query Details: "{query.queryText}"
        </h3>
        <div className="mt-1 text-sm text-gray-500">
          {query.category} • {format(query.collectedAt, 'MMMM dd, yyyy HH:mm')}
        </div>
      </div>

      <div className="p-6">
        {/* Engine Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {query.engines.map((engine) => (
            <div key={engine.engine} className="border rounded-lg p-4">
              <div className="flex items-center mb-3">
                <span className="text-xl mr-2">
                  {engine.engine === 'google' ? '🔍' : 
                   engine.engine === 'bing' ? '🔎' : 
                   engine.engine === 'perplexity' ? '🤖' : '🦁'}
                </span>
                <span className="font-medium capitalize">{engine.engine}</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Results:</span>
                  <span className="font-medium">{engine.totalResults}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Domains:</span>
                  <span className="font-medium">{engine.uniqueDomains}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Diversity:</span>
                  <span className="font-medium">{(engine.domainDiversity * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Factual:</span>
                  <span className="font-medium">{(engine.factualAlignment * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Rank:</span>
                  <span className="font-medium">{engine.averageRank.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="border-t pt-6">
          <h4 className="font-medium text-gray-900 mb-3">Key Insights</h4>
          <QueryInsights query={query} />
        </div>
      </div>
    </div>
  );
}

function QueryInsights({ query }: { query: QueryAnalysis }) {
  const engines = query.engines;
  
  if (engines.length === 0) {
    return <p className="text-gray-500">No engine data available.</p>;
  }

  const mostDiverse = engines.reduce((best, current) => 
    current.domainDiversity > best.domainDiversity ? current : best
  );

  const mostFactual = engines.reduce((best, current) => 
    current.factualAlignment > best.factualAlignment ? current : best
  );

  const mostResults = engines.reduce((best, current) => 
    current.totalResults > best.totalResults ? current : best
  );

  const diversityRange = {
    min: Math.min(...engines.map(e => e.domainDiversity)),
    max: Math.max(...engines.map(e => e.domainDiversity)),
  };

  const factualRange = {
    min: Math.min(...engines.map(e => e.factualAlignment)),
    max: Math.max(...engines.map(e => e.factualAlignment)),
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-blue-50 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 mb-2">🏆 Best Diversity</h5>
        <p className="text-sm text-blue-800 mb-1">
          <span className="font-medium capitalize">{mostDiverse.engine}</span> with {(mostDiverse.domainDiversity * 100).toFixed(1)}%
        </p>
        <p className="text-xs text-blue-600">
          Range: {(diversityRange.min * 100).toFixed(1)}% - {(diversityRange.max * 100).toFixed(1)}%
        </p>
      </div>

      <div className="bg-green-50 rounded-lg p-4">
        <h5 className="font-medium text-green-900 mb-2">✅ Most Factual</h5>
        <p className="text-sm text-green-800 mb-1">
          <span className="font-medium capitalize">{mostFactual.engine}</span> with {(mostFactual.factualAlignment * 100).toFixed(1)}%
        </p>
        <p className="text-xs text-green-600">
          Range: {(factualRange.min * 100).toFixed(1)}% - {(factualRange.max * 100).toFixed(1)}%
        </p>
      </div>

      <div className="bg-purple-50 rounded-lg p-4">
        <h5 className="font-medium text-purple-900 mb-2">📊 Most Results</h5>
        <p className="text-sm text-purple-800 mb-1">
          <span className="font-medium capitalize">{mostResults.engine}</span> with {mostResults.totalResults} results
        </p>
        <p className="text-xs text-purple-600">
          Total across all engines: {engines.reduce((sum, e) => sum + e.totalResults, 0)}
        </p>
      </div>
    </div>
  );
}