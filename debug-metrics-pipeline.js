import { createStorageClient } from './apps/storage/dist/index.js';
import { createMetricsApp } from './apps/metrics/dist/index.js';

async function debugPipeline() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    console.log('='.repeat(80));
    console.log('DEBUGGING METRICS PIPELINE');
    console.log('='.repeat(80));
    
    // Step 1: Check what annotated results exist
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    console.log('\n1️⃣  FETCHING ANNOTATED RESULTS');
    console.log('   Since:', since.toISOString());
    
    const annotatedResults = await storage.fetchAnnotatedResults({ since });
    console.log(`   Found: ${annotatedResults.length} total results`);
    
    const voiceAIResults = annotatedResults.filter(r => 
      r.queryId.startsWith('44444') || 
      r.queryId.startsWith('55555') || 
      r.queryId.startsWith('66666')
    );
    console.log(`   Voice AI: ${voiceAIResults.length} results`);
    
    if (voiceAIResults.length > 0) {
      console.log('   Sample:', {
        queryId: voiceAIResults[0].queryId.substring(0, 8),
        runId: voiceAIResults[0].runId.substring(0, 8),
        engine: voiceAIResults[0].engine,
        domain: voiceAIResults[0].domain
      });
    }
    
    // Step 2: Check what's in metric_records table BEFORE computation
    console.log('\n2️⃣  CHECKING EXISTING METRICS IN DATABASE');
    const existingMetrics = await storage.fetchRecentMetricRecords('domain_diversity', 200);
    console.log(`   Total domain_diversity metrics: ${existingMetrics.length}`);
    
    const existingVoiceMetrics = existingMetrics.filter(m => 
      m.queryId.startsWith('44444') || 
      m.queryId.startsWith('55555') || 
      m.queryId.startsWith('66666')
    );
    console.log(`   Voice AI metrics: ${existingVoiceMetrics.length}`);
    
    // Step 3: Manually compute metrics to see what SHOULD be created
    console.log('\n3️⃣  COMPUTING METRICS MANUALLY');
    
    // Group voice AI results by query and run
    const byQuery = {};
    voiceAIResults.forEach(r => {
      const key = `${r.queryId}-${r.runId}`;
      if (!byQuery[key]) byQuery[key] = {
        queryId: r.queryId,
        runId: r.runId,
        results: []
      };
      byQuery[key].results.push(r);
    });
    
    console.log(`   Should create metrics for ${Object.keys(byQuery).length} query-run combinations:`);
    Object.values(byQuery).forEach(group => {
      const domains = new Set(group.results.map(r => r.domain));
      console.log(`     ${group.queryId.substring(0,8)}-${group.runId.substring(0,8)}: ${group.results.length} results, ${domains.size} domains`);
    });
    
    // Step 4: Check if metrics are actually being saved
    console.log('\n4️⃣  RUNNING METRICS COMPUTATION');
    
    // Import and run the actual metrics app
    const metricsApp = createMetricsApp();
    await metricsApp.run();
    
    // Step 5: Check metrics table AFTER computation
    console.log('\n5️⃣  CHECKING METRICS AFTER COMPUTATION');
    const afterMetrics = await storage.fetchRecentMetricRecords('domain_diversity', 200);
    console.log(`   Total domain_diversity metrics: ${afterMetrics.length}`);
    
    const afterVoiceMetrics = afterMetrics.filter(m => 
      m.queryId.startsWith('44444') || 
      m.queryId.startsWith('55555') || 
      m.queryId.startsWith('66666')
    );
    console.log(`   Voice AI metrics: ${afterVoiceMetrics.length}`);
    
    if (afterVoiceMetrics.length > 0) {
      console.log('\n   ✅ SUCCESS! Voice AI metrics found:');
      afterVoiceMetrics.forEach(m => {
        console.log(`      ${m.queryId.substring(0,8)}: ${m.metricType} = ${m.value}`);
      });
    } else {
      console.log('\n   ❌ FAILED - No voice AI metrics in database');
      console.log('   Checking if ANY new metrics were added...');
      
      const diff = afterMetrics.length - existingMetrics.length;
      console.log(`   Metrics added: ${diff}`);
      
      if (diff > 0) {
        console.log('   New metrics were added, but not for voice AI queries');
        console.log('   This suggests the computation is running but filtering out voice AI data');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error(error.stack);
  } finally {
    await storage.close();
  }
}

debugPipeline().catch(console.error);

