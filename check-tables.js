import duckdb from 'duckdb';

const db = new duckdb.Database('data/truthlayer.duckdb');
const conn = db.connect();

conn.all("SELECT table_name FROM information_schema.tables WHERE table_schema='main' ORDER BY table_name", (err, tables) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  console.log('Tables in database:');
  tables.forEach(t => console.log(`  - ${t.table_name}`));
  
  // Check annotation-related tables
  conn.all(`SELECT COUNT(*) as count FROM annotations`, (err, result) => {
    if (err) console.log('  annotations: ERROR -', err.message);
    else console.log(`\nannotations table: ${result[0].count} rows`);
    
    conn.all(`SELECT COUNT(*) as count FROM search_results`, (err2, result2) => {
      if (err2) console.log('search_results: ERROR');
      else console.log(`search_results table: ${result2[0].count} rows`);
      
      // Check for voice AI in annotations
      conn.all(`
        SELECT sr.query_id, COUNT(*) as count
        FROM annotations a
        JOIN search_results sr ON a.search_result_id = sr.id  
        GROUP BY sr.query_id
        ORDER BY sr.query_id
      `, (err3, byQuery) => {
        if (err3) {
          console.log('Error grouping:', err3.message);
        } else {
          console.log('\nAnnotations by query:');
          byQuery.forEach(q => {
            console.log(`  ${q.query_id.substring(0, 8)}: ${q.count}`);
          });
        }
        
        conn.close(() => db.close());
      });
    });
  });
});

