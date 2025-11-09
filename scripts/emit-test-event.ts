#!/usr/bin/env ts-node
/**
 * Emit a test pipeline event to verify SSE broadcasting
 * 
 * Usage:
 *   ts-node scripts/emit-test-event.ts
 *   ts-node scripts/emit-test-event.ts run:started test-run-123
 */

import { emitPipelineEvent } from "@truthlayer/events";
import crypto from "node:crypto";

const eventType = (process.argv[2] || "run:started") as any;
const runId = process.argv[3] || `test-${crypto.randomUUID().slice(0, 8)}`;

console.log(`📤 Emitting test event: ${eventType}`);
console.log(`   runId: ${runId}`);

switch (eventType) {
  case "run:started":
    emitPipelineEvent({ type: "run:started", runId });
    break;
    
  case "stage:completed":
    const stage = process.argv[4] || "collection";
    emitPipelineEvent({ type: "stage:completed", runId, stage });
    console.log(`   stage: ${stage}`);
    break;
    
  case "metrics:updated":
    emitPipelineEvent({ type: "metrics:updated", runId });
    break;
    
  case "run:finished":
    const ok = process.argv[4] !== "false";
    emitPipelineEvent({ type: "run:finished", runId, ok });
    console.log(`   ok: ${ok}`);
    break;
    
  default:
    console.error(`❌ Unknown event type: ${eventType}`);
    console.log("Valid types: run:started, stage:completed, metrics:updated, run:finished");
    process.exit(1);
}

console.log("✅ Event emitted");
console.log("💡 Run 'npm run test:sse' in another terminal to see events");
