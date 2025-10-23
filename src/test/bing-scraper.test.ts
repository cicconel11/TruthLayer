import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BingScraper } from '../collectors/bing-scraper';
import { SearchResult } from '../types/search-result';

describe('BingScraper', () => {
    let scraper: BingScraper;

    beforeEach(() => {
        scraper = new BingScraper();
    });

    afterEach(async () => {
        await scraper.cleanup();
    });

    describe('Initialization', () => {
        it('should initialize with correct engine name', () => {
            expect(scraper['engineName']).toBe('bing');
        });

        it('should have base URL set correctly', () => {
            expect(scraper['baseUrl']).toBe('https://www.bing.com');
        });
    });

    describe('Result Normalization', () => {
        it('should normalize raw results correctly', () => {
            const rawResult = {
                title: 'Test Title',
                snippet: 'Test snippet content',
                url: 'https://example.com',
                rank: 1
            };

            const normalized = scraper['normalizeResult'](rawResult, 'test query', 1);

            expect(normalized.query).toBe('test query');
            expect(normalized.engine).toBe('bing');
            expect(normalized.rank).toBe(1);
            expect(normalized.title).toBe('Test Title');
            expect(normalized.snippet).toBe('Test snippet content');
            expect(normalized.url).toBe('https://example.com');
            expect(normalized.id).toBeTruthy();
            expect(normalized.timestamp).toBeInstanceOf(Date);
            expect(normalized.contentHash).toBeTruthy();
        });

        it('should trim whitespace from title and snippet', () => {
            const rawResult = {
                title: '  Test Title  ',
                snippet: '  Test snippet  ',
                url: 'https://example.com',
                rank: 1
            };

            const normalized = scraper['normalizeResult'](rawResult, 'test query', 1);

            expect(normalized.title).toBe('Test Title');
            expect(normalized.snippet).toBe('Test snippet');
        });

        it('should generate unique IDs for different results', () => {
            const rawResult1 = {
                title: 'Title 1',
                snippet: 'Snippet 1',
                url: 'https://example1.com',
                rank: 1
            };

            const rawResult2 = {
                title: 'Title 2',
                snippet: 'Snippet 2',
                url: 'https://example2.com',
                rank: 2
            };

            const normalized1 = scraper['normalizeResult'](rawResult1, 'test query', 1);
            const normalized2 = scraper['normalizeResult'](rawResult2, 'test query', 2);

            expect(normalized1.id).not.toBe(normalized2.id);
        });

        it('should generate different content hashes for different content', () => {
            const rawResult1 = {
                title: 'Title 1',
                snippet: 'Snippet 1',
                url: 'https://example1.com',
                rank: 1
            };

            const rawResult2 = {
                title: 'Title 2',
                snippet: 'Snippet 2',
                url: 'https://example2.com',
                rank: 2
            };

            const normalized1 = scraper['normalizeResult'](rawResult1, 'test query', 1);
            const normalized2 = scraper['normalizeResult'](rawResult2, 'test query', 2);

            expect(normalized1.contentHash).not.toBe(normalized2.contentHash);
        });
    });

    describe('Blocking Detection', () => {
        it('should detect CAPTCHA indicators in page content', async () => {
            // Mock page with CAPTCHA content
            const mockPage = {
                content: () => Promise.resolve('<html><body>Please complete the security check to continue</body></html>'),
                title: () => Promise.resolve('Security Check'),
                $: () => Promise.resolve(null)
            } as any;

            const isBlocked = await scraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });

        it('should detect suspicious traffic messages', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>We have detected suspicious traffic from your network</body></html>'),
                title: () => Promise.resolve('Bing'),
                $: () => Promise.resolve(null)
            } as any;

            const isBlocked = await scraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });

        it('should detect security verification messages', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>Security verification required</body></html>'),
                title: () => Promise.resolve('Bing'),
                $: () => Promise.resolve(null)
            } as any;

            const isBlocked = await scraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });

        it('should detect CAPTCHA elements', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>Normal content</body></html>'),
                title: () => Promise.resolve('Bing'),
                $: () => Promise.resolve({}) // Mock element found
            } as any;

            const isBlocked = await scraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });

        it('should detect Bing-specific blocking elements', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>Normal content</body></html>'),
                title: () => Promise.resolve('Bing'),
                $: (selector: string) => {
                    if (selector === '.captcha, #captcha, [data-captcha]') return Promise.resolve(null);
                    if (selector === '.b_no, .b_errPage') return Promise.resolve({}); // Mock Bing error element
                    return Promise.resolve(null);
                }
            } as any;

            const isBlocked = await scraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });

        it('should not detect blocking on normal pages', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>Normal search results</body></html>'),
                title: () => Promise.resolve('Bing Search Results'),
                $: () => Promise.resolve(null)
            } as any;

            const isBlocked = await scraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(false);
        });
    });

    describe('Resource Management', () => {
        it('should cleanup resources without errors', async () => {
            await expect(scraper.cleanup()).resolves.not.toThrow();
        });
    });
});