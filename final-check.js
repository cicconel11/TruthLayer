import { createStorageClient } from './apps/storage/dist/index.js';

async function check() {
  // Use the exact same client creation as the metrics runner
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    console.log('Checking database: data/truthlayer.duckdb');
    console.log('Since:', since.toISOString(), '\n');
    
    const results = await storage.fetchAnnotatedResults({ since });
    
    console.log(`Total annotated results: ${results.length}`);
    
    const byQuery = {};
    results.forEach(r => {
      if (!byQuery[r.queryId]) byQuery[r.queryId] = 0;
      byQuery[r.queryId]++;
    });
    
    console.log(`\nBy query:`);
    Object.entries(byQuery).forEach(([qid, count]) => {
      console.log(`  ${qid.substring(0, 8)}: ${count}`);
    });
    
    const voiceAI = results.filter(r => 
      r.queryId.startsWith('44444') || 
      r.queryId.startsWith('55555') || 
      r.queryId.startsWith('66666')
    );
    
    console.log(`\n${voiceAI.length > 0 ? '✅' : '❌'} Voice AI: ${voiceAI.length} results`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await storage.close();
  }
}

check().catch(console.error);

