import { NextRequest, NextResponse } from "next/server";
import { emitPipelineEvent } from "@truthlayer/events";
import crypto from "node:crypto";

/**
 * Internal API endpoint for triggering test pipeline runs
 * 
 * This is a development/testing endpoint to simulate pipeline events
 * without running the actual pipeline.
 * 
 * WARNING: This should be disabled or protected in production.
 */

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint disabled in production" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { simulate = true, stages = ["collection", "annotation", "metrics"] } = body;

    const runId = `test-${crypto.randomUUID().slice(0, 8)}`;

    if (!simulate) {
      return NextResponse.json({
        message: "Actual pipeline trigger not implemented",
        runId
      });
    }

    // Simulate pipeline events
    emitPipelineEvent({
      type: "run:started",
      runId
    });

    // Wait and emit stage completions
    for (const stage of stages) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      emitPipelineEvent({
        type: "stage:completed",
        runId,
        stage
      });
    }

    // Wait and emit metrics updated
    await new Promise(resolve => setTimeout(resolve, 300));
    emitPipelineEvent({
      type: "metrics:updated",
      runId
    });

    // Wait and finish
    await new Promise(resolve => setTimeout(resolve, 200));
    emitPipelineEvent({
      type: "run:finished",
      runId,
      ok: true
    });

    return NextResponse.json({
      success: true,
      runId,
      message: `Simulated pipeline run ${runId} completed`,
      stages
    });

  } catch (error) {
    console.error("Failed to trigger run:", error);
    return NextResponse.json(
      { error: "Failed to trigger run", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Endpoint disabled in production" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    endpoint: "/api/internal/trigger-run",
    methods: ["POST"],
    description: "Trigger a simulated pipeline run for testing",
    example: {
      method: "POST",
      body: {
        simulate: true,
        stages: ["collection", "annotation", "metrics"]
      }
    }
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
