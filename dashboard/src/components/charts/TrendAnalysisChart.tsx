'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { MetricsTrend, TimeSeriesData } from '@/types/dashboard';
import { format, parseISO } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TrendAnalysisChartProps {
  data: MetricsTrend[];
  type: 'line' | 'area' | 'bar';
  metrics: ('domainDiversity' | 'engineOverlap' | 'factualAlignment')[];
  engines?: string[];
  timeRange?: 'week' | 'month' | 'quarter';
  height?: number;
  responsive?: boolean;
  showMovingAverage?: boolean;
}

export default function TrendAnalysisChart({ 
  data, 
  type, 
  metrics,
  engines = ['google', 'bing', 'perplexity', 'brave'],
  timeRange = 'month',
  height = 400,
  responsive = true,
  showMovingAverage = false
}: TrendAnalysisChartProps) {
  const chartRef = useRef<any>(null);

  const engineColors = {
    google: '#4285F4',
    bing: '#00BCF2', 
    perplexity: '#20B2AA',
    brave: '#FB542B',
  };

  const metricColors = {
    domainDiversity: '#10B981',
    engineOverlap: '#F59E0B',
    factualAlignment: '#8B5CF6',
  };

  const calculateMovingAverage = (values: number[], window: number = 7): number[] => {
    return values.map((_, index) => {
      if (index < window - 1) return 0;
      
      const slice = values.slice(index - window + 1, index + 1);
      const validValues = slice.filter(v => v > 0);
      
      if (validValues.length === 0) return 0;
      return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    });
  };

  const prepareMultiMetricData = (): TimeSeriesData => {
    const filteredData = data.filter(d => engines.includes(d.engine));
    const uniqueDates = Array.from(new Set(filteredData.map(d => d.date))).sort();
    
    const datasets: any[] = [];

    // Add datasets for each metric across all engines (averaged)
    metrics.forEach(metric => {
      const metricData = uniqueDates.map(date => {
        const dayData = filteredData.filter(d => d.date === date);
        if (dayData.length === 0) return 0;
        
        const average = dayData.reduce((sum, d) => sum + d[metric], 0) / dayData.length;
        return average * 100;
      });

      datasets.push({
        label: getMetricLabel(metric),
        data: metricData,
        borderColor: metricColors[metric],
        backgroundColor: type === 'area' ? `${metricColors[metric]}20` : 'transparent',
        fill: type === 'area',
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      });

      // Add moving average if requested
      if (showMovingAverage) {
        const movingAvg = calculateMovingAverage(metricData);
        datasets.push({
          label: `${getMetricLabel(metric)} (7-day avg)`,
          data: movingAvg,
          borderColor: metricColors[metric],
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 3,
        });
      }
    });

    return {
      labels: uniqueDates.map(date => formatDateLabel(date, timeRange)),
      datasets,
    };
  };

  const prepareEngineComparisonData = (): TimeSeriesData => {
    const filteredData = data.filter(d => engines.includes(d.engine));
    const uniqueDates = Array.from(new Set(filteredData.map(d => d.date))).sort();
    const primaryMetric = metrics[0]; // Use first metric for engine comparison
    
    const datasets = engines.map(engine => {
      const engineData = filteredData.filter(d => d.engine === engine);
      const chartData = uniqueDates.map(date => {
        const trend = engineData.find(d => d.date === date);
        return trend ? trend[primaryMetric] * 100 : 0;
      });

      const baseDataset = {
        label: engine.charAt(0).toUpperCase() + engine.slice(1),
        data: chartData,
        borderColor: engineColors[engine as keyof typeof engineColors] || '#6B7280',
        backgroundColor: type === 'area' 
          ? `${engineColors[engine as keyof typeof engineColors] || '#6B7280'}20` 
          : 'transparent',
        fill: type === 'area',
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      };

      return baseDataset;
    });

    return {
      labels: uniqueDates.map(date => formatDateLabel(date, timeRange)),
      datasets,
    };
  };

  const prepareBarData = () => {
    // For bar charts, show recent averages
    const filteredData = data.filter(d => engines.includes(d.engine));
    const recentData = filteredData.slice(-engines.length * 7); // Last week of data
    
    if (metrics.length === 1) {
      // Single metric, compare engines
      const engineAverages = engines.map(engine => {
        const engineData = recentData.filter(d => d.engine === engine);
        const average = engineData.length > 0 
          ? engineData.reduce((sum, d) => sum + d[metrics[0]], 0) / engineData.length 
          : 0;
        return average * 100;
      });

      return {
        labels: engines.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
        datasets: [{
          label: getMetricLabel(metrics[0]),
          data: engineAverages,
          backgroundColor: engines.map(engine => 
            `${engineColors[engine as keyof typeof engineColors] || '#6B7280'}80`
          ),
          borderColor: engines.map(engine => 
            engineColors[engine as keyof typeof engineColors] || '#6B7280'
          ),
          borderWidth: 2,
        }],
      };
    } else {
      // Multiple metrics, show average across engines
      const metricAverages = metrics.map(metric => {
        const average = recentData.length > 0 
          ? recentData.reduce((sum, d) => sum + d[metric], 0) / recentData.length 
          : 0;
        return average * 100;
      });

      return {
        labels: metrics.map(m => getMetricLabel(m)),
        datasets: [{
          label: 'Average Across Engines',
          data: metricAverages,
          backgroundColor: metrics.map(metric => 
            `${metricColors[metric]}80`
          ),
          borderColor: metrics.map(metric => metricColors[metric]),
          borderWidth: 2,
        }],
      };
    }
  };

  const formatDateLabel = (date: string, range: string) => {
    const d = parseISO(date);
    switch (range) {
      case 'week':
        return format(d, 'EEE');
      case 'month':
        return format(d, 'MMM dd');
      case 'quarter':
        return format(d, 'MMM yyyy');
      default:
        return format(d, 'MMM dd');
    }
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'domainDiversity': return 'Domain Diversity';
      case 'engineOverlap': return 'Engine Overlap';
      case 'factualAlignment': return 'Factual Alignment';
      default: return metric;
    }
  };

  const commonOptions = {
    responsive,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y?.toFixed(1) || 0}%`;
          }
        }
      },
    },
  };

  const lineOptions = {
    ...commonOptions,
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time Period',
        },
        grid: {
          display: true,
          color: '#f3f4f6',
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
        grid: {
          display: true,
          color: '#f3f4f6',
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  const barOptions = {
    ...commonOptions,
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
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
        grid: {
          display: true,
          color: '#f3f4f6',
        },
      },
    },
  };

  // Handle chart resize on window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-2">📈</div>
          <p className="text-gray-500 text-sm">No trend data available</p>
        </div>
      </div>
    );
  }

  const containerStyle = {
    height: responsive ? '100%' : `${height}px`,
    width: '100%',
  };

  const chartData = type === 'bar' 
    ? prepareBarData() 
    : (metrics.length === 1 ? prepareEngineComparisonData() : prepareMultiMetricData());

  switch (type) {
    case 'line':
    case 'area':
      return (
        <div style={containerStyle}>
          <Line 
            ref={chartRef}
            data={chartData} 
            options={lineOptions} 
          />
        </div>
      );
    case 'bar':
      return (
        <div style={containerStyle}>
          <Bar 
            ref={chartRef}
            data={chartData} 
            options={barOptions} 
          />
        </div>
      );
    default:
      return null;
  }
}