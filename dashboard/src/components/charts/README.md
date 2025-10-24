# TruthLayer Dashboard Chart Components

This directory contains interactive Chart.js-based visualization components for the TruthLayer transparency dashboard. All components are built with responsive design and mobile compatibility in mind.

## Components Overview

### 1. BiasMetricsChart
**Purpose**: Visualize bias metrics (domain diversity, engine overlap, factual alignment) over time or across engines.

**Chart Types**:
- `line`: Time-series line chart showing metric trends
- `bar`: Bar chart comparing average metrics across engines  
- `doughnut`: Circular chart showing metric distribution

**Props**:
```typescript
interface BiasMetricsChartProps {
  data: MetricsTrend[];
  type: 'line' | 'bar' | 'doughnut';
  metric: 'domainDiversity' | 'engineOverlap' | 'factualAlignment';
  engines?: string[];
  height?: number;
  responsive?: boolean;
}
```

**Usage**:
```tsx
<BiasMetricsChart
  data={trendsData}
  type="line"
  metric="domainDiversity"
  engines={['google', 'bing']}
  height={400}
  responsive={true}
/>
```

### 2. EngineComparisonChart
**Purpose**: Compare bias metrics across different search engines.

**Chart Types**:
- `bar`: Side-by-side bar comparison of all metrics
- `radar`: Radar/spider chart showing engine performance profiles

**Props**:
```typescript
interface EngineComparisonChartProps {
  data: EngineComparison[];
  type: 'bar' | 'radar';
  height?: number;
  responsive?: boolean;
}
```

**Usage**:
```tsx
<EngineComparisonChart
  data={engineData}
  type="radar"
  height={400}
  responsive={true}
/>
```

### 3. DomainDistributionChart
**Purpose**: Visualize the distribution of domain types (news, academic, commercial, etc.) in search results.

**Chart Types**:
- `bar`: Bar chart showing domain type percentages
- `pie`: Pie chart showing domain distribution

**Props**:
```typescript
interface DomainDistributionChartProps {
  data: DomainDistribution[];
  type: 'bar' | 'pie';
  engine?: string; // Filter to specific engine
  height?: number;
  responsive?: boolean;
}
```

**Usage**:
```tsx
<DomainDistributionChart
  data={domainData}
  type="pie"
  engine="google"
  height={400}
  responsive={true}
/>
```

### 4. TrendAnalysisChart
**Purpose**: Advanced trend analysis with multiple metrics, moving averages, and time period controls.

**Chart Types**:
- `line`: Multi-line trend chart
- `area`: Filled area chart for trend visualization
- `bar`: Bar chart for recent period averages

**Props**:
```typescript
interface TrendAnalysisChartProps {
  data: MetricsTrend[];
  type: 'line' | 'area' | 'bar';
  metrics: ('domainDiversity' | 'engineOverlap' | 'factualAlignment')[];
  engines?: string[];
  timeRange?: 'week' | 'month' | 'quarter';
  height?: number;
  responsive?: boolean;
  showMovingAverage?: boolean;
}
```

**Usage**:
```tsx
<TrendAnalysisChart
  data={trendsData}
  type="area"
  metrics={['domainDiversity', 'factualAlignment']}
  engines={['google', 'bing', 'perplexity']}
  timeRange="month"
  showMovingAverage={true}
  height={400}
  responsive={true}
/>
```

## Features

### Responsive Design
- All charts automatically resize based on container size
- Mobile-optimized touch interactions
- Responsive legend positioning
- Adaptive font sizes and spacing

### Interactive Elements
- Hover tooltips with detailed information
- Clickable legends to show/hide data series
- Zoom and pan capabilities (where applicable)
- Cross-filtering between chart elements

### Accessibility
- High contrast color schemes
- Screen reader compatible
- Keyboard navigation support
- ARIA labels and descriptions

### Performance Optimizations
- Chart.js canvas rendering for smooth animations
- Efficient data processing and caching
- Lazy loading of chart components
- Memory management for large datasets

## Color Schemes

### Engine Colors
- **Google**: `#4285F4` (Blue)
- **Bing**: `#00BCF2` (Light Blue)  
- **Perplexity**: `#20B2AA` (Teal)
- **Brave**: `#FB542B` (Orange)

### Metric Colors
- **Domain Diversity**: `#10B981` (Green)
- **Engine Overlap**: `#F59E0B` (Amber)
- **Factual Alignment**: `#8B5CF6` (Purple)

### Domain Type Colors
- **News**: `#EF4444` (Red)
- **Government**: `#3B82F6` (Blue)
- **Academic**: `#10B981` (Green)
- **Blog**: `#F59E0B` (Amber)
- **Commercial**: `#8B5CF6` (Purple)
- **Social**: `#EC4899` (Pink)

## Data Requirements

### MetricsTrend
```typescript
interface MetricsTrend {
  date: string; // ISO date string
  domainDiversity: number; // 0.0-1.0
  engineOverlap: number; // 0.0-1.0
  factualAlignment: number; // 0.0-1.0
  engine: string; // 'google' | 'bing' | 'perplexity' | 'brave'
}
```

### EngineComparison
```typescript
interface EngineComparison {
  engine: string;
  domainDiversity: number; // 0.0-1.0
  engineOverlap: number; // 0.0-1.0
  factualAlignment: number; // 0.0-1.0
  totalResults: number;
  uniqueDomains: number;
  averageRank: number;
}
```

### DomainDistribution
```typescript
interface DomainDistribution {
  domainType: string; // 'news' | 'academic' | 'commercial' | etc.
  count: number;
  percentage: number; // 0-100
  engine: string;
}
```

## Error Handling

All chart components include:
- Graceful handling of empty or invalid data
- Loading states with spinners
- Error boundaries for chart rendering failures
- Fallback displays when data is unavailable

## Testing

Use the test page at `/test-charts` to verify all chart components work correctly with mock data.

## Dependencies

- **Chart.js**: Core charting library
- **react-chartjs-2**: React wrapper for Chart.js
- **date-fns**: Date formatting and manipulation
- **Tailwind CSS**: Styling and responsive design

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers with Canvas support