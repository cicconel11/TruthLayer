import { createStorageClient } from './apps/storage/dist/index.js';
import { randomUUID } from 'node:crypto';

async function testInsert() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    console.log('Testing metric record insertion...\n');
    
    // Check existing metrics
    const before = await storage.fetchRecentMetricRecords('domain_diversity', 200);
    console.log(`Before: ${before.length} domain_diversity metrics`);
    
    // Create a test metric record
    const testMetric = {
      id: randomUUID(),
      crawlRunId: 'test-run-' + randomUUID().substring(0, 8),
      queryId: '44444444-4444-4444-4444-444444444444',
      engine: null,
      metricType: 'domain_diversity',
      value: 999,
      delta: null,
      comparedToRunId: null,
      collectedAt: new Date(),
      extra: { test: true },
      createdAt: new Date()
    };
    
    console.log('\nInserting test metric:', {
      queryId: testMetric.queryId.substring(0, 8),
      value: testMetric.value,
      metricType: testMetric.metricType
    });
    
    // Try to insert
    await storage.insertMetricRecords([testMetric]);
    console.log('Insert call completed');
    
    // Check if it was inserted
    const after = await storage.fetchRecentMetricRecords('domain_diversity', 200);
    console.log(`\nAfter: ${after.length} domain_diversity metrics`);
    
    const voiceAIMetrics = after.filter(m => m.queryId.startsWith('44444'));
    console.log(`Voice AI metrics: ${voiceAIMetrics.length}`);
    
    if (voiceAIMetrics.length > 0) {
      console.log('\n✅ SUCCESS! Test metric was inserted');
      console.log('Found metrics:', voiceAIMetrics.map(m => ({
        queryId: m.queryId.substring(0, 8),
        value: m.value,
        runId: m.crawlRunId
      })));
    } else {
      console.log('\n❌ FAILED! Test metric was NOT inserted');
      
      // Try fetching ALL metrics to see what's there
      const allMetrics = await storage.fetchRecentMetricRecords('domain_diversity', 1000);
      console.log(`Total metrics in DB: ${allMetrics.length}`);
      
      const uniqueQueries = new Set(allMetrics.map(m => m.queryId));
      console.log('Unique query IDs:', [...uniqueQueries].map(q => q.substring(0, 8)));
    }
    
  } catch (error) {
    console.error('\n❌ ERROR during test:', error);
    console.error(error.stack);
  } finally {
    await storage.close();
  }
}

testInsert().catch(console.error);

