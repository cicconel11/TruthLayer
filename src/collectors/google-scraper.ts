import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';

/**
 * Google search engine scraper
 */
export class GoogleScraper extends BaseScraper {
    protected engineName = 'google';

    async scrapeResults(_query: string, _maxResults: number = 20): Promise<SearchResult[]> {
        // TODO: Implement Google scraping logic
        throw new Error('GoogleScraper not yet implemented');
    }

    protected normalizeResult(_rawResult: RawSearchResult, _query: string, _rank: number): SearchResult {
        // TODO: Implement Google result normalization
        throw new Error('GoogleScraper normalization not yet implemented');
    }
}