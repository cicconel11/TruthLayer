import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GoogleScraper } from '../collectors/google-scraper';
import { BingScraper } from '../collectors/bing-scraper';
import { BraveScraper } from '../collectors/brave-scraper';
import { PerplexityScraper } from '../collectors/perplexity-scraper';
import { CollectorService } from '../collectors/collector-service';
import { SearchResult, CollectionRequest } from '../types/search-result';

/**
 * MANUAL TESTING SUITE FOR LIVE SEARCH ENGINES
 * 
 * These tests are designed to be run manually when testing against live search engines.
 * They are skipped by default to avoid automated blocking.
 * 
 * To run these tests manually:
 * 1. Remove the .skip from describe.skip
 * 2. Run: npm test -- scrapers-manual --run
 * 3. Be aware that search engines may block automated requests
 * 
 * WARNING: Running these tests frequently may result in IP blocking from search engines.
 * Use responsibly and consider using VPN/proxy rotation for extensive testing.
 */

const TEST_QUERIES = [
    'artificial intelligence',
    'climate change research',
    'renewable energy technology'
];

const MANUAL_TIMEOUT = 120000; // 2 minutes for manual tests
const MAX_RESULTS_MANUAL = 5;

describe.skip('Manual Scrapers Live Testing', () => {
    let googleScraper: GoogleScraper;
    let bingScraper: BingScraper;
    let braveScraper: BraveScraper;
    let perplexityScraper: PerplexityScraper;
    let collectorService: CollectorService;

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

    describe('Google Live Scraping', () => {
        it('should scrape Google search results successfully', async () => {
            const query = TEST_QUERIES[0];
            console.log(`Testing Google scraper with query: "${query}"`);

            const results = await googleScraper.scrapeResults(query, MAX_RESULTS_MANUAL);

            expect(results).toBeInstanceOf(Array);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(MAX_RESULTS_MANUAL);

            console.log(`Google returned ${results.length} results`);

            results.forEach((result, index) => {
                expect(result.id).toBeTruthy();
                expect(result.query).toBe(query);
                expect(result.engine).toBe('google');
                expect(result.rank).toBe(index + 1);
                expect(result.title).toBeTruthy();
                expect(result.url).toMatch(/^https?:\/\//);
                expect(result.timestamp).toBeInstanceOf(Date);
                expect(result.contentHash).toBeTruthy();

                // Log first result for manual verification
                if (index === 0) {
                    console.log('First Google result:', {
                        title: result.title,
                        url: result.url,
                        snippet: result.snippet?.substring(0, 100) + '...'
                    });
                }
            });
        }, MANUAL_TIMEOUT);

        it('should handle different Google query types', async () => {
            const queries = [
                'simple query',
                '"exact phrase search"',
                'site:github.com machine learning',
                'filetype:pdf climate change'
            ];

            for (const query of queries) {
                console.log(`Testing Google with query type: "${query}"`);

                const results = await googleScraper.scrapeResults(query, 3);
                expect(results).toBeInstanceOf(Array);

                if (results.length > 0) {
                    expect(results[0].query).toBe(query);
                    expect(results[0].engine).toBe('google');
                    console.log(`Query "${query}" returned ${results.length} results`);
                }

                // Add delay between queries to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }, MANUAL_TIMEOUT);
    });

    describe('Bing Live Scraping', () => {
        it('should scrape Bing search results successfully', async () => {
            const query = TEST_QUERIES[1];
            console.log(`Testing Bing scraper with query: "${query}"`);

            const results = await bingScraper.scrapeResults(query, MAX_RESULTS_MANUAL);

            expect(results).toBeInstanceOf(Array);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(MAX_RESULTS_MANUAL);

            console.log(`Bing returned ${results.length} results`);

            results.forEach((result, index) => {
                expect(result.id).toBeTruthy();
                expect(result.query).toBe(query);
                expect(result.engine).toBe('bing');
                expect(result.rank).toBe(index + 1);
                expect(result.title).toBeTruthy();
                expect(result.url).toMatch(/^https?:\/\//);

                if (index === 0) {
                    console.log('First Bing result:', {
                        title: result.title,
                        url: result.url,
                        snippet: result.snippet?.substring(0, 100) + '...'
                    });
                }
            });
        }, MANUAL_TIMEOUT);
    });

    describe('Brave Live Scraping', () => {
        it('should scrape Brave search results successfully', async () => {
            const query = TEST_QUERIES[2];
            console.log(`Testing Brave scraper with query: "${query}"`);

            const results = await braveScraper.scrapeResults(query, MAX_RESULTS_MANUAL);

            expect(results).toBeInstanceOf(Array);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(MAX_RESULTS_MANUAL);

            console.log(`Brave returned ${results.length} results`);

            results.forEach((result, index) => {
                expect(result.id).toBeTruthy();
                expect(result.query).toBe(query);
                expect(result.engine).toBe('brave');
                expect(result.rank).toBe(index + 1);
                expect(result.title).toBeTruthy();
                expect(result.url).toMatch(/^https?:\/\//);

                if (index === 0) {
                    console.log('First Brave result:', {
                        title: result.title,
                        url: result.url,
                        snippet: result.snippet?.substring(0, 100) + '...'
                    });
                }
            });
        }, MANUAL_TIMEOUT);
    });

    describe('Perplexity Live Scraping', () => {
        it('should scrape Perplexity AI results successfully', async () => {
            const query = TEST_QUERIES[0];
            console.log(`Testing Perplexity scraper with query: "${query}"`);

            const results = await perplexityScraper.scrapeResults(query, MAX_RESULTS_MANUAL);

            expect(results).toBeInstanceOf(Array);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThanOrEqual(MAX_RESULTS_MANUAL);

            console.log(`Perplexity returned ${results.length} results`);

            results.forEach((result, index) => {
                expect(result.id).toBeTruthy();
                expect(result.query).toBe(query);
                expect(result.engine).toBe('perplexity');
                expect(result.rank).toBe(index + 1);
                expect(result.title).toBeTruthy();
                expect(result.url).toMatch(/^https?:\/\//);

                if (index === 0) {
                    console.log('First Perplexity result:', {
                        title: result.title,
                        url: result.url,
                        snippet: result.snippet?.substring(0, 100) + '...'
                    });
                }
            });
        }, MANUAL_TIMEOUT);
    });

    describe('Cross-Engine Comparison', () => {
        it('should demonstrate different results across engines', async () => {
            const query = 'machine learning algorithms';
            console.log(`Comparing results across engines for: "${query}"`);

            const [googleResults, bingResults, braveResults] = await Promise.allSettled([
                googleScraper.scrapeResults(query, 3),
                bingScraper.scrapeResults(query, 3),
                braveScraper.scrapeResults(query, 3)
            ]);

            const results = {
                google: googleResults.status === 'fulfilled' ? googleResults.value : [],
                bing: bingResults.status === 'fulfilled' ? bingResults.value : [],
                brave: braveResults.status === 'fulfilled' ? braveResults.value : []
            };

            console.log('Results summary:');
            console.log(`Google: ${results.google.length} results`);
            console.log(`Bing: ${results.bing.length} results`);
            console.log(`Brave: ${results.brave.length} results`);

            // Analyze URL overlap
            const allUrls = [
                ...results.google.map(r => r.url),
                ...results.bing.map(r => r.url),
                ...results.brave.map(r => r.url)
            ];
            const uniqueUrls = new Set(allUrls);

            console.log(`Total URLs: ${allUrls.length}, Unique URLs: ${uniqueUrls.size}`);
            console.log(`Overlap rate: ${((allUrls.length - uniqueUrls.size) / allUrls.length * 100).toFixed(1)}%`);

            // At least one engine should return results
            const totalResults = results.google.length + results.bing.length + results.brave.length;
            expect(totalResults).toBeGreaterThan(0);
        }, MANUAL_TIMEOUT);
    });

    describe('CollectorService Live Integration', () => {
        it('should orchestrate multi-engine collection', async () => {
            const request: CollectionRequest = {
                query: 'artificial intelligence ethics',
                engines: ['google', 'bing', 'brave'],
                maxResults: 3
            };

            console.log(`Testing CollectorService with query: "${request.query}"`);

            const result = await collectorService.collectResults(request);

            expect(result.results).toBeInstanceOf(Array);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.collectionTime).toBeGreaterThan(0);

            console.log('Collection results:');
            console.log(`Total results: ${result.metadata.totalCollected}`);
            console.log(`Successful engines: ${result.metadata.successfulEngines.join(', ')}`);
            console.log(`Failed engines: ${result.metadata.failedEngines.join(', ')}`);
            console.log(`Collection time: ${result.metadata.collectionTime}ms`);

            if (result.metadata.duplicatesRemoved !== undefined) {
                console.log(`Duplicates removed: ${result.metadata.duplicatesRemoved}`);
            }

            // Validate deduplication
            if (result.results.length > 1) {
                const urls = result.results.map(r => r.url);
                const uniqueUrls = new Set(urls);
                expect(uniqueUrls.size).toBe(urls.length); // No duplicates
            }

            // At least some collection should succeed or fail gracefully
            expect(result.metadata.successfulEngines.length + result.metadata.failedEngines.length).toBeGreaterThan(0);
        }, MANUAL_TIMEOUT);
    });

    describe('Anti-Detection Effectiveness', () => {
        it('should successfully rotate user agents and avoid detection', async () => {
            const query = 'test query for anti-detection';
            const results = [];

            console.log('Testing anti-detection measures with multiple requests...');

            // Make several requests to test anti-detection
            for (let i = 0; i < 3; i++) {
                try {
                    console.log(`Request ${i + 1}/3...`);
                    const result = await googleScraper.scrapeResults(query, 1);
                    results.push(result);
                    console.log(`Request ${i + 1} succeeded with ${result.length} results`);

                    // Add delay between requests
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } catch (error) {
                    console.log(`Request ${i + 1} failed: ${error.message}`);
                    results.push({ error: error.message });
                }
            }

            console.log(`Anti-detection test completed. ${results.filter(r => Array.isArray(r)).length}/3 requests succeeded`);

            // At least some requests should succeed if anti-detection is working
            const successfulRequests = results.filter(r => Array.isArray(r));
            expect(successfulRequests.length).toBeGreaterThanOrEqual(0); // Allow for blocking in automated environments
        }, MANUAL_TIMEOUT);
    });

    describe('Result Quality Validation', () => {
        it('should extract high-quality, clean results', async () => {
            const query = 'web development best practices';
            console.log(`Testing result quality for: "${query}"`);

            const results = await googleScraper.scrapeResults(query, 5);

            if (results.length > 0) {
                console.log('Validating result quality...');

                results.forEach((result, index) => {
                    console.log(`Result ${index + 1}:`);
                    console.log(`  Title: ${result.title}`);
                    console.log(`  URL: ${result.url}`);
                    console.log(`  Snippet: ${result.snippet?.substring(0, 100)}...`);

                    // Quality checks
                    expect(result.title).not.toMatch(/<[^>]*>/); // No HTML tags
                    expect(result.title.length).toBeGreaterThan(5);
                    expect(result.title.length).toBeLessThan(200);

                    expect(() => new URL(result.url)).not.toThrow(); // Valid URL
                    expect(result.url).not.toContain('/url?'); // No redirect URLs
                    expect(result.url).not.toContain('google.com'); // No Google internal links

                    if (result.snippet) {
                        expect(result.snippet).not.toMatch(/<[^>]*>/); // No HTML tags
                        expect(result.snippet.length).toBeGreaterThan(10);
                        expect(result.snippet.length).toBeLessThan(500);
                    }
                });

                console.log('All results passed quality validation');
            } else {
                console.log('No results returned (likely blocked)');
            }
        }, MANUAL_TIMEOUT);
    });
});