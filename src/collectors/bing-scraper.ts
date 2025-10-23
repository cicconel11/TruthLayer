import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';

/**
 * Bing search engine scraper
 */
export class BingScraper extends BaseScraper {
    protected engineName = 'bing';

    async scrapeResults(_query: string, _maxResults: number = 20): Promise<SearchResult[]> {
        // TODO: Implement Bing scraping logic
        throw new Error('BingScraper not yet implemented');
    }

    protected normalizeResult(_rawResult: RawSearchResult, _query: string, _rank: number): SearchResult {
        // TODO: Implement Bing result normalization
        throw new Error('BingScraper normalization not yet implemented');
    }
}