import { render, screen, waitFor } from '@testing-library/react'
import TrendsPage from '@/app/trends/page'
import EnginesPage from '@/app/engines/page'

// Mock the chart components and other dependencies
jest.mock('@/components/charts', () => ({
  TrendAnalysisChart: ({ data, ...props }: any) => (
    <div data-testid="trend-analysis-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Trend Analysis Chart
    </div>
  ),
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

jest.mock('@/components/FilterPanel', () => {
  return function MockFilterPanel({ filters, onFiltersChange }: any) {
    return (
      <div data-testid="filter-panel">
        <button onClick={() => onFiltersChange({ ...filters, engines: ['google'] })}>
          Change Filters
        </button>
      </div>
    )
  }
})

jest.mock('@/components/RealTimeUpdates', () => ({
  useRealTimeUpdates: jest.fn(() => ({
    lastUpdate: new Date(),
    isConnected: true,
  })),
  __esModule: true,
  default: () => <div data-testid="real-time-updates">Real Time Updates</div>,
}))

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

describe('API Integration Tests', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear()
  })

  describe('Trends Page API Integration', () => {
    it('fetches trends data with correct parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })

      render(<TrendsPage />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/trends?')
        )
      })

      // Check that the API call includes expected parameters
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).toContain('days=30')
      expect(fetchCall).toContain('engines=google%2Cbing%2Cperplexity%2Cbrave')
    })

    it('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'))

      render(<TrendsPage />)

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText('Network error occurred')).toBeInTheDocument()
      })
    })

    it('displays data when API call succeeds', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })

      render(<TrendsPage />)

      await waitFor(() => {
        expect(screen.getByText('Trend Analysis')).toBeInTheDocument()
        expect(screen.getByTestId('trend-analysis-chart')).toBeInTheDocument()
      })
    })

    it('refetches data when filters change', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })

      render(<TrendsPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // Simulate filter change
      const filterPanel = screen.getByTestId('filter-panel')
      const changeButton = screen.getByText('Change Filters')
      changeButton.click()

      // Should trigger new API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('handles empty data response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })

      render(<TrendsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('trend-analysis-chart')).toBeInTheDocument()
      })

      // Chart should receive empty data
      const chart = screen.getByTestId('trend-analysis-chart')
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '[]')
      expect(chartData).toEqual([])
    })

    it('handles API response with error flag', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Database connection failed' }),
      })

      render(<TrendsPage />)

      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument()
      })
    })
  })

  describe('Engines Page API Integration', () => {
    it('fetches engine comparison data with correct parameters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

      render(<EnginesPage />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/metrics/engines?')
        )
      })

      // Check that the API call includes date range parameters
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(fetchCall).toContain('start=')
      expect(fetchCall).toContain('end=')
    })

    it('displays engine comparison data', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

      render(<EnginesPage />)

      await waitFor(() => {
        expect(screen.getByText('Engine Comparison')).toBeInTheDocument()
        expect(screen.getByText('Google')).toBeInTheDocument()
        expect(screen.getByText('Bing')).toBeInTheDocument()
      })
    })

    it('displays correct metric values', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

      render(<EnginesPage />)

      await waitFor(() => {
        expect(screen.getByText('68.0%')).toBeInTheDocument() // Google diversity
        expect(screen.getByText('82.0%')).toBeInTheDocument() // Google factual
        expect(screen.getByText('62.0%')).toBeInTheDocument() // Bing diversity
        expect(screen.getByText('75.0%')).toBeInTheDocument() // Bing factual
      })
    })

    it('renders comparison charts', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

      render(<EnginesPage />)

      await waitFor(() => {
        expect(screen.getAllByTestId('engine-comparison-chart')).toHaveLength(2) // Radar and bar charts
      })
    })

    it('includes category filter in API call when selected', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockEngineData }),
      })

      render(<EnginesPage />)

      // Wait for initial load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // The mock filter panel will trigger a filter change
      const changeButton = screen.getByText('Change Filters')
      changeButton.click()

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Real-time Updates Integration', () => {
    it('polls for updates at regular intervals', async () => {
      jest.useFakeTimers()
      
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: { lastUpdate: '2024-01-15T10:30:00Z' } 
        }),
      })

      render(<TrendsPage />)

      // Initial API calls
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length

      // Fast-forward 30 seconds to trigger update polling
      jest.advanceTimersByTime(30000)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/updates/status')
      })

      jest.useRealTimers()
    })

    it('refreshes data when updates are detected', async () => {
      const mockUseRealTimeUpdates = require('@/components/RealTimeUpdates').useRealTimeUpdates
      
      // Mock the hook to simulate an update
      mockUseRealTimeUpdates.mockImplementation((callback: () => void) => {
        // Simulate calling the callback after a delay
        setTimeout(callback, 100)
        return {
          lastUpdate: new Date(),
          isConnected: true,
        }
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockTrendsData }),
      })

      render(<TrendsPage />)

      // Should make initial API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      })

      // Should make additional call due to real-time update callback
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      }, { timeout: 200 })
    })
  })

  describe('Error Handling', () => {
    it('handles network timeouts', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      )

      render(<TrendsPage />)

      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument()
      }, { timeout: 200 })
    })

    it('handles malformed JSON responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => { throw new Error('Invalid JSON') },
      })

      render(<TrendsPage />)

      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument()
      })
    })

    it('handles HTTP error status codes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      render(<TrendsPage />)

      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument()
      })
    })

    it('retries failed requests when user clicks try again', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: mockTrendsData }),
        })

      render(<TrendsPage />)

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText('Network error occurred')).toBeInTheDocument()
      })

      // Click try again
      const tryAgainButton = screen.getByRole('button', { name: /try again/i })
      tryAgainButton.click()

      // Should show success after retry
      await waitFor(() => {
        expect(screen.getByText('Trend Analysis')).toBeInTheDocument()
      })
    })
  })
})