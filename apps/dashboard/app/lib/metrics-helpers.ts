import type { AnnotationAggregate } from "../types";

export type MetricType = "domain_diversity" | "engine_overlap" | "factual_alignment";

export function average(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

export function formatValue(value: number | null, metric: MetricType): string {
  if (value === null || Number.isNaN(value)) return "–";
  const percentageMetrics: MetricType[] = ["engine_overlap", "factual_alignment"];
  if (percentageMetrics.includes(metric)) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(1);
}

export function extractPerEngineValue(extra: Record<string, unknown> | null | undefined, engine: string): number | null {
  if (!extra || typeof extra !== "object") return null;
  const perEngine = (extra as Record<string, unknown>).perEngine;
  if (!perEngine || typeof perEngine !== "object") return null;
  const value = (perEngine as Record<string, unknown>)[engine];
  return typeof value === "number" ? value : null;
}

export function extractPairwiseOverlap(extra: Record<string, unknown> | null | undefined, engine: string): number | null {
  if (!extra || typeof extra !== "object") return null;
  const pairwise = (extra as Record<string, unknown>).pairwise;
  if (!pairwise || typeof pairwise !== "object") return null;
  const entries = Object.entries(pairwise as Record<string, unknown>).filter(([key]) => key.includes(engine));
  const numeric = entries
    .map(([, value]) => (typeof value === "number" ? value : Number.parseFloat(String(value))))
    .filter((value) => Number.isFinite(value));
  return average(numeric as number[]) ?? null;
}

export function buildAggregateMap(aggregates: AnnotationAggregate[]) {
  const map = new Map<string, { aligned: number; contradicted: number; unclear: number; total: number }>();

  for (const aggregate of aggregates) {
    const key = `${aggregate.runId}|${aggregate.queryId}|${aggregate.engine ?? "all"}`;
    const existing = map.get(key) ?? { aligned: 0, contradicted: 0, unclear: 0, total: 0 };

    if (aggregate.factualConsistency === "aligned") {
      existing.aligned += aggregate.count;
    } else if (aggregate.factualConsistency === "contradicted") {
      existing.contradicted += aggregate.count;
    } else if (aggregate.factualConsistency === "unclear") {
      existing.unclear += aggregate.count;
    }
    existing.total += aggregate.count;
    map.set(key, existing);
  }

  return map;
}

export function computeFactualAlignmentFromAggregates(
  aggregateMap: ReturnType<typeof buildAggregateMap>,
  runId: string | null,
  queryId: string,
  engine: string
): number | null {
  if (!runId) return null;
  const record = aggregateMap.get(`${runId}|${queryId}|${engine}`);
  if (!record || record.total === 0) return null;
  const score = (record.aligned + 0.5 * record.unclear) / record.total;
  return Number.isFinite(score) ? score : null;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\"")) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return lines.join("\n");
}

