# Dashboard Frontend Tests

This directory contains comprehensive test suites for the TruthLayer dashboard frontend components.

## Test Coverage

### 1. Main Dashboard Page (`page.test.tsx`)
- Tests dashboard header and description rendering
- Validates loading states and error handling
- Verifies overview metrics display with correct data
- Tests bias metrics calculations and percentages
- Validates action button links and navigation
- Tests error recovery with "try again" functionality
- Verifies chart rendering with real data

### 2. FilterPanel Component (`components/FilterPanel.test.tsx`)
- Tests basic filter panel rendering
- Validates active filter count display
- Tests engine and category selection toggles
- Verifies date range updates via dropdown
- Tests query text filtering functionality
- Validates advanced options expansion
- Tests filter clearing functionality
- Verifies quick preset applications
- Tests custom date range inputs
- Validates correct button states for selections

### 3. QueryExplorer Component (`components/QueryExplorer.test.tsx`)
- Tests loading and error states
- Validates query list display with metadata
- Tests diversity and factual percentage calculations
- Verifies sorting functionality by different columns
- Tests query details expansion and display
- Validates engine details in expanded view
- Tests insights generation for selected queries
- Verifies error recovery mechanisms
- Tests empty state handling
- Validates API parameter inclusion for filters

### 4. RealTimeUpdates Component (`components/RealTimeUpdates.test.tsx`)
- Tests connection status display
- Validates minimal view when notifications disabled
- Tests recent updates display with correct data
- Verifies empty state handling
- Tests polling intervals for updates
- Validates callback execution on data updates
- Tests different update type icons
- Verifies graceful error handling
- Tests last update time display
- Includes hook testing for `useRealTimeUpdates`

### 5. Chart Components (`components/charts.test.tsx`)
- **BiasMetricsChart**: Tests line/bar chart rendering, data filtering, empty state handling
- **EngineComparisonChart**: Tests radar/bar chart rendering, engine data display, color schemes
- **TrendAnalysisChart**: Tests multi-metric display, engine filtering, moving averages
- **DomainDistributionChart**: Tests pie/bar charts, domain aggregation, color mapping

### 6. Export Functionality (`export.test.tsx`)
- Tests export configuration form rendering
- Validates format selection (CSV/JSON)
- Tests engine and category selection
- Verifies date range configuration
- Tests small dataset export (direct download)
- Tests large dataset export (async with progress)
- Validates export parameter inclusion
- Tests error handling and recovery
- Verifies export guidelines display

### 7. API Integration (`api-integration.test.tsx`)
- Tests API calls with correct parameters
- Validates error handling across components
- Tests data display when API calls succeed
- Verifies filter change triggers new API calls
- Tests empty data response handling
- Validates real-time update integration
- Tests various error scenarios (timeouts, malformed JSON, HTTP errors)
- Verifies retry functionality

## Testing Infrastructure

### Setup
- **Jest**: Test runner with Next.js integration
- **React Testing Library**: Component testing utilities
- **jsdom**: DOM environment for testing
- **User Event**: Realistic user interaction simulation

### Mocks
- Chart.js components mocked for consistent testing
- Next.js router and navigation mocked
- Fetch API mocked for API testing
- Real-time updates hook mocked for controlled testing

### Configuration
- TypeScript support with proper type checking
- Module path mapping for `@/` imports
- Coverage collection from source files
- Test environment isolation

## Key Testing Principles

1. **User-Centric Testing**: Tests focus on user interactions and expected outcomes
2. **Real Data Simulation**: Uses realistic mock data that matches actual API responses
3. **Error Boundary Testing**: Comprehensive error handling and recovery testing
4. **Accessibility**: Tests include proper ARIA labels and semantic HTML
5. **Responsive Design**: Tests verify component behavior across different screen sizes
6. **Performance**: Tests validate loading states and efficient data handling

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern="FilterPanel"

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

## Test Data

All tests use consistent mock data that reflects the actual data structures used in the application:
- Search engine results with proper metrics
- Query analysis data with engine comparisons
- Domain distribution data across engines
- Trend data with time series information
- Export configuration options

This ensures tests remain valid as the application evolves and provides confidence in the frontend functionality.