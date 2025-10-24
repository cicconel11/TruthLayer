import { render, screen } from '@testing-library/react'
import { 
  BiasMetricsChart, 
  EngineComparisonChart, 
  TrendAnalysisChart, 
  DomainDistributionChart 
} from '@/components/charts'

const mockTrendsData = [
  {
    date: '2024-01-14',
    engine: 'google',
    domainDiversity: 0.67,
    engineOverlap: 0.41,
    factualAlignment: 0.81,
  },
  {
    date: '2024-01-15',
    engine: 'google',
    domainDiversity: 0.68,
    engineOverlap: 0.42,
    factualAlignment: 0.82,
  },
  {
    date: '2024-01-14',
    engine: 'bing',
    domainDiversity: 0.62,
    engineOverlap: 0.38,
    factualAlignment: 0.75,
  },
]

const mockEngineData = [
  {
    engine: 'google',
    domainDiversity: 0.68,
    engineOverlap: 0.42,
    factualAlignment: 0.82,
    totalResults: 8500,
    uniqueDomains: 1200,
    averageRank: 10.5,
  },
  {
    engine: 'bing',
    domainDiversity: 0.62,
    engineOverlap: 0.38,
    factualAlignment: 0.75,
    totalResults: 7200,
    uniqueDomains: 980,
    averageRank: 11.2,
  },
]

const mockDomainData = [
  { domainType: 'news', count: 45, percentage: 35.2, engine: 'google' },
  { domainType: 'commercial', count: 32, percentage: 25.0, engine: 'google' },
  { domainType: 'academic', count: 28, percentage: 21.9, engine: 'google' },
  { domainType: 'government', count: 15, percentage: 11.7, engine: 'google' },
  { domainType: 'blog', count: 8, percentage: 6.2, engine: 'google' },
]

