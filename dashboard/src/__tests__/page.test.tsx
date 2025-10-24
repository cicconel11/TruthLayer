import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DashboardPage from '@/app/page'

// Mock the real-time updates hook
jest.mock('@/components/RealTimeUpdates', () => ({
  useRealTimeUpdates: jest.fn(() => ({
    lastUpdate: new Date(),
    isConnected: true,
  })),
}))

// Mock chart components
jest.mock('@/components/charts', () => ({
  BiasMetricsChart: ({ data, ...props }: any) => (
    <div data-testid="bias-metrics-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Bias Metrics Chart
    </div>
  ),
  EngineComparisonChart: ({ data, ...props }: any) => (
    <div data-testid="engine-comparison-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Engine Comparison Chart
    </div>
  ),
}))

const mockOverviewData = {
  totalQueries: 1250,
  totalResults: 25000,
  totalAnnotations: 18500,
  lastUpdated: '2024-01-15T10:30:00Z',
  averageDomainDiversity: 0.65,
  averageEngineOverlap: 0.42,
  averageFactualAlignment: 0.78,
}

const mockEngineData = [
  {
    engine: 'google',
    domainDiversity: 0.68,
    factualAlignment: 0.82,
    totalResults: 8500,
  },
  {
    engine: 'bing',
    domainDiversity: 0.62,
    factualAlignment: 0.75,
    totalResults: 7200,
  },
]

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
]

describe('Dashboard Page', () => {
  beforeEach(() => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear()
  })

  it('renders dashboard header and description', async () => {
    // Mock successful API responses
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverviewData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

    render(<DashboardPage />)

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument()
    expect(screen.getByText('Search engine transparency metrics and bias analysis')).toBeInTheDocument()
  })

  it('displays loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))

    render(<DashboardPage />)

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
  })

  it('displays error state when API fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Network error occurred')).toBeInTheDocument()
    })
  })

  it('displays overview metrics when data loads successfully', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverviewData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument() // Total Queries
      expect(screen.getByText('25,000')).toBeInTheDocument() // Total Results
      expect(screen.getByText('18,500')).toBeInTheDocument() // Total Annotations
    })
  })

  it('displays bias metrics with correct percentages', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverviewData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('65.0%')).toBeInTheDocument() // Domain Diversity
      expect(screen.getByText('42.0%')).toBeInTheDocument() // Engine Overlap
      expect(screen.getByText('78.0%')).toBeInTheDocument() // Factual Alignment
    })
  })

  it('renders action buttons with correct links', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverviewData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /view trends/i })).toHaveAttribute('href', '/trends')
      expect(screen.getByRole('link', { name: /compare engines/i })).toHaveAttribute('href', '/engines')
      expect(screen.getByRole('link', { name: /export data/i })).toHaveAttribute('href', '/export')
      expect(screen.getByRole('link', { name: /data explorer/i })).toHaveAttribute('href', '/explore')
    })
  })

  it('handles try again button on error', async () => {
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverviewData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Network error occurred')).toBeInTheDocument()
    })

    const tryAgainButton = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(tryAgainButton)

    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument()
    })
  })

  it('renders charts when data is available', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverviewData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByTestId('bias-metrics-chart')).toBeInTheDocument()
      expect(screen.getByTestId('engine-comparison-chart')).toBeInTheDocument()
    })
  })

  it('displays engine performance grid with correct data', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockOverviewData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('Google')).toBeInTheDocument()
      expect(screen.getByText('Bing')).toBeInTheDocument()
      expect(screen.getByText('68.0%')).toBeInTheDocument() // Google diversity
      expect(screen.getByText('82.0%')).toBeInTheDocument() // Google factual
    })
  })
})