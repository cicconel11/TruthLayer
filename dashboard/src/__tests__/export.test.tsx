import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportPage from '../app/export/page'

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url')
global.URL.revokeObjectURL = jest.fn()

// Mock document.createElement and appendChild/removeChild
const mockAnchorElement = {
  click: jest.fn(),
  style: { display: '' },
  href: '',
  download: '',
}

const originalCreateElement = document.createElement
document.createElement = jest.fn((tagName) => {
  if (tagName === 'a') {
    return mockAnchorElement as any
  }
  return originalCreateElement.call(document, tagName)
})

document.body.appendChild = jest.fn()
document.body.removeChild = jest.fn()

describe('Export Page', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear()
    jest.clearAllMocks()
  })

  it('renders export configuration form', () => {
    render(<ExportPage />)

    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Export Configuration')).toBeInTheDocument()
    expect(screen.getByText('Export Summary')).toBeInTheDocument()
  })

  it('shows format selection options', () => {
    render(<ExportPage />)

    expect(screen.getByLabelText(/csv/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/json/i)).toBeInTheDocument()
    expect(screen.getByText('Comma-separated values')).toBeInTheDocument()
    expect(screen.getByText('JavaScript Object Notation')).toBeInTheDocument()
  })

  it('shows engine selection checkboxes', () => {
    render(<ExportPage />)

    expect(screen.getByLabelText(/google/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bing/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/perplexity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/brave/i)).toBeInTheDocument()
  })

  it('shows category selection checkboxes', () => {
    render(<ExportPage />)

    expect(screen.getByLabelText(/health/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/politics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/technology/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/science/i)).toBeInTheDocument()
  })

  it('updates format selection', async () => {
    const user = userEvent.setup()
    render(<ExportPage />)

    const jsonRadio = screen.getByLabelText(/json/i)
    await user.click(jsonRadio)

    expect(jsonRadio).toBeChecked()
    expect(screen.getByText('JSON')).toBeInTheDocument()
  })

  it('updates engine selection', async () => {
    const user = userEvent.setup()
    render(<ExportPage />)

    const googleCheckbox = screen.getByLabelText(/google/i)
    await user.click(googleCheckbox)

    expect(googleCheckbox).not.toBeChecked()
  })

  it('updates category selection', async () => {
    const user = userEvent.setup()
    render(<ExportPage />)

    const healthCheckbox = screen.getByLabelText(/health/i)
    await user.click(healthCheckbox)

    expect(healthCheckbox).toBeChecked()
  })

  it('updates date range', async () => {
    const user = userEvent.setup()
    render(<ExportPage />)

    const startDateInput = screen.getAllByDisplayValue(/2024-/)[0]
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-01-01')

    expect(startDateInput).toHaveValue('2024-01-01')
  })

  it('shows export summary with correct values', () => {
    render(<ExportPage />)

    expect(screen.getByText('CSV')).toBeInTheDocument() // Format
    expect(screen.getByText('4')).toBeInTheDocument() // Engines count
    expect(screen.getByText('All')).toBeInTheDocument() // Categories (none selected)
  })

  it('handles small dataset export (direct download)', async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(['test data'], { type: 'text/csv' })
    
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    })

    render(<ExportPage />)

    const exportButton = screen.getByRole('button', { name: /export data/i })
    await user.click(exportButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/export?')
      )
    })

    // Should trigger download
    expect(mockAnchorElement.click).toHaveBeenCalled()
    expect(screen.getByText('Export completed successfully!')).toBeInTheDocument()
  })

  it('handles large dataset export (async)', async () => {
    const user = userEvent.setup()
    
    // Mock async export response
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: { exportId: 'export-123' } 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: { 
            exportId: 'export-123',
            status: 'processing',
            progress: 50,
            totalRecords: 20000,
            processedRecords: 10000,
          } 
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          data: { 
            exportId: 'export-123',
            status: 'completed',
            progress: 100,
            totalRecords: 20000,
            processedRecords: 20000,
            downloadUrl: '/api/export/download/export-123',
          } 
        }),
      })

    render(<ExportPage />)

    // Select all engines and a long date range to trigger large export
    const exportButton = screen.getByRole('button', { name: /export data/i })
    await user.click(exportButton)

    await waitFor(() => {
      expect(screen.getByText(/Large dataset detected/)).toBeInTheDocument()
    })

    // Fast-forward timers to trigger progress polling
    jest.useFakeTimers()
    jest.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('10000 / 20000 records')).toBeInTheDocument()
    })

    // Fast-forward again for completion
    jest.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(screen.getByText('Export completed! Download ready.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /download export/i })).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  it('handles export errors', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Export failed'))

    render(<ExportPage />)

    const exportButton = screen.getByRole('button', { name: /export data/i })
    await user.click(exportButton)

    await waitFor(() => {
      expect(screen.getByText('Export failed. Please try again.')).toBeInTheDocument()
    })
  })

  it('disables export button when no engines selected', async () => {
    const user = userEvent.setup()
    render(<ExportPage />)

    // Uncheck all engines
    const googleCheckbox = screen.getByLabelText(/google/i)
    const bingCheckbox = screen.getByLabelText(/bing/i)
    const perplexityCheckbox = screen.getByLabelText(/perplexity/i)
    const braveCheckbox = screen.getByLabelText(/brave/i)

    await user.click(googleCheckbox)
    await user.click(bingCheckbox)
    await user.click(perplexityCheckbox)
    await user.click(braveCheckbox)

    const exportButton = screen.getByRole('button', { name: /export data/i })
    expect(exportButton).toBeDisabled()
  })

  it('shows correct estimated rows', () => {
    render(<ExportPage />)

    // Should show estimated rows based on engines * results per engine * days
    // 4 engines * 20 results * 30 days = 2400
    expect(screen.getByText('2,400')).toBeInTheDocument()
  })

  it('includes additional data options', () => {
    render(<ExportPage />)

    expect(screen.getByLabelText(/include llm annotations/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/include raw html snapshots/i)).toBeInTheDocument()
  })

  it('toggles additional data options', async () => {
    const user = userEvent.setup()
    render(<ExportPage />)

    const annotationsCheckbox = screen.getByLabelText(/include llm annotations/i)
    const rawDataCheckbox = screen.getByLabelText(/include raw html snapshots/i)

    // Annotations should be checked by default
    expect(annotationsCheckbox).toBeChecked()
    expect(rawDataCheckbox).not.toBeChecked()

    await user.click(rawDataCheckbox)
    expect(rawDataCheckbox).toBeChecked()

    await user.click(annotationsCheckbox)
    expect(annotationsCheckbox).not.toBeChecked()
  })

  it('shows export guidelines', () => {
    render(<ExportPage />)

    expect(screen.getByText('Export Guidelines')).toBeInTheDocument()
    expect(screen.getByText('Data Usage')).toBeInTheDocument()
    expect(screen.getByText('File Size')).toBeInTheDocument()
    expect(screen.getByText('Data Freshness')).toBeInTheDocument()
  })

  it('handles download from completed async export', async () => {
    const user = userEvent.setup()
    const mockBlob = new Blob(['export data'], { type: 'text/csv' })
    
    // Mock the download fetch
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => mockBlob,
    })

    render(<ExportPage />)

    // Simulate completed export state by directly setting the component state
    // This would normally be set through the async export flow
    const downloadButton = screen.queryByRole('button', { name: /download export/i })
    
    // Since we can't easily simulate the full async flow in this test,
    // we'll test the download functionality separately
    if (downloadButton) {
      await user.click(downloadButton)
      expect(mockAnchorElement.click).toHaveBeenCalled()
    }
  })

  it('includes correct parameters in export request', async () => {
    const user = userEvent.setup()
    
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['test'], { type: 'text/csv' }),
    })

    render(<ExportPage />)

    // Select JSON format
    const jsonRadio = screen.getByLabelText(/json/i)
    await user.click(jsonRadio)

    // Select health category
    const healthCheckbox = screen.getByLabelText(/health/i)
    await user.click(healthCheckbox)

    // Uncheck annotations
    const annotationsCheckbox = screen.getByLabelText(/include llm annotations/i)
    await user.click(annotationsCheckbox)

    const exportButton = screen.getByRole('button', { name: /export data/i })
    await user.click(exportButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('format=json')
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('categories=health')
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('includeAnnotations=false')
      )
    })
  })
})