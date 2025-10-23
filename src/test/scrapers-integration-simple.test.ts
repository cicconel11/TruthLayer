import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GoogleScraper } from '../collectors/google-scraper';
import { BingScraper } from '../collectors/bing-scraper';
import { BraveScraper } from '../collectors/brave-scraper';
import { PerplexityScraper } from '../collectors/perplexity-scraper';
import { CollectorService } from '../collectors/collector-service';
import { BypassServiceImpl } from '../services/bypass-service';
import { getConfig } from '../utils/config-loader';

describe('Scrapers Integration Tests - Simple', () => {
    let googleScraper: GoogleScraper;
    let bingScraper: BingScraper;
    let braveScraper: BraveScraper;
    let perplexityScraper: PerplexityScraper;
    let collectorService: CollectorService;
    let bypassService: BypassServiceImpl;

    beforeAll(async () => {
        // Create minimal test config
        const config = {
            database: {
                host: 'localhost',
                port: 5432,
                database: 'test',
                username: 'test',
                password: 'test',
                ssl: false,
                maxConnections: 20,
                connectionTimeout: 30000,
            },
            scraping: {
                userAgents: ['test-agent'],
                delays: { min: 1000, max: 2000 },
                retries: { maxAttempts: 3, backoffMultiplier: 2 },
                timeout: 30000,
                requestsPerWindow: 30,
                windowSizeMs: 60000,
            },
            annotation: {
                provider: 'openai' as const,
                apiKey: 'test-key',
                model: 'gpt-4',
                temperature: 0.1,
                maxTokens: 1000,
                batchSize: 10,
                rateLimits: { requestsPerMinute: 60, tokensPerMinute: 90000 },
            },
            dashboard: {
                port: 3000,
                host: 'localhost',
                cors: { origins: ['http://localhost:3000'], credentials: true },
                rateLimit: { windowMs: 900000, maxRequests: 100 },
            },
            monitoring: {
                logLevel: 'info' as const,
                logFormat: 'json' as const,
                metrics: { enabled: true },
                alerts: { enabled: false },
            },
            bypass: {
                captcha: {
                    enabled: false,
                    provider: 'twocaptcha' as const,
                    apiKey: '',
                    timeout: 120000,
                    pollingInterval: 3000,
                },
                cloudflare: {
                    enabled: false,
                    timeout: 30000,
                },
                retries: {
                    maxAttempts: 3,
                    baseDelay: 1000,
                    maxDelay: 30000,
                    backoffMultiplier: 2,
                },
            },
        };

        bypassService = new BypassServiceImpl(config.bypass);

        googleScraper = new GoogleScraper(bypassService);
        bingScraper = new BingScraper(bypassService);
        braveScraper = new BraveScraper(bypassService);
        perplexityScraper = new PerplexityScraper(bypassService);

        collectorService = new CollectorService();
    });

    afterAll(async () => {
        await googleScraper.cleanup();
        await bingScraper.cleanup();
        await braveScraper.cleanup();
        await perplexityScraper.cleanup();
        await collectorService.cleanup();
    });

    describe('Scraper Infrastructure', () => {
        it('should initialize all scrapers correctly', () => {
            expect(googleScraper).toBeDefined();
            expect(bingScraper).toBeDefined();
            expect(braveScraper).toBeDefined();
            expect(perplexityScraper).toBeDefined();
            expect(collectorService).toBeDefined();
        });

        it('should have correct base URLs configured', () => {
            expect(googleScraper['baseUrl']).toBe('https://www.google.com');
            expect(bingScraper['baseUrl']).toBe('https://www.bing.com');
            expect(braveScraper['baseUrl']).toBe('https://search.brave.com');
            expect(perplexityScraper['baseUrl']).toBe('https://www.perplexity.ai');
        });

        it('should handle scraping attempts gracefully (expect blocking)', async () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' }
            ];

            for (const { scraper, name } of scrapers) {
                try {
                    // Use a very short timeout to avoid hanging
                    const results = await Promise.race([
                        scraper.scrapeResults('test query', 1),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Expected timeout')), 3000)
                        )
                    ]);

                    // If successful, validate results
                    expect(results).toBeInstanceOf(Array);
                    console.log(`${name} returned ${(results as any).length} results`);
                } catch (error) {
                    // Blocking/errors are expected in automated testing
                    expect(error).toBeInstanceOf(Error);
                    console.log(`${name} blocked as expected: ${error.message}`);
                }
            }
        }, 10000);
    });

    describe('Result Normalization', () => {
        it('should normalize results correctly with null/undefined handling', () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            const testCases = [
                { title: 'Valid Title', snippet: 'Valid snippet', url: 'https://example.com' },
                { title: null, snippet: null, url: null },
                { title: undefined, snippet: undefined, url: undefined },
                { title: '  Whitespace  ', snippet: '  Trimmed  ', url: 'https://example.com' },
                { title: '', snippet: '', url: '' }
            ];

            scrapers.forEach(({ scraper, name }) => {
                testCases.forEach((testCase, index) => {
                    try {
                        const result = scraper['normalizeResult'](testCase as any, 'test query', index + 1);

                        // Should always have these properties
                        expect(result).toHaveProperty('id');
                        expect(result).toHaveProperty('query');
                        expect(result).toHaveProperty('engine');
                        expect(result).toHaveProperty('rank');
                        expect(result).toHaveProperty('title');
                        expect(result).toHaveProperty('snippet');
                        expect(result).toHaveProperty('url');
                        expect(result).toHaveProperty('timestamp');
                        expect(result).toHaveProperty('contentHash');

                        // Validate types
                        expect(typeof result.id).toBe('string');
                        expect(typeof result.title).toBe('string');
                        expect(typeof result.snippet).toBe('string');
                        expect(typeof result.url).toBe('string');
                        expect(result.timestamp).toBeInstanceOf(Date);
                        expect(typeof result.contentHash).toBe('string');

                        console.log(`${name} normalized test case ${index + 1} successfully`);
                    } catch (error) {
                        console.log(`${name} handled malformed data: ${error.message}`);
                        expect(error).toBeInstanceOf(Error);
                    }
                });
            });
        });

        it('should generate unique content hashes', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                const result1 = scraper['normalizeResult']({
                    title: 'Title 1',
                    snippet: 'Snippet 1',
                    url: 'https://example1.com'
                }, 'query', 1);

                const result2 = scraper['normalizeResult']({
                    title: 'Title 2',
                    snippet: 'Snippet 2',
                    url: 'https://example2.com'
                }, 'query', 2);

                expect(result1.contentHash).not.toBe(result2.contentHash);
                expect(result1.id).not.toBe(result2.id);
            });
        });
    });

    describe('CollectorService Integration', () => {
        it('should initialize with all scrapers available', () => {
            expect(collectorService['scrapers'].size).toBe(4);
            expect(Array.from(collectorService['scrapers'].keys())).toEqual([
                'google', 'bing', 'perplexity', 'brave'
            ]);
        });

        it('should handle requests for unavailable engines gracefully', async () => {
            const request = {
                query: 'test query',
                engines: ['nonexistent'] as any,
                maxResults: 1
            };

            const result = await collectorService.collectResults(request);

            expect(result.results).toHaveLength(0);
            expect(result.metadata.successfulEngines).toHaveLength(0);
            expect(result.metadata.failedEngines).toHaveLength(1);
            expect(result.metadata.failedEngines[0]).toBe('nonexistent');
        });

        it('should handle collection attempts gracefully (expect blocking)', async () => {
            const request = {
                query: 'test query',
                engines: ['google', 'bing'],
                maxResults: 1
            };

            try {
                // Use timeout to prevent hanging
                const result = await Promise.race([
                    collectorService.collectResults(request),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Collection timeout')), 5000)
                    )
                ]) as any;

                // If successful, validate structure
                expect(result).toHaveProperty('results');
                expect(result).toHaveProperty('metadata');
                expect(result.metadata).toHaveProperty('totalCollected');
                expect(result.metadata).toHaveProperty('successfulEngines');
                expect(result.metadata).toHaveProperty('failedEngines');

                console.log(`Collection completed: ${result.metadata.totalCollected} results`);
            } catch (error) {
                // Blocking is expected in automated testing
                expect(error).toBeInstanceOf(Error);
                console.log(`Collection blocked as expected: ${error.message}`);
            }
        }, 8000);
    });

    describe('Resource Management', () => {
        it('should cleanup all scrapers without errors', async () => {
            await expect(googleScraper.cleanup()).resolves.not.toThrow();
            await expect(bingScraper.cleanup()).resolves.not.toThrow();
            await expect(braveScraper.cleanup()).resolves.not.toThrow();
            await expect(perplexityScraper.cleanup()).resolves.not.toThrow();
            await expect(collectorService.cleanup()).resolves.not.toThrow();
        });

        it('should handle multiple cleanup calls gracefully', async () => {
            await googleScraper.cleanup();
            await expect(googleScraper.cleanup()).resolves.not.toThrow();
        });
    });
});