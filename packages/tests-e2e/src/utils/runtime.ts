import { spawn, ChildProcess } from "node:child_process";
import * as EventSourceModule from "eventsource";

// Handle both default and named exports from eventsource package
const EventSourceConstructor = (EventSourceModule as any).default || (EventSourceModule as any);

let dashboardProc: ChildProcess | null = null;
let pipelineProc: ChildProcess | null = null;

export async function startDashboard(): Promise<void> {
  if (dashboardProc) {
    console.warn("Dashboard already running");
    return;
  }

  return new Promise((resolve, reject) => {
    dashboardProc = spawn("pnpm", ["-C", "apps/dashboard", "run", "dev"], {
      stdio: "ignore",
      detached: false
    });

    dashboardProc.on("error", (err) => {
      console.error("Failed to start dashboard:", err);
      reject(err);
    });

    // Wait for dashboard to be ready
    setTimeout(() => {
      resolve();
    }, 3000);
  });
}

export async function stopDashboard(): Promise<void> {
  if (dashboardProc) {
    dashboardProc.kill("SIGTERM");
    dashboardProc = null;
    // Allow time for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export async function startPipeline(env?: Record<string, string>): Promise<void> {
  if (pipelineProc) {
    console.warn("Pipeline already running");
    return;
  }

  return new Promise((resolve, reject) => {
    pipelineProc = spawn("pnpm", ["-C", "apps/scheduler", "run", "dev"], {
      stdio: "ignore",
      detached: false,
      env: { ...process.env, ...env }
    });

    pipelineProc.on("error", (err) => {
      console.error("Failed to start pipeline:", err);
      reject(err);
    });

    setTimeout(() => {
      resolve();
    }, 2000);
  });
}

export async function stopPipeline(): Promise<void> {
  if (pipelineProc) {
    pipelineProc.kill("SIGTERM");
    pipelineProc = null;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export function sseClient(path: string): any {
  const url = `http://localhost:3000${path}`;
  return new EventSourceConstructor(url);
}

export async function waitForDashboardReady(maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch("http://localhost:3000/api/metrics");
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Dashboard not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

export async function healthCheck(url: string, maxAttempts = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Not ready
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

export async function cleanupAll(): Promise<void> {
  await Promise.all([
    stopDashboard(),
    stopPipeline()
  ]);
}
