// Direct DuckDB access
const duckdb = require('./apps/storage/node_modules/duckdb');
const db = new duckdb.Database('data/truthlayer.duckdb');

const run = (conn, sql, params = []) => {
  return new Promise((resolve, reject) => {
    const callback = (err) => {
      if (err) reject(err);
      else resolve();
    };
    if (params.length) {
      conn.run(sql, ...params, callback);
    } else {
      conn.run(sql, callback);
    }
  });
};

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

async function checkDatabase() {
  try {
    const conn = db.connect();
    
    // Check tables
    console.log('=== TABLES ===');
    const tables = await all(conn, "SHOW TABLES");
    console.log('Available tables:', tables.map(t => t.name));
    
    // Check search results by engine
    console.log('\n=== SEARCH RESULTS BY ENGINE ===');
    const searchResults = await all(conn, `
      SELECT engine, COUNT(*) as count 
      FROM search_results 
      GROUP BY engine 
      ORDER BY count DESC
    `);
    console.log('Search results by engine:');
    searchResults.forEach(row => {
      console.log(`${row.engine}: ${row.count} results`);
    });
    
    // Check annotated results by engine
    console.log('\n=== ANNOTATED RESULTS BY ENGINE ===');
    const annotatedResults = await all(conn, `
      SELECT sr.engine, COUNT(*) as count 
      FROM search_results sr
      INNER JOIN annotations a ON sr.id = a.search_result_id
      GROUP BY sr.engine 
      ORDER BY count DESC
    `);
    console.log('Annotated results by engine:');
    annotatedResults.forEach(row => {
      console.log(`${row.engine}: ${row.count} results`);
    });
    
    // Check if search results exist without annotations
    console.log('\n=== UNANNOTATED SEARCH RESULTS ===');
    const unAnnotated = await all(conn, `
      SELECT sr.engine, COUNT(*) as count 
      FROM search_results sr
      LEFT JOIN annotations a ON sr.id = a.search_result_id
      WHERE a.search_result_id IS NULL
      GROUP BY sr.engine 
      ORDER BY count DESC
    `);
    console.log('Unannotated search results by engine:');
    unAnnotated.forEach(row => {
      console.log(`${row.engine}: ${row.count} results`);
    });
    
    // Disable recent check for now - column name issue
    
    // Show sample results from all engines
    console.log('\n=== SAMPLE RESULTS FROM ALL ENGINES ===');
    const samples = await all(conn, `
      SELECT sr.engine, sr.domain, sr.title, sr.timestamp, a.domain_type, a.factual_consistency
      FROM search_results sr
      LEFT JOIN annotations a ON sr.id = a.search_result_id
      ORDER BY sr.timestamp DESC
      LIMIT 20
    `);
    samples.forEach((row, i) => {
      console.log(`${i+1}. ${row.engine}: ${row.domain} (${row.domain_type || 'unannotated'}) - ${row.title?.substring(0, 50) || 'No title'}...`);
    });
    
    // Check total counts
    console.log('\n=== TOTAL COUNTS ===');
    const totalSearch = await all(conn, "SELECT COUNT(*) as count FROM search_results");
    const totalAnnot = await all(conn, "SELECT COUNT(*) as count FROM annotations");
    console.log(`Total search results: ${totalSearch[0]?.count || 0}`);
    console.log(`Total annotations: ${totalAnnot[0]?.count || 0}`);
    
    conn.close();
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
  process.exit(0);
}

checkDatabase();
