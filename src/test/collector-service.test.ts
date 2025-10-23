import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CollectorService } from '../collectors/collector-service';
import { CollectionRequest } from '../types/search-result';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('CollectorService Integration', () => {
    let service: CollectorService;
    const testStoragePath = './test-storage/html';

    beforeEach(async () => {
        // Clean up test storage directory
        try {
            await fs.rm(testStoragePath, { recursive: true, force: true });
        } catch (error) {
            // Directory might not exist, ignore
        }

        service = new CollectorService(undefined, testStoragePath);
    });

    afterEach(async () => {
        await service.cleanup();

        // Clean up test storage directory
        try {
            await fs.rm(testStoragePath, { recursive: true, force: true });
        } catch (error) {
            // Directory might not exist, ignore
        }
    });

    describe('Initialization', () => {
        it('should initialize with Google scraper available', () => {
            expect(service['scrapers'].has('google')).toBe(true);
        });

        it('should have correct scraper count', () => {
            // All four scrapers are now implemented
            expect(service['scrapers'].size).toBe(4);
        });
    });

    describe('Collection Request Handling', () => {
        it('should handle requests for unavailable engines gracefully', async () => {
            const request: CollectionRequest = {
                query: 'test query',
                engines: ['nonexistent'], // Truly unavailable engine
                maxResults: 10
            };

            const result = await service.collectResults(request);

            expect(result.results).toHaveLength(0);
            expect(result.metadata.successfulEngines).toHaveLength(0);
            expect(result.metadata.failedEngines).toEqual(['nonexistent']);
            expect(result.metadata.totalCollected).toBe(0);
            expect(result.metadata.collectionTime).toBeGreaterThanOrEqual(0);
        }, 10000);

        it('should have all scrapers available in scrapers map', () => {
            // Test that the service correctly initializes with all scrapers
            expect(service['scrapers'].has('google')).toBe(true);
            expect(service['scrapers'].get('google')).toBeDefined();

            // Test that all implemented engines are available
            expect(service['scrapers'].has('bing')).toBe(true);
            expect(service['scrapers'].has('perplexity')).toBe(true);
            expect(service['scrapers'].has('brave')).toBe(true);

            // Verify all scrapers are properly instantiated
            expect(service['scrapers'].get('bing')).toBeDefined();
            expect(service['scrapers'].get('perplexity')).toBeDefined();
            expect(service['scrapers'].get('brave')).toBeDefined();
        });
    });

    describe('Result Validation', () => {
        it('should validate empty results as invalid', () => {
            const isValid = service.validateResults([]);
            expect(isValid).toBe(false);
        });

        it('should validate complete results as valid', () => {
            const validResults = [{
                id: 'test-1',
                query: 'test query',
                engine: 'google' as const,
                rank: 1,
                title: 'Test Title',
                snippet: 'Test snippet',
                url: 'https://example.com',
                timestamp: new Date()
            }];

            const isValid = service.validateResults(validResults);
            expect(isValid).toBe(true);
        });

        it('should validate incomplete results as invalid', () => {
            const invalidResults = [{
                id: '',
                query: 'test query',
                engine: 'google' as const,
                rank: 1,
                title: '',
                snippet: 'Test snippet',
                url: 'https://example.com',
                timestamp: new Date()
            }];

            const isValid = service.validateResults(invalidResults);
            expect(isValid).toBe(false);
        });
    });

    describe('Result Processing and Validation', () => {
        it('should validate complete results as valid', () => {
            const validResults = [{
                id: 'test-1',
                query: 'test query',
                engine: 'google' as const,
                rank: 1,
                title: 'Test Title',
                snippet: 'Test snippet',
                url: 'https://example.com',
                timestamp: new Date(),
                contentHash: 'abc123'
            }];

            const isValid = service.validateResults(validResults);
            expect(isValid).toBe(true);
        });

        it('should validate incomplete results as invalid', () => {
            const invalidResults = [{
                id: '',
                query: 'test query',
                engine: 'google' as const,
                rank: 1,
                title: '',
                snippet: 'Test snippet',
                url: 'https://example.com',
                timestamp: new Date()
            }];

            const isValid = service.validateResults(invalidResults);
            expect(isValid).toBe(false);
        });

        it('should reject results with invalid URLs', () => {
            const invalidResults = [{
                id: 'test-1',
                query: 'test query',
                engine: 'google' as const,
                rank: 1,
                title: 'Test Title',
                snippet: 'Test snippet',
                url: 'not-a-valid-url',
                timestamp: new Date()
            }];

            const isValid = service.validateResults(invalidResults);
            expect(isValid).toBe(false);
        });

        it('should reject results with invalid rank', () => {
            const invalidResults = [{
                id: 'test-1',
                query: 'test query',
                engine: 'google' as const,
                rank: 0, // Invalid rank
                title: 'Test Title',
                snippet: 'Test snippet',
                url: 'https://example.com',
                timestamp: new Date()
            }];

            const isValid = service.validateResults(invalidResults);
            expect(isValid).toBe(false);
        });
    });

    describe('HTML Storage', () => {
        it('should create storage directory on initialization', async () => {
            // Directory should be created during service initialization
            const stats = await fs.stat(testStoragePath);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should handle missing HTML gracefully', async () => {
            const result = await service.getStoredHtml('nonexistent/path.html');
            expect(result).toBeNull();
        });
    });

    describe('Collection Statistics', () => {
        it('should return null when database is not available', async () => {
            const stats = await service.getCollectionStats();
            expect(stats).toBeNull();
        });
    });

    describe('Bulk Collection', () => {
        it('should handle empty request array', async () => {
            const results = await service.bulkCollectResults([]);
            expect(results).toHaveLength(0);
        });

        it('should process multiple requests', async () => {
            const requests: CollectionRequest[] = [
                {
                    query: 'test query 1',
                    engines: ['nonexistent'], // Use non-existent engine to avoid actual scraping
                    maxResults: 5
                },
                {
                    query: 'test query 2',
                    engines: ['nonexistent'],
                    maxResults: 5
                }
            ];

            const results = await service.bulkCollectResults(requests);
            expect(results).toHaveLength(2);

            // Both should have empty results due to non-existent engine
            results.forEach(result => {
                expect(result.results).toHaveLength(0);
                expect(result.metadata.failedEngines).toContain('nonexistent');
            });
        }, 15000);
    });

    describe('Resource Management', () => {
        it('should cleanup all scrapers without errors', async () => {
            await expect(service.cleanup()).resolves.not.toThrow();
        });
    });
});