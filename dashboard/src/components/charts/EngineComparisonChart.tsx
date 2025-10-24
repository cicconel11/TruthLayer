'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';
import { EngineComparison, BarChartData } from '@/types/dashboard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface EngineComparisonChartProps {
  data: EngineComparison[];
  type: 'bar' | 'radar';
  height?: number;
  responsive?: boolean;
}

export default function EngineComparisonChart({ 
  data, 
  type, 
  height = 400,
  responsive = true 
}: EngineComparisonChartProps) {
  const chartRef = useRef<any>(null);

  const engineColors = {
    google: '#4285F4',
    bing: '#00BCF2', 
    perplexity: '#20B2AA',
    brave: '#FB542B',
  };

  const prepareBarChartData = (): BarChartData => {
    const metrics = ['domainDiversity', 'engineOverlap', 'factualAlignment'];
    const metricLabels = ['Domain Diversity', 'Engine Overlap', 'Factual Alignment'];

    const datasets = data.map(engine => ({
      label: engine.engine.charAt(0).toUpperCase() + engine.engine.slice(1),
      data: metrics.map(metric => engine[metric as keyof EngineComparison] as number * 100),
      backgroundColor: `${engineColors[engine.engine as keyof typeof engineColors] || '#6B7280'}80`,
      borderColor: engineColors[engine.engine as keyof typeof engineColors] || '#6B7280',
      borderWidth: 2,
    }));

    return {
      labels: metricLabels,
      datasets,
    };
  };

  const prepareRadarData = () => {
    const metrics = ['domainDiversity', 'engineOverlap', 'factualAlignment'];
    const metricLabels = ['Domain Diversity', 'Engine Overlap', 'Factual Alignment'];

    const datasets = data.map(engine => ({
      label: engine.engine.charAt(0).toUpperCase() + engine.engine.slice(1),
      data: metrics.map(metric => engine[metric as keyof EngineComparison] as number * 100),
      backgroundColor: `${engineColors[engine.engine as keyof typeof engineColors] || '#6B7280'}20`,
      borderColor: engineColors[engine.engine as keyof typeof engineColors] || '#6B7280',
      borderWidth: 2,
      pointBackgroundColor: engineColors[engine.engine as keyof typeof engineColors] || '#6B7280',
      pointBorderColor: '#ffffff',
      pointHoverBackgroundColor: '#ffffff',
      pointHoverBorderColor: engineColors[engine.engine as keyof typeof engineColors] || '#6B7280',
    }));

    return {
      labels: metricLabels,
      datasets,
    };
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
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y?.toFixed(1) || context.raw?.toFixed(1) || 0}%`;
          }
        }
      },
    },
  };

  const barOptions = {
    ...commonOptions,
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Bias Metrics',
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

  const radarOptions = {
    ...commonOptions,
    scales: {
      r: {
        angleLines: {
          display: true,
          color: '#e5e7eb',
        },
        grid: {
          color: '#e5e7eb',
        },
        pointLabels: {
          font: {
            size: 12,
          },
        },
        ticks: {
          beginAtZero: true,
          min: 0,
          max: 100,
          stepSize: 20,
          callback: function(value: any) {
            return value + '%';
          },
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
          <div className="text-gray-400 text-4xl mb-2">⚖️</div>
          <p className="text-gray-500 text-sm">No comparison data available</p>
        </div>
      </div>
    );
  }

  const containerStyle = {
    height: responsive ? '100%' : `${height}px`,
    width: '100%',
  };

  switch (type) {
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
    case 'radar':
      return (
        <div style={containerStyle}>
          <Radar 
            ref={chartRef}
            data={prepareRadarData()} 
            options={radarOptions} 
          />
        </div>
      );
    default:
      return null;
  }
}