import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterPanel from '@/components/FilterPanel'
import { DashboardFilters } from '@/types/dashboard'
import { subDays } from 'date-fns'

const mockFilters: DashboardFilters = {
  dateRange: {
    start: subDays(new Date(), 30),
    end: new Date(),
  },
  engines: ['google', 'bing', 'perplexity', 'brave'],
  categories: [],
  queryText: '',
}

const mockOnFiltersChange = jest.fn()

describe('FilterPanel', () => {
  beforeEach(() => {
    mockOnFiltersChange.mockClear()
  })

  it('renders basic filter panel', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText('Filters')).toBeInTheDocument()
    expect(screen.getByText('Date Range')).toBeInTheDocument()
    expect(screen.getByText('Search Engines')).toBeInTheDocument()
    expect(screen.getByText('Categories')).toBeInTheDocument()
  })

  it('shows active filter count when filters are applied', () => {
    const filtersWithActive: DashboardFilters = {
      ...mockFilters,
      engines: ['google', 'bing'], // Less than 4 engines
      categories: ['health'],
      queryText: 'test query',
    }

    render(
      <FilterPanel
        filters={filtersWithActive}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    expect(screen.getByText('3 active')).toBeInTheDocument()
  })

  it('toggles engine selection correctly', async () => {
    const user = userEvent.setup()

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const googleButton = screen.getByRole('button', { name: /google/i })
    await user.click(googleButton)

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      engines: ['bing', 'perplexity', 'brave'], // Google removed
    })
  })

  it('toggles category selection correctly', async () => {
    const user = userEvent.setup()

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const healthButton = screen.getByRole('button', { name: /health/i })
    await user.click(healthButton)

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      categories: ['health'], // Health added
    })
  })

  it('updates date range when dropdown changes', async () => {
    const user = userEvent.setup()

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const dateSelect = screen.getByDisplayValue('Last 30 days')
    await user.selectOptions(dateSelect, '7')

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockFilters,
        dateRange: expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        }),
      })
    )
  })

  it('shows query filter when enabled', () => {
    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        showQueryFilter={true}
      />
    )

    expect(screen.getByPlaceholderText('Filter by query text...')).toBeInTheDocument()
  })

  it('updates query text filter', async () => {
    const user = userEvent.setup()

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        showQueryFilter={true}
      />
    )

    const queryInput = screen.getByPlaceholderText('Filter by query text...')
    
    // Use fireEvent for more predictable behavior with text inputs
    fireEvent.change(queryInput, { target: { value: 'test query' } })

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      queryText: 'test query',
    })
  })

  it('shows advanced options when enabled', async () => {
    const user = userEvent.setup()

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        showAdvanced={true}
      />
    )

    const moreOptionsButton = screen.getByRole('button', { name: /more options/i })
    await user.click(moreOptionsButton)

    expect(screen.getByText('Custom Date Range')).toBeInTheDocument()
    expect(screen.getByText('Quick Presets')).toBeInTheDocument()
  })

  it('clears all filters when clear button is clicked', async () => {
    const user = userEvent.setup()
    const filtersWithActive: DashboardFilters = {
      ...mockFilters,
      engines: ['google'],
      categories: ['health'],
      queryText: 'test',
    }

    render(
      <FilterPanel
        filters={filtersWithActive}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const clearButton = screen.getByRole('button', { name: /clear all/i })
    await user.click(clearButton)

    expect(mockOnFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dateRange: expect.objectContaining({
          start: expect.any(Date),
          end: expect.any(Date),
        }),
        engines: ['google', 'bing', 'perplexity', 'brave'],
        categories: [],
        queryText: '',
      })
    )
  })

  it('applies quick presets correctly', async () => {
    const user = userEvent.setup()

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        showAdvanced={true}
      />
    )

    // Expand advanced options
    const moreOptionsButton = screen.getByRole('button', { name: /more options/i })
    await user.click(moreOptionsButton)

    // Click health preset
    const healthPreset = screen.getByRole('button', { name: /health: google vs bing/i })
    await user.click(healthPreset)

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      engines: ['google', 'bing'],
      categories: ['health'],
    })
  })

  it('updates custom date range', async () => {
    const user = userEvent.setup()

    render(
      <FilterPanel
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        showAdvanced={true}
      />
    )

    // Expand advanced options
    const moreOptionsButton = screen.getByRole('button', { name: /more options/i })
    await user.click(moreOptionsButton)

    // Update start date - look for date inputs by type
    const dateInputs = screen.getAllByDisplayValue(/2025-/)
    const startDateInput = dateInputs[0] // First date input
    
    // Use fireEvent for date inputs as userEvent has issues with date inputs
    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })

    expect(mockOnFiltersChange).toHaveBeenCalledWith({
      ...mockFilters,
      dateRange: {
        ...mockFilters.dateRange,
        start: new Date('2024-01-01'),
      },
    })
  })

  it('shows correct engine button states', () => {
    const filtersWithSomeEngines: DashboardFilters = {
      ...mockFilters,
      engines: ['google', 'bing'], // Only 2 engines selected
    }

    render(
      <FilterPanel
        filters={filtersWithSomeEngines}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const googleButton = screen.getByRole('button', { name: /google/i })
    const bingButton = screen.getByRole('button', { name: /bing/i })
    const perplexityButton = screen.getByRole('button', { name: /perplexity/i })
    const braveButton = screen.getByRole('button', { name: /brave/i })

    // Selected engines should have primary styling
    expect(googleButton).toHaveClass('bg-primary-600', 'text-white')
    expect(bingButton).toHaveClass('bg-primary-600', 'text-white')
    
    // Unselected engines should have gray styling
    expect(perplexityButton).toHaveClass('bg-gray-200', 'text-gray-700')
    expect(braveButton).toHaveClass('bg-gray-200', 'text-gray-700')
  })

  it('shows correct category button states', () => {
    const filtersWithCategories: DashboardFilters = {
      ...mockFilters,
      categories: ['health', 'politics'],
    }

    render(
      <FilterPanel
        filters={filtersWithCategories}
        onFiltersChange={mockOnFiltersChange}
      />
    )

    const healthButton = screen.getByRole('button', { name: /health/i })
    const politicsButton = screen.getByRole('button', { name: /politics/i })
    const technologyButton = screen.getByRole('button', { name: /technology/i })

    // Selected categories should have green styling
    expect(healthButton).toHaveClass('bg-green-600', 'text-white')
    expect(politicsButton).toHaveClass('bg-green-600', 'text-white')
    
    // Unselected category should have gray styling
    expect(technologyButton).toHaveClass('bg-gray-200', 'text-gray-700')
  })
})