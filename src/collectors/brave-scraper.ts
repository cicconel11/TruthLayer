import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';
import { logger, errorToLogContext } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Brave search scraper for privacy-focused traditional search results
 */
export class BraveScraper extends BaseScraper {
    protected engineName = 'brave';
    private readonly baseUrl = 'https://search.brave.com';

    /**
     * Scrape Brave search results for a given query
     */
    async scrapeResults(query: string, maxResults: number = 20): Promise<SearchResult[]> {
        logger.info(`Starting Brave search for query: "${query}"`);

        return this.performRequest(async () => {
            const page = await this.createStealthPage();
            const results: SearchResult[] = [];

            try {
                // Navigate to Brave search homepage first to establish session
                await page.goto(this.baseUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Check if we're blocked before proceeding
                if (await this.isPageBlocked(page)) {
                    throw new Error('Brave has blocked our request - CAPTCHA or unusual traffic detected');
                }

                // Perform the search
                await this.performSearch(page, query);

                // Wait for results to load
                await this.waitForSearchResults(page);

                // Check again for blocking after search
                if (await this.isPageBlocked(page)) {
                    throw new Error('Brave blocked request after search - CAPTCHA detected');
                }

                // Extract search results
                const rawResults = await this.extractSearchResults(page, maxResults);

                // Normalize results
                for (let i = 0; i < rawResults.length; i++) {
                    const normalizedResult = this.normalizeResult(rawResults[i], query, i + 1);
                    results.push(normalizedResult);
                }

                logger.info(`Successfully scraped ${results.length} results from Brave for query: "${query}"`);
                return results;

            } catch (error) {
                logger.error(`Error scraping Brave for query "${query}":`, errorToLogContext(error));
                throw error;
            } finally {
                await page.close();
            }
        });
    }

    /**
     * Perform search on Brave with human-like behavior
     */
    private async performSearch(page: Page, query: string): Promise<void> {
        // Wait for search box to be available
        await page.waitForSelector('#searchbox, input[name="q"], input[type="search"]', { timeout: 10000 });

        // Type query with human-like delays
        const searchSelector = '#searchbox, input[name="q"], input[type="search"]';
        await page.type(searchSelector, query, {
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
                await page.click('button[type="submit"], input[type="submit"], .search-btn');
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
            await page.waitForSelector('#results, .result, .snippet', {
                timeout: 15000,
                visible: true
            });

            // Additional wait for results to stabilize
            await this.sleep(Math.random() * 2000 + 1000);

        } catch (error) {
            logger.warn('Timeout waiting for Brave search results, proceeding anyway');
        }
    }

    /**
     * Extract search results from Brave SERP
     */
    private async extractSearchResults(page: Page, maxResults: number): Promise<RawSearchResult[]> {
        return page.evaluate((max: number) => {
            const results: any[] = [];

            // Brave result selectors (multiple patterns for robustness)
            const resultSelectors = [
                '.result', // Standard Brave results
                '.snippet', // Alternative result pattern
                '[data-type="web"]', // Web results specifically
                '.web-result', // Web result class
                '#results > div', // Direct children of results container
                '.search-result' // Generic search result class
            ];

            let resultElements: any[] = [];

            // Try different selectors until we find results
            for (const selector of resultSelectors) {
                resultElements = Array.from((globalThis as any).document?.querySelectorAll(selector) || []);
                if (resultElements.length > 0) break;
            }

            // Filter out ads and non-web results
            resultElements = resultElements.filter((element: any) => {
                // Skip ads
                if (element.querySelector('.ad, .sponsored, [data-type="ad"]') ||
                    element.classList.contains('ad') ||
                    element.classList.contains('sponsored')) {
                    return false;
                }

                // Skip if it doesn't contain a link
                const hasLink = element.querySelector('a[href*="http"]');
                return hasLink !== null;
            });

            // Limit to requested number of results
            resultElements = resultElements.slice(0, max);

            for (let i = 0; i < resultElements.length; i++) {
                const element = resultElements[i];

                try {
                    // Extract title
                    const titleSelectors = [
                        '.result-header a', // Standard title link
                        '.title a', // Alternative title
                        'h3 a', // H3 title link
                        'h2 a', // H2 title link
                        '.snippet-title a', // Snippet title
                        'a[data-testid="result-title-a"]' // Test ID based selector
                    ];

                    let titleElement = null;
                    let title = '';

                    for (const selector of titleSelectors) {
                        titleElement = element.querySelector(selector);
                        if (titleElement?.textContent?.trim()) {
                            title = titleElement.textContent.trim();
                            break;
                        }
                    }

                    // Extract URL
                    let url = '';
                    if (titleElement?.href) {
                        url = titleElement.href;
                    } else {
                        // Try to find any link in the result
                        const linkElement = element.querySelector('a[href*="http"]');
                        url = linkElement?.href || '';
                    }

                    // Clean Brave redirect URLs if present
                    if (url.includes('search.brave.com/redirect?')) {
                        try {
                            const urlObj = new URL(url);
                            const targetUrl = urlObj.searchParams.get('url');
                            if (targetUrl) {
                                url = decodeURIComponent(targetUrl);
                            }
                        } catch {
                            // Keep original URL if parsing fails
                        }
                    }

                    // Extract snippet
                    const snippetSelectors = [
                        '.snippet-description', // Standard snippet
                        '.result-description', // Alternative description
                        '.snippet-content', // Snippet content
                        '.description', // Generic description
                        '.result-body', // Result body text
                        'p', // Paragraph text
                        '.text-sm' // Small text (common for descriptions)
                    ];

                    let snippet = '';
                    for (const selector of snippetSelectors) {
                        const snippetElement = element.querySelector(selector);
                        if (snippetElement?.textContent?.trim()) {
                            snippet = snippetElement.textContent.trim();
                            break;
                        }
                    }

                    // Skip if essential data is missing
                    if (!title || !url || url.startsWith('javascript:')) {
                        continue;
                    }

                    // Skip Brave's own results and internal links
                    if (url.includes('search.brave.com') || url.includes('brave.com')) {
                        continue;
                    }

                    // Skip if this looks like a sidebar or related search
                    if (element.closest('.sidebar, .related, .pagination')) {
                        continue;
                    }

                    results.push({
                        title,
                        snippet: snippet || 'No description available',
                        url,
                        rank: results.length + 1
                    });

                } catch (error) {
                    console.warn('Error extracting Brave result:', error);
                    continue;
                }
            }

            return results;
        }, maxResults);
    }

    /**
     * Normalize raw Brave result to standard SearchResult format
     */
    protected normalizeResult(rawResult: RawSearchResult, query: string, rank: number): SearchResult {
        const timestamp = new Date();
        const title = rawResult.title?.trim() || '';
        const snippet = rawResult.snippet?.trim() || '';
        const url = rawResult.url || '';
        const content = `${title} ${snippet} ${url}`;

        return {
            id: uuidv4(),
            query,
            engine: 'brave',
            rank,
            title,
            snippet,
            url,
            timestamp,
            contentHash: this.generateContentHash(content)
        };
    }

    /**
     * Enhanced blocking detection for Brave-specific patterns
     */
    protected override async isPageBlocked(page: Page): Promise<boolean> {
        const content = await page.content();
        const title = await page.title();

        // Brave-specific blocking indicators
        const braveBlockedIndicators = [
            'rate limited',
            'too many requests',
            'please try again',
            'captcha',
            'verify you are human',
            'robot',
            'automated queries',
            'suspicious activity',
            'blocked',
            'access denied',
            'unusual traffic'
        ];

        // Check page content
        const contentBlocked = braveBlockedIndicators.some(indicator =>
            content.toLowerCase().includes(indicator.toLowerCase())
        );

        // Check page title
        const titleBlocked = title.toLowerCase().includes('error') ||
            title.toLowerCase().includes('blocked') ||
            title.toLowerCase().includes('rate limit') ||
            title.toLowerCase().includes('captcha');

        // Check for CAPTCHA elements
        const hasCaptcha = await page.$('.captcha, #captcha, [data-captcha]') !== null;

        // Check for Brave-specific error elements
        const hasBraveError = await page.$('.error-page, .rate-limit-page') !== null;

        // Check if search box is available (indicates page loaded properly)
        const hasSearchBox = await page.$('#searchbox, input[name="q"], input[type="search"]') !== null;

        return contentBlocked || titleBlocked || hasCaptcha || hasBraveError || !hasSearchBox;
    }
}