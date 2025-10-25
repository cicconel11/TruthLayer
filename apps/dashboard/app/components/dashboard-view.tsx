'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { MetricType, MetricRecord, AnnotationAggregate, QueryMeta } from '../types';
import {
  extractPerEngineValue,
  extractPairwiseOverlap,
  buildAggregateMap,
  computeFactualAlignmentFromAggregates,
  formatValue,
  toCsv
} from '../lib/metrics-helpers';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface MetricsResponse {
  metrics: Record<MetricType, MetricRecord[]>;
  aggregates: AnnotationAggregate[];
  queries: Record<string, QueryMeta>;
  queryIds: string[];
  engines: string[];
  runIds: string[];
  topics: string[];
  generatedAt: string;
}

const METRIC_LABELS: Record<MetricType, string> = {
  domain_diversity: 'Domain Diversity',
  engine_overlap: 'Engine Overlap',
  factual_alignment: 'Factual Alignment'
};

const METRIC_DESCRIPTIONS: Record<MetricType, string> = {
  domain_diversity: 'Unique sources returned per query across engines',
  engine_overlap: 'Proportion of shared URLs across engines',
  factual_alignment: 'Factual agreement score derived from annotations'
};

const REFRESH_INTERVAL_MS = 60_000;

type DashboardState = {
  loading: boolean;
  error?: string;
  data?: MetricsResponse;
};

type DatasetPoint = {
  label: string;
  value: number;
  runId: string | null;
  queryId: string;
  delta: number | null;
  collectedAt: string;
  raw: MetricRecord;
};

