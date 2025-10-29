import { createStorageClient } from './apps/storage/dist/index.js';

async function check() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const voiceAIQueries = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];
    
    console.log('Checking metric_records table...\n');
    
    // Fetch ALL metrics for voice AI queries
    const allMetrics = await storage.fetchRecentMetricRecords('domain_diversity', 200);
    const voiceAIMetrics = allMetrics.filter(m => voiceAIQueries.includes(m.queryId));
    
    console.log(`Total domain_diversity metrics: ${allMetrics.length}`);
    console.log(`Voice AI domain_diversity metrics: ${voiceAIMetrics.length}`);
    
    if (voiceAIMetrics.length > 0) {
      console.log('\nVoice AI Metrics Found:');
      voiceAIMetrics.forEach(m => {
        console.log(`  ${m.queryId.substring(0,8)}: ${m.metricType} = ${m.value} (run: ${m.crawlRunId?.substring(0,8)})`);
      });
    }
    
    // Try fetching from all metric types
    console.log('\n Checking all metric types...');
    const types = ['domain_diversity', 'engine_overlap', 'factual_alignment'];
    let totalFound = 0;
    
    for (const type of types) {
      const metrics = await storage.fetchRecentMetricRecords(type, 200);
      const voiceMetrics = metrics.filter(m => voiceAIQueries.includes(m.queryId));
      if (voiceMetrics.length > 0) {
        console.log(`  ${type}: ${voiceMetrics.length} metrics`);
        totalFound += voiceMetrics.length;
      }
    }
    
    console.log(`\n${totalFound > 0 ? '✅' : '❌'} Total voice AI metrics: ${totalFound}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await storage.close();
  }
}

check().catch(console.error);

