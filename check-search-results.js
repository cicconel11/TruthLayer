const { createStorageClient } = require('./apps/storage/dist/index.js');

async function checkSearchResults() {
  try {
    console.log('Checking raw search results in the database...');
    const storage = createStorageClient();
    const db = await storage.getConnection();
    
    try {
      // Run all() is defined in the storage module
      const all = (conn, sql, params = []) => {
        return new Promise((resolve, reject) => {
          const callback = (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows ?? []);
            }
          };
          if (params.length) {
            conn.all(sql, ...params, callback);
          } else {
            conn.all(sql, callback);
          }
        });
      };
      
      // Check what's in all tables
      console.log('\n=== TABLES ===');
      let tables = await all(db, "SHOW TABLES");
      console.log('Available tables:', tables.map(t => t.name));
      
      // Check search_results table
      console.log('\n=== SEARCH RESULTS ===');
      const searchResults = await all(db, "SELECT COUNT(*) as count FROM search_results");
      console.log(`Total search results: ${searchResults[0]?.count || 0}`);
      
      if (searchResults[0]?.count > 0) {
        // Results by engine
        const byEngine = await all(db, `
          SELECT engine, COUNT(*) as count 
          FROM search_results 
          GROUP BY engine 
          ORDER BY count DESC
        `);
        console.log('\nSearch results by engine:');
        byEngine.forEach(row => {
          console.log(`${row.engine}: ${row.count} results`);
        });
        
        // Recent results
        const recentResults = await all(db, `
          SELECT engine, domain, url, title, collected_at
          FROM search_results 
          ORDER BY collected_at DESC 
          LIMIT 10
        `);
        console.log('\nRecent search results:');
        recentResults.forEach((row, i) => {
          console.log(`${i+1}. ${row.engine}: ${row.domain} ${row.title ? `- ${row.title.substring(0, 40)}...` : ''}`);
        });
      }
      
      // Check what's in the annotations
      console.log('\n=== ANNOTATIONS ===');
      const annotations = await all(db, "SELECT COUNT(*) as count FROM annotations");
      console.log(`Total annotations: ${annotations[0]?.count || 0}`);
      
      // Check annotated results
      console.log('\n=== FETCH ANNOTATED RESULTS (SQL) ===');
      const annotatedSQL = `
        SELECT 
          sr.engine,
          sr.domain,
          sr.url,
          sr.title,
          a.domain_type,
          a.factual_consistency,
          a.confidence,
          a.annotated_at
        FROM search_results sr
        LEFT JOIN annotations a ON sr.id = a.search_result_id
        WHERE a.search_result_id IS NOT NULL
        ORDER BY a.annotated_at DESC
        LIMIT 20
      `;
      
      const annotatedResults = await all(db, annotatedSQL);
      console.log(`\nAnnotated results found: ${annotatedResults.length}`);
      
      annotatedResults.forEach((row, i) => {
        console.log(`${i+1}. ${row.engine}: ${row.domain} (${row.domain_type}) - ${row.factual_consistency || 'N/A'}`);
      });
      
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

checkSearchResults();
