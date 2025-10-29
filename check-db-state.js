import { createStorageClient } from './apps/storage/dist/index.js';

async function check() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    console.log('Fetching with same parameters as metrics runner...');
    console.log('Since:', since.toISOString());
    console.log();
    
    const results = await storage.fetchAnnotatedResults({ since });
    console.log(`Total results: ${results.length}`);
    
    // Check for duplicates
    const ids = results.map(r => r.annotationId);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      console.log(`❌ DUPLICATES FOUND! ${ids.length} total, ${uniqueIds.size} unique`);
    } else {
      console.log(`✅ No duplicates (${uniqueIds.size} unique annotation IDs)`);
    }
    
    // Group by query
    const byQuery = {};
    results.forEach(r => {
      if (!byQuery[r.queryId]) byQuery[r.queryId] = [];
      byQuery[r.queryId].push(r);
    });
    
    console.log(`\nGrouped into ${Object.keys(byQuery).length} queries:`);
    Object.entries(byQuery).forEach(([qid, qResults]) => {
      console.log(`  ${qid.substring(0, 8)}: ${qResults.length} results`);
    });
    
    // Check voice AI specifically
    const voiceAI = results.filter(r => 
      r.queryId.startsWith('44444') || 
      r.queryId.startsWith('55555') || 
      r.queryId.startsWith('66666')
    );
    
    console.log(`\nVoice AI: ${voiceAI.length} results`);
    if (voiceAI.length === 0) {
      console.log('❌ Voice AI results NOT FOUND');
      console.log('\nLet me check if they exist at all...');
      
      const allResults = await storage.fetchAnnotatedResults({});
      const allVoiceAI = allResults.filter(r => 
        r.queryId.startsWith('44444') || 
        r.queryId.startsWith('55555') || 
        r.queryId.startsWith('66666')
      );
      console.log(`Found ${allVoiceAI.length} voice AI results without date filter`);
      
      if (allVoiceAI.length > 0) {
        console.log('Sample:', {
          queryId: allVoiceAI[0].queryId.substring(0, 8),
          collectedAt: allVoiceAI[0].collectedAt,
          runId: allVoiceAI[0].runId.substring(0, 8)
        });
        
        const oldestDate = new Date(Math.min(...allVoiceAI.map(r => new Date(r.collectedAt).getTime())));
        const newestDate = new Date(Math.max(...allVoiceAI.map(r => new Date(r.collectedAt).getTime())));
        console.log(`Date range: ${oldestDate.toISOString()} to ${newestDate.toISOString()}`);
        console.log(`Since filter: ${since.toISOString()}`);
        
        if (oldestDate < since) {
          console.log('❌ Voice AI data is OLDER than the "since" filter!');
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
  } finally {
    await storage.close();
  }
}

check().catch(console.error);

