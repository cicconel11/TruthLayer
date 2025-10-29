const { createStorageClient } = require('./apps/storage/dist/index.js');

async function testFetchFilter() {
  try {
    console.log('Testing fetchAnnotatedResults with different time windows...\n');
    const storage = createStorageClient();
    
    // Test with different time windows
    const timeWindows = [
      { days: 1, label: 'Last 1 day' },
      { days: 7, label: 'Last 7 days (current)' },
      { days: 30, label: 'Last 30 days' },
      { days: 365, label: 'Last 365 days (all)' }
    ];
    
    for (const window of timeWindows) {
      const since = new Date(Date.now() - window.days * 24 * 60 * 60 * 1000);
      const annotated = await storage.fetchAnnotatedResults({ since });
      
      const engines = [...new Set(annotated.map(r => r.engine))];
      console.log(`${window.label}: ${annotated.length} results`);
      engines.forEach(engine => {
        const count = annotated.filter(r => r.engine === engine).length;
        console.log(`  ${engine}: ${count} results`);
      });
      console.log('');
    }
    
    // Test without any time filter
    console.log('No time filter (all results):');
    const allAnnotated = await storage.fetchAnnotatedResults({});
    const allEngines = [...new Set(allAnnotated.map(r => r.engine))];
    console.log(`Total: ${allAnnotated.length} results`);
    allEngines.forEach(engine => {
      const count = allAnnotated.filter(r => r.engine === engine).length;
      console.log(`  ${engine}: ${count} results`);
    });
    
    // Check timestamps of Perplexity vs other engines 
    console.log('\nChecking result timestamps by engine:');
    const perplexityResults = allAnnotated.filter(r => r.engine === 'perplexity');
    const braveResults = allAnnotated.filter(r => r.engine === 'brave');
    const duckduckgoResults = allAnnotated.filter(r => r.engine === 'duckduckgo');
    
    if (perplexityResults.length > 0) {
      const recentPerplex = perplexityResults[0];
      console.log(`Most recent Perplexity result: ${recentPerplex.timestamp.toISOString()}`);
    }
    
    if (braveResults.length > 0) {
      const recentBrave = braveResults[0];
      console.log(`Most recent Brave result: ${recentBrave.timestamp.toISOString()}`);
    }
    
    if (duckduckgoResults.length > 0) {
      const recentDDG = duckduckgoResults[0];
      console.log(`Most recent DuckDuckGo result: ${recentDDG.timestamp.toISOString()}`);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

testFetchFilter();
