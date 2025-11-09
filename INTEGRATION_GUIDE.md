# Pipeline Event Integration Guide

## Quick Start

Your TruthLayer installation now has a **realtime event bus** that broadcasts pipeline state to the dashboard via Server-Sent Events (SSE).

## How to Use in Your Pipeline

### 1. Import the Event Helpers

```typescript
import {
  notifyRunStarted,
  notifyStageCompleted,
  notifyMetricsUpdated,
  notifyRunFinished
} from "./lib/events";
```

### 2. Emit Events at Key Points

**Example: Scheduler/Pipeline Runner**

```typescript
async function runPipeline() {
  const runId = crypto.randomUUID();
  
  try {
    // Notify dashboard that run started
    notifyRunStarted(runId);
    
    // Run collection
    await runCollector(runId);
    notifyStageCompleted(runId, "collection");
    
    // Run annotation
    await runAnnotator(runId);
    notifyStageCompleted(runId, "annotation");
    
    // Compute metrics
    await computeMetrics(runId);
    notifyStageCompleted(runId, "metrics");
    notifyMetricsUpdated(runId);
    
    // Mark run as successful
    notifyRunFinished(runId, true);
    
  } catch (error) {
    logger.error("Pipeline failed", { runId, error });
    notifyRunFinished(runId, false);
    throw error;
  }
}
```

### 3. Test the Integration

**Terminal 1: Start the system**
```bash
pnpm run start:dev
```

**Terminal 2: Monitor SSE events**
```bash
curl -N http://localhost:3000/api/metrics/stream
```

You should see events like:
```json
data: {"type":"run:started","runId":"abc-123","timestamp":"2025-11-09T..."}
data: {"type":"stage:completed","runId":"abc-123","stage":"collection","timestamp":"..."}
data: {"type":"metrics:updated","runId":"abc-123","timestamp":"..."}
data: {"type":"run:finished","runId":"abc-123","ok":true,"timestamp":"..."}
data: {"type":"heartbeat","timestamp":"..."}
```

## Event Types

| Event Type | When to Emit | Required Fields |
|------------|-------------|-----------------|
| `run:started` | Pipeline run begins | `runId` |
| `stage:completed` | After collection/annotation/metrics | `runId`, `stage` |
| `metrics:updated` | After metrics computation | `runId` |
| `run:finished` | Pipeline run ends | `runId`, `ok` |

## Integration Points

### Option A: Modify Existing Scheduler

**File:** `apps/scheduler/src/index.ts` or `apps/scheduler/src/lib/orchestrator.ts`

Add event emissions around your existing pipeline logic:

```typescript
import { notifyRunStarted, notifyStageCompleted, notifyRunFinished } from "./lib/events";

// At the start of your pipeline
const runId = generateRunId();
notifyRunStarted(runId);

// After each stage completes
await yourCollectionFunction();
notifyStageCompleted(runId, "collection");

// At the end
notifyRunFinished(runId, true);
```

### Option B: Create a Wrapper

**File:** `apps/scheduler/src/lib/pipeline-runner.ts`

```typescript
import { notifyRunStarted, notifyStageCompleted, notifyRunFinished } from "./events";

export async function runPipelineWithEvents(
  runId: string,
  stages: {
    collection: () => Promise<void>,
    annotation: () => Promise<void>,
    metrics: () => Promise<void>
  }
) {
  notifyRunStarted(runId);
  
  try {
    await stages.collection();
    notifyStageCompleted(runId, "collection");
    
    await stages.annotation();
    notifyStageCompleted(runId, "annotation");
    
    await stages.metrics();
    notifyStageCompleted(runId, "metrics");
    
    notifyRunFinished(runId, true);
  } catch (error) {
    notifyRunFinished(runId, false);
    throw error;
  }
}
```

Then use it:

```typescript
await runPipelineWithEvents(runId, {
  collection: () => runCollector(runId),
  annotation: () => runAnnotator(runId),
  metrics: () => computeMetrics(runId)
});
```

## Dashboard Integration

The dashboard **automatically subscribes** to these events via the `RealtimeProvider`:

```typescript
// In any dashboard component:
import { useRealtimeMetrics } from "../components/RealtimeProvider";

function DashboardComponent() {
  const { connected, lastEvent, subscribe } = useRealtimeMetrics();
  
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === "run:finished") {
        // Refresh metrics display
        refetchMetrics();
      }
      
      if (event.type === "stage:completed") {
        // Update progress indicator
        setProgress(event.stage);
      }
    });
    
    return unsubscribe;
  }, []);
  
  return (
    <div>
      <StatusIndicator connected={connected} />
      <LastUpdate time={lastEvent?.timestamp} />
    </div>
  );
}
```

## Troubleshooting

### Events Not Appearing

1. **Check SSE endpoint is running:**
   ```bash
   curl http://localhost:3000/api/metrics/stream
   ```

2. **Check event bus is imported:**
   ```bash
   # Should see this in dashboard logs:
   ✅ SSE endpoint connected to pipeline event bus
   ```

3. **Verify events are emitted:**
   ```typescript
   // Add logging in your pipeline:
   console.log("Emitting run:started", runId);
   notifyRunStarted(runId);
   ```

### SSE Connection Drops

- **Cause:** Reverse proxy timeout (Nginx, Cloudflare)
- **Fix:** Increase proxy timeout to 60s+ or enable heartbeat

### Multiple Dashboard Instances

The event bus broadcasts to **all connected clients**. If you have multiple dashboard instances (dev server + browser tabs), all will receive events.

## Performance Notes

- **In-memory bus:** Events are **not persisted**
- **No replay:** New clients only receive events emitted **after** connection
- **Buffer size:** Last 100 events kept for late-joining clients
- **Overhead:** Negligible (~1-2ms per emit)

## Future Enhancements

- [ ] Redis-backed event bus for multi-instance deployments
- [ ] Event persistence for audit trail
- [ ] GraphQL subscriptions as alternative to SSE
- [ ] Replay buffer with configurable size

---

**See Also:**
- [OBSERVABILITY.md](./docs/OBSERVABILITY.md) - Logging and monitoring
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Production deployment
- `packages/events/src/bus.ts` - Event bus implementation
