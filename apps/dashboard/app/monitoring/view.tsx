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

export function MonitoringView() {
  const [state, setState] = useState<DashboardState>({ loading: true });

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
  }, []);

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

  return (
    <main className="container">
      <header className="card" style={{ marginBottom: '1.5rem' }}>
        <h1 className="header-title">Pipeline Monitoring</h1>
        <p className="header-subtitle">
          Recent scheduler executions, stage reliability, and annotation accuracy snapshots.
        </p>
        <div className="metrics-meta">
          <span>Last updated: {formatDate(generatedAt)}</span>
          <span>Total runs tracked: {runs.length}</span>
        </div>
      </header>

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
                <th>Error</th>
                <th>Annotation Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {runs.length ? (
                runs.map((run) => {
                  const accuracy = accuracyByRun[run.id];
                  return (
                    <tr key={run.id}>
                      <td>{run.id}</td>
                      <td>
                        <span className="status-pill">{run.status}</span>
                      </td>
                      <td>{formatDate(run.startedAt)}</td>
                      <td>{formatDate(run.completedAt)}</td>
                      <td>{run.error ?? '—'}</td>
                      <td>{accuracy ? formatPercentage(accuracy.accuracy) : '—'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem 0' }}>
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

