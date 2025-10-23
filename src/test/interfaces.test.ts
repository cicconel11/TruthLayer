import { describe, it, expect } from 'vitest';
import { validateSearchResult, validateAnnotationRequest, validateQuery } from '../utils/validation';
import { SearchResult, AnnotationRequest, Query } from '../types';

describe('Interface Validation', () => {
    it('should validate SearchResult interface correctly', () => {
        const validSearchResult: SearchResult = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            query: 'test query',
            engine: 'google',
            rank: 1,
            title: 'Test Title',
            snippet: 'Test snippet',
            url: 'https://example.com',
            timestamp: new Date(),
        };

        expect(() => validateSearchResult(validSearchResult)).not.toThrow();
    });

    it('should validate AnnotationRequest interface correctly', () => {
        const validAnnotationRequest: AnnotationRequest = {
            title: 'Test Title',
            snippet: 'Test snippet',
            url: 'https://example.com',
            query: 'test query',
        };

        expect(() => validateAnnotationRequest(validAnnotationRequest)).not.toThrow();
    });

    it('should validate Query interface correctly', () => {
        const validQuery: Query = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            text: 'test query',
            category: 'health',
            createdAt: new Date(),
            isActive: true,
        };

        expect(() => validateQuery(validQuery)).not.toThrow();
    });

    it('should reject invalid SearchResult', () => {
        const invalidSearchResult = {
            id: 'invalid-uuid',
            query: '',
            engine: 'invalid-engine',
            rank: 0,
            title: '',
            snippet: 'Test snippet',
            url: 'invalid-url',
            timestamp: 'invalid-date',
        };

        expect(() => validateSearchResult(invalidSearchResult)).toThrow();
    });

    it('should reject invalid AnnotationRequest', () => {
        const invalidAnnotationRequest = {
            title: '',
            snippet: 'Test snippet',
            url: 'invalid-url',
            query: '',
        };

        expect(() => validateAnnotationRequest(invalidAnnotationRequest)).toThrow();
    });
});