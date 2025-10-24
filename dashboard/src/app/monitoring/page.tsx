'use client';

import { useEffect, useState } from 'react';
import { useRealTimeUpdates } from '@/components/RealTimeUpdates';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: HealthCheckResult[];
  summary: string;
}

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime?: number;
  metadata?: Record<string, any>;
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  acknowledged?: boolean;
}

interface SystemMetrics {
  timestamp: Date;
  scheduler: {
    totalJobs: number;
    enabledJobs: number;
    activeExecutions: number;
    failureRate: number;
  };
  queue: {
    pending: number;
    running: number;
    throughput: number;
    averageProcessingTime: number;
  };
  collection: {
    successRate: number;
    totalCollected: number;
    errorRate: number;
  };
  annotation: {
    queueSize: number;
    processingRate: number;
    errorRate: number;
  };
}

export default function MonitoringPage() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use real-time updates
  const { lastUpdate, isConnected } = useRealTimeUpdates(() => {
    fetchMonitoringData();
  });

  useEffect(() => {
    fetchMonitoringData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      setLoading(true);
      
      // Fetch system health
      const healthResponse = await fetch('/api/monitoring/health');
      const healthResult = await healthResponse.json();
      
      // Fetch alerts
      const alertsResponse = await fetch('/api/monitoring/alerts');
      const alertsResult = await alertsResponse.json();
      
      // Fetch metrics
      const metricsResponse = await fetch('/api/monitoring/metrics');
      const metricsResult = await metricsResponse.json();
      
      if (healthResult.success) {
        setSystemHealth(healthResult.data);
      }
      
      if (alertsResult.success) {
        setAlerts(alertsResult.data);
      }
      
      if (metricsResult.success) {
        setMetrics(metricsResult.data);
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch monitoring data');
      console.error('Error fetching monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ acknowledgedBy: 'dashboard-user' }),
      });
      
      if (response.ok) {
        setAlerts(alerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true }
            : alert
        ));
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  if (loading && !systemHealth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !systemHealth) {
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
                onClick={fetchMonitoringData}
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">System Monitoring</h2>
          <p className="mt-2 text-gray-600">
            Internal dashboard for tracking collection success rates and system performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* System Health Overview */}
      <SystemHealthCard systemHealth={systemHealth} />

      {/* Active Alerts */}
      <AlertsPanel 
        alerts={alerts.filter(a => !a.acknowledged)} 
        onAcknowledge={acknowledgeAlert}
      />

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CollectionMetricsCard metrics={metrics[0]} />
        <AnnotationMetricsCard metrics={metrics[0]} />
      </div>

      {/* System Components Health */}
      <ComponentsHealthGrid components={systemHealth?.components || []} />

      {/* Recent System Logs */}
      <SystemLogsPanel />
    </div>
  );
}

interface SystemHealthCardProps {
  systemHealth: SystemHealth | null;
}

function SystemHealthCard({ systemHealth }: SystemHealthCardProps) {
  if (!systemHealth) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unhealthy': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
      <div className={`inline-flex items-center px-4 py-2 rounded-lg border ${getStatusColor(systemHealth.status)}`}>
        <span className="text-xl mr-2">{getStatusIcon(systemHealth.status)}</span>
        <div>
          <div className="font-medium capitalize">{systemHealth.status}</div>
          <div className="text-sm">{systemHealth.summary}</div>
        </div>
      </div>
    </div>
  );
}

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
}

function AlertsPanel({ alerts, onAcknowledge }: AlertsPanelProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-700';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Active Alerts</h3>
        <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </div>
      
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <span className="text-4xl mb-2 block">✅</span>
          No active alerts
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <span className="text-xl">{getSeverityIcon(alert.severity)}</span>
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm mt-1">{alert.message}</div>
                    <div className="text-xs mt-2 opacity-75">
                      {new Date(alert.timestamp).toLocaleString()} • {alert.source}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="text-xs px-3 py-1 bg-white bg-opacity-50 rounded hover:bg-opacity-75 transition-colors"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MetricsCardProps {
  metrics: SystemMetrics | undefined;
}

function CollectionMetricsCard({ metrics }: MetricsCardProps) {
  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Performance</h3>
      <div className="space-y-4">
        <MetricRow
          label="Success Rate"
          value={`${(metrics.collection.successRate * 100).toFixed(1)}%`}
          status={metrics.collection.successRate > 0.9 ? 'good' : metrics.collection.successRate > 0.7 ? 'warning' : 'error'}
        />
        <MetricRow
          label="Total Collected"
          value={metrics.collection.totalCollected.toLocaleString()}
          status="neutral"
        />
        <MetricRow
          label="Error Rate"
          value={`${(metrics.collection.errorRate * 100).toFixed(1)}%`}
          status={metrics.collection.errorRate < 0.1 ? 'good' : metrics.collection.errorRate < 0.2 ? 'warning' : 'error'}
        />
        <MetricRow
          label="Queue Throughput"
          value={`${metrics.queue.throughput}/min`}
          status="neutral"
        />
      </div>
    </div>
  );
}

function AnnotationMetricsCard({ metrics }: MetricsCardProps) {
  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Annotation Performance</h3>
      <div className="space-y-4">
        <MetricRow
          label="Queue Size"
          value={metrics.annotation.queueSize.toLocaleString()}
          status={metrics.annotation.queueSize < 100 ? 'good' : metrics.annotation.queueSize < 500 ? 'warning' : 'error'}
        />
        <MetricRow
          label="Processing Rate"
          value={`${metrics.annotation.processingRate}/min`}
          status="neutral"
        />
        <MetricRow
          label="Error Rate"
          value={`${(metrics.annotation.errorRate * 100).toFixed(1)}%`}
          status={metrics.annotation.errorRate < 0.05 ? 'good' : metrics.annotation.errorRate < 0.1 ? 'warning' : 'error'}
        />
        <MetricRow
          label="Avg Processing Time"
          value={`${metrics.queue.averageProcessingTime}s`}
          status="neutral"
        />
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'error' | 'neutral';
}

function MetricRow({ label, value, status }: MetricRowProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}:</span>
      <span className={`font-medium ${getStatusColor(status)}`}>{value}</span>
    </div>
  );
}

interface ComponentsHealthGridProps {
  components: HealthCheckResult[];
}

function ComponentsHealthGrid({ components }: ComponentsHealthGridProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200 text-green-800';
      case 'degraded': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'unhealthy': return 'bg-red-50 border-red-200 text-red-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Health</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {components.map((component) => (
          <div
            key={component.component}
            className={`border rounded-lg p-4 ${getStatusColor(component.status)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium capitalize">{component.component}</span>
              <span className="text-xl">{getStatusIcon(component.status)}</span>
            </div>
            {component.message && (
              <div className="text-sm mb-2">{component.message}</div>
            )}
            {component.responseTime && (
              <div className="text-xs">Response: {component.responseTime}ms</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/monitoring/logs?limit=10');
        const result = await response.json();
        if (result.success) {
          setLogs(result.data);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'text-red-600';
      case 'warn': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      case 'debug': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent System Logs</h3>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse flex space-x-3">
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
              <div className="flex-1 h-4 bg-gray-200 rounded"></div>
              <div className="w-24 h-4 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div key={index} className="flex items-start space-x-3 text-sm">
              <span className={`font-medium w-16 ${getLevelColor(log.level)}`}>
                {log.level}
              </span>
              <span className="flex-1 text-gray-900">{log.message}</span>
              <span className="text-gray-500 w-24 text-xs">
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}