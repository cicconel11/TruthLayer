import { SearchResult, RawSearchResult } from '../types/search-result';

/**
 * Abstract base class for search engine scrapers
 */
export abstract class BaseScraper {
    protected abstract engineName: string;

    /**
     * Scrape search results for a given query
     */
    abstract scrapeResults(query: string, maxResults?: number): Promise<SearchResult[]>;

    /**
     * Normalize raw search result to standard format
     */
    protected abstract normalizeResult(rawResult: RawSearchResult, query: string, rank: number): SearchResult;

    /**
     * Get random delay between requests
     */
    protected getRandomDelay(min: number = 2000, max: number = 8000): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Sleep for specified milliseconds
     */
    protected async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get random user agent
     */
    protected getRandomUserAgent(): string {
        const userAgents = [
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }
}