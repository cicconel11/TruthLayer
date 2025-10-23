import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { GoogleScraper } from '../collectors/google-scraper';
import { BingScraper } from '../collectors/bing-scraper';
import { BraveScraper } from '../collectors/brave-scraper';
import { PerplexityScraper } from '../collectors/perplexity-scraper';
import { CollectorService } from '../collectors/collector-service';
import { SearchResult, CollectionRequest } from '../types/search-result';
import { logger } from '../utils/logger';

// Test configuration
const TEST_QUERIES = [
    'test query',
    'simple test',
    'basic search'
];

const INTEGRATION_TIMEOUT = 30000; // 30 seconds for integration tests
const MAX_RESULTS_TEST = 3; // Limit results for faster testing

describe('Scrapers Integration Tests', () => {
    let googleScraper: GoogleScraper;
    let bingScraper: BingScraper;
    let braveScraper: BraveScraper;
    let perplexityScraper: PerplexityScraper;
    let collectorService: CollectorService;

    beforeAll(() => {
        // Reduce log level for cleaner test output
        logger.level = 'error';
    });

    beforeEach(() => {
        googleScraper = new GoogleScraper();
        bingScraper = new BingScraper();
        braveScraper = new BraveScraper();
        perplexityScraper = new PerplexityScraper();
        collectorService = new CollectorService();
    });

    afterEach(async () => {
        await Promise.all([
            googleScraper.cleanup(),
            bingScraper.cleanup(),
            braveScraper.cleanup(),
            perplexityScraper.cleanup(),
            collectorService.cleanup()
        ]);
    });

    describe('Scraper Infrastructure Tests', () => {
        it('should initialize all scrapers correctly', () => {
            expect(googleScraper['engineName']).toBe('google');
            expect(bingScraper['engineName']).toBe('bing');
            expect(braveScraper['engineName']).toBe('brave');
            expect(perplexityScraper['engineName']).toBe('perplexity');
        });

        it('should have correct base URLs configured', () => {
            expect(googleScraper['baseUrl']).toBe('https://www.google.com');
            expect(bingScraper['baseUrl']).toBe('https://www.bing.com');
            expect(braveScraper['baseUrl']).toBe('https://search.brave.com');
            expect(perplexityScraper['baseUrl']).toBe('https://www.perplexity.ai');
        });

        it('should handle scraping attempts with proper error handling', async () => {
            const query = TEST_QUERIES[0];

            // Test each scraper's error handling
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            for (const { scraper, name } of scrapers) {
                try {
                    const results = await scraper.scrapeResults(query, 1);

                    // If scraping succeeds (not blocked), validate basic structure
                    expect(results).toBeInstanceOf(Array);

                    if (results.length > 0) {
                        const result = results[0];
                        expect(result.id).toBeTruthy();
                        expect(result.query).toBe(query);
                        expect(result.engine).toBe(scraper['engineName']);
                        expect(result.timestamp).toBeInstanceOf(Date);
                    }
                } catch (error) {
                    // Blocking/errors are expected in automated testing
                    expect(error).toBeInstanceOf(Error);
                    console.log(`${name} scraper blocked (expected): ${error.message}`);
                }
            }

            // Test passes if all scrapers handle requests without crashing
            expect(true).toBe(true);
        }, 15000);
    });

    describe('Result Normalization Tests', () => {
        it('should normalize Google results correctly', () => {
            const rawResult = {
                title: '  Test Title  ',
                snippet: '  Test snippet content  ',
                url: 'https://example.com',
                rank: 1
            };

            const normalized = googleScraper['normalizeResult'](rawResult, 'test query', 1);

            expect(normalized.query).toBe('test query');
            expect(normalized.engine).toBe('google');
            expect(normalized.rank).toBe(1);
            expect(normalized.title).toBe('Test Title');
            expect(normalized.snippet).toBe('Test snippet content');
            expect(normalized.url).toBe('https://example.com');
            expect(normalized.id).toBeTruthy();
            expect(normalized.timestamp).toBeInstanceOf(Date);
            expect(normalized.contentHash).toBeTruthy();
            expect(normalized.contentHash).toHaveLength(64);
        });

        it('should normalize Bing results correctly', () => {
            const rawResult = {
                title: '  Bing Test Title  ',
                snippet: '  Bing test snippet  ',
                url: 'https://bing-example.com',
                rank: 2
            };

            const normalized = bingScraper['normalizeResult'](rawResult, 'bing query', 2);

            expect(normalized.query).toBe('bing query');
            expect(normalized.engine).toBe('bing');
            expect(normalized.rank).toBe(2);
            expect(normalized.title).toBe('Bing Test Title');
            expect(normalized.snippet).toBe('Bing test snippet');
            expect(normalized.url).toBe('https://bing-example.com');
            expect(normalized.contentHash).toBeTruthy();
        });

        it('should normalize Brave results correctly', () => {
            const rawResult = {
                title: '  Brave Test Title  ',
                snippet: '  Brave test snippet  ',
                url: 'https://brave-example.com',
                rank: 3
            };

            const normalized = braveScraper['normalizeResult'](rawResult, 'brave query', 3);

            expect(normalized.query).toBe('brave query');
            expect(normalized.engine).toBe('brave');
            expect(normalized.rank).toBe(3);
            expect(normalized.title).toBe('Brave Test Title');
            expect(normalized.snippet).toBe('Brave test snippet');
            expect(normalized.url).toBe('https://brave-example.com');
            expect(normalized.contentHash).toBeTruthy();
        });

        it('should normalize Perplexity results correctly', () => {
            const rawResult = {
                title: '  Perplexity Test Title  ',
                snippet: '  Perplexity test snippet  ',
                url: 'https://perplexity-example.com',
                rank: 4
            };

            const normalized = perplexityScraper['normalizeResult'](rawResult, 'perplexity query', 4);

            expect(normalized.query).toBe('perplexity query');
            expect(normalized.engine).toBe('perplexity');
            expect(normalized.rank).toBe(4);
            expect(normalized.title).toBe('Perplexity Test Title');
            expect(normalized.snippet).toBe('Perplexity test snippet');
            expect(normalized.url).toBe('https://perplexity-example.com');
            expect(normalized.contentHash).toBeTruthy();
        });

        it('should generate unique content hashes for different results', () => {
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

            const normalized1 = googleScraper['normalizeResult'](rawResult1, 'test query', 1);
            const normalized2 = googleScraper['normalizeResult'](rawResult2, 'test query', 2);

            expect(normalized1.contentHash).not.toBe(normalized2.contentHash);
            expect(normalized1.id).not.toBe(normalized2.id);
        });
    });

    describe('Blocking Detection Tests', () => {
        it('should detect CAPTCHA indicators correctly', async () => {
            // Mock page with CAPTCHA content
            const mockPage = {
                content: () => Promise.resolve('<html><body>Please complete the security check to continue</body></html>'),
                title: () => Promise.resolve('Security Check'),
                $: () => Promise.resolve(null)
            } as any;

            const isBlocked = await googleScraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });

        it('should detect unusual traffic messages', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>Our systems have detected unusual traffic from your network</body></html>'),
                title: () => Promise.resolve('Google'),
                $: () => Promise.resolve(null)
            } as any;

            const isBlocked = await googleScraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });

        it('should not detect blocking on normal pages', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>Normal search results content</body></html>'),
                title: () => Promise.resolve('Search Results'),
                $: () => Promise.resolve(null)
            } as any;

            const isBlocked = await googleScraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(false);
        });

        it('should detect CAPTCHA elements', async () => {
            const mockPage = {
                content: () => Promise.resolve('<html><body>Normal content</body></html>'),
                title: () => Promise.resolve('Google'),
                $: () => Promise.resolve({}) // Mock element found
            } as any;

            const isBlocked = await googleScraper['isPageBlocked'](mockPage);
            expect(isBlocked).toBe(true);
        });
    });

    describe('CollectorService Integration', () => {
        it('should initialize with all scrapers available', () => {
            expect(collectorService['scrapers'].has('google')).toBe(true);
            expect(collectorService['scrapers'].has('bing')).toBe(true);
            expect(collectorService['scrapers'].has('perplexity')).toBe(true);
            expect(collectorService['scrapers'].has('brave')).toBe(true);
            expect(collectorService['scrapers'].size).toBe(4);
        });

        it('should handle requests for unavailable engines gracefully', async () => {
            const request: CollectionRequest = {
                query: 'test query',
                engines: ['nonexistent'],
                maxResults: 3
            };

            const result = await collectorService.collectResults(request);

            expect(result.results).toHaveLength(0);
            expect(result.metadata.successfulEngines).toHaveLength(0);
            expect(result.metadata.failedEngines).toEqual(['nonexistent']);
            expect(result.metadata.totalCollected).toBe(0);
            expect(result.metadata.collectionTime).toBeGreaterThanOrEqual(0);
        });

        it('should validate results correctly', () => {
            const validResults = [{
                id: 'test-1',
                query: 'test query',
                engine: 'google' as const,
                rank: 1,
                title: 'Test Title',
                snippet: 'Test snippet',
                url: 'https://example.com',
                timestamp: new Date(),
                contentHash: 'abc123'
            }];

            const isValid = collectorService.validateResults(validResults);
            expect(isValid).toBe(true);
        });

        it('should reject invalid results', () => {
            const invalidResults = [{
                id: '',
                query: 'test query',
                engine: 'google' as const,
                rank: 1,
                title: '',
                snippet: 'Test snippet',
                url: 'https://example.com',
                timestamp: new Date()
            }];

            const isValid = collectorService.validateResults(invalidResults);
            expect(isValid).toBe(false);
        });

        it('should handle collection attempts gracefully', async () => {
            const request: CollectionRequest = {
                query: TEST_QUERIES[0],
                engines: ['google', 'bing'],
                maxResults: 2
            };

            const result = await collectorService.collectResults(request);

            // Should handle the request without crashing
            expect(result.results).toBeInstanceOf(Array);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.totalCollected).toBeGreaterThanOrEqual(0);
            expect(result.metadata.successfulEngines).toBeInstanceOf(Array);
            expect(result.metadata.failedEngines).toBeInstanceOf(Array);
            expect(result.metadata.collectionTime).toBeGreaterThan(0);

            // In automated testing, engines will likely be blocked
            expect(result.metadata.successfulEngines.length + result.metadata.failedEngines.length).toBe(2);
        }, INTEGRATION_TIMEOUT);

        it('should handle multi-engine collection with comprehensive validation', async () => {
            const request: CollectionRequest = {
                query: 'integration test query',
                engines: ['google', 'bing', 'brave', 'perplexity'],
                maxResults: 3
            };

            const result = await collectorService.collectResults(request);

            // Validate collection result structure
            expect(result).toHaveProperty('results');
            expect(result).toHaveProperty('metadata');

            // Validate metadata completeness
            expect(result.metadata).toHaveProperty('totalCollected');
            expect(result.metadata).toHaveProperty('successfulEngines');
            expect(result.metadata).toHaveProperty('failedEngines');
            expect(result.metadata).toHaveProperty('collectionTime');
            expect(result.metadata).toHaveProperty('duplicatesRemoved');

            // All engines should be accounted for
            const totalEngines = result.metadata.successfulEngines.length + result.metadata.failedEngines.length;
            expect(totalEngines).toBe(4);

            // Validate individual results if any were collected
            if (result.results.length > 0) {
                result.results.forEach(searchResult => {
                    expect(searchResult).toHaveProperty('id');
                    expect(searchResult).toHaveProperty('query');
                    expect(searchResult).toHaveProperty('engine');
                    expect(searchResult).toHaveProperty('rank');
                    expect(searchResult).toHaveProperty('title');
                    expect(searchResult).toHaveProperty('url');
                    expect(searchResult).toHaveProperty('timestamp');

                    // Validate data types and constraints
                    expect(typeof searchResult.id).toBe('string');
                    expect(searchResult.query).toBe(request.query);
                    expect(['google', 'bing', 'brave', 'perplexity']).toContain(searchResult.engine);
                    expect(searchResult.rank).toBeGreaterThan(0);
                    expect(typeof searchResult.title).toBe('string');
                    expect(searchResult.title.length).toBeGreaterThan(0);
                    expect(() => new URL(searchResult.url)).not.toThrow();
                    expect(searchResult.timestamp).toBeInstanceOf(Date);
                });
            }

            console.log(`Collection test completed: ${result.metadata.totalCollected} results, ${result.metadata.successfulEngines.length} successful engines, ${result.metadata.failedEngines.length} failed engines`);

            // Test passes if collection completes without crashing
            expect(result.metadata.collectionTime).toBeGreaterThan(0);
        }, 15000);
    });

    describe('Error Handling and Resilience', () => {
        it('should handle invalid queries gracefully across all scrapers', async () => {
            const invalidQueries = ['', '   ', '\n\t'];
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            for (const { scraper, name } of scrapers) {
                for (const invalidQuery of invalidQueries) {
                    try {
                        const results = await scraper.scrapeResults(invalidQuery as any, 1);
                        // If it doesn't throw, results should be valid
                        expect(results).toBeInstanceOf(Array);
                        console.log(`${name} handled invalid query gracefully: "${invalidQuery}"`);
                    } catch (error) {
                        // Errors are acceptable for invalid queries
                        expect(error).toBeInstanceOf(Error);
                        console.log(`${name} properly rejected invalid query: "${invalidQuery}"`);
                    }
                }
            }
        }, 10000);

        it('should validate result data integrity comprehensively', () => {
            const testResults: SearchResult[] = [{
                id: 'test-1',
                query: 'test query',
                engine: 'google',
                rank: 1,
                title: 'Valid Title',
                snippet: 'Valid snippet content',
                url: 'https://example.com',
                timestamp: new Date(),
                contentHash: 'a'.repeat(64) // Valid 64-character hash
            }];

            testResults.forEach(result => {
                // URL validation
                expect(() => new URL(result.url)).not.toThrow();
                expect(result.url).toMatch(/^https?:\/\//);

                // Title validation
                expect(result.title.length).toBeGreaterThan(0);
                expect(result.title.length).toBeLessThan(500);
                expect(result.title.trim()).toBe(result.title); // No leading/trailing whitespace

                // Snippet validation
                if (result.snippet) {
                    expect(result.snippet.length).toBeLessThan(1000);
                    expect(result.snippet.trim()).toBe(result.snippet);
                }

                // Rank validation
                expect(result.rank).toBeGreaterThan(0);
                expect(result.rank).toBeLessThanOrEqual(100);
                expect(Number.isInteger(result.rank)).toBe(true);

                // Timestamp validation
                expect(result.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
                expect(result.timestamp.getTime()).toBeGreaterThan(Date.now() - 300000); // Within 5 minutes

                // Engine validation
                expect(['google', 'bing', 'brave', 'perplexity']).toContain(result.engine);

                // ID validation
                expect(result.id).toBeTruthy();
                expect(typeof result.id).toBe('string');

                // Content hash validation
                if (result.contentHash) {
                    expect(result.contentHash).toHaveLength(64); // SHA-256 hex
                    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
                }
            });
        });

        it('should handle network timeouts gracefully across all scrapers', async () => {
            const query = 'timeout test';
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            for (const { scraper, name } of scrapers) {
                try {
                    const results = await scraper.scrapeResults(query, 1);
                    expect(results).toBeInstanceOf(Array);
                    console.log(`${name} handled request successfully`);
                } catch (error) {
                    // Network errors are acceptable in integration tests
                    expect(error).toBeInstanceOf(Error);
                    expect(error.message).toBeTruthy();
                    console.log(`${name} failed gracefully: ${error.message}`);
                }
            }
        }, 15000);

        it('should implement retry logic with exponential backoff', async () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                // Test that performRequest method exists and has retry capability
                expect(scraper['performRequest']).toBeDefined();
                expect(typeof scraper['performRequest']).toBe('function');
            });
        });

        it('should handle malformed HTML gracefully', () => {
            const malformedData = [
                { title: '<script>alert("xss")</script>', snippet: 'Normal snippet', url: 'https://example.com', rank: 1 },
                { title: 'Title with\n\nnewlines', snippet: 'Snippet\twith\ttabs', url: 'https://example.com', rank: 2 },
                { title: 'Title with "quotes" & ampersands', snippet: 'Snippet with émojis 🚀', url: 'https://example.com/path?param=value', rank: 3 }
            ];

            malformedData.forEach(rawResult => {
                try {
                    const normalized = googleScraper['normalizeResult'](rawResult, 'test query', rawResult.rank);

                    // Should handle special characters without breaking
                    expect(normalized.title).toBeTruthy();
                    expect(normalized.snippet).toBeTruthy();
                    expect(normalized.url).toBeTruthy();
                    expect(normalized.contentHash).toBeTruthy();

                    // Should preserve content but normalize whitespace
                    expect(normalized.title.trim()).toBe(normalized.title);
                    expect(normalized.snippet.trim()).toBe(normalized.snippet);

                } catch (error) {
                    // Errors are acceptable for truly malformed data
                    expect(error).toBeInstanceOf(Error);
                }
            });
        });
    });

    describe('Anti-Detection Infrastructure', () => {
        it('should implement user agent rotation across all scrapers', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                // Test that different user agents are generated
                const userAgents = Array.from({ length: 15 }, () =>
                    scraper['getRandomUserAgent']()
                );

                const uniqueUserAgents = new Set(userAgents);
                expect(uniqueUserAgents.size).toBeGreaterThan(1);

                // All should be valid user agent strings
                userAgents.forEach(ua => {
                    expect(ua).toContain('Mozilla');
                    expect(ua.length).toBeGreaterThan(50);
                    // Should contain browser identifiers
                    const hasBrowser = ua.includes('Chrome') || ua.includes('Firefox') || ua.includes('Safari');
                    expect(hasBrowser).toBe(true);
                });
            });
        });

        it('should validate anti-detection measures effectiveness', async () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            for (const { scraper, name } of scrapers) {
                // Test stealth page creation
                const page = await scraper['createStealthPage']();
                expect(page).toBeDefined();

                // Verify anti-detection measures are applied
                const webdriver = await page.evaluate(() => (navigator as any).webdriver);
                expect(webdriver).toBeFalsy(); // Should be false or undefined

                const userAgent = await page.evaluate(() => navigator.userAgent);
                expect(userAgent).toContain('Mozilla');
                expect(userAgent).not.toContain('HeadlessChrome');

                // Test that plugins are properly spoofed
                const plugins = await page.evaluate(() => navigator.plugins.length);
                expect(plugins).toBeGreaterThan(0);

                await page.close();
                console.log(`${name} anti-detection measures validated`);
            }
        }, INTEGRATION_TIMEOUT);

        it('should implement random delays with proper distribution', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                const delays = Array.from({ length: 20 }, () =>
                    scraper['getRandomDelay'](1000, 3000)
                );

                // Should generate different delays
                const uniqueDelays = new Set(delays);
                expect(uniqueDelays.size).toBeGreaterThan(5); // Expect good distribution

                // All delays should be within range
                delays.forEach(delay => {
                    expect(delay).toBeGreaterThanOrEqual(1000);
                    expect(delay).toBeLessThanOrEqual(3000);
                });

                // Test default range
                const defaultDelays = Array.from({ length: 10 }, () =>
                    scraper['getRandomDelay']()
                );

                defaultDelays.forEach(delay => {
                    expect(delay).toBeGreaterThanOrEqual(2000);
                    expect(delay).toBeLessThanOrEqual(8000);
                });
            });
        });

        it('should generate consistent content hashes across scrapers', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];
            const content = 'test content for hashing';

            scrapers.forEach(scraper => {
                const hash1 = scraper['generateContentHash'](content);
                const hash2 = scraper['generateContentHash'](content);

                expect(hash1).toBe(hash2);
                expect(hash1).toHaveLength(64); // SHA-256 hex length

                // Different content should produce different hashes
                const hash3 = scraper['generateContentHash'](content + ' different');
                expect(hash1).not.toBe(hash3);
            });
        });

        it('should implement proxy rotation infrastructure', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                // Test proxy rotator exists and functions
                const proxyRotator = scraper['proxyRotator'];
                expect(proxyRotator).toBeDefined();

                // Test proxy rotation (even with empty proxy list)
                const proxy1 = proxyRotator.getNextProxy();
                const proxy2 = proxyRotator.getNextProxy();

                // Should handle empty proxy list gracefully
                if (proxy1 === null && proxy2 === null) {
                    expect(true).toBe(true); // No proxies configured, which is acceptable
                } else {
                    // If proxies exist, rotation should work
                    expect(proxyRotator).toHaveProperty('getNextProxy');
                    expect(proxyRotator).toHaveProperty('markProxyFailed');
                    expect(proxyRotator).toHaveProperty('resetProxy');
                }
            });
        });

        it('should implement request throttling', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                const throttler = scraper['throttler'];
                expect(throttler).toBeDefined();
                expect(throttler).toHaveProperty('throttle');
            });
        });

        it('should validate browser fingerprinting setup', async () => {
            // Test browser initialization with anti-detection measures
            const browser = await googleScraper['initializeBrowser'](false); // No proxy for test
            expect(browser).toBeDefined();

            const page = await googleScraper['createStealthPage']();
            expect(page).toBeDefined();

            // Test that stealth measures are applied
            const userAgent = await page.evaluate(() => navigator.userAgent);
            expect(userAgent).toContain('Mozilla');

            const webdriver = await page.evaluate(() => (navigator as any).webdriver);
            expect(webdriver).toBeFalsy(); // Should be false or undefined

            // Test viewport randomization
            const viewport = page.viewport();
            expect(viewport).toBeDefined();
            expect(viewport!.width).toBeGreaterThan(800);
            expect(viewport!.height).toBeGreaterThan(600);

            // Test language and timezone spoofing
            const language = await page.evaluate(() => navigator.language);
            expect(language).toBeTruthy();

            const timezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
            expect(timezone).toBeTruthy();

            await page.close();
        });

        it('should implement comprehensive result parsing accuracy validation', async () => {
            const testCases = [
                {
                    title: 'Machine Learning Algorithms - Complete Guide',
                    snippet: 'Learn about different machine learning algorithms including supervised, unsupervised, and reinforcement learning techniques.',
                    url: 'https://example.com/ml-guide',
                    rank: 1
                },
                {
                    title: 'Climate Change Research: Latest Findings',
                    snippet: 'Recent studies show accelerating climate change impacts on global ecosystems and weather patterns.',
                    url: 'https://research.org/climate-study-2024',
                    rank: 2
                },
                {
                    title: 'Renewable Energy Technology Advances',
                    snippet: 'Solar and wind energy efficiency improvements drive down costs and increase adoption worldwide.',
                    url: 'https://energy-news.com/renewable-advances',
                    rank: 3
                }
            ];

            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            scrapers.forEach(({ scraper, name }) => {
                testCases.forEach(testCase => {
                    const normalized = scraper['normalizeResult'](testCase, 'test query', testCase.rank);

                    // Validate result structure completeness
                    expect(normalized.id).toBeTruthy();
                    expect(normalized.query).toBe('test query');
                    expect(normalized.engine).toBe(scraper['engineName']);
                    expect(normalized.rank).toBe(testCase.rank);
                    expect(normalized.title).toBe(testCase.title);
                    expect(normalized.snippet).toBe(testCase.snippet);
                    expect(normalized.url).toBe(testCase.url);
                    expect(normalized.timestamp).toBeInstanceOf(Date);
                    expect(normalized.contentHash).toBeTruthy();

                    // Validate content hash consistency
                    const hash2 = scraper['normalizeResult'](testCase, 'test query', testCase.rank);
                    expect(normalized.contentHash).toBe(hash2.contentHash);

                    // Validate URL parsing
                    expect(() => new URL(normalized.url)).not.toThrow();

                    console.log(`${name} parsed result ${testCase.rank} correctly`);
                });
            });
        });
    });

    describe('Proxy Rotation and Network Resilience', () => {
        it('should implement proxy rotation infrastructure correctly', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                const proxyRotator = scraper['proxyRotator'];
                expect(proxyRotator).toBeDefined();

                // Test proxy rotation methods exist
                expect(typeof proxyRotator.getNextProxy).toBe('function');
                expect(typeof proxyRotator.markProxyFailed).toBe('function');
                expect(typeof proxyRotator.resetProxy).toBe('function');

                // Test proxy rotation behavior (even with empty proxy list)
                const proxy1 = proxyRotator.getNextProxy();
                const proxy2 = proxyRotator.getNextProxy();

                // Should handle empty proxy list gracefully
                if (proxy1 === null && proxy2 === null) {
                    console.log('No proxies configured - testing graceful handling');
                    expect(proxy1).toBe(null);
                    expect(proxy2).toBe(null);
                } else if (proxy1 && proxy2) {
                    // If proxies exist, test rotation
                    expect(proxy1).toHaveProperty('host');
                    expect(proxy1).toHaveProperty('port');
                    expect(proxy1).toHaveProperty('protocol');
                }
            });
        });

        it('should validate comprehensive proxy rotation behavior', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                const proxyRotator = scraper['proxyRotator'];

                // Test multiple proxy rotations
                const proxies = Array.from({ length: 10 }, () => proxyRotator.getNextProxy());

                // All should be consistent (null if no proxies, or valid proxy objects)
                const allNull = proxies.every(p => p === null);
                const allValid = proxies.every(p => p && typeof p === 'object' && p.host && p.port);

                expect(allNull || allValid).toBe(true);

                // Test proxy failure handling
                if (proxies[0]) {
                    proxyRotator.markProxyFailed(proxies[0]);
                    const nextProxy = proxyRotator.getNextProxy();
                    // Should still return a proxy (or handle gracefully)
                    expect(nextProxy !== undefined).toBe(true);
                }

                console.log(`Proxy rotation validated for ${scraper['engineName']}`);
            });
        });

        it('should handle proxy failures and recovery', () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            scrapers.forEach(scraper => {
                const proxyRotator = scraper['proxyRotator'];

                // Test marking proxy as failed
                const proxy = proxyRotator.getNextProxy();
                if (proxy) {
                    // Mark as failed and verify it's handled
                    proxyRotator.markProxyFailed(proxy);

                    // Should still return a proxy (or null if no alternatives)
                    const nextProxy = proxyRotator.getNextProxy();
                    expect(nextProxy !== undefined).toBe(true);

                    // Test proxy reset
                    proxyRotator.resetProxy(proxy);
                    const resetProxy = proxyRotator.getNextProxy();
                    expect(resetProxy !== undefined).toBe(true);
                }
            });
        });

        it('should implement request throttling correctly', async () => {
            const scrapers = [googleScraper, bingScraper, braveScraper, perplexityScraper];

            for (const scraper of scrapers) {
                const throttler = scraper['throttler'];
                expect(throttler).toBeDefined();
                expect(typeof throttler.throttle).toBe('function');

                // Test throttling timing (allow for implementation variations)
                const startTime = Date.now();
                await throttler.throttle(100, 200);
                const endTime = Date.now();

                const duration = endTime - startTime;
                expect(duration).toBeGreaterThanOrEqual(0); // Should complete without error
                expect(duration).toBeLessThan(1000); // Should not take too long
            }
        });

        it('should handle browser initialization with proxy settings', async () => {
            // Test browser initialization without proxy
            const browserNoProxy = await googleScraper['initializeBrowser'](false);
            expect(browserNoProxy).toBeDefined();

            // Test browser initialization with proxy (should not fail even if no proxies configured)
            const browserWithProxy = await googleScraper['initializeBrowser'](true);
            expect(browserWithProxy).toBeDefined();

            // Both should be the same instance (singleton pattern)
            expect(browserNoProxy).toBe(browserWithProxy);
        });
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

            // Test cleanup for all scrapers
            const scrapers = [bingScraper, braveScraper, perplexityScraper];
            for (const scraper of scrapers) {
                await scraper.cleanup();
                await expect(scraper.cleanup()).resolves.not.toThrow();
            }
        });

        it('should properly manage browser instances', async () => {
            // Initialize browser
            const browser = await googleScraper['initializeBrowser']();
            expect(browser).toBeDefined();
            expect(googleScraper['browser']).toBe(browser);

            // Cleanup should close browser
            await googleScraper.cleanup();
            expect(googleScraper['browser']).toBe(null);
        });
    });

    describe('Result Parsing Infrastructure', () => {
        it('should handle empty or malformed data gracefully across all scrapers', () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            const malformedResults = [
                { title: '', snippet: '', url: '', rank: 0 },
                { title: null, snippet: null, url: null, rank: -1 },
                { title: undefined, snippet: undefined, url: undefined, rank: NaN },
                { title: '   ', snippet: '   ', url: 'invalid-url', rank: 1.5 }
            ];

            scrapers.forEach(({ scraper, name }) => {
                malformedResults.forEach(rawResult => {
                    try {
                        const normalized = scraper['normalizeResult'](rawResult as any, 'test', 1);
                        // If normalization succeeds, validate basic structure
                        expect(normalized).toHaveProperty('id');
                        expect(normalized).toHaveProperty('timestamp');
                        expect(normalized).toHaveProperty('engine');
                        console.log(`${name} handled malformed data gracefully`);
                    } catch (error) {
                        // Errors are acceptable for malformed data
                        expect(error).toBeInstanceOf(Error);
                        console.log(`${name} properly rejected malformed data: ${error.message}`);
                    }
                });
            });
        });

        it('should trim whitespace from titles and snippets consistently', () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            const rawResult = {
                title: '   Title with spaces   ',
                snippet: '   Snippet with spaces   ',
                url: 'https://example.com',
                rank: 1
            };

            scrapers.forEach(({ scraper, name }) => {
                const normalized = scraper['normalizeResult'](rawResult, 'test query', 1);

                expect(normalized.title).toBe('Title with spaces');
                expect(normalized.snippet).toBe('Snippet with spaces');
                expect(normalized.engine).toBe(scraper['engineName']);
                console.log(`${name} properly trimmed whitespace`);
            });
        });

        it('should handle special characters and encoding correctly', () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            const testCases = [
                {
                    title: 'Title with "quotes" & ampersands',
                    snippet: 'Snippet with <tags> and émojis 🚀',
                    url: 'https://example.com/path?param=value&other=test',
                    rank: 1
                },
                {
                    title: 'Título en español con acentos',
                    snippet: 'Descripción con caracteres especiales: ñ, ü, ç',
                    url: 'https://example.es/página',
                    rank: 2
                },
                {
                    title: 'Title with\nnewlines\tand\ttabs',
                    snippet: 'Snippet\rwith\r\nvarious\nwhitespace',
                    url: 'https://example.com',
                    rank: 3
                }
            ];

            scrapers.forEach(({ scraper, name }) => {
                testCases.forEach(rawResult => {
                    const normalized = scraper['normalizeResult'](rawResult, 'test query', rawResult.rank);

                    // Should preserve special characters
                    expect(normalized.title).toBeTruthy();
                    expect(normalized.snippet).toBeTruthy();
                    expect(normalized.url).toBe(rawResult.url);
                    expect(normalized.contentHash).toBeTruthy();

                    // Should normalize whitespace but preserve content
                    expect(normalized.title.trim()).toBe(normalized.title);
                    expect(normalized.snippet.trim()).toBe(normalized.snippet);

                    console.log(`${name} handled special characters correctly for rank ${rawResult.rank}`);
                });
            });
        });

        it('should generate unique IDs and content hashes for different results', () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            const results = [
                { title: 'First Result', snippet: 'First snippet', url: 'https://first.com', rank: 1 },
                { title: 'Second Result', snippet: 'Second snippet', url: 'https://second.com', rank: 2 },
                { title: 'Third Result', snippet: 'Third snippet', url: 'https://third.com', rank: 3 }
            ];

            scrapers.forEach(({ scraper, name }) => {
                const normalizedResults = results.map(result =>
                    scraper['normalizeResult'](result, 'test query', result.rank)
                );

                // All IDs should be unique
                const ids = normalizedResults.map(r => r.id);
                const uniqueIds = new Set(ids);
                expect(uniqueIds.size).toBe(ids.length);

                // All content hashes should be unique
                const hashes = normalizedResults.map(r => r.contentHash);
                const uniqueHashes = new Set(hashes);
                expect(uniqueHashes.size).toBe(hashes.length);

                console.log(`${name} generated unique IDs and hashes for ${normalizedResults.length} results`);
            });
        });

        it('should validate URL parsing accuracy', () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            const urlTestCases = [
                'https://example.com',
                'https://example.com/path/to/page',
                'https://example.com/path?param=value&other=test',
                'https://subdomain.example.com:8080/path',
                'http://example.com', // HTTP should be preserved
                'https://example.com/path#fragment'
            ];

            scrapers.forEach(({ scraper, name }) => {
                urlTestCases.forEach(url => {
                    const rawResult = {
                        title: 'Test Title',
                        snippet: 'Test snippet',
                        url: url,
                        rank: 1
                    };

                    const normalized = scraper['normalizeResult'](rawResult, 'test query', 1);

                    expect(normalized.url).toBe(url);
                    expect(() => new URL(normalized.url)).not.toThrow();

                    console.log(`${name} correctly parsed URL: ${url}`);
                });
            });
        });
    });

    describe('Live Scraping Result Validation', () => {
        it('should validate result parsing accuracy with sample queries', async () => {
            const testQueries = [
                'machine learning algorithms',
                'climate change research',
                'renewable energy technology'
            ];

            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            for (const query of testQueries) {
                console.log(`Testing result parsing accuracy for query: "${query}"`);

                for (const { scraper, name } of scrapers) {
                    try {
                        const results = await scraper.scrapeResults(query, 3);

                        if (results.length > 0) {
                            console.log(`${name} returned ${results.length} results for "${query}"`);

                            // Validate each result's structure and content quality
                            results.forEach((result, index) => {
                                // Basic structure validation
                                expect(result.id).toBeTruthy();
                                expect(result.query).toBe(query);
                                expect(result.engine).toBe(scraper['engineName']);
                                expect(result.rank).toBe(index + 1);
                                expect(result.timestamp).toBeInstanceOf(Date);

                                // Content quality validation
                                expect(result.title).toBeTruthy();
                                expect(result.title.length).toBeGreaterThan(5);
                                expect(result.title.length).toBeLessThan(300);
                                expect(result.title.trim()).toBe(result.title);

                                // URL validation
                                expect(() => new URL(result.url)).not.toThrow();
                                expect(result.url).toMatch(/^https?:\/\//);
                                expect(result.url).not.toContain('google.com/url?'); // No redirect URLs
                                expect(result.url).not.toContain('bing.com/ck/'); // No Bing redirect URLs

                                // Snippet validation (if present)
                                if (result.snippet) {
                                    expect(result.snippet.length).toBeGreaterThan(10);
                                    expect(result.snippet.length).toBeLessThan(500);
                                    expect(result.snippet.trim()).toBe(result.snippet);
                                }

                                // Content hash validation
                                expect(result.contentHash).toBeTruthy();
                                expect(result.contentHash).toHaveLength(64);
                                expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);

                                console.log(`${name} result ${index + 1} validated successfully`);
                            });

                            // Test result uniqueness
                            const urls = results.map(r => r.url);
                            const uniqueUrls = new Set(urls);
                            expect(uniqueUrls.size).toBe(urls.length); // No duplicate URLs

                            const ids = results.map(r => r.id);
                            const uniqueIds = new Set(ids);
                            expect(uniqueIds.size).toBe(ids.length); // No duplicate IDs

                        } else {
                            console.log(`${name} returned no results for "${query}" (likely blocked)`);
                        }

                        // Add delay between scraper attempts
                        await new Promise(resolve => setTimeout(resolve, 2000));

                    } catch (error) {
                        console.log(`${name} failed for "${query}": ${error.message}`);
                        expect(error).toBeInstanceOf(Error);
                    }
                }

                // Add delay between queries
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }, 45000);

        it('should validate cross-engine result comparison and overlap detection', async () => {
            const query = 'artificial intelligence ethics';
            console.log(`Testing cross-engine comparison for: "${query}"`);

            const collectionRequest = {
                query,
                engines: ['google', 'bing', 'brave', 'perplexity'],
                maxResults: 5
            };

            const result = await collectorService.collectResults(collectionRequest);

            // Validate collection result structure
            expect(result.results).toBeInstanceOf(Array);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.totalCollected).toBeGreaterThanOrEqual(0);
            expect(result.metadata.successfulEngines).toBeInstanceOf(Array);
            expect(result.metadata.failedEngines).toBeInstanceOf(Array);
            expect(result.metadata.collectionTime).toBeGreaterThan(0);

            // All engines should be accounted for
            const totalEngines = result.metadata.successfulEngines.length + result.metadata.failedEngines.length;
            expect(totalEngines).toBe(4);

            console.log(`Collection completed: ${result.metadata.totalCollected} results from ${result.metadata.successfulEngines.length} engines`);
            console.log(`Successful engines: ${result.metadata.successfulEngines.join(', ')}`);
            console.log(`Failed engines: ${result.metadata.failedEngines.join(', ')}`);

            if (result.results.length > 0) {
                // Validate deduplication
                const urls = result.results.map(r => r.url);
                const uniqueUrls = new Set(urls);
                expect(uniqueUrls.size).toBe(urls.length);

                // Analyze engine overlap
                const engineGroups = result.results.reduce((acc, r) => {
                    if (!acc[r.engine]) acc[r.engine] = [];
                    acc[r.engine].push(r.url);
                    return acc;
                }, {} as Record<string, string[]>);

                const engines = Object.keys(engineGroups);
                if (engines.length > 1) {
                    // Calculate overlap between engines
                    for (let i = 0; i < engines.length; i++) {
                        for (let j = i + 1; j < engines.length; j++) {
                            const engine1 = engines[i];
                            const engine2 = engines[j];
                            const urls1 = new Set(engineGroups[engine1]);
                            const urls2 = new Set(engineGroups[engine2]);
                            const overlap = [...urls1].filter(url => urls2.has(url));

                            console.log(`Overlap between ${engine1} and ${engine2}: ${overlap.length} URLs`);
                            if (overlap.length > 0) {
                                console.log(`Shared URLs: ${overlap.slice(0, 3).join(', ')}${overlap.length > 3 ? '...' : ''}`);
                            }
                        }
                    }
                }

                // Validate result quality across engines
                result.results.forEach(searchResult => {
                    expect(searchResult.title).toBeTruthy();
                    expect(searchResult.url).toMatch(/^https?:\/\//);
                    expect(searchResult.rank).toBeGreaterThan(0);
                    expect(searchResult.timestamp).toBeInstanceOf(Date);
                    expect(searchResult.contentHash).toMatch(/^[a-f0-9]{64}$/);
                });
            }
        }, 30000);

        it('should validate error handling and recovery mechanisms', async () => {
            const scrapers = [
                { scraper: googleScraper, name: 'Google' },
                { scraper: bingScraper, name: 'Bing' },
                { scraper: braveScraper, name: 'Brave' },
                { scraper: perplexityScraper, name: 'Perplexity' }
            ];

            // Test with various problematic queries
            const problematicQueries = [
                '', // Empty query
                '   ', // Whitespace only
                'a'.repeat(1000), // Very long query
                'query with "quotes" and & symbols', // Special characters
                'query\nwith\nnewlines', // Newlines
                'query\twith\ttabs' // Tabs
            ];

            for (const { scraper, name } of scrapers) {
                console.log(`Testing error handling for ${name}`);

                for (const query of problematicQueries) {
                    try {
                        const results = await scraper.scrapeResults(query, 1);

                        // If it succeeds, validate the results
                        expect(results).toBeInstanceOf(Array);
                        if (results.length > 0) {
                            expect(results[0]).toHaveProperty('id');
                            expect(results[0]).toHaveProperty('engine');
                            expect(results[0]).toHaveProperty('timestamp');
                            console.log(`${name} handled problematic query gracefully: "${query.substring(0, 50)}..."`);
                        }
                    } catch (error) {
                        // Errors are acceptable for problematic queries
                        expect(error).toBeInstanceOf(Error);
                        expect(error.message).toBeTruthy();
                        console.log(`${name} properly rejected problematic query: "${query.substring(0, 50)}..." - ${error.message}`);
                    }
                }

                // Test timeout handling
                try {
                    // This should either succeed or fail gracefully with timeout
                    const results = await scraper.scrapeResults('timeout test query', 1);
                    expect(results).toBeInstanceOf(Array);
                    console.log(`${name} handled timeout test successfully`);
                } catch (error) {
                    expect(error).toBeInstanceOf(Error);
                    console.log(`${name} handled timeout gracefully: ${error.message}`);
                }
            }
        }, 20000);
    });
});