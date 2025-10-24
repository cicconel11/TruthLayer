import { SearchResult, CollectionRequest, CollectionResult } from '../types/search-result';
import { CreateSearchResultRequest } from '../database/models';
import { SearchResultRepository, QueryRepository } from '../database/repositories';
import { DatabaseConnection } from '../database/connection';
import { logger, errorToLogContext } from '../utils/logger';
import { GoogleScraper } from './google-scraper';
import { BingScraper } from './bing-scraper';
import { PerplexityScraper } from './perplexity-scraper';
import { BraveScraper } from './brave-scraper';
import { BaseScraper } from './base-scraper';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

/**
 * Service for orchestrating multi-engine search result collection
 */
export class CollectorService {
    private scrapers: Map<string, BaseScraper> = new Map();
    private searchResultRepo?: SearchResultRepository;
    private queryRepo?: QueryRepository;
    private htmlStoragePath: string;

    constructor(db?: DatabaseConnection, htmlStoragePath: string = './storage/html') {
        this.initializeScrapers();

        // Initialize database repositories if connection provided
        if (db) {
            this.searchResultRepo = new SearchResultRepository(db);
            this.queryRepo = new QueryRepository(db);
        }

        this.htmlStoragePath = htmlStoragePath;
        this.ensureStorageDirectory();

        logger.info('CollectorService initialized', { htmlStoragePath });
    }

    /**
     * Initialize scrapers for each supported engine
     */
    private initializeScrapers(): void {
        this.scrapers.set('google', new GoogleScraper());
        this.scrapers.set('bing', new BingScraper());
        this.scrapers.set('perplexity', new PerplexityScraper());
        this.scrapers.set('brave', new BraveScraper());
    }

