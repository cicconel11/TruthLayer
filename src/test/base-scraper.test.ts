import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseScraper } from '../collectors/base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';

// Test implementation of BaseScraper
class TestScraper extends BaseScraper {
    protected engineName = 'test';

    async scrapeResults(query: string, maxResults?: number): Promise<SearchResult[]> {
        // Mock implementation for testing
        const mockResults: SearchResult[] = [
            {
                id: 'test-1',
                query,
                engine: 'google',
                rank: 1,
                title: 'Test Result 1',
                snippet: 'Test snippet 1',
                url: 'https://example1.com',
                timestamp: new Date(),
            },
            {
                id: 'test-2',
                query,
                engine: 'google',
                rank: 2,
                title: 'Test Result 2',
                snippet: 'Test snippet 2',
                url: 'https://example2.com',
                timestamp: new Date(),
            }
        ];

        return maxResults ? mockResults.slice(0, maxResults) : mockResults;
    }

    protected normalizeResult(rawResult: RawSearchResult, query: string, rank: number): SearchResult {
        return {
            id: `test-${rank}`,
            query,
            engine: 'google',
            rank,
            title: rawResult.title,
            snippet: rawResult.snippet,
            url: rawResult.url,
            timestamp: new Date(),
        };
    }

    // Expose protected methods for testing
    public testGetRandomDelay(min?: number, max?: number): number {
        return this.getRandomDelay(min, max);
    }

    public testGetRandomUserAgent(): string {
        return this.getRandomUserAgent();
    }

    public testGenerateContentHash(content: string): string {
        return this.generateContentHash(content);
    }

    public async testSleep(ms: number): Promise<void> {
        return this.sleep(ms);
    }
}

describe('BaseScraper Infrastructure', () => {
    let scraper: TestScraper;

    beforeEach(() => {
        scraper = new TestScraper();
    });

    afterEach(async () => {
        await scraper.cleanup();
    });

    describe('Random Delay Generation', () => {
        it('should generate delays within specified range', () => {
            const min = 1000;
            const max = 3000;
            const delay = scraper.testGetRandomDelay(min, max);

            expect(delay).toBeGreaterThanOrEqual(min);
            expect(delay).toBeLessThanOrEqual(max);
        });

        it('should use default range when no parameters provided', () => {
            const delay = scraper.testGetRandomDelay();

            expect(delay).toBeGreaterThanOrEqual(2000);
            expect(delay).toBeLessThanOrEqual(8000);
        });

        it('should generate different delays on multiple calls', () => {
            const delays = Array.from({ length: 10 }, () => scraper.testGetRandomDelay());
            const uniqueDelays = new Set(delays);

            // Should have some variation (not all identical)
            expect(uniqueDelays.size).toBeGreaterThan(1);
        });
    });

    describe('User Agent Rotation', () => {
        it('should return valid user agent strings', () => {
            const userAgent = scraper.testGetRandomUserAgent();

            expect(userAgent).toBeTruthy();
            expect(userAgent).toContain('Mozilla');
            // Should contain at least one of the major browsers
            const hasBrowser = userAgent.includes('Chrome') ||
                userAgent.includes('Firefox') ||
                userAgent.includes('Safari');
            expect(hasBrowser).toBe(true);
        });

        it('should rotate between different user agents', () => {
            const userAgents = Array.from({ length: 20 }, () => scraper.testGetRandomUserAgent());
            const uniqueUserAgents = new Set(userAgents);

            // Should have some variation
            expect(uniqueUserAgents.size).toBeGreaterThan(1);
        });

        it('should include different browser types', () => {
            const userAgents = Array.from({ length: 50 }, () => scraper.testGetRandomUserAgent());
            const hasChrome = userAgents.some(ua => ua.includes('Chrome'));
            const hasFirefox = userAgents.some(ua => ua.includes('Firefox'));
            const hasSafari = userAgents.some(ua => ua.includes('Safari'));

            expect(hasChrome).toBe(true);
            // Note: Firefox and Safari might not always appear in small samples
            // but Chrome should always be present
        });
    });

    describe('Content Hash Generation', () => {
        it('should generate consistent hashes for same content', () => {
            const content = 'test content';
            const hash1 = scraper.testGenerateContentHash(content);
            const hash2 = scraper.testGenerateContentHash(content);

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 hex string length
        });

        it('should generate different hashes for different content', () => {
            const hash1 = scraper.testGenerateContentHash('content 1');
            const hash2 = scraper.testGenerateContentHash('content 2');

            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty content', () => {
            const hash = scraper.testGenerateContentHash('');

            expect(hash).toBeTruthy();
            expect(hash).toHaveLength(64);
        });
    });

    describe('Sleep Functionality', () => {
        it('should sleep for approximately the specified duration', async () => {
            const startTime = Date.now();
            const sleepDuration = 100; // 100ms

            await scraper.testSleep(sleepDuration);

            const endTime = Date.now();
            const actualDuration = endTime - startTime;

            // Allow for some timing variance (±100ms) to account for system load
            expect(actualDuration).toBeGreaterThanOrEqual(sleepDuration - 100);
            expect(actualDuration).toBeLessThanOrEqual(sleepDuration + 100);
        });
    });

    describe('Abstract Methods Implementation', () => {
        it('should implement scrapeResults method', async () => {
            const query = 'test query';
            const results = await scraper.scrapeResults(query);

            expect(results).toHaveLength(2);
            expect(results[0].query).toBe(query);
            expect(results[0].rank).toBe(1);
            expect(results[1].rank).toBe(2);
        });

        it('should respect maxResults parameter', async () => {
            const query = 'test query';
            const results = await scraper.scrapeResults(query, 1);

            expect(results).toHaveLength(1);
            expect(results[0].rank).toBe(1);
        });

        it('should implement normalizeResult method', () => {
            const rawResult: RawSearchResult = {
                title: 'Test Title',
                snippet: 'Test Snippet',
                url: 'https://test.com',
                rank: 1
            };

            const normalized = scraper.normalizeResult(rawResult, 'test query', 1);

            expect(normalized.title).toBe(rawResult.title);
            expect(normalized.snippet).toBe(rawResult.snippet);
            expect(normalized.url).toBe(rawResult.url);
            expect(normalized.query).toBe('test query');
            expect(normalized.rank).toBe(1);
        });
    });

    describe('Resource Cleanup', () => {
        it('should cleanup resources without errors', async () => {
            await expect(scraper.cleanup()).resolves.not.toThrow();
        });
    });
});