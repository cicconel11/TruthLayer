import { createStorageClient } from './apps/storage/dist/index.js';
import { readFile } from 'fs/promises';

async function test() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    console.log('Testing full metrics computation flow...\n');
    
    // Step 1: Fetch annotated results
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    const annotatedResults = await storage.fetchAnnotatedResults({ since });
    console.log(`1. Fetched ${annotatedResults.length} annotated results`);
    
    const voiceAI = annotatedResults.filter(r => r.queryId.startsWith('44444') || r.queryId.startsWith('55555') || r.queryId.startsWith('66666'));
    console.log(`   Voice AI: ${voiceAI.length} results\n`);
    
    // Step 2: Import and call computeMetricSeries from the actual metrics lib
    // We can't do this easily since it's compiled, so let's check the latest run's JSON output
    
    console.log('2. Checking latest metrics computation output...');
    
    // Find the latest metrics JSON file
    const metricsFiles = await readFile('data/metrics', 'utf-8').catch(() => null);
    
    // Read the JSON from the last run we saw (2e251675...)
    const latestJson = JSON.parse(await readFile(
      'data/metrics/2e251675-16c4-4ad8-9ee5-f31da23131ef-metrics.json',
      'utf-8'
    ));
    
    console.log(`   Total metrics computed: ${latestJson.length}`);
    
    const voiceAIMetrics = latestJson.filter(m => 
      m.queryId.startsWith('44444') || 
      m.queryId.startsWith('55555') || 
      m.queryId.startsWith('66666')
    );
    
    console.log(`   Voice AI metrics: ${voiceAIMetrics.length}\n`);
    
    if (voiceAIMetrics.length > 0) {
      console.log('✅ Voice AI metrics WERE computed!');
      console.log('   Sample:', voiceAIMetrics.slice(0, 3).map(m => ({
        queryId: m.queryId.substring(0, 8),
        metricType: m.metricType,
        value: m.value,
        runId: m.runId.substring(0, 8)
      })));
      
      console.log('\n3. So metrics were computed but NOT inserted into database!');
      console.log('   This suggests an error in insertMetricRecords that is being swallowed.\n');
      
    } else {
      console.log('❌ Voice AI metrics were NOT computed');
      console.log('   The computation is filtering them out for some reason.\n');
      
      // Show what WAS computed
      const uniqueQueries = [...new Set(latestJson.map(m => m.queryId))];
      console.log('   Queries that WERE computed:');
      uniqueQueries.forEach(q => {
        const count = latestJson.filter(m => m.queryId === q).length;
        console.log(`     ${q.substring(0, 8)}: ${count} metrics`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
  } finally {
    await storage.close();
  }
}

test().catch(console.error);

