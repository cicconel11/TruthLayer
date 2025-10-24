import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
)

// Mock Chart.js
jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn(),
  },
  CategoryScale: jest.fn(),
  LinearScale: jest.fn(),
  PointElement: jest.fn(),
  LineElement: jest.fn(),
  Title: jest.fn(),
  Tooltip: jest.fn(),
  Legend: jest.fn(),
  BarElement: jest.fn(),
  ArcElement: jest.fn(),
  RadialLinearScale: jest.fn(),
}))

// Mock react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options, ...props }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Line Chart
    </div>
  ),
  Bar: ({ data, options, ...props }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Bar Chart
    </div>
  ),
  Pie: ({ data, options, ...props }) => (
    <div data-testid="pie-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Pie Chart
    </div>
  ),
  Radar: ({ data, options, ...props }) => (
    <div data-testid="radar-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Radar Chart
    </div>
  ),
}))

// Setup cleanup after each test
afterEach(() => {
  jest.clearAllMocks()
})