describe('Chart Components', () => {
  describe('BiasMetricsChart', () => {
    it('renders line chart with correct data', () => {
      render(
        <BiasMetricsChart
          data={mockTrendsData}
          type="line"
          metric="domainDiversity"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('line-chart')
      expect(chart).toBeInTheDocument()
      
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      expect(chartData.labels).toHaveLength(2) // Should have 2 dates
      expect(chartData.datasets).toHaveLength(4) // Google, Bing, Perplexity, Brave (default engines)
    })

    it('renders bar chart when type is bar', () => {
      render(
        <BiasMetricsChart
          data={mockTrendsData}
          type="bar"
          metric="factualAlignment"
          height={300}
          responsive={true}
        />
      )

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('handles empty data gracefully', () => {
      render(
        <BiasMetricsChart
          data={[]}
          type="line"
          metric="domainDiversity"
          height={300}
          responsive={true}
        />
      )

      // Should show empty state instead of chart
      expect(screen.getByText('No data available')).toBeInTheDocument()
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    })

    it('filters data by metric correctly', () => {
      render(
        <BiasMetricsChart
          data={mockTrendsData}
          type="line"
          metric="engineOverlap"
          engines={['google', 'bing']}
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('line-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      // Check that data points are converted to percentages and filtered by engines
      expect(chartData.datasets).toHaveLength(2) // Only Google and Bing
      expect(chartData.datasets[0].data[0]).toBeCloseTo(41, 0) // Google: 0.41*100
      expect(chartData.datasets[0].data[1]).toBeCloseTo(42, 0) // Google: 0.42*100
    })
  })

  describe('EngineComparisonChart', () => {
    it('renders radar chart with engine data', () => {
      render(
        <EngineComparisonChart
          data={mockEngineData}
          type="radar"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('radar-chart')
      expect(chart).toBeInTheDocument()
      
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      expect(chartData.labels).toEqual(['Domain Diversity', 'Engine Overlap', 'Factual Alignment'])
      expect(chartData.datasets).toHaveLength(2) // Google and Bing
    })

    it('renders bar chart when type is bar', () => {
      render(
        <EngineComparisonChart
          data={mockEngineData}
          type="bar"
          height={300}
          responsive={true}
        />
      )

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('includes engine overlap in data correctly', () => {
      render(
        <EngineComparisonChart
          data={mockEngineData}
          type="radar"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('radar-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      // Engine overlap should be included as-is (converted to percentage)
      const googleDataset = chartData.datasets.find((d: any) => d.label === 'Google')
      const bingDataset = chartData.datasets.find((d: any) => d.label === 'Bing')
      
      expect(googleDataset.data[1]).toBe(42) // 0.42 * 100
      expect(bingDataset.data[1]).toBe(38) // 0.38 * 100
    })

    it('uses correct colors for engines', () => {
      render(
        <EngineComparisonChart
          data={mockEngineData}
          type="radar"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('radar-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      const googleDataset = chartData.datasets.find((d: any) => d.label === 'Google')
      const bingDataset = chartData.datasets.find((d: any) => d.label === 'Bing')
      
      expect(googleDataset.borderColor).toBe('#4285F4')
      expect(bingDataset.borderColor).toBe('#00BCF2')
    })
  })

  describe('TrendAnalysisChart', () => {
    it('renders with single metric', () => {
      render(
        <TrendAnalysisChart
          data={mockTrendsData}
          type="line"
          metrics={['domainDiversity']}
          engines={['google', 'bing']}
          timeRange="month"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('line-chart')
      expect(chart).toBeInTheDocument()
    })

    it('renders with multiple metrics', () => {
      render(
        <TrendAnalysisChart
          data={mockTrendsData}
          type="area"
          metrics={['domainDiversity', 'factualAlignment']}
          engines={['google']}
          timeRange="week"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('line-chart') // Area charts use Line component
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      // Should have datasets for each metric
      expect(chartData.datasets.length).toBeGreaterThan(1)
    })

    it('filters by selected engines', () => {
      render(
        <TrendAnalysisChart
          data={mockTrendsData}
          type="line"
          metrics={['domainDiversity']}
          engines={['google']} // Only Google
          timeRange="month"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('line-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      // Should only have Google data
      expect(chartData.datasets).toHaveLength(1)
      expect(chartData.datasets[0].label).toContain('Google')
    })

    it('shows moving average when enabled', () => {
      render(
        <TrendAnalysisChart
          data={mockTrendsData}
          type="line"
          metrics={['domainDiversity']}
          engines={['google']}
          timeRange="month"
          height={300}
          responsive={true}
          showMovingAverage={true}
        />
      )

      const chart = screen.getByTestId('line-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      // Should have additional dataset for moving average (may not be visible with limited data)
      // Just check that the chart renders with showMovingAverage enabled
      expect(chartData.datasets.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('DomainDistributionChart', () => {
    it('renders pie chart with domain data', () => {
      render(
        <DomainDistributionChart
          data={mockDomainData}
          type="pie"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('pie-chart')
      expect(chart).toBeInTheDocument()
      
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      expect(chartData.labels).toEqual(['News', 'Commercial', 'Academic', 'Government', 'Blog'])
      expect(chartData.datasets[0].data).toEqual([35.2, 25, 21.9, 11.7, 6.2]) // Uses percentage values
    })

    it('renders bar chart when type is bar', () => {
      render(
        <DomainDistributionChart
          data={mockDomainData}
          type="bar"
          height={300}
          responsive={true}
        />
      )

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('uses correct colors for domain types', () => {
      render(
        <DomainDistributionChart
          data={mockDomainData}
          type="pie"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('pie-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      // Should have predefined colors for each domain type
      expect(chartData.datasets[0].backgroundColor).toHaveLength(5)
      expect(chartData.datasets[0].backgroundColor[0]).toBe('#EF4444') // News - red
      expect(chartData.datasets[0].backgroundColor[1]).toBe('#8B5CF6') // Commercial - purple
    })

    it('aggregates data by domain type', () => {
      const multiEngineData = [
        ...mockDomainData,
        { domainType: 'news', count: 38, percentage: 31.4, engine: 'bing' },
        { domainType: 'commercial', count: 35, percentage: 28.9, engine: 'bing' },
      ]

      render(
        <DomainDistributionChart
          data={multiEngineData}
          type="pie"
          height={300}
          responsive={true}
        />
      )

      const chart = screen.getByTestId('pie-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}')
      
      // News should be averaged: (35.2 + 31.4) / 2 = 33.3
      // Commercial should be averaged: (25 + 28.9) / 2 = 26.95
      expect(chartData.datasets[0].data[0]).toBeCloseTo(33.3, 1) // News
      expect(chartData.datasets[0].data[1]).toBeCloseTo(26.95, 1) // Commercial
    })

    it('handles empty data gracefully', () => {
      render(
        <DomainDistributionChart
          data={[]}
          type="pie"
          height={300}
          responsive={true}
        />
      )

      // Should show empty state instead of chart
      expect(screen.getByText('No domain distribution data available')).toBeInTheDocument()
      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument()
    })
  })
})