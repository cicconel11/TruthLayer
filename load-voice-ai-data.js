import { createStorageClient } from './apps/storage/dist/index.js';
import fs from 'fs/promises';

async function loadVoiceAIData() {
  // Use DuckDB explicitly
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    console.log('Loading Voice AI SERP data into database...');
    
    // Load all three voice AI query files
    const queryFiles = [
      'data/serp/44444444-4444-4444-4444-444444444444-voice-ai-20.json',
      'data/serp/55555555-5555-5555-5555-555555555555-voice-ai-20.json',
      'data/serp/66666666-6666-6666-6666-666666666666-voice-ai-20.json'
    ];
    
    let totalResults = 0;
    
    for (const file of queryFiles) {
      const serpData = JSON.parse(await fs.readFile(file, 'utf-8'));
      
      if (serpData.length > 0) {
        console.log(`Loading ${serpData.length} results from ${file.split('/').pop()}`);
        
        // Convert to SearchResultInput format
        const searchResults = serpData.map(r => ({
          id: r.id,
          crawlRunId: r.crawlRunId,
          queryId: r.queryId,
          engine: r.engine,
          rank: r.rank,
          title: r.title,
          snippet: r.snippet ?? null,
          url: r.url,
          normalizedUrl: r.normalizedUrl,
          domain: r.domain,
          timestamp: new Date(r.timestamp),
          hash: r.hash,
          rawHtmlPath: r.rawHtmlPath ?? '',
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt)
        }));
        
        await storage.insertSearchResults(searchResults);
        totalResults += searchResults.length;
        console.log(`✅ Loaded ${searchResults.length} results`);
      }
    }
    
    console.log(`\n✅ Total: ${totalResults} search results loaded successfully`);
    
    // Verify data
    const pending = await storage.fetchPendingAnnotations({ limit: 10 });
    console.log(`✅ Verified: ${pending.length} results pending annotation`);
    
    console.log('\n🎉 Voice AI data loaded! Ready for annotation.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await storage.close();
  }
}

loadVoiceAIData().catch(console.error);

