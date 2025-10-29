const { createStorageClient } = require('./apps/storage/dist/index.js');
const duckdb = require('./apps/storage/node_modules/duckdb');

async function debugStorage() {
  try {
    console.log('=== COMPARING STORAGE CLIENT VS DIRECT DATABASE ===\n');
    
    // Test storage client
    console.log('Storage client results:');
    const storage = createStorageClient();
    const storageResults = await storage.fetchAnnotatedResults({});
    console.log(`Storage client: ${storageResults.length} total results`);
    
    const storageEngines = [...new Set(storageResults.map(r => r.engine))];
    storageEngines.forEach(engine => {
      const count = storageResults.filter(r => r.engine === engine).length;
      console.log(`  ${engine}: ${count} results`);
    });
    
    console.log('\nDirect database results:');
    
    // Test direct database
    const db = new duckdb.Database('data/truthlayer.duckdb');
    const conn = db.connect();
    
    const all = (conn, sql, params = []) => {
      return new Promise((resolve, reject) => {
        const callback = (err, rows) => {
          if (err) reject(err);
          else resolve(rows ?? []);
        };
        if (params.length) {
          conn.all(sql, ...params, callback);
        } else {
          conn.all(sql, callback);
        }
      });
    };
    
    const directResults = await all(conn, `
      SELECT 
        sr.engine,
        sr.normalized_url as normalizedUrl,
        sr.domain,
        sr.rank,
        ann.factual_consistency as factualConsistency,
        ann.domain_type as domainType,
        sr.timestamp
      FROM search_results sr
      JOIN annotations ann ON sr.id = ann.search_result_id
      ORDER BY sr.timestamp DESC
      LIMIT 100
    `);
    
    console.log(`Direct database: ${directResults.length} total results`);
    
    const directEngines = [...new Set(directResults.map(r => r.engine))];
    directEngines.forEach(engine => {
      const count = directResults.filter(r => r.engine === engine).length;
      console.log(`  ${engine}: ${count} results`);
    });
    
    // Check timestamps to see if there's a time filter issue
    console.log('\nSample timestamps by engine:');
    directEngines.forEach(engine => {
      const engineResults = directResults.filter(r => r.engine === engine).slice(0, 3);
      console.log(`${engine}:`);
      engineResults.forEach(r => {
        console.log(`  ${r.timestamp}`);
      });
    });
    
    // Check engine field specifically in storage results
    console.log('\nStorage result engine field analysis:');
    storageResults.slice(0, 10).forEach((r, i) => {
      console.log(`${i+1}. engine: "${r.engine}" (type: ${typeof r.engine})`);
    });
    
    conn.close();
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

debugStorage();
