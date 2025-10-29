import { createStorageClient } from './apps/storage/dist/index.js';

async function reset() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    console.log('Deleting old voice AI annotations...');
    
    // Get connection to run raw SQL
    const conn = await storage.getConnection();
    
    // Delete annotations for voice AI query results (DuckDB uses 'annotations' table)
    await conn.run(`
      DELETE FROM annotations 
      WHERE search_result_id IN (
        SELECT id FROM search_results 
        WHERE query_id IN (
          '44444444-4444-4444-4444-444444444444',
          '55555555-5555-5555-5555-555555555555',
          '66666666-6666-6666-6666-666666666666'
        )
      )
    `);
    
    console.log('✅ Old annotations deleted');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await storage.close();
  }
}

reset().catch(console.error);

