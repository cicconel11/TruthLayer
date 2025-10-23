import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Perplexity AI search scraper for AI-enhanced search results
 */
export class PerplexityScraper extends BaseScraper {
    protected engineName = 'perplexity';
    private readonly baseUrl = 'https://www.perplexity.ai';

    /**
     * Scrape Perplexity AI search results for a given query
     */
    async scrapeResults(query: string, maxResults: number = 20): Promise<SearchResult[]> {
        logger.info(`Starting Perplexity AI search for query: "${query}"`);

        return this.performRequest(async () => {
            const page = await this.createStealthPage();
            const results: SearchResult[] = [];

            try {
                // Navigate to Perplexity homepage first to establish session
                await page.goto(this.baseUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Check if we're blocked before proceeding
                if (await this.isPageBlocked(page)) {
                    throw new Error('Perplexity has blocked our request - CAPTCHA or unusual traffic detected');
                }

                // Perform the search
                await this.performSearch(page, query);

                // Wait for AI response and sources to load
                await this.waitForSearchResults(page);

                // Check again for blocking after search
                if (await this.isPageBlocked(page)) {
                    throw new Error('Perplexity blocked request after search - CAPTCHA detected');
                }

                // Extract search results from sources
                const rawResults = await this.extractSearchResults(page, maxResults);

                // Normalize results
                for (let i = 0; i < rawResults.length; i++) {
                    const normalizedResult = this.normalizeResult(rawResults[i], query, i + 1);
                    results.push(normalizedResult);
                }

                logger.info(`Successfully scraped ${results.length} results from Perplexity for query: "${query}"`);
                return results;

            } catch (error) {
                logger.error(`Error scraping Perplexity for query "${query}":`, error);
                throw error;
            } finally {
                await page.close();
            }
        });
    }

    /**
     * Perform search on Perplexity with human-like behavior
     */
    private async performSearch(page: Page, query: string): Promise<void> {
        // Wait for search input to be available
        await page.waitForSelector('textarea[placeholder*="Ask"], input[placeholder*="Ask"], textarea[data-testid="search-input"]', { timeout: 10000 });

        // Type query with human-like delays
        const searchSelector = 'textarea[placeholder*="Ask"], input[placeholder*="Ask"], textarea[data-testid="search-input"]';
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
            // Fallback to clicking search/submit button
            try {
                const submitButton = await page.$('button[type="submit"], button[aria-label*="Search"], button[data-testid="submit"]');
                if (submitButton) {
                    await submitButton.click();
                }
            } catch {
                // Last resort: try to find and click any submit-like button
                await page.evaluate(() => {
                    const buttons = Array.from((globalThis as any).document?.querySelectorAll('button') || []);
                    const submitBtn = buttons.find((btn: any) =>
                        btn.textContent?.toLowerCase().includes('search') ||
                        btn.textContent?.toLowerCase().includes('ask') ||
                        btn.type === 'submit'
                    );
                    if (submitBtn) (submitBtn as any).click();
                });
            }
        }
    }

    /**
     * Wait for Perplexity AI response and sources to load
     */
    private async waitForSearchResults(page: Page): Promise<void> {
        try {
            // Wait for AI response to start appearing
            await page.waitForSelector('[data-testid="answer"], .prose, .answer-content, .sources', {
                timeout: 20000,
                visible: true
            });

            // Wait for sources/citations to load (these are our "search results")
            await page.waitForSelector('[data-testid="source"], .citation, .source-link, a[href*="http"]', {
                timeout: 15000
            });

            // Additional wait for content to stabilize
            await this.sleep(Math.random() * 3000 + 2000);

        } catch (error) {
            logger.warn('Timeout waiting for Perplexity search results, proceeding anyway');
        }
    }

