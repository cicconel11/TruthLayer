import { createStorageClient } from './apps/storage/dist/index.js';

async function check() {
  const storage = createStorageClient({ url: 'duckdb://data/truthlayer.duckdb' });
  
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    const annotatedResults = await storage.fetchAnnotatedResults({ since });
    
    console.log('Checking annotated result schemas...\n');
    
    // Get one old query result and one voice AI result
    const oldResult = annotatedResults.find(r => r.queryId.startsWith('11111'));
    const voiceAIResult = annotatedResults.find(r => r.queryId.startsWith('44444'));
    
    console.log('OLD QUERY RESULT (works):');
    console.log(JSON.stringify(oldResult, null, 2));
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    console.log('VOICE AI RESULT (doesn\'t work):');
    console.log(JSON.stringify(voiceAIResult, null, 2));
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Compare keys
    const oldKeys = Object.keys(oldResult).sort();
    const voiceKeys = Object.keys(voiceAIResult).sort();
    
    console.log('Field comparison:');
    console.log('  Old result fields:', oldKeys.join(', '));
    console.log('  Voice AI fields:', voiceKeys.join(', '));
    
    const missingInVoiceAI = oldKeys.filter(k => !voiceKeys.includes(k));
    const extraInVoiceAI = voiceKeys.filter(k => !oldKeys.includes(k));
    
    if (missingInVoiceAI.length) {
      console.log('\n  ❌ Missing in voice AI:', missingInVoiceAI.join(', '));
    }
    if (extraInVoiceAI.length) {
      console.log('\n  ℹ️  Extra in voice AI:', extraInVoiceAI.join(', '));
    }
    if (!missingInVoiceAI.length && !extraInVoiceAI.length) {
      console.log('\n  ✅ Fields match!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
  } finally {
    await storage.close();
  }
}

check().catch(console.error);

