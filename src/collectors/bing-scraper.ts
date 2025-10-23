import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Bing search scraper with advanced anti-detection measures
 */
export class BingScraper extends BaseScraper {
    protected engineName = 'bing';
    private readonly baseUrl = 'https://www.bing.com';

    /**
     * Scrape Bing search results for a given query
     */
    async scrapeResults(query: string, maxResults: number = 20): Promise<SearchResult[]> {
        logger.info(`Starting Bing search for query: "${query}"`);

        return this.performRequest(async () => {
            const page = await this.createStealthPage();
            const results: SearchResult[] = [];

            try {
                // Navigate to Bing homepage first to establish session
                await page.goto(this.baseUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Check if we're blocked before proceeding
                if (await this.isPageBlocked(page)) {
                    throw new Error('Bing has blocked our request - CAPTCHA or unusual traffic detected');
                }

                // Perform the search
                await this.performSearch(page, query);

                // Wait for results to load
                await this.waitForSearchResults(page);

                // Check again for blocking after search
                if (await this.isPageBlocked(page)) {
                    throw new Error('Bing blocked request after search - CAPTCHA detected');
                }

                // Extract search results
                const rawResults = await this.extractSearchResults(page, maxResults);

                // Normalize results
                for (let i = 0; i < rawResults.length; i++) {
                    const normalizedResult = this.normalizeResult(rawResults[i], query, i + 1);
                    results.push(normalizedResult);
                }

                logger.info(`Successfully scraped ${results.length} results from Bing for query: "${query}"`);
                return results;

            } catch (error) {
                logger.error(`Error scraping Bing for query "${query}":`, error);
                throw error;
            } finally {
                await page.close();
            }
        });
    }

    /**
     * Perform search on Bing with human-like behavior
     */
    private async performSearch(page: Page, query: string): Promise<void> {
        // Wait for search box to be available
        await page.waitForSelector('#sb_form_q, input[name="q"]', { timeout: 10000 });

        // Type query with human-like delays
        await page.type('#sb_form_q, input[name="q"]', query, {
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
                await page.click('#sb_form_go, input[type="submit"]');
            } catch {
                // Last resort: submit the form
                await page.evaluate(() => {
                    const form = (globalThis as any).document?.querySelector('#sb_form');
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
            await page.waitForSelector('#b_results, .b_algo, .b_searchResult', {
                timeout: 15000,
                visible: true
            });

            // Additional wait for results to stabilize
            await this.sleep(Math.random() * 2000 + 1000);

        } catch (error) {
            logger.warn('Timeout waiting for Bing search results, proceeding anyway');
        }
    }

    /**
     * Extract search results from Bing SERP
     */
    private async extractSearchResults(page: Page, maxResults: number): Promise<RawSearchResult[]> {
        return page.evaluate((max: number) => {
            const results: any[] = [];

            // Bing result selectors (multiple patterns for robustness)
            const resultSelectors = [
                '.b_algo', // Standard Bing results
                '.b_searchResult', // Alternative pattern
                '.b_ans .b_algo', // Results within answer blocks
                '[data-bm]' // Modern pattern with data attributes
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
                    const titleElement = element.querySelector('h2 a, .b_title a, .b_topTitle a');
                    const title = titleElement?.textContent?.trim() || '';

                    // Extract URL
                    const linkElement = element.querySelector('h2 a, .b_title a, .b_topTitle a');
                    let url = linkElement?.href || '';

                    // Clean Bing redirect URLs if present
                    if (url.includes('bing.com/ck/a?')) {
                        try {
                            const urlObj = new URL(url);
                            const targetUrl = urlObj.searchParams.get('u');
                            if (targetUrl) {
                                // Decode base64 if needed
                                try {
                                    url = atob(targetUrl.replace(/_/g, '/').replace(/-/g, '+'));
                                } catch {
                                    url = decodeURIComponent(targetUrl);
                                }
                            }
                        } catch {
                            // Keep original URL if parsing fails
                        }
                    }

                    // Extract snippet
                    const snippetSelectors = [
                        '.b_caption p', // Standard snippet
                        '.b_snippet', // Alternative snippet
                        '.b_dList', // Description list
                        '.b_paractl' // Paragraph control
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

                    // Skip Bing's own results and ads
                    if (url.includes('bing.com') ||
                        element.querySelector('.b_ad, .b_adLastChild, .sb_add')) {
                        continue;
                    }

                    // Skip if this looks like a sidebar or related search
                    if (element.closest('.b_sidebar, .b_rs, .b_pag')) {
                        continue;
                    }

                    results.push({
                        title,
                        snippet,
                        url,
                        rank: results.length + 1
                    });

                } catch (error) {
                    console.warn('Error extracting Bing result:', error);
                    continue;
                }
            }

            return results;
        }, maxResults);
    }

    /**
     * Normalize raw Bing result to standard SearchResult format
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
            engine: 'bing',
            rank,
            title,
            snippet,
            url,
            timestamp,
            contentHash: this.generateContentHash(content)
        };
    }

    /**
     * Enhanced blocking detection for Bing-specific patterns
     */
    protected override async isPageBlocked(page: Page): Promise<boolean> {
        const content = await page.content();
        const title = await page.title();

        // Bing-specific blocking indicators
        const bingBlockedIndicators = [
            'We have detected suspicious traffic',
            'Please complete the security check',
            'verify that you are human',
            'captcha',
            'robot',
            'automated queries',
            'unusual activity',
            'blocked',
            'security verification',
            'prove you are human'
        ];

        // Check page content
        const contentBlocked = bingBlockedIndicators.some(indicator =>
            content.toLowerCase().includes(indicator.toLowerCase())
        );

        // Check page title
        const titleBlocked = title.toLowerCase().includes('captcha') ||
            title.toLowerCase().includes('blocked') ||
            title.toLowerCase().includes('security') ||
            title.toLowerCase().includes('verification');

        // Check for CAPTCHA elements
        const hasCaptcha = await page.$('.captcha, #captcha, [data-captcha]') !== null;

        // Check for Bing-specific blocking elements
        const hasBingBlock = await page.$('.b_no, .b_errPage') !== null;

        return contentBlocked || titleBlocked || hasCaptcha || hasBingBlock;
    }


}