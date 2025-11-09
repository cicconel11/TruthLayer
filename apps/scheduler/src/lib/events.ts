/**
 * Pipeline event emission helpers
 * 
 * Use these functions to broadcast pipeline state changes to the SSE endpoint
 * for realtime dashboard updates.
 */

import { emitPipelineEvent } from "@truthlayer/events";

export function notifyRunStarted(runId: string) {
  emitPipelineEvent({
    type: "run:started",
    runId
  });
}

export function notifyStageCompleted(runId: string, stage: "collection" | "annotation" | "metrics") {
  emitPipelineEvent({
    type: "stage:completed",
    runId,
    stage
  });
}

export function notifyMetricsUpdated(runId: string) {
  emitPipelineEvent({
    type: "metrics:updated",
    runId
  });
}

export function notifyRunFinished(runId: string, ok: boolean) {
  emitPipelineEvent({
    type: "run:finished",
    runId,
    ok
  });
}
