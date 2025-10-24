import { render, screen, waitFor, act } from '@testing-library/react'
import RealTimeUpdates, { useRealTimeUpdates } from '../../components/RealTimeUpdates'

// Mock timers
jest.useFakeTimers()

const mockUpdateData = {
  lastUpdate: '2024-01-15T10:30:00Z',
  type: 'collection',
  message: 'Completed data collection for 50 health queries',
}

describe('RealTimeUpdates Component', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear()
    jest.clearAllTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
  })

  it('renders with connection status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUpdateData }),
    })

    render(<RealTimeUpdates />)

    await waitFor(() => {
      expect(screen.getByText('Real-time Updates')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
  })

  it('shows minimal view when showNotifications is false', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUpdateData }),
    })

    render(<RealTimeUpdates showNotifications={false} />)

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument()
      expect(screen.queryByText('Real-time Updates')).not.toBeInTheDocument()
    })
  })

  it('displays recent updates when data is available', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUpdateData }),
    })

    render(<RealTimeUpdates />)

    // Fast-forward to trigger initial poll
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(screen.getByText('Completed data collection for 50 health queries')).toBeInTheDocument()
      expect(screen.getByText('📊')).toBeInTheDocument() // Collection icon
    })
  })

  it('shows empty state when no updates available', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: null }),
    })

    render(<RealTimeUpdates />)

    await waitFor(() => {
      expect(screen.getByText('No recent updates')).toBeInTheDocument()
    })
  })

  it('polls for updates at regular intervals', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUpdateData }),
    })

    render(<RealTimeUpdates />)

    // Initial call
    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Fast-forward 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    // Should have made another call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('calls onDataUpdate callback when new data arrives', async () => {
    const mockCallback = jest.fn()
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockUpdateData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: {
            ...mockUpdateData,
            lastUpdate: '2024-01-15T10:35:00Z', // Newer timestamp
            message: 'New update message',
          }
        }),
      })

    render(<RealTimeUpdates onDataUpdate={mockCallback} />)

    // Wait for initial load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Fast-forward to next poll
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    // Should call callback for new data
    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled()
    })
  })

  it('displays correct icons for different update types', async () => {
    const updates = [
      { ...mockUpdateData, type: 'collection', message: 'Collection update' },
      { ...mockUpdateData, type: 'annotation', message: 'Annotation update' },
      { ...mockUpdateData, type: 'metrics', message: 'Metrics update' },
      { ...mockUpdateData, type: 'error', message: 'Error update' },
    ]

    let callCount = 0
    ;(global.fetch as jest.Mock).mockImplementation(() => {
      const update = updates[callCount % updates.length]
      callCount++
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: update }),
      })
    })

    render(<RealTimeUpdates />)

    // Let multiple polls happen
    for (let i = 0; i < updates.length; i++) {
      act(() => {
        jest.advanceTimersByTime(30000)
      })
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(i + 2) // +1 for initial call
      })
    }

    // Check that different icons are displayed
    await waitFor(() => {
      expect(screen.getByText('📊')).toBeInTheDocument() // Collection
      expect(screen.getByText('🤖')).toBeInTheDocument() // Annotation
      expect(screen.getByText('📈')).toBeInTheDocument() // Metrics
      expect(screen.getByText('⚠️')).toBeInTheDocument() // Error
    })
  })

  it('handles fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<RealTimeUpdates />)

    // Should not crash and should continue polling
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('shows last update time in footer', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUpdateData }),
    })

    render(<RealTimeUpdates />)

    await waitFor(() => {
      expect(screen.getByText(/Last update:/)).toBeInTheDocument()
      expect(screen.getByText('Auto-refresh every 30s')).toBeInTheDocument()
    })
  })
})

describe('useRealTimeUpdates Hook', () => {
  let TestComponent: React.FC<{ callback?: () => void }>

  beforeEach(() => {
    TestComponent = ({ callback }) => {
      const { lastUpdate, isConnected, refresh } = useRealTimeUpdates(callback)
      return (
        <div>
          <div data-testid="connected">{isConnected ? 'connected' : 'disconnected'}</div>
          <div data-testid="last-update">{lastUpdate?.toISOString() || 'none'}</div>
          <button onClick={refresh} data-testid="refresh">Refresh</button>
        </div>
      )
    }
    
    ;(global.fetch as jest.Mock).mockClear()
    jest.clearAllTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
  })

  it('returns connection status and last update', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUpdateData }),
    })

    render(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('connected')
      expect(screen.getByTestId('last-update')).toHaveTextContent('2024-01-15T10:30:00.000Z')
    })
  })

  it('calls callback when new data arrives', async () => {
    const mockCallback = jest.fn()
    
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockUpdateData }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: {
            ...mockUpdateData,
            lastUpdate: '2024-01-15T10:35:00Z',
          }
        }),
      })

    render(<TestComponent callback={mockCallback} />)

    // Wait for initial load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Fast-forward to next poll
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalled()
    })
  })

  it('handles manual refresh', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockUpdateData }),
    })

    render(<TestComponent />)

    // Wait for initial load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    // Click refresh button
    const refreshButton = screen.getByTestId('refresh')
    act(() => {
      refreshButton.click()
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('sets disconnected status on fetch error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByTestId('connected')).toHaveTextContent('disconnected')
    })
  })
})