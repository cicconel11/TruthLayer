'use client';

import { useState } from 'react';
import { DashboardFilters } from '@/types/dashboard';
import { format, subDays } from 'date-fns';

interface FilterPanelProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  showQueryFilter?: boolean;
  showAdvanced?: boolean;
}

export default function FilterPanel({ 
  filters, 
  onFiltersChange, 
  showQueryFilter = false,
  showAdvanced = false 
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const engines = ['google', 'bing', 'perplexity', 'brave'];
  const categories = ['health', 'politics', 'technology', 'science'];
  const dateRangeOptions = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'Custom', days: 0 },
  ];

  const updateDateRange = (days: number) => {
    if (days === 0) return; // Custom range - handled separately
    
    onFiltersChange({
      ...filters,
      dateRange: {
        start: subDays(new Date(), days),
        end: new Date(),
      },
    });
  };

  const toggleEngine = (engine: string) => {
    const newEngines = filters.engines.includes(engine)
      ? filters.engines.filter(e => e !== engine)
      : [...filters.engines, engine];
    
    onFiltersChange({
      ...filters,
      engines: newEngines,
    });
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    
    onFiltersChange({
      ...filters,
      categories: newCategories,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      dateRange: {
        start: subDays(new Date(), 30),
        end: new Date(),
      },
      engines: ['google', 'bing', 'perplexity', 'brave'],
      categories: [],
      queryText: '',
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.engines.length < 4) count++;
    if (filters.categories.length > 0) count++;
    if (filters.queryText && filters.queryText.trim()) count++;
    return count;
  };

  return (
    <div className="bg-white rounded-lg shadow border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-900">Filters</h3>
            {getActiveFilterCount() > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                {getActiveFilterCount()} active
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {getActiveFilterCount() > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
            {showAdvanced && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                {isExpanded ? 'Less' : 'More'} options
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Basic Filters */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              onChange={(e) => updateDateRange(parseInt(e.target.value))}
              defaultValue="30"
            >
              {dateRangeOptions.map((option) => (
                <option key={option.days} value={option.days}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Engines */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Engines
            </label>
            <div className="flex flex-wrap gap-2">
              {engines.map((engine) => (
                <button
                  key={engine}
                  onClick={() => toggleEngine(engine)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.engines.includes(engine)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {engine.charAt(0).toUpperCase() + engine.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categories
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.categories.includes(category)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Query Text Filter */}
        {showQueryFilter && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Query
            </label>
            <input
              type="text"
              placeholder="Filter by query text..."
              value={filters.queryText || ''}
              onChange={(e) => onFiltersChange({ ...filters, queryText: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        )}

        {/* Advanced Filters */}
        {showAdvanced && isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Custom Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={format(filters.dateRange.start, 'yyyy-MM-dd')}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      dateRange: {
                        ...filters.dateRange,
                        start: new Date(e.target.value),
                      },
                    })}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <input
                    type="date"
                    value={format(filters.dateRange.end, 'yyyy-MM-dd')}
                    onChange={(e) => onFiltersChange({
                      ...filters,
                      dateRange: {
                        ...filters.dateRange,
                        end: new Date(e.target.value),
                      },
                    })}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Presets
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => onFiltersChange({
                      ...filters,
                      engines: ['google', 'bing'],
                      categories: ['health'],
                    })}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md"
                  >
                    Health: Google vs Bing
                  </button>
                  <button
                    onClick={() => onFiltersChange({
                      ...filters,
                      engines: ['perplexity', 'brave'],
                      categories: ['technology'],
                    })}
                    className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md"
                  >
                    Tech: AI vs Traditional
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}