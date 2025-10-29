import { createStorageClient } from './apps/storage/dist/index.js';

async function verify() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const voiceAIQueries = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];
    
    console.log('Checking voice AI metrics in database...\n');
    
    const types = ['domain_diversity', 'engine_overlap', 'factual_alignment'];
    let totalFound = 0;
    
    for (const metricType of types) {
      const metrics = await storage.fetchRecentMetricRecords(metricType, 200);
      const voiceMetrics = metrics.filter(m => voiceAIQueries.includes(m.queryId));
      
      console.log(`${metricType}: ${voiceMetrics.length} voice AI metrics`);
      if (voiceMetrics.length > 0) {
        voiceMetrics.forEach(m => {
          console.log(`  - ${m.queryId.substring(0, 8)}: ${m.value}`);
        });
      }
      totalFound += voiceMetrics.length;
    }
    
    console.log(`\n✅ Total: ${totalFound} voice AI metrics`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await storage.close();
  }
}

verify().catch(console.error);

