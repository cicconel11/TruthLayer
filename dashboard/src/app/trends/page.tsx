'use client';

import { useEffect, useState } from 'react';
import { MetricsTrend, ApiResponse, TimeSeriesData, DashboardFilters } from '@/types/dashboard';
import { format, subDays } from 'date-fns';
import FilterPanel from '@/components/FilterPanel';
import { useRealTimeUpdates } from '@/components/RealTimeUpdates';
import { TrendAnalysisChart, BiasMetricsChart } from '@/components/charts';



export default function TrendsPage() {
  const [trends, setTrends] = useState<MetricsTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'domainDiversity' | 'engineOverlap' | 'factualAlignment'>('domainDiversity');
  const [selectedEngines, setSelectedEngines] = useState<string[]>(['google', 'bing', 'perplexity', 'brave']);
  const [timeRange, setTimeRange] = useState(30);
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
    fetchTrends();
  });

  useEffect(() => {
    fetchTrends();
  }, [timeRange, selectedEngines, filters]);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        days: timeRange.toString(),
        engines: selectedEngines.join(','),
      });

      const response = await fetch(`/api/metrics/trends?${params}`);
      const result: ApiResponse<MetricsTrend[]> = await response.json();
      
      if (result.success && result.data) {
        setTrends(result.data);
      } else {
        setError(result.error || 'Failed to fetch trends data');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  };

  const prepareChartData = (): TimeSeriesData => {
    const uniqueDates = Array.from(new Set(trends.map(t => t.date))).sort();
    const engines = Array.from(new Set(trends.map(t => t.engine))).filter(e => selectedEngines.includes(e));

    const colors = {
      google: '#4285F4',
      bing: '#00BCF2',
      perplexity: '#20B2AA',
      brave: '#FB542B',
    };

    const datasets = engines.map(engine => {
      const engineData = trends.filter(t => t.engine === engine);
      const data = uniqueDates.map(date => {
        const trend = engineData.find(t => t.date === date);
        return trend ? trend[selectedMetric] * 100 : 0;
      });

      return {
        label: engine.charAt(0).toUpperCase() + engine.slice(1),
        data,
        borderColor: colors[engine as keyof typeof colors] || '#6B7280',
        backgroundColor: `${colors[engine as keyof typeof colors] || '#6B7280'}20`,
        fill: false,
        tension: 0.1,
      };
    });

    return {
      labels: uniqueDates.map(date => format(new Date(date), 'MMM dd')),
      datasets,
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${selectedMetric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} Trends`,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
          }
        }
      },
    },
    hover: {
      mode: 'nearest' as const,
      intersect: true,
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Percentage (%)',
        },
        min: 0,
        max: 100,
      },
    },
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
                onClick={fetchTrends}
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
        <h2 className="text-3xl font-bold text-gray-900">Trend Analysis</h2>
        <p className="mt-2 text-gray-600">
          Time-series visualization of bias metrics across search engines
        </p>
      </div>

      {/* Filters */}
      <FilterPanel 
        filters={filters} 
        onFiltersChange={setFilters}
        showAdvanced={true}
      />

      {/* Chart Controls */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metric
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="domainDiversity">Domain Diversity</option>
              <option value="engineOverlap">Engine Overlap</option>
              <option value="factualAlignment">Factual Alignment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Engines
            </label>
            <EngineSelector
              selectedEngines={selectedEngines}
              onEnginesChange={setSelectedEngines}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchTrends}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
            >
              Update Chart
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="h-96">
          <TrendAnalysisChart
            data={trends}
            type="line"
            metrics={[selectedMetric]}
            engines={selectedEngines}
            timeRange={timeRange <= 7 ? 'week' : timeRange <= 30 ? 'month' : 'quarter'}
            height={384}
            responsive={true}
            showMovingAverage={true}
          />
        </div>
      </div>

      {/* Additional Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Metrics Comparison</h3>
          <div className="h-80">
            <TrendAnalysisChart
              data={trends}
              type="area"
              metrics={['domainDiversity', 'engineOverlap', 'factualAlignment']}
              engines={selectedEngines}
              timeRange={timeRange <= 7 ? 'week' : timeRange <= 30 ? 'month' : 'quarter'}
              height={320}
              responsive={true}
            />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Averages</h3>
          <div className="h-80">
            <TrendAnalysisChart
              data={trends}
              type="bar"
              metrics={['domainDiversity', 'engineOverlap', 'factualAlignment']}
              engines={selectedEngines}
              height={320}
              responsive={true}
            />
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricTrendCard
          title="Domain Diversity"
          trends={trends}
          metric="domainDiversity"
          selectedEngines={selectedEngines}
        />
        <MetricTrendCard
          title="Engine Overlap"
          trends={trends}
          metric="engineOverlap"
          selectedEngines={selectedEngines}
        />
        <MetricTrendCard
          title="Factual Alignment"
          trends={trends}
          metric="factualAlignment"
          selectedEngines={selectedEngines}
        />
      </div>

      {/* Statistical Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistical Summary</h3>
        <TrendStatistics trends={trends} selectedEngines={selectedEngines} />
      </div>

      {/* Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
        <TrendInsights trends={trends} selectedEngines={selectedEngines} />
      </div>
    </div>
  );
}

interface EngineSelectorProps {
  selectedEngines: string[];
  onEnginesChange: (engines: string[]) => void;
}

function EngineSelector({ selectedEngines, onEnginesChange }: EngineSelectorProps) {
  const engines = ['google', 'bing', 'perplexity', 'brave'];

  const toggleEngine = (engine: string) => {
    if (selectedEngines.includes(engine)) {
      onEnginesChange(selectedEngines.filter(e => e !== engine));
    } else {
      onEnginesChange([...selectedEngines, engine]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {engines.map(engine => (
        <button
          key={engine}
          onClick={() => toggleEngine(engine)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selectedEngines.includes(engine)
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {engine.charAt(0).toUpperCase() + engine.slice(1)}
        </button>
      ))}
    </div>
  );
}

interface MetricTrendCardProps {
  title: string;
  trends: MetricsTrend[];
  metric: keyof Pick<MetricsTrend, 'domainDiversity' | 'engineOverlap' | 'factualAlignment'>;
  selectedEngines: string[];
}

function MetricTrendCard({ title, trends, metric, selectedEngines }: MetricTrendCardProps) {
  const filteredTrends = trends.filter(t => selectedEngines.includes(t.engine));
  
  if (filteredTrends.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
        <p className="text-gray-500 text-sm">No data available</p>
      </div>
    );
  }

  const currentValues = filteredTrends
    .filter(t => t.date === Math.max(...filteredTrends.map(t => new Date(t.date).getTime())).toString().split('T')[0])
    .reduce((acc, t) => acc + t[metric], 0) / selectedEngines.length;

  const previousValues = filteredTrends
    .filter(t => {
      const dates = Array.from(new Set(filteredTrends.map(t => t.date))).sort();
      return t.date === dates[dates.length - 2];
    })
    .reduce((acc, t) => acc + t[metric], 0) / selectedEngines.length;

  const change = currentValues - previousValues;
  const changePercent = previousValues > 0 ? (change / previousValues) * 100 : 0;

  return (
    <div className="bg-white rounded-lg border p-4">
      <h4 className="font-medium text-gray-900 mb-2">{title}</h4>
      <div className="text-2xl font-bold text-gray-900 mb-1">
        {(currentValues * 100).toFixed(1)}%
      </div>
      <div className={`text-sm flex items-center ${
        change >= 0 ? 'text-green-600' : 'text-red-600'
      }`}>
        <span className="mr-1">
          {change >= 0 ? '↗' : '↘'}
        </span>
        {Math.abs(changePercent).toFixed(1)}% from previous period
      </div>
    </div>
  );
}

interface TrendStatisticsProps {
  trends: MetricsTrend[];
  selectedEngines: string[];
}

function TrendStatistics({ trends, selectedEngines }: TrendStatisticsProps) {
  const filteredTrends = trends.filter(t => selectedEngines.includes(t.engine));

  if (filteredTrends.length === 0) {
    return <p className="text-gray-500">No data available for statistics.</p>;
  }

  const calculateStats = (metric: keyof Pick<MetricsTrend, 'domainDiversity' | 'engineOverlap' | 'factualAlignment'>) => {
    const values = filteredTrends.map(t => t[metric]);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length);

    return { avg, min, max, stdDev };
  };

  const domainStats = calculateStats('domainDiversity');
  const overlapStats = calculateStats('engineOverlap');
  const factualStats = calculateStats('factualAlignment');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard title="Domain Diversity" stats={domainStats} />
      <StatCard title="Engine Overlap" stats={overlapStats} />
      <StatCard title="Factual Alignment" stats={factualStats} />
    </div>
  );
}

interface StatCardProps {
  title: string;
  stats: {
    avg: number;
    min: number;
    max: number;
    stdDev: number;
  };
}

function StatCard({ title, stats }: StatCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3">{title}</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Average:</span>
          <span className="font-medium">{(stats.avg * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Range:</span>
          <span className="font-medium">
            {(stats.min * 100).toFixed(1)}% - {(stats.max * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Std Dev:</span>
          <span className="font-medium">{(stats.stdDev * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

interface TrendInsightsProps {
  trends: MetricsTrend[];
  selectedEngines: string[];
}

function TrendInsights({ trends, selectedEngines }: TrendInsightsProps) {
  const filteredTrends = trends.filter(t => selectedEngines.includes(t.engine));

  if (filteredTrends.length === 0) {
    return <p className="text-gray-500">No data available for insights.</p>;
  }

  // Calculate insights
  const enginePerformance = selectedEngines.map(engine => {
    const engineTrends = filteredTrends.filter(t => t.engine === engine);
    const avgDiversity = engineTrends.reduce((sum, t) => sum + t.domainDiversity, 0) / engineTrends.length;
    const avgOverlap = engineTrends.reduce((sum, t) => sum + t.engineOverlap, 0) / engineTrends.length;
    const avgFactual = engineTrends.reduce((sum, t) => sum + t.factualAlignment, 0) / engineTrends.length;

    return {
      engine,
      avgDiversity,
      avgOverlap,
      avgFactual,
      overall: (avgDiversity + avgFactual - avgOverlap) / 2, // Simple composite score
    };
  });

  const bestPerformer = enginePerformance.reduce((best, current) => 
    current.overall > best.overall ? current : best
  );

  const mostDiverse = enginePerformance.reduce((best, current) => 
    current.avgDiversity > best.avgDiversity ? current : best
  );

  const mostFactual = enginePerformance.reduce((best, current) => 
    current.avgFactual > best.avgFactual ? current : best
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">🏆 Best Overall Performance</h4>
        <p className="text-sm text-gray-600 mb-2">
          Based on composite score of diversity, factual alignment, and low overlap
        </p>
        <div className="flex items-center">
          <span className="text-2xl mr-2">
            {bestPerformer.engine === 'google' ? '🔍' : 
             bestPerformer.engine === 'bing' ? '🔎' : 
             bestPerformer.engine === 'perplexity' ? '🤖' : '🦁'}
          </span>
          <span className="font-medium capitalize">{bestPerformer.engine}</span>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">🌐 Most Diverse Sources</h4>
        <p className="text-sm text-gray-600 mb-2">
          Highest average domain diversity score
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-2">
              {mostDiverse.engine === 'google' ? '🔍' : 
               mostDiverse.engine === 'bing' ? '🔎' : 
               mostDiverse.engine === 'perplexity' ? '🤖' : '🦁'}
            </span>
            <span className="font-medium capitalize">{mostDiverse.engine}</span>
          </div>
          <span className="text-sm text-gray-600">
            {(mostDiverse.avgDiversity * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">✅ Most Factually Aligned</h4>
        <p className="text-sm text-gray-600 mb-2">
          Highest average factual consistency score
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl mr-2">
              {mostFactual.engine === 'google' ? '🔍' : 
               mostFactual.engine === 'bing' ? '🔎' : 
               mostFactual.engine === 'perplexity' ? '🤖' : '🦁'}
            </span>
            <span className="font-medium capitalize">{mostFactual.engine}</span>
          </div>
          <span className="text-sm text-gray-600">
            {(mostFactual.avgFactual * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}