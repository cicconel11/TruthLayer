const { createStorageClient } = require('./apps/storage/dist/index.js');
const storage = createStorageClient();

async function checkData() {
  try {
    console.log('Checking recent annotated results...');
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const annotated = await storage.fetchAnnotatedResults({ since });
    console.log(`Total annotated results: ${annotated?.length || 0}`);
    
    if (annotated && annotated.length > 0) {
      const engines = [...new Set(annotated.map(r => r.engine))];
      console.log('Available engines:', engines);
      
      // Group by engine
      const byEngine = {};
      annotated.forEach(r => {
        const engine = r.engine || 'unknown';
        if (!byEngine[engine]) byEngine[engine] = [];
        byEngine[engine].push(r);
      });
      
      console.log('\nResults by engine:');
      Object.entries(byEngine).forEach(([engine, results]) => {
        console.log(`${engine}: ${results.length} results`);
        // Show sample domains for this engine
        const domains = [...new Set(results.slice(0, 3).map(r => r.domain))];
        console.log(`  Sample domains: ${domains.join(', ')}`);
      });
      
      // Check if there are any query texts
      const withQuery = annotated.filter(r => r.query);
      console.log(`\nResults with query text: ${withQuery.length}`);
      
      // Search for election related content
      const electionRelated = annotated.filter(r => {
        const searchText = `${r.normalizedUrl} ${r.domain} ${r.query || ''}`.toLowerCase();
        return searchText.includes('election') || searchText.includes('2024');
      });
      console.log(`\nElection/2024 related results: ${electionRelated.length}`);
      
      // Show all engines for election-related results
      if (electionRelated.length > 0) {
        console.log('\nElection results by engine:');
        const electionByEngine = {};
        electionRelated.forEach(r => {
          const engine = r.engine || 'unknown';
          if (!electionByEngine[engine]) electionByEngine[engine] = [];
          electionByEngine[engine].push(r);
        });
        Object.entries(electionByEngine).forEach(([engine, results]) => {
          console.log(`  ${engine}: ${results.length} results`);
          results.slice(0, 2).forEach(r => {
            console.log(`    - ${r.domain} (${r.domainType})`);
          });
        });
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

checkData();
