// Test the exact SQL pattern used by fetchAnnotatedResults
const duckdb = require('./apps/storage/node_modules/duckdb');
const db = new duckdb.Database('data/truthlayer.duckdb');

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

async function testSQLPattern() {
  try {
    const conn = db.connect();
    
    // Test the exact query from fetchAnnotatedResults
    console.log('=== TESTING STORAGE CLIENT SQL PATTERN ===');
    
    const { rows } = await all(
      conn,
      `
        SELECT
          COALESCE(sr.crawl_run_id::text, ann.query_id || '-' || to_char(sr.timestamp, 'YYYYMMDDHH24MISS')) AS run_id,
          cr.batch_id::text,
          ann.id::text AS annotation_id,
          sr.query_id::text,
          sr.engine,
          sr.normalized_url,
          sr.domain,
          sr.rank,
          ann.factual_consistency,
          ann.domain_type,
          sr.timestamp AS collected_at
        FROM annotations ann
        JOIN search_results sr ON sr.id = ann.search_result_id
        LEFT JOIN crawl_runs cr ON cr.id = sr.crawl_run_id
        ORDER BY collected_at ASC, sr.query_id ASC, sr.engine ASC, sr.rank ASC
      `
    );
    
    console.log(`Total results from storage client query: ${rows.length}`);
    
    // Group by engine
    const byEngine = {};
    rows.forEach(row => {
      const engine = row.engine || 'unknown';
      if (!byEngine[engine]) byEngine[engine] = [];
      byEngine[engine].push(row);
    });
    
    Object.entries(byEngine).forEach(([engine, results]) => {
      console.log(`${engine}: ${results.length} results`);
    });
    
    // Check if there are any issues with the joins
    console.log('\n=== DEBUGGING JOIN ISSUES ===');
    
    // Check if all search_results have annotations
    const allSR = await all(conn, 'SELECT COUNT(*) as count FROM search_results');
    const allAnn = await all(conn, 'SELECT COUNT(*) as count FROM annotations');
    const joined = await all(conn, `
      SELECT COUNT(*) as count 
      FROM annotations ann 
      JOIN search_results sr ON sr.id = ann.search_result_id
    `);
    
    console.log(`Search results: ${allSR[0]?.count || 0}`);
    console.log(`Annotations: ${allAnn[0]?.count || 0}`);
    console.log(`Successful joins: ${joined[0]?.count || 0}`);
    
    // Check if there are search results without annotations
    const orphanSR = await all(conn, `
      SELECT COUNT(*) as count, engine
      FROM search_results sr 
      LEFT JOIN annotations a ON sr.id = a.search_result_id 
      WHERE a.search_result_id IS NULL
      GROUP BY engine
    `);
    
    console.log('Orphaned search results (no annotations):');
    orphanSR.forEach(row => {
      console.log(`  ${row.engine}: ${row.count} results`);
    });
    
    // Check if there are annotations without search results
    const orphanAnn = await all(conn, `
      SELECT COUNT(*) as count 
      FROM annotations a 
      LEFT JOIN search_results sr ON sr.id = a.search_result_id 
      WHERE sr.id IS NULL
    `);
    
    console.log(`Orphaned annotations (no search results): ${orphanAnn[0]?.count || 0}`);
    
    conn.close();
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
  process.exit(0);
}

testSQLPattern();
