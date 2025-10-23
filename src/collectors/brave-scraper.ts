import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';

/**
 * Brave search engine scraper
 */
export class BraveScraper extends BaseScraper {
    protected engineName = 'brave';

    async scrapeResults(_query: string, _maxResults: number = 20): Promise<SearchResult[]> {
        // TODO: Implement Brave scraping logic
        throw new Error('BraveScraper not yet implemented');
    }

    protected normalizeResult(_rawResult: RawSearchResult, _query: string, _rank: number): SearchResult {
        // TODO: Implement Brave result normalization
        throw new Error('BraveScraper normalization not yet implemented');
    }
}