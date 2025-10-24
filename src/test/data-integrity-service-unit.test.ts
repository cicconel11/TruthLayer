import { describe, it, expect } from 'vitest';
import { generateSearchResultHash, isValidHash } from '../utils/hash-utils';

describe('Data Integrity Utilities', () => {
    describe('generateSearchResultHash', () => {
        it('should generate consistent hashes for same content', () => {
            const title = 'Test Result';
            const snippet = 'Test snippet';
            const url = 'https://example.com';

            const hash1 = generateSearchResultHash(title, snippet, url);
            const hash2 = generateSearchResultHash(title, snippet, url);

            expect(hash1).toBe(hash2);
            expect(isValidHash(hash1)).toBe(true);
        });

        it('should generate different hashes for different content', () => {
            const hash1 = generateSearchResultHash('Title 1', 'Snippet 1', 'https://example.com/1');
            const hash2 = generateSearchResultHash('Title 2', 'Snippet 2', 'https://example.com/2');

            expect(hash1).not.toBe(hash2);
            expect(isValidHash(hash1)).toBe(true);
            expect(isValidHash(hash2)).toBe(true);
        });

        it('should handle empty snippets', () => {
            const hash = generateSearchResultHash('Title', '', 'https://example.com');
            expect(isValidHash(hash)).toBe(true);
        });
    });

    describe('isValidHash', () => {
        it('should validate correct SHA-256 hashes', () => {
            const validHash = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
            expect(isValidHash(validHash)).toBe(true);
        });

        it('should reject invalid hash formats', () => {
            expect(isValidHash('invalid_hash')).toBe(false);
            expect(isValidHash('123')).toBe(false);
            expect(isValidHash('')).toBe(false);
            expect(isValidHash('a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae')).toBe(false); // Too short
        });
    });
});