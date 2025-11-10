import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as EventSourceModule from "eventsource";
import { startDashboard, stopDashboard, waitForDashboardReady } from "../utils/runtime";

// Handle both default and named exports from eventsource package
const EventSourceConstructor = (EventSourceModule as any).default || (EventSourceModule as any);

describe("SSE Reconnection Behavior", () => {
  beforeAll(async () => {
    await startDashboard();
    const ready = await waitForDashboardReady();
    if (!ready) {
      throw new Error("Dashboard failed to start");
    }
  }, 30000);

  afterAll(async () => {
    await stopDashboard();
  });

  it("should connect to SSE endpoint", async () => {
    const es = new EventSourceConstructor("http://localhost:3000/api/metrics/stream");
    
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        es.close();
        reject(new Error("Connection timeout"));
      }, 5000);

      es.onopen = () => {
        clearTimeout(timeout);
        es.close();
        resolve();
      };

      es.onerror = (err: any) => {
        clearTimeout(timeout);
        es.close();
        reject(err);
      };
    });
  });

  it("should receive heartbeat events", async () => {
    const es = new EventSourceConstructor("http://localhost:3000/api/metrics/stream");
    
    const events: any[] = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        es.close();
        resolve();
      }, 25000); // Wait for at least one heartbeat (20s interval)

      es.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          events.push(data);
          
          // If we got a heartbeat, we can resolve early
          if (data.type === "heartbeat") {
            clearTimeout(timeout);
            es.close();
            resolve();
          }
        } catch (err) {
          clearTimeout(timeout);
          es.close();
          reject(err);
        }
      };

      es.onerror = (err: any) => {
        clearTimeout(timeout);
        es.close();
        reject(err);
      };
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.type === "heartbeat")).toBe(true);
  }, 30000);

  it("should reconnect after connection drop", async () => {
    let connectionCount = 0;
    
    // First connection
    const es1 = new EventSourceConstructor("http://localhost:3000/api/metrics/stream");
    
    await new Promise<void>((resolve) => {
      es1.onopen = () => {
        connectionCount++;
        es1.close();
        resolve();
      };
    });

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second connection (simulating reconnect)
    const es2 = new EventSourceConstructor("http://localhost:3000/api/metrics/stream");
    
    await new Promise<void>((resolve) => {
      es2.onopen = () => {
        connectionCount++;
        es2.close();
        resolve();
      };
    });

    expect(connectionCount).toBe(2);
  });

  it("should maintain connection for extended period", async () => {
    const es = new EventSourceConstructor("http://localhost:3000/api/metrics/stream");
    const events: any[] = [];
    let errors = 0;

    await new Promise<void>((resolve) => {
      const duration = 10000; // 10 seconds
      const timeout = setTimeout(() => {
        es.close();
        resolve();
      }, duration);

      es.onmessage = (event: any) => {
        try {
          const data = JSON.parse(event.data);
          events.push(data);
        } catch (err) {
          errors++;
        }
      };

      es.onerror = () => {
        errors++;
      };
    });

    expect(errors).toBe(0);
    expect(events.length).toBeGreaterThan(0);
  }, 15000);

  it("should handle concurrent connections", async () => {
    const connectionResults: boolean[] = [];

    // Create 5 concurrent connections
    const promises = Array.from({ length: 5 }, async () => {
      const es = new EventSourceConstructor("http://localhost:3000/api/metrics/stream");

      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          es.close();
          resolve(false);
        }, 5000);

        es.onopen = () => {
          clearTimeout(timeout);
          es.close();
          resolve(true);
        };

        es.onerror = () => {
          clearTimeout(timeout);
          es.close();
          resolve(false);
        };
      });
    });

    const results = await Promise.all(promises);
    
    // All connections should succeed
    expect(results.every(r => r === true)).toBe(true);
  });
});
