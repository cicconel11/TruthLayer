import { EventEmitter } from "node:events";

export type PipelineEvent =
  | { type: "run:started"; runId: string; timestamp: string }
  | { type: "stage:completed"; runId: string; stage: string; timestamp: string }
  | { type: "metrics:updated"; runId: string; timestamp: string }
  | { type: "run:finished"; runId: string; ok: boolean; timestamp: string }
  | { type: "heartbeat"; timestamp: string };

class Bus extends EventEmitter {}

export const bus = new Bus();

// Helper to emit with automatic timestamp
export function emitPipelineEvent(event: Omit<PipelineEvent, "timestamp">) {
  bus.emit(event.type, {
    ...event,
    timestamp: new Date().toISOString()
  });
}