    /**
     * Ensure HTML storage directory exists
     */
    private async ensureStorageDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.htmlStoragePath, { recursive: true });
        } catch (error) {
            logger.error('Failed to create HTML storage directory:', errorToLogContext(error));
        }
    }

    /**
     * Collect search results from multiple engines with enhanced validation and storage
     */
    async collectResults(request: CollectionRequest): Promise<CollectionResult> {
        const startTime = Date.now();
        const allResults: SearchResult[] = [];
        const successfulEngines: string[] = [];
        const failedEngines: string[] = [];

        logger.info(`Starting collection for query: "${request.query}" across engines: ${request.engines.join(', ')}`);

        // Create or find query record if database is available
        let queryId: string | undefined;
        if (this.queryRepo) {
            try {
                const queryRecord = await this.queryRepo.create({
                    text: request.query,
                    category: request.category
                });
                queryId = queryRecord.id;
                logger.info(`Created query record with ID: ${queryId}`);
            } catch (error) {
                logger.error('Failed to create query record:', errorToLogContext(error));
            }
        }

        // Process each requested engine
        for (const engineName of request.engines) {
            const scraper = this.scrapers.get(engineName);

            if (!scraper) {
                logger.warn(`Scraper not available for engine: ${engineName}`);
                failedEngines.push(engineName);
                continue;
            }

            try {
                logger.info(`Collecting results from ${engineName} for query: "${request.query}"`);

                const engineResults = await scraper.scrapeResults(
                    request.query,
                    request.maxResults || 20
                );

                // Process and enhance each result
                const processedResults = await this.processResults(
                    engineResults,
                    request.query,
                    engineName,
                    queryId
                );

                allResults.push(...processedResults);
                successfulEngines.push(engineName);

                logger.info(`Successfully collected and processed ${processedResults.length} results from ${engineName}`);

            } catch (error) {
                logger.error(`Failed to collect from ${engineName}:`, errorToLogContext(error));
                failedEngines.push(engineName);
            }
        }

        // Deduplicate results across engines
        const deduplicatedResults = this.deduplicateResults(allResults);
        const duplicatesRemoved = allResults.length - deduplicatedResults.length;

        if (duplicatesRemoved > 0) {
            logger.info(`Removed ${duplicatesRemoved} duplicate results across engines`);
        }

        const collectionTime = Date.now() - startTime;

        logger.info(`Collection completed. Total results: ${deduplicatedResults.length}, Successful engines: ${successfulEngines.length}, Failed engines: ${failedEngines.length}`);

        return {
            results: deduplicatedResults,
            metadata: {
                totalCollected: deduplicatedResults.length,
                successfulEngines,
                failedEngines,
                collectionTime,
                duplicatesRemoved,
                queryId
            },
        };
    }

    /**
     * Process and enhance search results with validation, HTML storage, and database persistence
     */
    private async processResults(
        results: SearchResult[],
        _query: string,
        engine: string,
        queryId?: string
    ): Promise<SearchResult[]> {
        const processedResults: SearchResult[] = [];

        for (const result of results) {
            try {
                // Validate individual result
                if (!this.validateSingleResult(result)) {
                    logger.warn(`Invalid result skipped from ${engine}:`, {
                        title: result.title,
                        url: result.url
                    });
                    continue;
                }

                // Generate content hash for deduplication
                const contentHash = this.generateContentHash(result);

                // Store raw HTML if available
                let htmlPath: string | undefined;
                if (result.rawHtml) {
                    htmlPath = await this.storeRawHtml(result.rawHtml, engine, result.id);
                }

                // Enhanced result with metadata
                const enhancedResult: SearchResult = {
                    ...result,
                    contentHash,
                    rawHtml: undefined // Remove raw HTML from memory after storage
                };

                // Store in database if available
                if (this.searchResultRepo && queryId) {
                    try {
                        const dbRequest: CreateSearchResultRequest = {
                            query_id: queryId,
                            engine: result.engine,
                            rank: result.rank,
                            title: result.title,
                            snippet: result.snippet,
                            url: result.url,
                            content_hash: contentHash,
                            raw_html_path: htmlPath
                        };

                        await this.searchResultRepo.create(dbRequest);
                        logger.debug(`Stored result in database: ${result.id}`);
                    } catch (dbError) {
                        logger.error(`Failed to store result in database: ${result.id}`, errorToLogContext(dbError));
                        // Continue processing even if database storage fails
                    }
                }

                processedResults.push(enhancedResult);

            } catch (error) {
                logger.error(`Error processing result from ${engine}:`, errorToLogContext(error));
                // Continue with other results
            }
        }

        return processedResults;
    }

    /**
     * Validate a single search result
     */
    private validateSingleResult(result: SearchResult): boolean {
        // Required fields validation
        if (!result.id || !result.query || !result.engine || !result.title || !result.url) {
            return false;
        }

        // Rank validation
        if (result.rank < 1 || result.rank > 100) {
            return false;
        }

        // URL validation
        try {
            new URL(result.url);
        } catch {
            return false;
        }

        // Engine validation
        const validEngines = ['google', 'bing', 'perplexity', 'brave'];
        if (!validEngines.includes(result.engine)) {
            return false;
        }

        // Timestamp validation
        if (!result.timestamp || !(result.timestamp instanceof Date)) {
            return false;
        }

        // Title and snippet length validation
        if (result.title.length > 500 || (result.snippet && result.snippet.length > 1000)) {
            return false;
        }

        return true;
    }

    /**
     * Generate content hash for deduplication
     */
    private generateContentHash(result: SearchResult): string {
        // Create hash based on URL and title for deduplication
        const content = `${result.url}|${result.title}`;
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Store raw HTML for auditing purposes
     */
    private async storeRawHtml(html: string, engine: string, resultId: string): Promise<string> {
        try {
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const engineDir = join(this.htmlStoragePath, engine, timestamp);

            // Ensure directory exists
            await fs.mkdir(engineDir, { recursive: true });

            const filename = `${resultId}.html`;
            const filepath = join(engineDir, filename);

            await fs.writeFile(filepath, html, 'utf8');

            // Return relative path for database storage
            const relativePath = join(engine, timestamp, filename);
            logger.debug(`Stored raw HTML: ${relativePath}`);

            return relativePath;
        } catch (error) {
            logger.error(`Failed to store raw HTML for result ${resultId}:`, errorToLogContext(error));
            throw error;
        }
    }

    /**
     * Deduplicate results across engines based on content hash
     */
    private deduplicateResults(results: SearchResult[]): SearchResult[] {
        const seen = new Set<string>();
        const deduplicated: SearchResult[] = [];

        for (const result of results) {
            const key = result.contentHash || this.generateContentHash(result);

            if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(result);
            } else {
                logger.debug(`Duplicate result removed: ${result.url} from ${result.engine}`);
            }
        }

        return deduplicated;
    }

    /**
     * Validate collected search results (enhanced version)
     */
    validateResults(results: SearchResult[]): boolean {
        if (results.length === 0) return false;

        // Validate each result individually
        return results.every(result => this.validateSingleResult(result));
    }

    /**
     * Retrieve stored raw HTML for auditing
     */
    async getStoredHtml(htmlPath: string): Promise<string | null> {
        try {
            const fullPath = join(this.htmlStoragePath, htmlPath);
            const html = await fs.readFile(fullPath, 'utf8');
            return html;
        } catch (error) {
            logger.error(`Failed to retrieve stored HTML: ${htmlPath}`, errorToLogContext(error));
            return null;
        }
    }

    /**
     * Get collection statistics
     */
    async getCollectionStats(timeRange?: { start: Date; end: Date }): Promise<{
        totalResults: number;
        resultsByEngine: Record<string, number>;
        averageResultsPerQuery: number;
        duplicateRate: number;
    } | null> {
        if (!this.searchResultRepo) {
            logger.warn('Database not available for collection statistics');
            return null;
        }

        try {
            const filter = timeRange ? {
                collected_after: timeRange.start,
                collected_before: timeRange.end
            } : {};

            const totalResults = await this.searchResultRepo.count(filter);

            // Get results by engine (simplified - would need more complex query for exact counts)
            const resultsByEngine: Record<string, number> = {};
            for (const engine of ['google', 'bing', 'perplexity', 'brave']) {
                const engineCount = await this.searchResultRepo.count({
                    ...filter,
                    engine: engine as any
                });
                resultsByEngine[engine] = engineCount;
            }

            // Calculate basic statistics
            const averageResultsPerQuery = totalResults > 0 ? totalResults / 4 : 0; // Rough estimate
            const duplicateRate = 0; // Would need more complex calculation

            return {
                totalResults,
                resultsByEngine,
                averageResultsPerQuery,
                duplicateRate
            };
        } catch (error) {
            logger.error('Failed to get collection statistics:', errorToLogContext(error));
            return null;
        }
    }

    /**
     * Bulk collect results for multiple queries
     */
    async bulkCollectResults(requests: CollectionRequest[]): Promise<CollectionResult[]> {
        const results: CollectionResult[] = [];

        logger.info(`Starting bulk collection for ${requests.length} queries`);

        for (const request of requests) {
            try {
                const result = await this.collectResults(request);
                results.push(result);

                // Add delay between queries to avoid overwhelming servers
                await this.sleep(2000 + Math.random() * 3000);
            } catch (error) {
                logger.error(`Failed bulk collection for query: ${request.query}`, errorToLogContext(error));
                // Continue with other queries
            }
        }

        logger.info(`Bulk collection completed. Processed ${results.length}/${requests.length} queries`);
        return results;
    }

    /**
     * Sleep utility for delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean up all scrapers
     */
    async cleanup(): Promise<void> {
        logger.info('Cleaning up CollectorService scrapers');

        const cleanupPromises = Array.from(this.scrapers.values()).map(scraper =>
            scraper.cleanup().catch(error =>
                logger.error('Error cleaning up scraper:', error)
            )
        );

        await Promise.all(cleanupPromises);
        logger.info('CollectorService cleanup completed');
    }
}