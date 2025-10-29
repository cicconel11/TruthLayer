import { createStorageClient } from './apps/storage/dist/index.js';

async function verify() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const voiceAIQueries = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];
    
    // Check annotated results using storage API
    const annotatedResults = await storage.fetchAnnotatedResults({
      queryIds: voiceAIQueries
    });
    
    console.log('\n📊 Annotated Results Found:', annotatedResults.length);
    
    if (annotatedResults.length > 0) {
      const firstResult = annotatedResults[0];
      console.log('\nFirst result timestamp:', firstResult.collectedAt);
      console.log('Time since collection:', ((new Date() - firstResult.collectedAt) / 1000 / 60).toFixed(0), 'minutes ago');
    }
    
    const byQuery = {};
    annotatedResults.forEach(r => {
      if (!byQuery[r.queryId]) byQuery[r.queryId] = [];
      byQuery[r.queryId].push(r.engine);
    });
    
    console.log('\nBy Query:');
    Object.entries(byQuery).forEach(([qid, engines]) => {
      console.log(`  ${qid.substring(0,8)}: ${engines.length} results`);
    });
    
    // Try fetching with since parameter like metrics does
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentResults = await storage.fetchAnnotatedResults({
      queryIds: voiceAIQueries,
      since: oneDayAgo
    });
    
    console.log(`\n📅 Results from last 24 hours: ${recentResults.length}`);
    
    // Check metrics for each type
    console.log('\n📈 Metrics in Database:');
    const metricTypes = ['domain_diversity', 'engine_overlap', 'factual_alignment'];
    let foundMetrics = 0;
    
    for (const metricType of metricTypes) {
      const metrics = await storage.fetchRecentMetricRecords(metricType, 100);
      const voiceAIMetrics = metrics.filter(m => voiceAIQueries.includes(m.queryId));
      
      if (voiceAIMetrics.length > 0) {
        console.log(`  ${metricType}: ${voiceAIMetrics.length} metrics`);
        foundMetrics += voiceAIMetrics.length;
      }
    }
    
    if (foundMetrics === 0) {
      console.log('  ❌ NO METRICS FOUND - Metrics need to be computed!');
      console.log('\n  The annotated results exist, but metrics haven\'t been generated yet.');
      console.log('  This is normal - metrics only process data from the last 7 days.');
    } else {
      console.log(`\n✅ Found ${foundMetrics} metrics for voice AI queries`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await storage.close();
  }
}

verify().catch(console.error);

