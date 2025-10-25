import { promises as fs } from "node:fs";
import path from "node:path";
import duckdb from "duckdb";
import { MetricComputation } from "./computations";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function run(conn: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function closeConnection(conn: duckdb.Connection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.close((err?: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function closeDatabase(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err?: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function convertCsvToParquet(csvPath: string, parquetPath: string) {
  const db = new duckdb.Database(":memory:");
  const conn = db.connect();
  try {
    await run(conn, `CREATE OR REPLACE TABLE metrics_export AS SELECT * FROM read_csv_auto('${csvPath}', HEADER=TRUE)`);
    await run(conn, `COPY metrics_export TO '${parquetPath}' (FORMAT 'parquet')`);
  } finally {
    await closeConnection(conn);
    await closeDatabase(db);
  }
}

export interface ExportResult {
  csvPath: string;
  parquetPath: string;
  jsonPath: string;
}

export async function exportMetricSeries(
  metrics: MetricComputation[],
  exportDir: string,
  runId: string
): Promise<ExportResult> {
  await fs.mkdir(exportDir, { recursive: true });

  const headers = [
    "run_id",
    "query_id",
    "metric_type",
    "value",
    "delta",
    "compared_to_run_id",
    "collected_at",
    "window_start",
    "window_end",
    "engine",
    "extra"
  ];

  const rows = metrics.map((metric) => [
    metric.runId,
    metric.queryId,
    metric.metricType,
    metric.value,
    metric.delta ?? "",
    metric.comparedToRunId ?? "",
    metric.collectedAt.toISOString(),
    metric.windowStart.toISOString(),
    metric.windowEnd.toISOString(),
    metric.engine ?? "",
    JSON.stringify(metric.extra ?? {})
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");

  const csvPath = path.join(exportDir, `${runId}-metrics.csv`);
  await fs.writeFile(csvPath, csvContent, "utf-8");

  const jsonPath = path.join(exportDir, `${runId}-metrics.json`);
  await fs.writeFile(jsonPath, JSON.stringify(metrics, null, 2), "utf-8");

  const parquetPath = path.join(exportDir, `${runId}-metrics.parquet`);
  await convertCsvToParquet(csvPath, parquetPath);

  return { csvPath, parquetPath, jsonPath };
}

