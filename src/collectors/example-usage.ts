/**
 * Example usage of the enhanced CollectorService
 * This demonstrates the key features implemented in task 3.5
 */

import { CollectorService } from './collector-service';
import { DatabaseConnection } from '../database/connection';
import { CollectionRequest } from '../types/search-result';
import { logger } from '../utils/logger';

async function demonstrateCollectorService() {
    // Initialize database connection (optional)
    const db = new DatabaseConnection();
    await db.connect();

    // Create collector service with database integration and custom HTML storage path
    const collector = new CollectorService(db, './storage/html');

    try {
        // Example 1: Single query collection with validation and deduplication
        const singleRequest: CollectionRequest = {
            query: 'artificial intelligence ethics',
            engines: ['google', 'bing'],
            maxResults: 10,
            category: 'technology'
        };

        logger.info('Starting single query collection...');
        const singleResult = await collector.collectResults(singleRequest);

        logger.info('Single collection results:', {
            totalResults: singleResult.results.length,
            successfulEngines: singleResult.metadata.successfulEngines,
            duplicatesRemoved: singleResult.metadata.duplicatesRemoved,
            queryId: singleResult.metadata.queryId
        });

        // Example 2: Bulk collection for multiple queries
        const bulkRequests: CollectionRequest[] = [
            {
                query: 'climate change policy',
                engines: ['google', 'bing', 'perplexity'],
                maxResults: 15,
                category: 'politics'
            },
            {
                query: 'covid vaccine safety',
                engines: ['google', 'brave'],
                maxResults: 20,
                category: 'health'
            }
        ];

        logger.info('Starting bulk collection...');
        const bulkResults = await collector.bulkCollectResults(bulkRequests);

        logger.info('Bulk collection completed:', {
            totalQueries: bulkResults.length,
            totalResults: bulkResults.reduce((sum, result) => sum + result.results.length, 0)
        });

        // Example 3: Retrieve collection statistics
        const stats = await collector.getCollectionStats();
        if (stats) {
            logger.info('Collection statistics:', stats);
        }

        // Example 4: Retrieve stored HTML for auditing
        if (singleResult.results.length > 0) {
            const firstResult = singleResult.results[0];
            // Note: In real usage, you'd get the HTML path from the database
            // const storedHtml = await collector.getStoredHtml('google/2024-01-01/result-id.html');
            logger.info('First result for HTML storage demo:', {
                id: firstResult.id,
                title: firstResult.title,
                contentHash: firstResult.contentHash
            });
        }

        // Example 5: Validate results
        const isValid = collector.validateResults(singleResult.results);
        logger.info('Results validation:', { isValid });

    } catch (error) {
        logger.error('Error during collection demonstration:', error);
    } finally {
        // Clean up resources
        await collector.cleanup();
        await db.disconnect();
    }
}

// Key features demonstrated:
// 1. Multi-engine data collection coordination
// 2. Result validation and deduplication logic  
// 3. Raw HTML storage for auditing purposes
// 4. Database integration for persistence
// 5. Bulk collection capabilities
// 6. Collection statistics and monitoring
// 7. Error handling and resource cleanup

export { demonstrateCollectorService };