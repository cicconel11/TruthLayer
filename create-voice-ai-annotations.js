import { createStorageClient } from './apps/storage/dist/index.js';
import { randomUUID } from 'node:crypto';

/**
 * Create mock annotations for voice AI results
 * This allows us to demo the dashboard without running LLM annotation
 */
async function createMockAnnotations() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    console.log('Creating mock annotations for voice AI results...');
    
    // Fetch pending results
    const pendingResults = await storage.fetchPendingAnnotations({ limit: 100 });
    console.log(`Found ${pendingResults.length} results pending annotation`);
    
    if (pendingResults.length === 0) {
      console.log('No pending results to annotate');
      return;
    }
    
    // Create mock annotations with realistic labels
    // Valid domain types: 'news', 'government', 'academic', 'blog', 'other'
    const annotations = pendingResults.map((result) => {
      // Categorize domains heuristically using valid enum values
      let domainType = 'other';
      let factualConsistency = 'aligned';
      
      const domain = result.domain.toLowerCase();
      
      // Tech news/media
      if (domain.includes('theverge') || domain.includes('techcrunch') ||
          domain.includes('aithority') || domain.includes('nojitter')) {
        domainType = 'news';
      }
      // Blog/Educational
      else if (domain.includes('dev.to') || domain.includes('blog') ||
               domain.includes('lindy') || domain.includes('hubspot') ||
               domain.includes('saastake')) {
        domainType = 'blog';
      }
      // Academic/Educational institutions
      else if (domain.includes('.edu') || domain.includes('academic')) {
        domainType = 'academic';
      }
      // Everything else (commercial platforms, tools, etc.)
      else {
        domainType = 'other';
      }
      
      return {
        id: randomUUID(),
        searchResultId: result.id,
        queryId: result.queryId,
        engine: result.engine,
        domainType,
        factualConsistency,
        confidence: 0.85, // High confidence for mock data
        promptVersion: 'mock-v1',
        modelId: 'heuristic-mock',
        createdAt: new Date(),
        updatedAt: new Date(),
        extra: {
          provider: 'mock',
          reasoning: `Auto-classified as ${domainType} based on domain pattern`
        }
      };
    });
    
    // Insert annotations
    await storage.insertAnnotationRecords(annotations);
    console.log(`✅ Created ${annotations.length} mock annotations`);
    
    // Show summary
    const byType = annotations.reduce((acc, ann) => {
      acc[ann.domainType] = (acc[ann.domainType] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nAnnotation Summary:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\n🎉 Mock annotations created! Ready for metrics.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await storage.close();
  }
}

createMockAnnotations().catch(console.error);

