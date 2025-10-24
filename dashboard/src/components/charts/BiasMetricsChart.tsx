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
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { MetricsTrend, EngineComparison, TimeSeriesData, BarChartData } from '@/types/dashboard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BiasMetricsChartProps {
  data: MetricsTrend[];
  type: 'line' | 'bar' | 'doughnut';
  metric: 'domainDiversity' | 'engineOverlap' | 'factualAlignment';
  engines?: string[];
  height?: number;
  responsive?: boolean;
}

export default function BiasMetricsChart({ 
  data, 
  type, 
  metric, 
  engines = ['google', 'bing', 'perplexity', 'brave'],
  height = 400,
  responsive = true 
}: BiasMetricsChartProps) {
  const chartRef = useRef<any>(null);

  const engineColors = {
    google: '#4285F4',
    bing: '#00BCF2', 
    perplexity: '#20B2AA',
    brave: '#FB542B',
  };

  const prepareLineChartData = (): TimeSeriesData => {
    const filteredData = data.filter(d => engines.includes(d.engine));
    const uniqueDates = Array.from(new Set(filteredData.map(d => d.date))).sort();
    
    const datasets = engines.map(engine => {
      const engineData = filteredData.filter(d => d.engine === engine);
      const chartData = uniqueDates.map(date => {
        const trend = engineData.find(d => d.date === date);
        return trend ? trend[metric] * 100 : 0;
      });

      return {
        label: engine.charAt(0).toUpperCase() + engine.slice(1),
        data: chartData,
        borderColor: engineColors[engine as keyof typeof engineColors] || '#6B7280',
        backgroundColor: `${engineColors[engine as keyof typeof engineColors] || '#6B7280'}20`,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    return {
      labels: uniqueDates.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets,
    };
  };

  const prepareBarChartData = (): BarChartData => {
    const filteredData = data.filter(d => engines.includes(d.engine));
    
    // Calculate average for each engine
    const engineAverages = engines.map(engine => {
      const engineData = filteredData.filter(d => d.engine === engine);
      const average = engineData.length > 0 
        ? engineData.reduce((sum, d) => sum + d[metric], 0) / engineData.length 
        : 0;
      return average * 100;
    });

    return {
      labels: engines.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
      datasets: [{
        label: getMetricLabel(metric),
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
  };

  const prepareDoughnutData = () => {
    const filteredData = data.filter(d => engines.includes(d.engine));
    
    // Calculate average for each engine
    const engineAverages = engines.map(engine => {
      const engineData = filteredData.filter(d => d.engine === engine);
      const average = engineData.length > 0 
        ? engineData.reduce((sum, d) => sum + d[metric], 0) / engineData.length 
        : 0;
      return average * 100;
    });

    return {
      labels: engines.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
      datasets: [{
        data: engineAverages,
        backgroundColor: engines.map(engine => 
          engineColors[engine as keyof typeof engineColors] || '#6B7280'
        ),
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    };
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
          text: 'Date',
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
        title: {
          display: true,
          text: 'Search Engine',
        },
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

  const doughnutOptions = {
    ...commonOptions,
    plugins: {
      ...commonOptions.plugins,
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
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
          <div className="text-gray-400 text-4xl mb-2">📊</div>
          <p className="text-gray-500 text-sm">No data available</p>
        </div>
      </div>
    );
  }

  const containerStyle = {
    height: responsive ? '100%' : `${height}px`,
    width: '100%',
  };

  switch (type) {
    case 'line':
      return (
        <div style={containerStyle}>
          <Line 
            ref={chartRef}
            data={prepareLineChartData()} 
            options={lineOptions} 
          />
        </div>
      );
    case 'bar':
      return (
        <div style={containerStyle}>
          <Bar 
            ref={chartRef}
            data={prepareBarChartData()} 
            options={barOptions} 
          />
        </div>
      );
    case 'doughnut':
      return (
        <div style={containerStyle}>
          <Doughnut 
            ref={chartRef}
            data={prepareDoughnutData()} 
            options={doughnutOptions} 
          />
        </div>
      );
    default:
      return null;
  }
}