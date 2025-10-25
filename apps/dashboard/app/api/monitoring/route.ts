import { NextResponse } from "next/server";
import { createStorageClient } from "@truthlayer/storage";

function computeAccuracy(records: { factualConsistency: string; count: number }[]) {
  const totals: Record<string, number> = {};
  for (const record of records) {
    totals[record.factualConsistency] = (totals[record.factualConsistency] ?? 0) + record.count;
  }
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const aligned = totals.aligned ?? 0;
  const contradicted = totals.contradicted ?? 0;
  const unclear = totals.unclear ?? 0;
  const accuracy = total ? aligned / total : 0;
  return {
    total,
    aligned,
    contradicted,
    unclear,
    accuracy
  };
}

export async function GET() {
  const storage = createStorageClient();
  try {
    const pipelineRuns = await storage.fetchPipelineRuns({ limit: 20 });
    const runsWithStages = await Promise.all(
      pipelineRuns.map(async (run) => {
        const stages = await storage.fetchPipelineStages(run.id);
        return {
          ...run,
          stages
        };
      })
    );

    const aggregates = await storage.fetchAnnotationAggregates({});
    const byRun: Record<string, { factualConsistency: string; count: number }[]> = {};
    for (const aggregate of aggregates) {
      const key = aggregate.runId;
      byRun[key] = byRun[key] ?? [];
      byRun[key].push({
        factualConsistency: aggregate.factualConsistency,
        count: aggregate.count
      });
    }

    const accuracyByRun = Object.fromEntries(
      Object.entries(byRun).map(([runId, records]) => [runId, computeAccuracy(records)])
    );

    return NextResponse.json(
      {
        runs: runsWithStages,
        accuracyByRun,
        generatedAt: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("monitoring api error", error);
    return NextResponse.json({ error: "Failed to load monitoring data" }, { status: 500 });
  } finally {
    await storage.close();
  }
}

