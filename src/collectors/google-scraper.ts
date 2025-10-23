import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Google search scraper with advanced anti-detection measures
 */
export class GoogleScraper extends BaseScraper {
    protected engineName = 'google';
    private readonly baseUrl = 'https://www.google.com';

    /**
     * Scrape Google search results for a given query
     */
    async scrapeResults(query: string, maxResults: number = 20): Promise<SearchResult[]> {
        logger.info(`Starting Google search for query: "${query}"`);

        return this.performRequest(async () => {
            const page = await this.createStealthPage();
            const results: SearchResult[] = [];

            try {
                // Navigate to Google homepage first to establish session
                await page.goto(this.baseUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Check if we're blocked before proceeding
                if (await this.isPageBlocked(page)) {
                    logger.warn('Google blocking detected, attempting bypass');
                    const bypassSuccess = await this.handlePageBlocks(page);
                    if (!bypassSuccess) {
                        throw new Error('Google has blocked our request and bypass failed');
                    }
                }

                // Perform the search
                await this.performSearch(page, query);

                // Wait for results to load
                await this.waitForSearchResults(page);

                // Check again for blocking after search
                if (await this.isPageBlocked(page)) {
                    logger.warn('Google blocking detected after search, attempting bypass');
                    const bypassSuccess = await this.handlePageBlocks(page);
                    if (!bypassSuccess) {
                        throw new Error('Google blocked request after search and bypass failed');
                    }
                }

                // Extract search results
                const rawResults = await this.extractSearchResults(page, maxResults);

                // Normalize results
                for (let i = 0; i < rawResults.length; i++) {
                    const normalizedResult = this.normalizeResult(rawResults[i], query, i + 1);
                    results.push(normalizedResult);
                }

                logger.info(`Successfully scraped ${results.length} results from Google for query: "${query}"`);
                return results;

            } catch (error) {
                logger.error(`Error scraping Google for query "${query}":`, error);
                throw error;
            } finally {
                await page.close();
            }
        });
    }

    /**
     * Perform search on Google with human-like behavior
     */
    private async performSearch(page: Page, query: string): Promise<void> {
        // Wait for search box to be available
        await page.waitForSelector('textarea[name="q"], input[name="q"]', { timeout: 10000 });

        // Type query with human-like delays
        await page.type('textarea[name="q"], input[name="q"]', query, {
            delay: Math.random() * 100 + 50
        });

        // Add small delay before submitting
        await this.sleep(Math.random() * 1000 + 500);

        // Submit search (try multiple methods)
        try {
            // Try pressing Enter first
            await page.keyboard.press('Enter');
        } catch {
            // Fallback to clicking search button
            try {
                await page.click('input[type="submit"], button[type="submit"]');
            } catch {
                // Last resort: submit the form
                await page.evaluate(() => {
                    const form = (globalThis as any).document?.querySelector('form');
                    if (form) form.submit();
                });
            }
        }
    }

    /**
     * Wait for search results to load
     */
    private async waitForSearchResults(page: Page): Promise<void> {
        try {
            // Wait for main results container
            await page.waitForSelector('#search, #rso, .g', {
                timeout: 15000,
                visible: true
            });

            // Additional wait for results to stabilize
            await this.sleep(Math.random() * 2000 + 1000);

        } catch (error) {
            logger.warn('Timeout waiting for Google search results, proceeding anyway');
        }
    }

    /**
     * Extract search results from Google SERP
     */
    private async extractSearchResults(page: Page, maxResults: number): Promise<RawSearchResult[]> {
        return page.evaluate((max: number) => {
            const results: any[] = [];

            // Google result selectors (multiple patterns for robustness)
            const resultSelectors = [
                '.g:not(.g-blk)', // Standard results
                '[data-ved] .g', // Alternative pattern
                '.rc', // Classic pattern
                '.tF2Cxc' // Modern pattern
            ];

            let resultElements: any[] = [];

            // Try different selectors until we find results
            for (const selector of resultSelectors) {
                resultElements = Array.from((globalThis as any).document?.querySelectorAll(selector) || []);
                if (resultElements.length > 0) break;
            }

            // Limit to requested number of results
            resultElements = resultElements.slice(0, max);

            for (let i = 0; i < resultElements.length; i++) {
                const element = resultElements[i];

                try {
                    // Extract title
                    const titleElement = element.querySelector('h3, .LC20lb, .DKV0Md');
                    const title = titleElement?.textContent?.trim() || '';

                    // Extract URL
                    const linkElement = element.querySelector('a[href]');
                    let url = linkElement?.href || '';

                    // Clean Google redirect URLs
                    if (url.includes('/url?')) {
                        const urlParams = new URLSearchParams(url.split('?')[1]);
                        url = urlParams.get('url') || urlParams.get('q') || url;
                    }

                    // Extract snippet
                    const snippetSelectors = [
                        '.VwiC3b', // Modern snippet
                        '.s3v9rd', // Alternative snippet
                        '.st', // Classic snippet
                        '.IsZvec' // Another pattern
                    ];

                    let snippet = '';
                    for (const selector of snippetSelectors) {
                        const snippetElement = element.querySelector(selector);
                        if (snippetElement?.textContent) {
                            snippet = snippetElement.textContent.trim();
                            break;
                        }
                    }

                    // Skip if essential data is missing
                    if (!title || !url || url.startsWith('javascript:')) {
                        continue;
                    }

                    // Skip Google's own results and ads
                    if (url.includes('google.com') ||
                        element.querySelector('.ads-ad, .commercial-unit-desktop-top')) {
                        continue;
                    }

                    results.push({
                        title,
                        snippet,
                        url,
                        rank: results.length + 1
                    });

                } catch (error) {
                    console.warn('Error extracting result:', error);
                    continue;
                }
            }

            return results;
        }, maxResults);
    }

    /**
     * Normalize raw Google result to standard SearchResult format
     */
    protected normalizeResult(rawResult: RawSearchResult, query: string, rank: number): SearchResult {
        const timestamp = new Date();
        const content = `${rawResult.title} ${rawResult.snippet} ${rawResult.url}`;

        return {
            id: uuidv4(),
            query,
            engine: 'google',
            rank,
            title: rawResult.title.trim(),
            snippet: rawResult.snippet.trim(),
            url: rawResult.url,
            timestamp,
            contentHash: this.generateContentHash(content)
        };
    }

    /**
     * Enhanced blocking detection for Google-specific patterns
     */
    protected override async isPageBlocked(page: Page): Promise<boolean> {
        const content = await page.content();
        const title = await page.title();

        // Google-specific blocking indicators
        const googleBlockedIndicators = [
            'Our systems have detected unusual traffic',
            'Please complete the security check',
            'Before we continue',
            'verify you are human',
            'captcha',
            'robot',
            'automated queries',
            'suspicious activity',
            'blocked',
            'g-recaptcha'
        ];

        // Check page content
        const contentBlocked = googleBlockedIndicators.some(indicator =>
            content.toLowerCase().includes(indicator.toLowerCase())
        );

        // Check page title
        const titleBlocked = title.toLowerCase().includes('captcha') ||
            title.toLowerCase().includes('blocked') ||
            title.toLowerCase().includes('unusual traffic');

        // Check for CAPTCHA elements
        const hasCaptcha = await page.$('.g-recaptcha, #captcha, [data-recaptcha]') !== null;

        return contentBlocked || titleBlocked || hasCaptcha;
    }
}