function buildDatasetLabel(point: MetricRecord, meta?: QueryMeta) {
  const time = new Date(point.collectedAt).toLocaleString();
  const queryLabel = meta ? `${meta.topic ? `[${meta.topic}]` : ''} ${meta.query}`.trim() : point.queryId;
  return `${time} – ${queryLabel}`;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DashboardView() {
  const [state, setState] = useState<DashboardState>({ loading: true });
  const [selectedEngine, setSelectedEngine] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedQuery, setSelectedQuery] = useState<string>('all');

  const fetchMetrics = useCallback(async () => {
    try {
      setState((previous) => ({ ...previous, loading: !previous.data }));
      const response = await fetch('/api/metrics');
      if (!response.ok) {
        throw new Error(`API responded with ${response.status}`);
      }
      const json = (await response.json()) as MetricsResponse;
      setState({ loading: false, data: json });
    } catch (error) {
      console.error('failed to fetch dashboard metrics', error);
      setState({ loading: false, error: 'Unable to load metrics data' });
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const aggregateMap = useMemo(() => {
    if (!state.data) return new Map();
    return buildAggregateMap(state.data.aggregates);
  }, [state.data]);

  const filteredMetrics = useMemo(() => {
    if (!state.data) return null;
    const { data } = state;

    let queryIds: Set<string>;
    if (selectedQuery !== 'all') {
      queryIds = new Set([selectedQuery]);
    } else if (selectedTopic !== 'all') {
      queryIds = new Set(
        Object.entries(data.queries)
          .filter(([, meta]) => meta.topic === selectedTopic)
          .map(([id]) => id)
      );
    } else {
      queryIds = new Set(data.queryIds);
    }

    const filterRecord = (record: MetricRecord) => {
      if (!queryIds.has(record.queryId)) return false;
      if (selectedEngine !== 'all' && record.engine && record.engine !== selectedEngine) return false;
      return true;
    };

    const metrics: Record<MetricType, MetricRecord[]> = {
      domain_diversity: (data.metrics.domain_diversity ?? []).filter(filterRecord),
      engine_overlap: (data.metrics.engine_overlap ?? []).filter(filterRecord),
      factual_alignment: (data.metrics.factual_alignment ?? []).filter(filterRecord)
    };

    return {
      metrics,
      queryMap: data.queries
    };
  }, [state.data, selectedTopic, selectedQuery, selectedEngine]);

  const buildDataset = useCallback(
    (metricType: MetricType): DatasetPoint[] => {
      if (!filteredMetrics || !state.data) return [];
      const records = filteredMetrics.metrics[metricType] ?? [];
      const dataset: DatasetPoint[] = [];

      for (const record of records) {
        let value: number | null = record.value;

        if (selectedEngine !== 'all') {
          if (metricType === 'domain_diversity') {
            value = extractPerEngineValue(record.extra ?? null, selectedEngine);
          } else if (metricType === 'engine_overlap') {
            value = extractPairwiseOverlap(record.extra ?? null, selectedEngine);
          } else if (metricType === 'factual_alignment') {
            value = computeFactualAlignmentFromAggregates(
              aggregateMap,
              record.runId,
              record.queryId,
              selectedEngine
            );
          }
        }

        if (value === null || Number.isNaN(value)) continue;

        const queryMeta = filteredMetrics.queryMap[record.queryId];

        dataset.push({
          label: buildDatasetLabel(record, queryMeta),
          value,
          runId: record.runId,
          queryId: record.queryId,
          delta: record.delta,
          collectedAt: record.collectedAt,
          raw: record
        });
      }

      return dataset.sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());
    },
    [filteredMetrics, selectedEngine, aggregateMap, state.data]
  );

  const chartData = useMemo(() => {
    return {
      domain: buildDataset('domain_diversity'),
      overlap: buildDataset('engine_overlap'),
      factual: buildDataset('factual_alignment')
    };
  }, [buildDataset]);

  const latestSnapshot = useMemo(() => {
    if (!state.data) return null;
    const snapshot: Record<MetricType, DatasetPoint | undefined> = {
      domain_diversity: chartData.domain.at(-1),
      engine_overlap: chartData.overlap.at(-1),
      factual_alignment: chartData.factual.at(-1)
    };
    return snapshot;
  }, [chartData, state.data]);

  const csvExport = useCallback(() => {
    if (!state.data) return;
    const rows: Record<string, unknown>[] = [];
    (['domain_diversity', 'engine_overlap', 'factual_alignment'] as MetricType[]).forEach((metric) => {
      buildDataset(metric).forEach((point) => {
        rows.push({
          metric,
          runId: point.runId ?? 'unknown',
          queryId: point.queryId,
          collectedAt: point.collectedAt,
          value: point.value,
          delta: point.delta ?? '',
          engine: selectedEngine,
          topic: state.data?.queries[point.queryId]?.topic ?? 'Unknown'
        });
      });
    });
    const csv = toCsv(rows);
    if (csv) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCsv(`truthlayer-metrics-${timestamp}.csv`, csv);
    }
  }, [buildDataset, state.data, selectedEngine]);

  if (state.loading) {
    return (
      <main className="container">
        <section className="card">
          <h1 className="header-title">TruthLayer Metrics</h1>
          <p className="header-subtitle">Loading visibility metrics…</p>
        </section>
      </main>
    );
  }

  if (state.error || !state.data) {
    return (
      <main className="container">
        <section className="card empty-state">
          <h2>Metrics dashboard unavailable</h2>
          <p>{state.error ?? 'No metrics data has been generated yet.'}</p>
          <button type="button" onClick={fetchMetrics}>
            Retry fetch
          </button>
        </section>
      </main>
    );
  }

  const engineOptions = [
    'all',
    ...state.data.engines
      .filter((engine): engine is string => Boolean(engine))
      .sort((a, b) => a.localeCompare(b))
  ];
  const topicOptions = ['all', ...state.data.topics.sort((a, b) => a.localeCompare(b))];
  const queryOptions = [
    'all',
    ...Object.entries(state.data.queries)
      .sort(([, a], [, b]) => a.query.localeCompare(b.query))
      .map(([id]) => id)
  ];

  const renderChart = (id: string, title: string, metric: MetricType, dataset: DatasetPoint[], color: string) => {
    const labels = dataset.map((point) => new Date(point.collectedAt).toLocaleString());
    const values = dataset.map((point) => point.value);
    const data = {
      labels,
      datasets: [
        {
          label: title,
          data: values,
          borderColor: color,
          backgroundColor: `${color}33`,
          fill: true,
          tension: 0.35,
          pointRadius: 3.5,
          pointHoverRadius: 6
        }
      ]
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => `${context.dataset.label}: ${formatValue(context.parsed.y, metric)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(226, 232, 240, 0.7)' },
          grid: { color: 'rgba(148, 163, 184, 0.15)' }
        },
        y: {
          ticks: {
            color: 'rgba(226, 232, 240, 0.7)',
            callback: (value: number) => formatValue(value, metric)
          },
          grid: { color: 'rgba(148, 163, 184, 0.12)' }
        }
      }
    };

    return (
      <div key={id} className="card metric-card">
        <div>
          <h3>{METRIC_LABELS[metric]}</h3>
          <p className="metric-subtext">{METRIC_DESCRIPTIONS[metric]}</p>
        </div>
        <div className="chart-container">
          {dataset.length ? <Line data={data} options={options} /> : <div className="empty-state">No datapoints yet</div>}
        </div>
      </div>
    );
  };

  const summaryCards = (['domain_diversity', 'engine_overlap', 'factual_alignment'] as MetricType[]).map((metric) => {
    const point = latestSnapshot?.[metric];
    return (
      <div key={metric} className="card metric-card">
        <div>
          <h3>{METRIC_LABELS[metric]}</h3>
        </div>
        <div className="metric-value">{formatValue(point?.value ?? null, metric)}</div>
        <div className="metric-subtext">
          {point?.delta !== null && point?.delta !== undefined ? (
            <span className={point.delta >= 0 ? 'delta-positive' : 'delta-negative'}>
              {point.delta >= 0 ? '+' : ''}
              {formatValue(point.delta, metric)} vs prev
            </span>
          ) : (
            'No prior comparison'
          )}
        </div>
      </div>
    );
  });

  const tableRows = chartData.domain.map((point) => {
    const queryMeta = state.data?.queries[point.queryId];
    return {
      runId: point.runId ?? 'unknown',
      collectedAt: new Date(point.collectedAt).toLocaleString(),
      query: queryMeta?.query ?? point.queryId,
      topic: queryMeta?.topic ?? 'Unknown',
      domainDiversity: formatValue(point.value, 'domain_diversity'),
      engineOverlap: formatValue(
        chartData.overlap.find((entry) => entry.runId === point.runId && entry.queryId === point.queryId)?.value ?? null,
        'engine_overlap'
      ),
      factualAlignment: formatValue(
        chartData.factual.find((entry) => entry.runId === point.runId && entry.queryId === point.queryId)?.value ?? null,
        'factual_alignment'
      )
    };
  });

  return (
    <main className="container">
      <header className="card" style={{ marginBottom: '1.8rem' }}>
        <h1 className="header-title">TruthLayer Visibility Metrics</h1>
        <p className="header-subtitle">
          Track cross-engine visibility and factual alignment trends for the benchmark query set. Filters operate locally so you
          can explore engines, topics, and individual queries.
        </p>
        <div className="metrics-meta">
          <span>Last refreshed: {new Date(state.data.generatedAt).toLocaleString()}</span>
          <span>Runs tracked: {state.data.runIds.length || '0'}</span>
          <span>Queries covered: {state.data.queryIds.length || '0'}</span>
        </div>
      </header>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="filters">
          <label>
            <span style={{ display: 'block', marginBottom: '0.35rem' }}>Engine</span>
            <select value={selectedEngine} onChange={(event) => setSelectedEngine(event.target.value)}>
              {engineOptions.map((engine) => (
                <option key={engine} value={engine}>
                  {engine === 'all' ? 'All engines' : engine}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ display: 'block', marginBottom: '0.35rem' }}>Topic</span>
            <select value={selectedTopic} onChange={(event) => setSelectedTopic(event.target.value)}>
              {topicOptions.map((topic) => (
                <option key={topic} value={topic}>
                  {topic === 'all' ? 'All topics' : topic}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ display: 'block', marginBottom: '0.35rem' }}>Query</span>
            <select value={selectedQuery} onChange={(event) => setSelectedQuery(event.target.value)}>
              {queryOptions.map((id) => (
                <option key={id} value={id}>
                  {id === 'all' ? 'All queries' : state.data?.queries[id]?.query ?? id}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" onClick={csvExport}>
              Download CSV
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-2" style={{ marginBottom: '1.5rem' }}>{summaryCards}</section>

      <section className="grid grid-2" style={{ marginBottom: '1.5rem' }}>
        {renderChart('domain', 'Domain Diversity', 'domain_diversity', chartData.domain, '#60a5fa')}
        {renderChart('overlap', 'Engine Overlap', 'engine_overlap', chartData.overlap, '#34d399')}
        {renderChart('factual', 'Factual Alignment', 'factual_alignment', chartData.factual, '#f97316')}
      </section>

      <section className="card">
        <h3 style={{ marginBottom: '1rem' }}>Latest Runs</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Collected</th>
                <th>Query</th>
                <th>Topic</th>
                <th>Domain Diversity</th>
                <th>Engine Overlap</th>
                <th>Factual Alignment</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length ? (
                tableRows.map((row, index) => (
                  <tr key={`${row.runId}-${index}`}>
                    <td>{row.runId}</td>
                    <td>{row.collectedAt}</td>
                    <td>{row.query}</td>
                    <td>{row.topic}</td>
                    <td>{row.domainDiversity}</td>
                    <td>{row.engineOverlap}</td>
                    <td>{row.factualAlignment}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 0' }}>
                    No runs available for the selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
