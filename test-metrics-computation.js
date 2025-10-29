import { createStorageClient } from './apps/storage/dist/index.js';

async function test() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    console.log('Fetching annotated results since:', since.toISOString());
    
    const annotatedResults = await storage.fetchAnnotatedResults({ since });
    console.log(`Total annotated results: ${annotatedResults.length}\n`);
    
    // Group by query
    const byQuery = {};
    annotatedResults.forEach(r => {
      if (!byQuery[r.queryId]) byQuery[r.queryId] = [];
      byQuery[r.queryId].push(r);
    });
    
    console.log('Results by Query:');
    Object.entries(byQuery).forEach(([qid, results]) => {
      const runs = new Set(results.map(r => r.runId));
      console.log(`  ${qid}: ${results.length} results from ${runs.size} runs`);
    });
    
    // Check voice AI specifically
    const voiceAIIds = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];
    
    console.log('\nVoice AI Queries:');
    voiceAIIds.forEach(qid => {
      const results = byQuery[qid];
      if (results) {
        const runIds = [...new Set(results.map(r => r.runId))];
        console.log(`  ${qid.substring(0,8)}: ${results.length} results`);
        console.log(`    Run IDs: ${runIds.map(r => r.substring(0,8)).join(', ')}`);
      } else {
        console.log(`  ${qid.substring(0,8)}: NOT FOUND`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await storage.close();
  }
}

test().catch(console.error);

