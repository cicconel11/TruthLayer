'use client';

import { useEffect, useState } from 'react';

interface StageLog {
  id: string;
  stage: string;
  status: string;
  attempts: number;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
}

interface PipelineRun {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  stages: StageLog[];
}

interface AccuracySummary {
  total: number;
  aligned: number;
  contradicted: number;
  unclear: number;
  accuracy: number;
}

interface MonitoringResponse {
  runs: PipelineRun[];
  accuracyByRun: Record<string, AccuracySummary>;
  generatedAt: string;
}

interface DashboardState {
  loading: boolean;
  error?: string;
  data?: MonitoringResponse;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(startedAt: string, completedAt: string | null) {
  if (!completedAt) return 'In progress...';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationMs = end - start;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function computeSummaryStats(runs: PipelineRun[]) {
  const total = runs.length;
  const completed = runs.filter(r => r.status === 'completed').length;
  const failed = runs.filter(r => r.status === 'failed').length;
  const running = runs.filter(r => r.status === 'running').length;
  const successRate = total > 0 ? completed / total : 0;

  const durations = runs
    .filter(r => r.completedAt)
    .map(r => new Date(r.completedAt!).getTime() - new Date(r.startedAt).getTime());

  const avgDuration = durations.length > 0
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length
    : 0;

  return {
    total,
    completed,
    failed,
    running,
    successRate,
    avgDurationSeconds: Math.floor(avgDuration / 1000)
  };
}

export function MonitoringView() {
  const [state, setState] = useState<DashboardState>({ loading: true });
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/monitoring');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as MonitoringResponse;
        setState({ loading: false, data: json });
      } catch (error) {
        console.error('monitoring fetch failed', error);
        setState({ loading: false, error: 'Unable to load monitoring data' });
      }
    };

    void fetchData();

    // Auto-refresh every 30 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        void fetchData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (state.loading) {
    return (
      <main className="container">
        <section className="card empty-state">
          <h2>Loading pipeline monitoring…</h2>
        </section>
      </main>
    );
  }

  if (state.error || !state.data) {
    return (
      <main className="container">
        <section className="card empty-state">
          <h2>Monitoring unavailable</h2>
          <p>{state.error ?? 'No monitoring data available yet.'}</p>
        </section>
      </main>
    );
  }

  const { runs, accuracyByRun, generatedAt } = state.data;
  const stats = computeSummaryStats(runs);

  return (
    <main className="container">
      <header className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 className="header-title">Pipeline Monitoring</h1>
            <p className="header-subtitle">
              Recent scheduler executions, stage reliability, and annotation accuracy snapshots.
            </p>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: '0.5rem 1rem',
              background: autoRefresh ? '#10b981' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
          </button>
        </div>
        <div className="metrics-meta" style={{ marginTop: '1rem' }}>
          <span>Last updated: {formatDate(generatedAt)}</span>
          <span>Total runs: {runs.length}</span>
        </div>
      </header>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Summary Statistics</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1rem'
        }}>
          <div className="stat-box">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Runs</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats.failed}</div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.running}</div>
            <div className="stat-label">Running</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{formatPercentage(stats.successRate)}</div>
            <div className="stat-label">Success Rate</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{stats.avgDurationSeconds}s</div>
            <div className="stat-label">Avg Duration</div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Recent Pipeline Runs</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Status</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Duration</th>
                <th>Error</th>
                <th>Annotation Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {runs.length ? (
                runs.map((run) => {
                  const accuracy = accuracyByRun[run.id];
                  const statusColor = 
                    run.status === 'completed' ? '#10b981' :
                    run.status === 'failed' ? '#ef4444' :
                    '#3b82f6';
                  return (
                    <tr key={run.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {run.id.slice(0, 8)}...
                      </td>
                      <td>
                        <span className="status-pill" style={{ 
                          background: statusColor,
                          color: 'white',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '1rem',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {run.status}
                        </span>
                      </td>
                      <td>{formatDate(run.startedAt)}</td>
                      <td>{formatDate(run.completedAt)}</td>
                      <td>{formatDuration(run.startedAt, run.completedAt)}</td>
                      <td style={{ 
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {run.error ?? '—'}
                      </td>
                      <td>{accuracy ? formatPercentage(accuracy.accuracy) : '—'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem 0' }}>
                    No runs recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginBottom: '1rem' }}>Stage Details</h3>
        {runs.map((run) => (
          <div key={run.id} className="surface">
            <h4 style={{ margin: '0 0 0.5rem' }}>{run.id}</h4>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {run.stages.map((stage) => (
                    <tr key={stage.id}>
                      <td>{stage.stage}</td>
                      <td>{stage.status}</td>
                      <td>{stage.attempts}</td>
                      <td>{formatDate(stage.startedAt)}</td>
                      <td>{formatDate(stage.completedAt)}</td>
                      <td>{stage.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

