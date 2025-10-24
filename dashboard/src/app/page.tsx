'use client';

import { useEffect, useState } from 'react';
import { MetricsOverview, ApiResponse, MetricsTrend, EngineComparison } from '@/types/dashboard';
import { useRealTimeUpdates } from '@/components/RealTimeUpdates';
import { BiasMetricsChart, EngineComparisonChart } from '@/components/charts';

export default function DashboardPage() {
  const [overview, setOverview] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use real-time updates
  const { lastUpdate, isConnected } = useRealTimeUpdates(() => {
    fetchOverview();
  });

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/metrics/overview');
      const result: ApiResponse<MetricsOverview> = await response.json();
      
      if (result.success && result.data) {
        setOverview(result.data);
      } else {
        setError(result.error || 'Failed to fetch overview data');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching overview:', err);
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
                onClick={fetchOverview}
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

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="mt-2 text-gray-600">
          Search engine transparency metrics and bias analysis
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Queries"
          value={overview.totalQueries.toLocaleString()}
          description="Benchmark queries executed"
          color="blue"
        />
        <MetricCard
          title="Search Results"
          value={overview.totalResults.toLocaleString()}
          description="Results collected across engines"
          color="green"
        />
        <MetricCard
          title="Annotations"
          value={overview.totalAnnotations.toLocaleString()}
          description="LLM-powered classifications"
          color="purple"
        />
        <MetricCard
          title="Last Updated"
          value={new Date(overview.lastUpdated).toLocaleDateString()}
          description="Most recent data collection"
          color="gray"
        />
      </div>

      {/* Bias Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bias Metrics Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BiasMetricCard
            title="Domain Diversity"
            value={overview.averageDomainDiversity}
            description="Average unique sources per query"
            maxValue={1}
          />
          <BiasMetricCard
            title="Engine Overlap"
            value={overview.averageEngineOverlap}
            description="Shared results across engines"
            maxValue={1}
          />
          <BiasMetricCard
            title="Factual Alignment"
            value={overview.averageFactualAlignment}
            description="Average factual consistency score"
            maxValue={1}
          />
        </div>
      </div>

      {/* Engine Performance Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Engine Performance Overview</h3>
        <EnginePerformanceGrid />
      </div>

      {/* Quick Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Trends</h3>
          <QuickTrendsChart />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Engine Comparison</h3>
          <QuickComparisonChart />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <RecentActivityFeed />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionButton
            href="/trends"
            title="View Trends"
            description="Analyze bias metrics over time"
            icon="📈"
          />
          <ActionButton
            href="/engines"
            title="Compare Engines"
            description="Side-by-side engine analysis"
            icon="⚖️"
          />
          <ActionButton
            href="/export"
            title="Export Data"
            description="Download datasets for analysis"
            icon="📊"
          />
          <ActionButton
            href="/explore"
            title="Data Explorer"
            description="Interactive filtering and analysis"
            icon="🔍"
          />
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  color: 'blue' | 'green' | 'purple' | 'gray';
}

function MetricCard({ title, value, description, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{title}</div>
      <div className="text-xs mt-2 opacity-75">{description}</div>
    </div>
  );
}

interface BiasMetricCardProps {
  title: string;
  value: number;
  description: string;
  maxValue: number;
}

function BiasMetricCard({ title, value, description, maxValue }: BiasMetricCardProps) {
  const percentage = (value / maxValue) * 100;
  
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">
        {(value * 100).toFixed(1)}%
      </div>
      <div className="text-sm font-medium text-gray-700 mt-1">{title}</div>
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-2">{description}</div>
    </div>
  );
}

interface ActionButtonProps {
  href: string;
  title: string;
  description: string;
  icon: string;
}

function ActionButton({ href, title, description, icon }: ActionButtonProps) {
  return (
    <a
      href={href}
      className="block p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-center">
        <span className="text-2xl mr-3">{icon}</span>
        <div>
          <div className="font-medium text-gray-900">{title}</div>
          <div className="text-sm text-gray-500">{description}</div>
        </div>
      </div>
    </a>
  );
}

function EnginePerformanceGrid() {
  const [engines, setEngines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEngines = async () => {
      try {
        const response = await fetch('/api/metrics/engines');
        const result = await response.json();
        if (result.success && result.data) {
          setEngines(result.data.slice(0, 4)); // Show top 4 engines
        }
      } catch (error) {
        console.error('Error fetching engine data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEngines();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-24"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {engines.map((engine) => (
        <div key={engine.engine} className="border rounded-lg p-4">
          <div className="flex items-center mb-2">
            <span className="text-xl mr-2">
              {engine.engine === 'google' ? '🔍' : 
               engine.engine === 'bing' ? '🔎' : 
               engine.engine === 'perplexity' ? '🤖' : '🦁'}
            </span>
            <span className="font-medium capitalize">{engine.engine}</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Diversity:</span>
              <span className="font-medium">{(engine.domainDiversity * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Factual:</span>
              <span className="font-medium">{(engine.factualAlignment * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Results:</span>
              <span className="font-medium">{engine.totalResults.toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate recent activity data
    const mockActivities = [
      {
        id: 1,
        type: 'collection',
        message: 'Completed data collection for 50 health queries',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        status: 'success'
      },
      {
        id: 2,
        type: 'annotation',
        message: 'Processed 200 search results through LLM annotation',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        status: 'success'
      },
      {
        id: 3,
        type: 'metrics',
        message: 'Updated bias metrics for all engines',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
        status: 'success'
      },
      {
        id: 4,
        type: 'alert',
        message: 'Domain diversity dropped below threshold for Bing',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        status: 'warning'
      }
    ];

    setTimeout(() => {
      setActivities(mockActivities);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'collection': return '📊';
      case 'annotation': return '🤖';
      case 'metrics': return '📈';
      case 'alert': return '⚠️';
      default: return '📋';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start space-x-3">
          <span className="text-xl">{getActivityIcon(activity.type)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">{activity.message}</p>
            <p className={`text-xs ${getStatusColor(activity.status)}`}>
              {activity.timestamp.toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuickTrendsChart() {
  const [trends, setTrends] = useState<MetricsTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const response = await fetch('/api/metrics/trends?days=7');
        const result = await response.json();
        if (result.success && result.data) {
          setTrends(result.data);
        }
      } catch (error) {
        console.error('Error fetching trends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-48">
      <BiasMetricsChart
        data={trends}
        type="line"
        metric="domainDiversity"
        height={192}
        responsive={true}
      />
    </div>
  );
}

function QuickComparisonChart() {
  const [engines, setEngines] = useState<EngineComparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEngines = async () => {
      try {
        const response = await fetch('/api/metrics/engines');
        const result = await response.json();
        if (result.success && result.data) {
          setEngines(result.data);
        }
      } catch (error) {
        console.error('Error fetching engine data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEngines();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-48">
      <EngineComparisonChart
        data={engines}
        type="radar"
        height={192}
        responsive={true}
      />
    </div>
  );
}