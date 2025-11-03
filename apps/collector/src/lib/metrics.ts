/**
 * Metrics and telemetry for TruthLayer annotation pipeline.
 *
 * Provides counters, histograms, and gauges for monitoring annotation performance,
 * error rates, and system health.
 */

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

interface MetricsStorage {
  counters: Map<string, MetricValue>;
  histograms: Map<string, number[]>;
  gauges: Map<string, MetricValue>;
}

/**
 * Simple in-memory metrics storage.
 * In production, this could be replaced with Prometheus, DataDog, etc.
 */
class MetricsCollector {
  private storage: MetricsStorage = {
    counters: new Map(),
    histograms: new Map(),
    gauges: new Map()
  };

  /**
   * Increment a counter metric.
   */
  count(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const existing = this.storage.counters.get(key);

    this.storage.counters.set(key, {
      value: (existing?.value || 0) + value,
      labels,
      timestamp: Date.now()
    });
  }

  /**
   * Record a histogram value.
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const values = this.storage.histograms.get(key) || [];
    values.push(value);
    this.storage.histograms.set(key, values);
  }

  /**
   * Set a gauge value.
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);

    this.storage.gauges.set(key, {
      value,
      labels,
      timestamp: Date.now()
    });
  }

  /**
   * Get current metrics snapshot.
   */
  getSnapshot(): {
    counters: Array<{ name: string; value: MetricValue }>;
    histograms: Array<{ name: string; values: number[]; stats: HistogramStats }>;
    gauges: Array<{ name: string; value: MetricValue }>;
  } {
    const counters = Array.from(this.storage.counters.entries()).map(([key, value]) => ({
      name: key,
      value
    }));

    const histograms = Array.from(this.storage.histograms.entries()).map(([key, values]) => ({
      name: key,
      values,
      stats: this.calculateHistogramStats(values)
    }));

    const gauges = Array.from(this.storage.gauges.entries()).map(([key, value]) => ({
      name: key,
      value
    }));

    return { counters, histograms, gauges };
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.storage = {
      counters: new Map(),
      histograms: new Map(),
      gauges: new Map()
    };
  }

  private makeKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;

    const sortedLabels = Object.keys(labels)
      .sort()
      .map(key => `${key}=${labels[key]}`)
      .join(',');

    return `${name}{${sortedLabels}}`;
  }

  private calculateHistogramStats(values: number[]): HistogramStats {
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    return {
      count: values.length,
      sum,
      avg,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sortedValues[lower];

    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
}

interface HistogramStats {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

// Global metrics instance
let globalMetrics: MetricsCollector | null = null;

/**
 * Get or create global metrics collector.
 */
export function getMetrics(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = new MetricsCollector();
  }
  return globalMetrics;
}

/**
 * Initialize metrics collection.
 */
export function initMetrics(): void {
  globalMetrics = new MetricsCollector();
}

/**
 * Reset global metrics.
 */
export function resetMetrics(): void {
  if (globalMetrics) {
    globalMetrics.reset();
  }
}

/**
 * Get current metrics snapshot.
 */
export function getMetricsSnapshot() {
  return globalMetrics?.getSnapshot() || {
    counters: [],
    histograms: [],
    gauges: []
  };
}

/**
 * Log metrics snapshot to console (for debugging).
 */
export function logMetricsSnapshot(): void {
  const snapshot = getMetricsSnapshot();
  console.log('\n📊 Metrics Snapshot:');

  if (snapshot.counters.length > 0) {
    console.log('\nCounters:');
    snapshot.counters.forEach(({ name, value }) => {
      console.log(`  ${name}: ${value.value}`);
    });
  }

  if (snapshot.histograms.length > 0) {
    console.log('\nHistograms:');
    snapshot.histograms.forEach(({ name, stats }) => {
      console.log(`  ${name}: count=${stats.count}, avg=${stats.avg.toFixed(2)}, p95=${stats.p95.toFixed(2)}`);
    });
  }

  if (snapshot.gauges.length > 0) {
    console.log('\nGauges:');
    snapshot.gauges.forEach(({ name, value }) => {
      console.log(`  ${name}: ${value.value}`);
    });
  }
}
