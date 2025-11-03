/**
 * Tests for URL normalization and validation utilities.
 */

import { describe, it, expect } from 'vitest';
import { normalizeUrl, isValidForAnnotation, extractDomain } from '../src/annotate/url-utils';

describe('normalizeUrl', () => {
  it('should return null for empty input', () => {
    expect(normalizeUrl('')).toBe(null);
    expect(normalizeUrl('   ')).toBe(null);
  });

  it('should add https protocol when missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('www.example.com/path')).toBe('https://www.example.com/path');
  });

  it('should fix malformed w. prefixes', () => {
    expect(normalizeUrl('w.startus-insights.com/')).toBe('https://www.startus-insights.com/');
    expect(normalizeUrl('w.example.com/path')).toBe('https://www.example.com/path');
  });

  it('should remove trailing brackets and punctuation', () => {
    expect(normalizeUrl('example.com/path}')).toBe('https://example.com/path');
    expect(normalizeUrl('example.com/path]')).toBe('https://example.com/path');
    expect(normalizeUrl('example.com/path)')).toBe('https://example.com/path');
  });

  it('should remove surrounding quotes', () => {
    expect(normalizeUrl('"https://example.com/"')).toBe('https://example.com/');
    expect(normalizeUrl("'https://example.com/path'")).toBe('https://example.com/path');
  });

  it('should handle the specific malformed URL from the issue', () => {
    expect(normalizeUrl('w.startus-insights.com/innovators-guide/top-10-renewable-energy-trends-2022/"}')).toBe('https://www.startus-insights.com/innovators-guide/top-10-renewable-energy-trends-2022');
  });

  it('should return null for invalid URLs', () => {
    expect(normalizeUrl('not-a-url-at-all')).toBe(null);
    expect(normalizeUrl('http://')).toBe(null);
    expect(normalizeUrl('https://')).toBe(null);
  });

  it('should preserve valid URLs unchanged', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
    expect(normalizeUrl('http://example.com/path?query=value')).toBe('http://example.com/path?query=value');
  });
});

describe('isValidForAnnotation', () => {
  it('should accept valid http/https URLs', () => {
    expect(isValidForAnnotation('https://example.com')).toBe(true);
    expect(isValidForAnnotation('http://example.com')).toBe(true);
  });

  it('should reject non-http protocols', () => {
    expect(isValidForAnnotation('ftp://example.com')).toBe(false);
    expect(isValidForAnnotation('file:///path')).toBe(false);
  });

  it('should reject localhost/private IPs', () => {
    expect(isValidForAnnotation('http://localhost')).toBe(false);
    expect(isValidForAnnotation('http://127.0.0.1')).toBe(false);
    expect(isValidForAnnotation('http://192.168.1.1')).toBe(false);
    expect(isValidForAnnotation('http://10.0.0.1')).toBe(false);
  });

  it('should reject invalid URLs', () => {
    expect(isValidForAnnotation('not-a-url')).toBe(false);
    expect(isValidForAnnotation('')).toBe(false);
  });
});

describe('extractDomain', () => {
  it('should extract domain from valid URLs', () => {
    expect(extractDomain('https://example.com')).toBe('example.com');
    expect(extractDomain('https://www.example.com/path')).toBe('www.example.com');
    expect(extractDomain('http://sub.example.com/path?query=value')).toBe('sub.example.com');
  });

  it('should return null for invalid URLs', () => {
    expect(extractDomain('not-a-url')).toBe(null);
    expect(extractDomain('')).toBe(null);
  });
});
