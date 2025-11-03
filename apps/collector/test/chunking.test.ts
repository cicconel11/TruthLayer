/**
 * Tests for text chunking utilities.
 */

import { describe, it, expect } from 'vitest';
import { chunkText, reduceChunkAnnotations } from '../src/annotate/chunking';

describe('chunkText', () => {
  it('should return single chunk for short text', () => {
    const text = 'This is a short piece of text.';
    const chunks = chunkText(text, 100);
    expect(chunks).toEqual([text]);
  });

  it('should split long text into chunks', () => {
    const text = 'A'.repeat(100);
    const chunks = chunkText(text, 30);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= 30)).toBe(true);
    expect(chunks.join('')).toBe(text);
  });

  it('should preserve word boundaries when possible', () => {
    const text = 'This is a long sentence that should be split at word boundaries when possible.';
    const chunks = chunkText(text, 20);

    // Check that chunks don't cut words in half (basic check)
    for (const chunk of chunks) {
      if (chunk.length === 20) {
        expect(chunk.endsWith(' ') || chunk === text.slice(-20)).toBe(true);
      }
    }
  });

  it('should handle empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual(['   ']);
  });

  it('should handle exact boundary splits', () => {
    const text = '1234567890'; // 10 chars
    const chunks = chunkText(text, 5);
    expect(chunks).toEqual(['12345', '67890']);
  });
});

describe('reduceChunkAnnotations', () => {
  it('should return single annotation unchanged', () => {
    const annotation = {
      domainType: 'news',
      factualConsistency: 'aligned',
      confidence: 0.8,
      provider: 'llm',
      modelId: 'gpt-4o-mini'
    };

    const result = reduceChunkAnnotations([annotation]);
    expect(result).toEqual({
      ...annotation,
      chunk_count: 1
    });
  });

  it('should merge multiple annotations', () => {
    const annotations = [
      {
        domainType: 'news',
        factualConsistency: 'aligned',
        confidence: 0.7,
        provider: 'llm',
        modelId: 'gpt-4o-mini'
      },
      {
        domainType: 'news',
        factualConsistency: 'aligned',
        confidence: 0.9,
        provider: 'llm',
        modelId: 'gpt-4o-mini'
      }
    ];

    const result = reduceChunkAnnotations(annotations);
    expect(result.domainType).toBe('news');
    expect(result.factualConsistency).toBe('aligned');
    expect(result.confidence).toBe(0.8); // Average of 0.7 and 0.9
    expect(result.chunk_count).toBe(2);
    expect(result.merged).toBe(true);
  });

  it('should handle majority voting for categorical fields', () => {
    const annotations = [
      { domainType: 'news', factualConsistency: 'aligned', confidence: 0.8 },
      { domainType: 'blog', factualConsistency: 'aligned', confidence: 0.9 },
      { domainType: 'news', factualConsistency: 'contradicted', confidence: 0.6 }
    ];

    const result = reduceChunkAnnotations(annotations);
    expect(result.domainType).toBe('news'); // Majority vote
    expect(result.factualConsistency).toBe('aligned'); // Majority vote
    expect(result.confidence).toBeCloseTo(0.767, 2); // Average rounded to 2 decimals
  });

  it('should handle empty input', () => {
    expect(reduceChunkAnnotations([])).toBe(null);
  });

  it('should merge sources arrays', () => {
    const annotations = [
      { sources: ['source1', 'source2'], confidence: 0.8 },
      { sources: ['source2', 'source3'], confidence: 0.9 }
    ];

    const result = reduceChunkAnnotations(annotations);
    expect(result.sources).toEqual(['source1', 'source2', 'source3']);
  });
});