    /**
     * Extract search results from Perplexity sources and citations
     */
    private async extractSearchResults(page: Page, maxResults: number): Promise<RawSearchResult[]> {
        return page.evaluate((max: number) => {
            const results: any[] = [];

            // Perplexity source/citation selectors (multiple patterns for robustness)
            const sourceSelectors = [
                '[data-testid="source"]', // Primary source elements
                '.citation', // Citation elements
                '.source-link', // Source links
                '.prose a[href*="http"]', // Links within AI response
                '[data-testid="answer"] a[href*="http"]', // Links in answer
                '.answer-content a[href*="http"]', // Alternative answer links
                'a[href*="http"]:not([href*="perplexity.ai"])', // External links excluding Perplexity itself
            ];

            let sourceElements: any[] = [];

            // Try different selectors until we find sources
            for (const selector of sourceSelectors) {
                sourceElements = Array.from((globalThis as any).document?.querySelectorAll(selector) || []);
                if (sourceElements.length > 0) break;
            }

            // Filter out internal Perplexity links and duplicates
            const seenUrls = new Set<string>();
            const validSources = sourceElements.filter((element: any) => {
                const url = element.href || element.getAttribute('href') || '';
                if (!url || url.includes('perplexity.ai') || seenUrls.has(url)) {
                    return false;
                }
                seenUrls.add(url);
                return true;
            });

            // Limit to requested number of results
            const limitedSources = validSources.slice(0, max);

            for (let i = 0; i < limitedSources.length; i++) {
                const element = limitedSources[i];

                try {
                    // Extract URL
                    const url = element.href || element.getAttribute('href') || '';
                    if (!url || url.startsWith('javascript:')) {
                        continue;
                    }

                    // Extract title - try multiple approaches
                    let title = '';

                    // Try getting title from the link text
                    title = element.textContent?.trim() || '';

                    // If no title from link text, try getting from parent context
                    if (!title || title.length < 10) {
                        const parent = element.closest('[data-testid="source"], .citation, .source-item');
                        if (parent) {
                            const titleElement = parent.querySelector('.title, .source-title, h3, h4, strong');
                            title = titleElement?.textContent?.trim() || title;
                        }
                    }

                    // If still no good title, try to extract domain name
                    if (!title || title.length < 5) {
                        try {
                            const urlObj = new URL(url);
                            title = urlObj.hostname.replace('www.', '');
                        } catch {
                            title = 'Source';
                        }
                    }

                    // Extract snippet/description
                    let snippet = '';

                    // Try to find snippet in parent context
                    const parent = element.closest('[data-testid="source"], .citation, .source-item, .prose p');
                    if (parent) {
                        // Look for description text near the link
                        const textNodes = Array.from(parent.childNodes).filter((node: any) =>
                            node.nodeType === 3 && node.textContent?.trim()
                        );

                        if (textNodes.length > 0) {
                            snippet = textNodes.map((node: any) => node.textContent?.trim()).join(' ');
                        }

                        // If no text nodes, try getting text from sibling elements
                        if (!snippet) {
                            const siblingText = parent.querySelector('.description, .snippet, p, span');
                            snippet = siblingText?.textContent?.trim() || '';
                        }
                    }

                    // If still no snippet, try to get context from surrounding AI response
                    if (!snippet) {
                        const responseContainer = element.closest('.prose, [data-testid="answer"], .answer-content');
                        if (responseContainer) {
                            const paragraphs = responseContainer.querySelectorAll('p');
                            for (const p of paragraphs) {
                                if (p.contains(element) && p.textContent) {
                                    snippet = p.textContent.trim();
                                    break;
                                }
                            }
                        }
                    }

                    // Clean up snippet - remove the link text itself and limit length
                    if (snippet) {
                        snippet = snippet.replace(title, '').trim();
                        if (snippet.length > 300) {
                            snippet = snippet.substring(0, 300) + '...';
                        }
                    }

                    // Use a default snippet if none found
                    if (!snippet) {
                        snippet = `Source referenced in AI response for the query.`;
                    }

                    results.push({
                        title: title || 'Perplexity Source',
                        snippet: snippet,
                        url: url,
                        rank: results.length + 1
                    });

                } catch (error) {
                    console.warn('Error extracting Perplexity result:', error);
                    continue;
                }
            }

            return results;
        }, maxResults);
    }

    /**
     * Normalize raw Perplexity result to standard SearchResult format
     */
    protected normalizeResult(rawResult: RawSearchResult, query: string, rank: number): SearchResult {
        const timestamp = new Date();
        const content = `${rawResult.title} ${rawResult.snippet} ${rawResult.url}`;

        return {
            id: uuidv4(),
            query,
            engine: 'perplexity',
            rank,
            title: rawResult.title.trim(),
            snippet: rawResult.snippet.trim(),
            url: rawResult.url,
            timestamp,
            contentHash: this.generateContentHash(content)
        };
    }

    /**
     * Enhanced blocking detection for Perplexity-specific patterns
     */
    protected override async isPageBlocked(page: Page): Promise<boolean> {
        const content = await page.content();
        const title = await page.title();

        // Perplexity-specific blocking indicators
        const perplexityBlockedIndicators = [
            'rate limit',
            'too many requests',
            'please wait',
            'captcha',
            'verify you are human',
            'robot',
            'automated',
            'blocked',
            'access denied',
            'suspicious activity'
        ];

        // Check page content
        const contentBlocked = perplexityBlockedIndicators.some(indicator =>
            content.toLowerCase().includes(indicator.toLowerCase())
        );

        // Check page title
        const titleBlocked = title.toLowerCase().includes('error') ||
            title.toLowerCase().includes('blocked') ||
            title.toLowerCase().includes('rate limit');

        // Check for error messages or empty responses
        const hasError = await page.$('.error, .rate-limit, .blocked') !== null;

        // Check if the page failed to load properly
        const hasSearchInput = await page.$('textarea[placeholder*="Ask"], input[placeholder*="Ask"]') !== null;

        return contentBlocked || titleBlocked || hasError || !hasSearchInput;
    }
}