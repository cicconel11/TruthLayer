import { spawn } from "node:child_process";

export interface PipelineRunOptions {
  env?: Record<string, string>;
  timeout?: number;
}

export interface PipelineRunResult {
  code: number;
  stdout?: string;
  stderr?: string;
  duration: number;
}

export async function runPipelineCLI(options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
  const { env = {}, timeout = 60000 } = options;
  
  return new Promise<PipelineRunResult>((resolve, reject) => {
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";

    const proc = spawn(
      "pnpm",
      ["-C", "apps/scheduler", "run", "dev"],
      {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    if (proc.stdout) {
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });
    }

    if (proc.stderr) {
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    }

    const timeoutId = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Pipeline execution timed out after ${timeout}ms`));
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        duration
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

export async function triggerPipelineRun(options: PipelineRunOptions = {}): Promise<PipelineRunResult> {
  // This would trigger a single pipeline run
  return runPipelineCLI(options);
}

export async function monitorPipelineProgress(runId: string): Promise<string[]> {
  // Mock implementation - would connect to SSE and collect events
  const events: string[] = [];
  
  // In real implementation, would subscribe to SSE
  // and collect events for this runId
  
  return events;
}

export function parsePipelineOutput(output: string): {
  success: boolean;
  errors: string[];
  warnings: string[];
  metrics: Record<string, unknown>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, unknown> = {};

  const lines = output.split("\n");
  
  for (const line of lines) {
    if (line.includes("ERROR") || line.includes("error")) {
      errors.push(line.trim());
    }
    if (line.includes("WARN") || line.includes("warning")) {
      warnings.push(line.trim());
    }
    // Parse metrics from output
    const metricMatch = line.match(/metric:(\w+)=(\d+\.?\d*)/);
    if (metricMatch) {
      metrics[metricMatch[1]] = parseFloat(metricMatch[2]);
    }
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
    metrics
  };
}
