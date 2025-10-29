'use client';

import { useState } from 'react';
import { QueryInsightResponse } from '@truthlayer/schema';

// Import benchmark queries
// Adjust path if benchmark-queries.json is elsewhere in monorepo
import benchmarkQueries from '../../../../config/benchmark-queries.json';

export default function ComparePage() {
  const [selectedQueryId, setSelectedQueryId] = useState<string>('');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<QueryInsightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter queries based on search text
  const filteredQueries = benchmarkQueries.filter((q: any) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      q.query.toLowerCase().includes(search) ||
      q.topic.toLowerCase().includes(search) ||
      q.id.toLowerCase().includes(search)
    );
  });

  const handleCompare = async () => {
    if (!selectedQueryId) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ queryId: selectedQueryId });
      if (selectedRunId) {
        params.append('runId', selectedRunId);
      }

      const response = await fetch(`/api/query-insight?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch comparison data');
      }

      const result: QueryInsightResponse = await response.json();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <header className="card" style={{ marginBottom: '1.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h1 className="header-title">Query Comparison</h1>
            <p className="header-subtitle">
              Compare how different search engines answered the same query. Select a tracked query to see side-by-side results and bias metrics.
            </p>
          </div>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              color: '#e2e8f0',
              borderRadius: '0.75rem',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              marginLeft: '1rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.7)';
              e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
            }}
          >
            ← Dashboard
          </a>
        </div>
      </header>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="filters">
          <label style={{ flex: '1 1 100%' }}>
            <span style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'rgba(226, 232, 240, 0.85)' }}>
              Search Queries
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by query text, topic, or ID..."
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '12px',
                color: '#e2e8f0',
                padding: '0.55rem 0.9rem'
              }}
            />
            {searchText && (
              <div style={{ fontSize: '0.75rem', color: 'rgba(148, 163, 184, 0.8)', marginTop: '0.5rem' }}>
                Showing {filteredQueries.length} of {benchmarkQueries.length} queries
              </div>
            )}
          </label>

          <label>
            <span style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'rgba(226, 232, 240, 0.85)' }}>
              Query
            </span>
            <select
              value={selectedQueryId}
              onChange={(e) => setSelectedQueryId(e.target.value)}
            >
              <option value="">Select a query...</option>
              {filteredQueries.map((q: any) => (
                <option key={q.id} value={q.id}>
                  {q.query} ({q.topic})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'rgba(226, 232, 240, 0.85)' }}>
              Run ID (optional)
            </span>
            <input
              type="text"
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              placeholder="Latest run"
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '12px',
                color: '#e2e8f0',
                padding: '0.55rem 0.9rem'
              }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleCompare}
              disabled={!selectedQueryId || loading}
              style={{ opacity: !selectedQueryId || loading ? 0.5 : 1 }}
            >
              {loading ? 'Loading...' : 'Compare Engines'}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
            {error}
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Section A: Engine Outputs */}
          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.25rem', color: '#f8fafc' }}>
              Engine Outputs
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {['google', 'brave', 'duckduckgo', 'perplexity'].map((engine) => (
                <div key={engine} className="surface">
                  <h3 style={{ 
                    fontSize: '1rem', 
                    fontWeight: '700', 
                    marginBottom: '1rem', 
                    textTransform: 'capitalize',
                    color: '#3b82f6'
                  }}>
                    {engine}
                  </h3>
                  {data.engines[engine] && data.engines[engine].length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {data.engines[engine].slice(0, 3).map((result, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            paddingBottom: '0.75rem', 
                            borderBottom: idx < data.engines[engine].slice(0, 3).length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none'
                          }}
                        >
                          <div style={{ fontSize: '0.7rem', color: 'rgba(148, 163, 184, 0.7)', marginBottom: '0.25rem' }}>
                            #{result.rank}
                          </div>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              color: '#3b82f6', 
                              textDecoration: 'none', 
                              fontWeight: '600', 
                              fontSize: '0.85rem',
                              display: 'block',
                              marginBottom: '0.35rem'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {result.title}
                          </a>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(148, 163, 184, 0.8)', marginBottom: '0.35rem' }}>
                            {result.domainType} • {result.domain}
                          </div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: 'rgba(148, 163, 184, 0.7)', 
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {result.snippet}
                          </div>
                          {result.factualScore && (
                            <span className="badge" style={{
                              marginTop: '0.5rem',
                              background: result.factualScore === 'aligned' ? 'rgba(34, 197, 94, 0.18)' :
                                         result.factualScore === 'contradicted' ? 'rgba(239, 68, 68, 0.18)' :
                                         'rgba(251, 191, 36, 0.18)',
                              color: result.factualScore === 'aligned' ? '#86efac' :
                                     result.factualScore === 'contradicted' ? '#fca5a5' :
                                     '#fde047'
                            }}>
                              {result.factualScore}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                      No data for {engine}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Section B: Bias & Visibility Metrics */}
          <section className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.25rem', color: '#f8fafc' }}>
              Bias & Visibility Metrics
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="stat-box">
                <div className="stat-label">Engine Overlap</div>
                <div className="stat-value">
                  {(data.metrics.aggregate.overlap * 100).toFixed(1)}%
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Domain Diversity</div>
                <div className="stat-value">
                  {data.metrics.aggregate.domainDiversity}
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Factual Alignment</div>
                <div className="stat-value">
                  {(data.metrics.aggregate.factualAlignment * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            
            {Object.keys(data.metrics.perEngine).length > 0 && (
              <div className="surface" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '1rem', color: 'rgba(226, 232, 240, 0.85)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Per-Engine Metrics
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  {Object.entries(data.metrics.perEngine).map(([engine, metrics]) => (
                    <div key={engine} style={{ 
                      background: 'rgba(15, 23, 42, 0.4)', 
                      border: '1px solid rgba(148, 163, 184, 0.1)',
                      borderRadius: '0.75rem',
                      padding: '1rem'
                    }}>
                      <div style={{ fontWeight: '600', textTransform: 'capitalize', marginBottom: '0.75rem', color: '#3b82f6' }}>
                        {engine}
                      </div>
                      {metrics.domainDiversity !== undefined && (
                        <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                          <span style={{ color: 'rgba(148, 163, 184, 0.8)' }}>Diversity:</span>{' '}
                          <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{metrics.domainDiversity}</span>
                        </div>
                      )}
                      {metrics.factualAlignment !== undefined && (
                        <div style={{ fontSize: '0.8rem' }}>
                          <span style={{ color: 'rgba(148, 163, 184, 0.8)' }}>Alignment:</span>{' '}
                          <span style={{ fontWeight: '600', color: '#e2e8f0' }}>
                            {(metrics.factualAlignment * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ fontSize: '0.8rem', color: 'rgba(148, 163, 184, 0.7)', marginTop: '1.5rem' }}>
              Snapshot from {new Date(data.timestamp).toLocaleString('en-US', {
                timeZone: 'UTC',
                dateStyle: 'medium',
                timeStyle: 'short'
              })} UTC
            </div>
          </section>

          {/* Section C: Engines in this snapshot */}
          <section className="card">
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.25rem', color: '#f8fafc' }}>
              Engines in this Snapshot
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {data.enginesPresent.length > 0 ? (
                data.enginesPresent.map((engine) => (
                  <span
                    key={engine}
                    className="badge"
                    style={{ 
                      background: 'rgba(34, 197, 94, 0.18)',
                      color: '#86efac',
                      textTransform: 'capitalize'
                    }}
                  >
                    {engine}
                  </span>
                ))
              ) : (
                <div className="empty-state">
                  No engines returned data for this run
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

