import { createStorageClient } from './apps/storage/dist/index.js';

// Inline simplified version of computeMetricSeries to debug
function groupByQueryAndRun(records) {
  const byQuery = new Map();

  for (const record of records) {
    const queryMap = byQuery.get(record.queryId) ?? new Map();
    if (!byQuery.has(record.queryId)) {
      byQuery.set(record.queryId, queryMap);
    }

    const runKey = record.runId;
    let runGroup = queryMap.get(runKey);
    if (!runGroup) {
      runGroup = {
        runId: runKey,
        collectedAt: record.collectedAt,
        results: []
      };
      queryMap.set(runKey, runGroup);
    } else if (record.collectedAt < runGroup.collectedAt) {
      runGroup.collectedAt = record.collectedAt;
    }

    runGroup.results.push(record);
  }

  const output = new Map();
  for (const [queryId, runs] of byQuery.entries()) {
    output.set(
      queryId,
      Array.from(runs.values()).sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime())
    );
  }

  return output;
}

async function test() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    console.log('Fetching annotated results...');
    const annotatedResults = await storage.fetchAnnotatedResults({ since });
    console.log(`Total: ${annotatedResults.length} results\n`);
    
    // Group the results
    console.log('Grouping by query and run...');
    const grouped = groupByQueryAndRun(annotatedResults);
    
    console.log(`Grouped into ${grouped.size} queries:\n`);
    
    for (const [queryId, runs] of grouped.entries()) {
      console.log(`Query ${queryId.substring(0, 8)}:`);
      for (const run of runs) {
        console.log(`  Run ${run.runId.substring(0, 8)}: ${run.results.length} results, collected at ${run.collectedAt.toISOString()}`);
      }
    }
    
    // Check voice AI specifically
    const voiceAIQueries = [
      '44444444-4444-4444-4444-444444444444',
      '55555555-5555-5555-5555-555555555555',
      '66666666-6666-6666-6666-666666666666'
    ];
    
    console.log('\nVoice AI Queries:');
    voiceAIQueries.forEach(qid => {
      const runs = grouped.get(qid);
      if (runs) {
        console.log(`  ✅ ${qid.substring(0, 8)}: ${runs.length} runs`);
        runs.forEach(run => {
          console.log(`      Run ${run.runId.substring(0, 8)}: ${run.results.length} results`);
        });
      } else {
        console.log(`  ❌ ${qid.substring(0, 8)}: NOT FOUND in grouped data`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
  } finally {
    await storage.close();
  }
}

test().catch(console.error);

