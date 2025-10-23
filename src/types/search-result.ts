/**
 * Core search result interface representing normalized data from search engines
 */
export interface SearchResult {
    id: string;
    query: string;
    engine: 'google' | 'bing' | 'perplexity' | 'brave';
    rank: number;
    title: string;
    snippet: string;
    url: string;
    timestamp: Date;
    rawHtml?: string;
    contentHash?: string;
}

/**
 * Raw search result before normalization
 */
export interface RawSearchResult {
    title: string;
    snippet: string;
    url: string;
    rank: number;
    [key: string]: any; // Engine-specific fields
}

/**
 * Collection request parameters
 */
export interface CollectionRequest {
    query: string;
    engines: Array<'google' | 'bing' | 'perplexity' | 'brave'>;
    maxResults?: number;
    useProxy?: boolean;
    category?: string;
}

/**
 * Collection result with metadata
 */
export interface CollectionResult {
    results: SearchResult[];
    metadata: {
        totalCollected: number;
        successfulEngines: string[];
        failedEngines: string[];
        collectionTime: number;
        duplicatesRemoved?: number;
        queryId?: string;
    };
}