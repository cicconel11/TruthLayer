import { NextRequest } from "next/server";

interface MetricsUpdateEvent {
  type: "metricsUpdated" | "runStatus" | "heartbeat" | "run:started" | "stage:completed" | "metrics:updated" | "run:finished";
  data?: unknown;
  timestamp: string;
  runId?: string;
  stage?: string;
  ok?: boolean;
}

let clients: Set<ReadableStreamDefaultController> = new Set();
let eventBuffer: MetricsUpdateEvent[] = [];
const MAX_BUFFER_SIZE = 100;

function broadcastEvent(event: MetricsUpdateEvent) {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer = eventBuffer.slice(-MAX_BUFFER_SIZE);
  }
  
  const message = `data: ${JSON.stringify(event)}\n\n`;
  
  clients.forEach((controller) => {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      clients.delete(controller);
    }
  });
}

// Wire up pipeline event bus if in Node.js context
if (typeof process !== "undefined" && process.versions?.node) {
  try {
    // Dynamic import to avoid bundler issues
    import("@truthlayer/events").then(({ bus }) => {
      bus.on("run:started", (event: MetricsUpdateEvent) => broadcastEvent(event));
      bus.on("stage:completed", (event: MetricsUpdateEvent) => broadcastEvent(event));
      bus.on("metrics:updated", (event: MetricsUpdateEvent) => broadcastEvent(event));
      bus.on("run:finished", (event: MetricsUpdateEvent) => broadcastEvent(event));
      
      console.log("✅ SSE endpoint connected to pipeline event bus");
    }).catch((err) => {
      console.warn("⚠️  Event bus not available:", err.message);
    });
  } catch (err) {
    console.warn("⚠️  Event bus initialization failed");
  }
}

setInterval(() => {
  broadcastEvent({
    type: "heartbeat",
    timestamp: new Date().toISOString()
  });
}, 20000);

export async function GET(request: NextRequest) {
  let streamController: ReadableStreamDefaultController | null = null;
  
  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;
      clients.add(controller);
      
      controller.enqueue(
        new TextEncoder().encode(
          `data: ${JSON.stringify({
            type: "connected",
            timestamp: new Date().toISOString()
          })}\n\n`
        )
      );
      
      if (eventBuffer.length > 0) {
        const recentEvents = eventBuffer.slice(-10);
        recentEvents.forEach((event) => {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify(event)}\n\n`
            )
          );
        });
      }
    },
    cancel() {
      if (streamController) {
        clients.delete(streamController);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const event = await request.json() as MetricsUpdateEvent;
    
    if (!event.type || !event.timestamp) {
      return new Response(
        JSON.stringify({ error: "Invalid event format" }),
        { status: 400 }
      );
    }
    
    broadcastEvent(event);
    
    return new Response(
      JSON.stringify({ success: true, clients: clients.size }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to process event" }),
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
