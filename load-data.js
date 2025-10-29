import { createStorageClient } from './apps/storage/dist/index.js';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

async function loadData() {
  const storage = createStorageClient();
  
  try {
    console.log('Loading SERP data into database...');
    
    // Read SERP data
    const serpData = JSON.parse(await fs.readFile('data/serp/11111111-1111-1111-1111-111111111111-ai-20.json', 'utf-8'));
    
    if (serpData.length > 0) {
      console.log(`Found ${serpData.length} search results to load`);
      
      // Convert to SearchResultInput format
      const searchResults = serpData.map(r => ({
        id: r.id,
        crawlRunId: r.crawlRunId,
        queryId: r.queryId,
        engine: r.engine,
        rank: r.rank,
        title: r.title,
        snippet: r.snippet ?? null,
        url: r.url,
        normalizedUrl: r.normalizedUrl,
        domain: r.domain,
        timestamp: new Date(r.timestamp),
        hash: r.hash,
        rawHtmlPath: r.rawHtmlPath ?? '',
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt)
      }));
      
      // This should create tables and insert data
      await storage.insertSearchResults(searchResults);
      console.log('✅ Search results loaded successfully');
      
      // Create mock annotations
      console.log('Creating mock annotations...');
      const mockAnnotations = serpData.map((result, index) => ({
        id: randomUUID(),
        searchResultId: result.id,
        queryId: result.queryId,
        engine: result.engine,
        domainType: 'other',
        factualConsistency: 'aligned',
        confidence: 0.8,
        promptVersion: 'v1',
        modelId: 'mock',
        createdAt: new Date(),
        updatedAt: new Date(),
        extra: {}
      }));
      
      await storage.insertAnnotationRecords(mockAnnotations);
      console.log('✅ Mock annotations created');
      
      // Create mock metrics
      console.log('Creating mock metrics...');
      const runId = randomUUID();
      const queryId = '11111111-1111-1111-1111-111111111111';
      
      const mockMetrics = [
        {
          id: randomUUID(),
          crawlRunId: runId,
          queryId: queryId,
          engine: null,
          metricType: 'domain_diversity',
          value: serpData.length,
          delta: null,
          comparedToRunId: null,
          collectedAt: new Date(),
          extra: { totalResults: serpData.length },
          createdAt: new Date()
        },
        {
          id: randomUUID(),
          crawlRunId: runId,
          queryId: queryId,
          engine: null,
          metricType: 'engine_overlap',
          value: 0,
          delta: null,
          comparedToRunId: null,
          collectedAt: new Date(),
          extra: { sharedCount: 0, totalUrls: serpData.length },
          createdAt: new Date()
        },
        {
          id: randomUUID(),
          crawlRunId: runId,
          queryId: queryId,
          engine: null,
          metricType: 'factual_alignment',
          value: 1.0,
          delta: null,
          comparedToRunId: null,
          collectedAt: new Date(),
          extra: { aligned: serpData.length, total: serpData.length },
          createdAt: new Date()
        }
      ];
      
      await storage.insertMetricRecords(mockMetrics);
      console.log('✅ Mock metrics created');
      
      // Verify data
      const results = await storage.fetchPendingAnnotations({ limit: 5 });
      console.log(`✅ Verified: Found ${results.length} results in database`);
      
      console.log('🎉 Database setup complete!');
    } else {
      console.log('No data to load');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await storage.close();
  }
}

loadData().catch(console.error);