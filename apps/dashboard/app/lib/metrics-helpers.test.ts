import { describe, expect, it } from 'vitest';
import {
  average,
  buildAggregateMap,
  computeFactualAlignmentFromAggregates,
  extractPerEngineValue,
  extractPairwiseOverlap,
  formatValue,
  toCsv
} from './metrics-helpers';
import type { AnnotationAggregate } from '../types';

describe('metrics helpers', () => {
  it('formats values with appropriate units', () => {
    expect(formatValue(5.234, 'domain_diversity')).toBe('5.2');
    expect(formatValue(0.4123, 'engine_overlap')).toBe('41.2%');
    expect(formatValue(null, 'engine_overlap')).toBe('–');
  });

  it('extracts per-engine diversity values', () => {
    const extra = { perEngine: { google: 12, bing: 9 } } as Record<string, unknown>;
    expect(extractPerEngineValue(extra, 'google')).toBe(12);
    expect(extractPerEngineValue(extra, 'perplexity')).toBeNull();
  });

  it('averages pairwise overlaps for selected engine', () => {
    const extra = {
      pairwise: {
        google_bing: 0.4,
        google_brave: 0.6,
        bing_brave: 0.5
      }
    } as Record<string, unknown>;

    expect(extractPairwiseOverlap(extra, 'google')).toBeCloseTo(0.5, 5);
    expect(extractPairwiseOverlap(extra, 'perplexity')).toBeNull();
  });

  it('builds aggregate maps and computes factual alignment', () => {
    const aggregates: AnnotationAggregate[] = [
      {
        id: 'a',
        runId: 'run-1',
        queryId: 'q1',
        engine: 'google',
        domainType: 'news',
        factualConsistency: 'aligned',
        count: 3,
        totalAnnotations: 5,
        collectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        extra: null
      },
      {
        id: 'b',
        runId: 'run-1',
        queryId: 'q1',
        engine: 'google',
        domainType: 'news',
        factualConsistency: 'unclear',
        count: 1,
        totalAnnotations: 5,
        collectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        extra: null
      },
      {
        id: 'c',
        runId: 'run-1',
        queryId: 'q1',
        engine: 'google',
        domainType: 'news',
        factualConsistency: 'contradicted',
        count: 1,
        totalAnnotations: 5,
        collectedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        extra: null
      }
    ];

    const map = buildAggregateMap(aggregates);
    const score = computeFactualAlignmentFromAggregates(map, 'run-1', 'q1', 'google');
    expect(score).toBeCloseTo((3 + 0.5) / 5, 5);
  });

  it('builds CSV content with escaping', () => {
    const rows = [
      { columnA: 'value', columnB: 'needs,escaping' },
      { columnA: 'line\nbreak', columnB: 'plain' }
    ];
    const csv = toCsv(rows);
    expect(csv).toContain('"needs,escaping"');
    expect(csv).toContain('"line\nbreak"');
  });

  it('averages values', () => {
    expect(average([1, 2, 3])).toBe(2);
    expect(average([])).toBeNull();
  });
});

