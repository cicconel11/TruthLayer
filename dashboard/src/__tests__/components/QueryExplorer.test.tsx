import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QueryExplorer from '../../components/QueryExplorer'
import { DashboardFilters } from '../../types/dashboard'
import { subDays } from 'date-fns'

const mockFilters: DashboardFilters = {
  dateRange: {
    start: subDays(new Date(), 30),
    end: new Date(),
  },
  engines: ['google', 'bing', 'perplexity', 'brave'],
  categories: [],
}

const mockQueryData = [
  {
    queryId: 'q1',
    queryText: 'covid vaccine safety',
    category: 'health',
    collectedAt: new Date('2024-01-15T10:00:00Z'),
    totalResults: 80,
    engines: [
      {
        engine: 'google',
        totalResults: 20,
        uniqueDomains: 15,
        domainDiversity: 0.75,
        factualAlignment: 0.82,
        averageRank: 10.5,
      },
      {
        engine: 'bing',
        totalResults: 20,
        uniqueDomains: 12,
        domainDiversity: 0.60,
        factualAlignment: 0.78,
        averageRank: 11.2,
      },
    ],
  },
  {
    queryId: 'q2',
    queryText: 'climate change policy',
    category: 'politics',
    collectedAt: new Date('2024-01-14T15:30:00Z'),
    totalResults: 60,
    engines: [
      {
        engine: 'google',
        totalResults: 20,
        uniqueDomains: 18,
        domainDiversity: 0.90,
        factualAlignment: 0.85,
        averageRank: 9.8,
      },
    ],
  },
]

describe('QueryExplorer', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear()
  })

  it('renders loading state initially', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))

    render(<QueryExplorer filters={mockFilters} />)

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('displays error state when API fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Network error occurred')).toBeInTheDocument()
    })
  })

  it('displays query list when data loads successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('Query Analysis (2 queries)')).toBeInTheDocument()
      expect(screen.getByText('"covid vaccine safety"')).toBeInTheDocument()
      expect(screen.getByText('"climate change policy"')).toBeInTheDocument()
    })
  })

  it('shows correct query metadata', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('health')).toBeInTheDocument()
      expect(screen.getByText('politics')).toBeInTheDocument()
      expect(screen.getByText('80 results')).toBeInTheDocument()
      expect(screen.getByText('60 results')).toBeInTheDocument()
    })
  })

  it('displays correct diversity and factual percentages', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      // First query: (0.75 + 0.60) / 2 = 0.675 = 67.5%
      expect(screen.getByText('67.5%')).toBeInTheDocument()
      // First query: (0.82 + 0.78) / 2 = 0.80 = 80.0%
      expect(screen.getByText('80.0%')).toBeInTheDocument()
      // Second query: 0.90 = 90.0%
      expect(screen.getByText('90.0%')).toBeInTheDocument()
      // Second query: 0.85 = 85.0%
      expect(screen.getByText('85.0%')).toBeInTheDocument()
    })
  })

  it('handles sorting by different columns', async () => {
    const user = userEvent.setup()
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('Query Analysis (2 queries)')).toBeInTheDocument()
    })

    // Click on Results sort button
    const resultsSort = screen.getByRole('button', { name: /results/i })
    await user.click(resultsSort)

    // Should make new API call with sort parameters
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('sortBy=results&sortOrder=desc')
    )
  })

  it('expands query details when clicked', async () => {
    const user = userEvent
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('"covid vaccine safety"')).toBeInTheDocument()
    })

    // Click on first query row
    const queryRow = screen.getByText('"covid vaccine safety"').closest('div')
    if (queryRow) {
      await user.click(queryRow)
    }

    // Should show query details
    await waitFor(() => {
      expect(screen.getByText('Query Details: "covid vaccine safety"')).toBeInTheDocument()
      expect(screen.getByText('Google')).toBeInTheDocument()
      expect(screen.getByText('Bing')).toBeInTheDocument()
    })
  })

  it('shows engine details in expanded view', async () => {
    const user = userEvent
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('"covid vaccine safety"')).toBeInTheDocument()
    })

    // Click on first query row
    const queryRow = screen.getByText('"covid vaccine safety"').closest('div')
    if (queryRow) {
      await user.click(queryRow)
    }

    await waitFor(() => {
      // Check Google engine details
      expect(screen.getByText('15')).toBeInTheDocument() // Unique domains
      expect(screen.getByText('75.0%')).toBeInTheDocument() // Diversity
      expect(screen.getByText('82.0%')).toBeInTheDocument() // Factual
      expect(screen.getByText('10.5')).toBeInTheDocument() // Avg rank
    })
  })

  it('displays insights for selected query', async () => {
    const user = userEvent
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('"covid vaccine safety"')).toBeInTheDocument()
    })

    // Click on first query row
    const queryRow = screen.getByText('"covid vaccine safety"').closest('div')
    if (queryRow) {
      await user.click(queryRow)
    }

    await waitFor(() => {
      expect(screen.getByText('Key Insights')).toBeInTheDocument()
      expect(screen.getByText('🏆 Best Diversity')).toBeInTheDocument()
      expect(screen.getByText('✅ Most Factual')).toBeInTheDocument()
      expect(screen.getByText('📊 Most Results')).toBeInTheDocument()
    })
  })

  it('handles try again button on error', async () => {
    const user = userEvent
    
    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockQueryData }),
      })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('Network error occurred')).toBeInTheDocument()
    })

    const tryAgainButton = screen.getByRole('button', { name: /try again/i })
    await user.click(tryAgainButton)

    await waitFor(() => {
      expect(screen.getByText('Query Analysis (2 queries)')).toBeInTheDocument()
    })
  })

  it('shows empty state when no queries match filters', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('No queries found matching the current filters.')).toBeInTheDocument()
    })
  })

  it('includes query text filter in API call when provided', async () => {
    const filtersWithQuery = {
      ...mockFilters,
      queryText: 'covid',
    }

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    })

    render(<QueryExplorer filters={filtersWithQuery} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('queryText=covid')
      )
    })
  })

  it('includes categories filter in API call when provided', async () => {
    const filtersWithCategories = {
      ...mockFilters,
      categories: ['health', 'politics'],
    }

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    })

    render(<QueryExplorer filters={filtersWithCategories} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('categories=health%2Cpolitics')
      )
    })
  })

  it('toggles sort order when clicking same column twice', async () => {
    const user = userEvent
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockQueryData }),
    })

    render(<QueryExplorer filters={mockFilters} />)

    await waitFor(() => {
      expect(screen.getByText('Query Analysis (2 queries)')).toBeInTheDocument()
    })

    // First click - should sort desc
    const dateSort = screen.getByRole('button', { name: /date/i })
    await user.click(dateSort)

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('sortBy=date&sortOrder=desc')
    )

    // Second click - should sort asc
    await user.click(dateSort)

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('sortBy=date&sortOrder=asc')
    )
  })
})