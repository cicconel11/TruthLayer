'use client';

import { useState } from 'react';
import dynamicImport from "next/dynamic";

const DashboardView = dynamicImport(() => import("./components/dashboard-view").then((mod) => mod.DashboardView), {
  ssr: false
});

const ViewpointAnalysisView = dynamicImport(() => import("./components/viewpoint-analysis").then((mod) => mod.ViewpointAnalysisView), {
  ssr: false
});

export const dynamic = "force-dynamic";

export default function Page() {
  const [activeView, setActiveView] = useState<'dashboard' | 'viewpoints'>('dashboard');

  return (
    <div>
      {/* Navigation Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.7)',
        borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
        padding: '1rem 0',
        marginBottom: '2rem'
      }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ 
                color: '#e2e8f0', 
                fontSize: '1.5rem', 
                fontWeight: '600',
                margin: 0
              }}>
                TruthLayer
              </h1>
            </div>
            <nav style={{ display: 'flex', gap: '2rem' }}>
              <button
                onClick={() => setActiveView('dashboard')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeView === 'dashboard' ? '#60a5fa' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  borderBottom: activeView === 'dashboard' ? '2px solid #60a5fa' : 'none',
                  paddingBottom: '0.75rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (activeView !== 'dashboard') {
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeView !== 'dashboard') {
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                Metrics Dashboard
              </button>
              <button
                onClick={() => setActiveView('viewpoints')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeView === 'viewpoints' ? '#60a5fa' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  borderBottom: activeView === 'viewpoints' ? '2px solid #60a5fa' : 'none',
                  paddingBottom: '0.75rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  if (activeView !== 'viewpoints') {
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeView !== 'viewpoints') {
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                Viewpoint Analysis
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="container">
          {activeView === 'dashboard' ? <DashboardView /> : <ViewpointAnalysisView />}
        </div>
      </main>
    </div>
  );
}
