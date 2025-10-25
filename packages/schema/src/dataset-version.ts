import { z } from "zod";

export const DatasetFormatEnum = z.enum(["parquet", "csv", "json"]);
export const DatasetTypeEnum = z.enum([
  "search_results",
  "annotated_results",
  "metrics"
]);

export const DatasetVersionSchema = z.object({
  id: z.string().uuid("dataset_version_id must be a UUID"),
  datasetType: DatasetTypeEnum,
  format: DatasetFormatEnum,
  path: z.string().min(1),
  runId: z.string().uuid("run_id must be a UUID").nullable(),
  recordCount: z.number().int().min(0),
  metadata: z.record(z.any()),
  createdAt: z.coerce.date()
});

export type DatasetVersion = z.infer<typeof DatasetVersionSchema>;

