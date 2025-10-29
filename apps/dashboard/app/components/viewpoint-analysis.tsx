'use client';

import { useState, useCallback } from 'react';

interface ViewpointAnalysis {
  query: string;
  diversityScore: number;
  domainDistribution: Record<string, number>;
  underrepresentedTypes: string[];
  alternativeSources: any[];
  reasoning: string[];
  collectedAt: string;
  processingTime?: number;
}

interface ApiResponse {
  query: string;
  diversityScore: number;
  domainDistribution: Record<string, number>;
  alternatives: any[];
  processingTime: number;
  generatedAt: string;
  analysis?: {
    reasoning: string[];
    underrepresentedTypes: string[];
    collectedAt: string;
  };
  metrics?: {
    totalResults: number;
    underrepresentedTypes: string[];
    diversityRating: string;
  };
}

export function ViewpointAnalysisView() {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ApiResponse | null>(null);

  const analyzeQuery = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const response = await fetch(`/api/viewpoints?q=${encodeURIComponent(query.trim())}&analysis=true&maxAlternatives=10`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze query');
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="container">
      <div>
        <h2 style={{ color: '#e2e8f0', fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Viewpoint Analysis
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          Analyze viewpoint diversity in search results and discover alternative perspectives
        </p>

        {/* Query Input */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && analyzeQuery()}
              placeholder="Enter a search query to analyze (e.g., climate change, election 2024)"
              style={{
                flex: '1',
                padding: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '0.5rem',
                background: 'rgba(15, 23, 42, 0.5)',
                color: '#e2e8f0',
                opacity: loading ? 0.5 : 1
              }}
              disabled={loading}
            />
            <button
              onClick={analyzeQuery}
              disabled={loading || !query.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                background: loading || !query.trim() 
                  ? 'rgba(148, 163, 184, 0.3)' 
                  : '#60a5fa',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>

          {error && (
            <div style={{
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.5rem',
              color: '#fca5a5'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ color: '#ef4444' }}>⚠️</div>
                <div style={{ marginLeft: '0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#f87171' }}>
                    Analysis Error
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#fca5a5' }}>
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analysis Results */}
        {analysis && (
          <div>
            {/* Summary Cards */}
            <div className="grid" style={{ marginBottom: '1.5rem' }}>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: '#60a5fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: '#f8fafc'
                  }}>
                    {Math.round(analysis.diversityScore)}
                  </div>
                  <div style={{ marginLeft: '1rem' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '500', color: '#e2e8f0' }}>
                      Diversity Score
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      Viewpoint diversity rating
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: '#f8fafc'
                  }}>
                    {(analysis.analysis?.underrepresentedTypes || analysis.metrics?.underrepresentedTypes || []).length}
                  </div>
                  <div style={{ marginLeft: '1rem' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '500', color: '#e2e8f0' }}>
                      Missing Perspectives
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      Underrepresented viewpoints
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: '#f8fafc'
                  }}>
                    {(analysis.alternatives || []).length}
                  </div>
                  <div style={{ marginLeft: '1rem' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '500', color: '#e2e8f0' }}>
                      Alternatives Found
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                      Alternative sources available
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Insights */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '500', color: '#e2e8f0', marginBottom: '1rem' }}>
                Analysis Insights
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(analysis.analysis?.reasoning || []).map((reason, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: '#60a5fa',
                      marginTop: '0.25rem',
                      flexShrink: 0
                    }}></div>
                    <div style={{ marginLeft: '0.75rem', fontSize: '0.875rem', color: '#d1d5db' }}>
                      {reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Domain Distribution */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '500', color: '#e2e8f0', marginBottom: '1rem' }}>
                Domain Distribution
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(analysis.domainDistribution || {}).map(([domain, percentage]) => (
                  <div key={domain} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#d1d5db', textTransform: 'capitalize' }}>
                      {domain}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '8rem',
                        height: '0.5rem',
                        background: 'rgba(148, 163, 184, 0.2)',
                        borderRadius: '0.25rem',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${percentage * 100}%`,
                          height: '100%',
                          background: '#60a5fa',
                          borderRadius: '0.25rem'
                        }}></div>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '0.875rem', minWidth: '3rem' }}>
                        {Math.round(percentage * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alternative Sources */}
            {(analysis.alternatives && analysis.alternatives.length > 0) && (
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ color: '#e2e8f0', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Top Alternative Sources
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {analysis.alternatives.slice(0, 5).map((source, index) => (
                    <div key={index} style={{
                      padding: '0.75rem',
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                          width: '1.5rem',
                          height: '1.5rem',
                          borderRadius: '50%',
                          background: '#60a5fa',
                          color: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ 
                                color: '#60a5fa', 
                                textDecoration: 'none', 
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                wordBreak: 'break-all'
                              }}
                            >
                              {source.domain}
                            </a>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              background: source.domainType === 'news' ? '#ef4444' :
                                       source.domainType === 'government' ? '#3b82f6' :
                                       source.domainType === 'academic' ? '#10b981' :
                                       source.domainType === 'blog' ? '#f59e0b' : '#6b7280',
                              color: '#f8fafc',
                              fontSize: '0.75rem',
                              borderRadius: '0.25rem',
                              textTransform: 'capitalize',
                              fontWeight: '500'
                            }}>
                              {source.domainType}
                            </span>
                            {source.factualConsistency && (
                              <span style={{
                                padding: '0.125rem 0.5rem',
                                background: source.factualConsistency === 'aligned' ? '#10b981' :
                                         source.factualConsistency === 'contradicted' ? '#ef4444' : '#f59e0b',
                                color: '#f8fafc',
                                fontSize: '0.75rem',
                                borderRadius: '0.25rem',
                                fontWeight: '500'
                              }}>
                                {source.factualConsistency}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Found via {source.engine} • Rank #{source.rank}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.processingTime && (
              <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b', marginTop: '1rem' }}>
                Analysis completed in {analysis.processingTime}ms
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
