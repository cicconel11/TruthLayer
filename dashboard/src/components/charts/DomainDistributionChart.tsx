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
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { DomainDistribution, BarChartData } from '@/types/dashboard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface DomainDistributionChartProps {
  data: DomainDistribution[];
  type: 'bar' | 'pie';
  engine?: string;
  height?: number;
  responsive?: boolean;
}

export default function DomainDistributionChart({ 
  data, 
  type, 
  engine,
  height = 400,
  responsive = true 
}: DomainDistributionChartProps) {
  const chartRef = useRef<any>(null);

  const domainColors = {
    news: '#EF4444',
    government: '#3B82F6',
    academic: '#10B981',
    blog: '#F59E0B',
    commercial: '#8B5CF6',
    social: '#EC4899',
    other: '#6B7280',
  };

  const prepareBarChartData = (): BarChartData => {
    const filteredData = engine ? data.filter(d => d.engine === engine) : data;
    
    if (engine) {
      // Single engine view
      return {
        labels: filteredData.map(d => d.domainType.charAt(0).toUpperCase() + d.domainType.slice(1)),
        datasets: [{
          label: 'Distribution',
          data: filteredData.map(d => d.percentage),
          backgroundColor: filteredData.map(d => 
            `${domainColors[d.domainType as keyof typeof domainColors] || '#6B7280'}80`
          ),
          borderColor: filteredData.map(d => 
            domainColors[d.domainType as keyof typeof domainColors] || '#6B7280'
          ),
          borderWidth: 2,
        }],
      };
    } else {
      // Multi-engine comparison
      const engines = Array.from(new Set(data.map(d => d.engine)));
      const domainTypes = Array.from(new Set(data.map(d => d.domainType)));

      const datasets = engines.map(eng => {
        const engineData = data.filter(d => d.engine === eng);
        return {
          label: eng.charAt(0).toUpperCase() + eng.slice(1),
          data: domainTypes.map(domain => {
            const domainData = engineData.find(d => d.domainType === domain);
            return domainData ? domainData.percentage : 0;
          }),
          backgroundColor: `${getEngineColor(eng)}80`,
          borderColor: getEngineColor(eng),
          borderWidth: 2,
        };
      });

      return {
        labels: domainTypes.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
        datasets,
      };
    }
  };

  const preparePieData = () => {
    const filteredData = engine ? data.filter(d => d.engine === engine) : data;
    
    if (!engine && data.length > 0) {
      // If no specific engine, aggregate across all engines
      const domainTypes = Array.from(new Set(data.map(d => d.domainType)));
      const aggregatedData = domainTypes.map(domain => {
        const domainEntries = data.filter(d => d.domainType === domain);
        const totalCount = domainEntries.reduce((sum, d) => sum + d.count, 0);
        const totalPercentage = domainEntries.reduce((sum, d) => sum + d.percentage, 0) / domainEntries.length;
        
        return {
          domainType: domain,
          count: totalCount,
          percentage: totalPercentage,
        };
      });

      return {
        labels: aggregatedData.map(d => d.domainType.charAt(0).toUpperCase() + d.domainType.slice(1)),
        datasets: [{
          data: aggregatedData.map(d => d.percentage),
          backgroundColor: aggregatedData.map(d => 
            domainColors[d.domainType as keyof typeof domainColors] || '#6B7280'
          ),
          borderColor: '#ffffff',
          borderWidth: 2,
        }],
      };
    }

    return {
      labels: filteredData.map(d => d.domainType.charAt(0).toUpperCase() + d.domainType.slice(1)),
      datasets: [{
        data: filteredData.map(d => d.percentage),
        backgroundColor: filteredData.map(d => 
          domainColors[d.domainType as keyof typeof domainColors] || '#6B7280'
        ),
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    };
  };

  const getEngineColor = (engine: string) => {
    const engineColors = {
      google: '#4285F4',
      bing: '#00BCF2', 
      perplexity: '#20B2AA',
      brave: '#FB542B',
    };
    return engineColors[engine as keyof typeof engineColors] || '#6B7280';
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
            const label = context.label || '';
            const value = context.parsed?.y !== undefined ? context.parsed.y : context.parsed;
            return `${label}: ${value?.toFixed(1) || 0}%`;
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
          text: 'Domain Type',
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
        grid: {
          display: true,
          color: '#f3f4f6',
        },
      },
    },
  };

  const pieOptions = {
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
          <div className="text-gray-400 text-4xl mb-2">🌐</div>
          <p className="text-gray-500 text-sm">No domain distribution data available</p>
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
    case 'pie':
      return (
        <div style={containerStyle}>
          <Pie 
            ref={chartRef}
            data={preparePieData()} 
            options={pieOptions} 
          />
        </div>
      );
    default:
      return null;
  }
}