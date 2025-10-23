import { BaseScraper } from './base-scraper';
import { SearchResult, RawSearchResult } from '../types/search-result';

/**
 * Perplexity AI search engine scraper
 */
export class PerplexityScraper extends BaseScraper {
    protected engineName = 'perplexity';

    async scrapeResults(_query: string, _maxResults: number = 20): Promise<SearchResult[]> {
        // TODO: Implement Perplexity scraping logic
        throw new Error('PerplexityScraper not yet implemented');
    }

    protected normalizeResult(_rawResult: RawSearchResult, _query: string, _rank: number): SearchResult {
        // TODO: Implement Perplexity result normalization
        throw new Error('PerplexityScraper normalization not yet implemented');
    }
}