/**
 * Tests for the main annotation orchestrator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { annotatePage } from '../src/annotate/annotator';
import { createStorageClient } from '@truthlayer/storage';

// Mock dependencies
vi.mock('@truthlayer/storage', () => ({
  createStorageClient: vi.fn()
}));

vi.mock('../src/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }))
}));

vi.mock('../src/lib/metrics', () => ({
  getMetrics: vi.fn(() => ({
    count: vi.fn(),
    histogram: vi.fn()
  }))
}));

describe('annotatePage', () => {
  let mockStorage: any;

  beforeEach(() => {
    mockStorage = {
      markAnnotationFailure: vi.fn(),
      markAnnotationSuccess: vi.fn(),
      close: vi.fn()
    };

    (createStorageClient as any).mockReturnValue(mockStorage);
  });

  it('should skip annotation for malformed URLs', async () => {
    const result = await annotatePage({
      queryId: 'test-query',
      url: 'w.startus-insights.com/path"}',
      title: 'Test Title',
      pageText: 'Some content',
      engine: 'brave'
    });

    expect(mockStorage.markAnnotationFailure).toHaveBeenCalledWith({
      queryId: 'test-query',
      url: 'w.startus-insights.com/path"}',
      engine: 'brave',
      status: 'SKIPPED_BAD_URL'
    });

    // Should return heuristic result for bad URL
    expect(result.provider).toBe('heuristic-fallback');
  });

  it('should skip annotation for empty content', async () => {
    const result = await annotatePage({
      queryId: 'test-query',
      url: 'https://example.com',
      title: 'Test Title',
      pageText: '',
      engine: 'brave'
    });

    expect(mockStorage.markAnnotationFailure).toHaveBeenCalledWith({
      queryId: 'test-query',
      url: 'https://example.com/',
      engine: 'brave',
      status: 'SKIPPED_EMPTY'
    });

    expect(result.provider).toBe('heuristic-fallback');
  });

  it('should normalize valid URLs', async () => {
    // Mock successful LLM call
    const mockLLM = vi.fn().mockResolvedValue('{"domain_type":"news","factual_consistency":"aligned","confidence":0.8}');
    vi.doMock('../src/lib/openai-client', () => ({
      annotateWithOpenAI: mockLLM,
      extractErrorInfo: vi.fn()
    }));

    // Re-import to get the mocked version
    const { annotatePage: annotatePageMocked } = await import('../src/annotate/annotator');

    const result = await annotatePageMocked({
      queryId: 'test-query',
      url: 'example.com/path', // Missing protocol
      title: 'Test Title',
      pageText: 'Some content here for annotation',
      engine: 'brave'
    });

    expect(result.domainType).toBe('news');
    expect(result.factualConsistency).toBe('aligned');
    expect(result.confidence).toBe(0.8);
  });

  it('should handle LLM failures and use heuristic fallback', async () => {
    // Mock LLM failure
    vi.doMock('../src/lib/openai-client', () => ({
      annotateWithOpenAI: vi.fn().mockRejectedValue(new Error('API Error')),
      extractErrorInfo: vi.fn(() => ({
        code: 'rate_limit_exceeded',
        status: 429,
        message: 'Rate limit exceeded',
        requestId: null,
        model: 'gpt-4o-mini',
        inputChars: 100,
        attempt: 1
      }))
    }));

    const { annotatePage: annotatePageMocked } = await import('../src/annotate/annotator');

    const result = await annotatePageMocked({
      queryId: 'test-query',
      url: 'https://example.com',
      title: 'Test Title',
      pageText: 'Some content about renewable energy and climate change',
      engine: 'brave'
    });

    expect(mockStorage.markAnnotationFailure).toHaveBeenCalledWith({
      queryId: 'test-query',
      url: 'https://example.com/',
      engine: 'brave',
      errorCode: 'rate_limit_exceeded',
      errorMessage: 'Rate limit exceeded',
      status: 'LLM_FAILED'
    });

    expect(mockStorage.markAnnotationSuccess).toHaveBeenCalledWith({
      queryId: 'test-query',
      url: 'https://example.com/',
      engine: 'brave',
      source: 'heuristic_fallback'
    });

    expect(result.provider).toBe('heuristic-fallback');
  });
});
