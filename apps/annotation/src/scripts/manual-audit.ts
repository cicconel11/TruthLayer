import { promises as fs } from "node:fs";
import path from "node:path";
import { createStorageClient, StorageClient } from "@truthlayer/storage";
import { AnnotatedResultView } from "@truthlayer/schema";
import { makeAnnotationConfig } from "../lib/config";

interface CliOptions {
  runId?: string;
  percent?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === "-r" || arg === "--run") && argv[i + 1]) {
      options.runId = argv[i + 1];
      i += 1;
    } else if ((arg === "-p" || arg === "--percent") && argv[i + 1]) {
      options.percent = Number.parseInt(argv[i + 1], 10);
      i += 1;
    }
  }

  return options;
}

function pickLatestRunId(records: { runId: string; collectedAt: Date }[]): string | undefined {
  if (!records.length) return undefined;
  return records
    .slice()
    .sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime())[0].runId;
}

function sampleResults(results: AnnotatedResultView[], sampleSize: number): AnnotatedResultView[] {
  if (sampleSize >= results.length) return results;
  const copy = results.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, sampleSize);
}

async function ensureAuditDir(): Promise<string> {
  const dir = path.resolve("data/audit");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function runAudit(options: CliOptions) {
  const config = makeAnnotationConfig();
  const storage: StorageClient = createStorageClient();

  try {
    const aggregates = await storage.fetchAnnotationAggregates({});
    const targetRunId = options.runId ?? pickLatestRunId(
      aggregates.map((record) => ({ runId: record.runId, collectedAt: record.collectedAt }))
    );

    if (!targetRunId) {
      throw new Error("No annotation runs found to audit");
    }

    const annotatedResults = await storage.fetchAnnotatedResults({ runIds: [targetRunId] });
    if (!annotatedResults.length) {
      throw new Error(`No annotated results found for run ${targetRunId}`);
    }

    const samplePercent = options.percent ?? config.auditSampleSize;
    const sampleSize = Math.max(1, Math.ceil((annotatedResults.length * samplePercent) / 100));
    const sample = sampleResults(annotatedResults, sampleSize);

    const auditDir = await ensureAuditDir();
    const filePath = path.join(auditDir, `${targetRunId}-sample.json`);

    await fs.writeFile(
      filePath,
      JSON.stringify(
        sample.map((item) => ({
          runId: item.runId,
          queryId: item.queryId,
          engine: item.engine,
          domain: item.domain,
          url: item.normalizedUrl,
          factualConsistency: item.factualConsistency,
          domainType: item.domainType,
          collectedAt: item.collectedAt,
          annotationId: item.annotationId
        })),
        null,
        2
      ),
      "utf-8"
    );

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          runId: targetRunId,
          total: annotatedResults.length,
          sampled: sample.length,
          percent: samplePercent,
          filePath
        },
        null,
        2
      )
    );
  } finally {
    await storage.close();
  }
}

runAudit(parseArgs(process.argv.slice(2))).catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Manual audit failed", error);
  process.exitCode = 1;
});
