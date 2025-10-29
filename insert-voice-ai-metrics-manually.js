import { createStorageClient } from './apps/storage/dist/index.js';
import { randomUUID } from 'node:crypto';

async function insertVoiceAIMetrics() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    console.log('Manually computing and inserting voice AI metrics...\n');
    
    // Fetch voice AI annotated results
    const voiceAIQueries = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];
    
    const results = await storage.fetchAnnotatedResults({ 
      queryIds: voiceAIQueries 
    });
    
    console.log(`Found ${results.length} voice AI results`);
    
    // Group by query
    const byQuery = {};
    results.forEach(r => {
      if (!byQuery[r.queryId]) {
        byQuery[r.queryId] = {
          results: [],
          runId: r.runId,
          collectedAt: r.collectedAt
        };
      }
      byQuery[r.queryId].results.push(r);
    });
    
    // Compute metrics for each query
    const metrics = [];
    
    for (const [queryId, data] of Object.entries(byQuery)) {
      const { results: qResults, runId, collectedAt } = data;
      
      // Domain diversity
      const domains = new Set(qResults.map(r => r.domain.toLowerCase()));
      metrics.push({
        id: randomUUID(),
        crawlRunId: runId,
        queryId,
        engine: null,
        metricType: 'domain_diversity',
        value: domains.size,
        delta: null,
        comparedToRunId: null,
        collectedAt: new Date(collectedAt),
        extra: {
          totalResults: qResults.length,
          perEngine: {}
        },
        createdAt: new Date()
      });
      
      // Engine overlap
      metrics.push({
        id: randomUUID(),
        crawlRunId: runId,
        queryId,
        engine: null,
        metricType: 'engine_overlap',
        value: 0,
        delta: null,
        comparedToRunId: null,
        collectedAt: new Date(collectedAt),
        extra: {
          sharedCount: 0,
          totalUrls: qResults.length,
          engines: [...new Set(qResults.map(r => r.engine))]
        },
        createdAt: new Date()
      });
      
      // Factual alignment
      const aligned = qResults.filter(r => r.factualConsistency === 'aligned').length;
      const total = qResults.length;
      metrics.push({
        id: randomUUID(),
        crawlRunId: runId,
        queryId,
        engine: null,
        metricType: 'factual_alignment',
        value: total > 0 ? aligned / total : 0,
        delta: null,
        comparedToRunId: null,
        collectedAt: new Date(collectedAt),
        extra: {
          aligned,
          total
        },
        createdAt: new Date()
      });
      
      console.log(`  ${queryId.substring(0, 8)}: ${qResults.length} results, ${domains.size} domains`);
    }
    
    console.log(`\nInserting ${metrics.length} metrics...`);
    await storage.insertMetricRecords(metrics);
    console.log('✅ Metrics inserted successfully!\n');
    
    // Verify
    const check = await storage.fetchRecentMetricRecords('domain_diversity', 200);
    const voiceMetrics = check.filter(m => voiceAIQueries.includes(m.queryId));
    console.log(`Verification: ${voiceMetrics.length} voice AI metrics in database`);
    
  } catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
  } finally {
    await storage.close();
  }
}

insertVoiceAIMetrics().catch(console.error);

