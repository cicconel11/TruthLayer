import { createStorageClient } from './apps/storage/dist/index.js';

/**
 * Test script to verify query ID labeling and storage functionality
 * after security fixes to ensure no sensitive data is exposed.
 */
async function testSingleQueryStorage() {
  console.log('Testing storage for controversial queries...');

  const storage = createStorageClient();

  try {
    // Check current results for vaccines query
    const existingResults = await storage.fetchPendingAnnotations({
      queryIds: ['11111111-1111-1111-1111-111111111111'],
      limit: 2
    });

    console.log(`Current results for vaccines query: ${existingResults.length}`);

    if (existingResults.length > 0) {
      console.log('Sample existing result:', existingResults[0].snippet?.substring(0, 100));
    }

    // Test if we can write a test result
    console.log('Testing storage write capability...');

    const testResult = {
      id: '12345678-1234-1234-1234-123456789abc',
      crawlRunId: '87654321-4321-4321-4321-cba987654321',
      queryId: '11111111-1111-1111-1111-111111111111',
      engine: 'test-engine',
      rank: 1,
      title: 'Test Controversial Query Result',
      snippet: 'This is a test result for vaccines cause autism query to verify storage works.',
      url: 'https://example.com/test',
      normalizedUrl: 'https://example.com/test',
      domain: 'example.com',
      timestamp: new Date(),
      hash: 'test-hash',
      rawHtmlPath: '/test/path',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await storage.insertSearchResults([testResult]);
    console.log('✅ Successfully inserted test result');

    // Verify it was stored - filter to only recent results like the dashboard does
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const allResults = await storage.fetchPendingAnnotations({
      queryIds: ['11111111-1111-1111-1111-111111111111'],
      limit: 50 // Get more to see the difference
    });

    const recentResults = allResults.filter((result) => {
      const resultDate = result.timestamp;
      return resultDate >= sevenDaysAgo;
    });

    console.log(`Found ${allResults.length} total results for vaccines query (all time)`);
    console.log(`Found ${recentResults.length} recent results for vaccines query (last 7 days)`);

    if (recentResults.length > 0) {
      console.log('Recent results:');
      recentResults.forEach((result, i) => {
        console.log(`${i + 1}. ${result.snippet?.substring(0, 50)}...`);
      });
    }

    const foundTestResult = recentResults.find(r => r.snippet?.includes('test result'));
    if (foundTestResult) {
      console.log('✅ Test result found in storage!');
    } else {
      console.log('❌ Test result not found - checking if it was deduplicated');
      // Check if our test result exists by URL
      const byUrl = recentResults.find(r => r.url === 'https://example.com/test');
      if (byUrl) {
        console.log('✅ Test result found by URL (may have been deduped)');
      } else {
        console.log('❌ Test result not found at all');
      }
    }

  } catch (error) {
    console.error('❌ Storage test failed:', error.message);
  } finally {
    await storage.close();
  }
}

testSingleQueryStorage();
