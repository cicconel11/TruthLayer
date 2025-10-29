import { createStorageClient } from './apps/storage/dist/index.js';

async function checkMetrics() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const voiceAIQueries = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];
    
    // Check annotated results using the storage API
    console.log('\n🔍 Checking Voice AI Data in Database...\n');
    
    const annotatedResults = await storage.fetchAnnotatedResults({
      queryIds: voiceAIQueries
    });
    
    console.log(`📊 Total Annotated Results: ${annotatedResults.length}`);
    
    if (annotatedResults.length > 0) {
      const byQuery = {};
      annotatedResults.forEach(r => {
        if (!byQuery[r.queryId]) byQuery[r.queryId] = { engines: new Set(), count: 0 };
        byQuery[r.queryId].engines.add(r.engine);
        byQuery[r.queryId].count++;
      });
      
      console.log('\nResults by Query:');
      Object.entries(byQuery).forEach(([qid, data]) => {
        console.log(`  ${qid.substring(0, 8)}: ${data.count} results from [${[...data.engines].join(', ')}]`);
      });
      
      console.log('\n✅ Voice AI data is in the database and ready for metrics!');
      console.log('\nNote: The metrics runner may have processed older queries.');
      console.log('The data is loaded and the dashboard should show it.');
    } else {
      console.log('❌ No annotated results found for voice AI queries');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await storage.close();
  }
}

checkMetrics().catch(console.error);

