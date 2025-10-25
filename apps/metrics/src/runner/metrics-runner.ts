import { subDays } from "date-fns";
import { createStorageClient, StorageClient } from "@truthlayer/storage";
import { MetricsConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { computeMetricSeries, toMetricRecordInputs } from "../lib/computations";
import { exportMetricSeries } from "../lib/exporter";

interface MetricsRunner {
  id: string;
  execute: () => Promise<void>;
}

interface CreateMetricsRunnerOptions {
  config: MetricsConfig;
  logger: Logger;
  storage?: StorageClient;
}

export function createMetricsRunner({ config, logger, storage }: CreateMetricsRunnerOptions): MetricsRunner {
  const id = config.runId;

  return {
    id,
    async execute() {
      const storageClient = storage ?? createStorageClient({ url: config.storageUrl });

      const since = subDays(new Date(), Math.max(1, config.windowSize));

      try {
        const annotatedResults = await storageClient.fetchAnnotatedResults({ since });

        if (!annotatedResults.length) {
          logger.warn("no annotated results available for metrics computation", {
            since: since.toISOString()
          });
          return;
        }

        const metricSeries = computeMetricSeries(annotatedResults, config.windowSize);

        if (!metricSeries.length) {
          logger.warn("no metrics generated from annotated results", {
            resultCount: annotatedResults.length
          });
          return;
        }

        const createdAt = new Date();
        const metricRecords = toMetricRecordInputs(metricSeries, createdAt);
        await storageClient.insertMetricRecords(metricRecords);

        const exportResult = await exportMetricSeries(metricSeries, config.exportDir, id);

        logger.info("metrics computation complete", {
          metricsCount: metricSeries.length,
          csvPath: exportResult.csvPath,
          parquetPath: exportResult.parquetPath
        });
      } finally {
        if (!storage) {
          await storageClient.close();
        }
      }
    }
  };
}
