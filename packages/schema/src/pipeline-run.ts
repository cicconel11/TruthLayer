import { z } from "zod";

export const PipelineStageEnum = z.enum([
  "collector",
  "annotation",
  "metrics"
]);

export const PipelineRunStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "failed"
]);

export const PipelineRunSchema = z.object({
  id: z.string().uuid("pipeline_run_id must be a UUID"),
  status: PipelineRunStatusEnum,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  metadata: z.record(z.any())
});

export const PipelineStageLogSchema = z.object({
  id: z.string().uuid("pipeline_stage_log_id must be a UUID"),
  runId: z.string().uuid("pipeline_run_id must be a UUID"),
  stage: PipelineStageEnum,
  status: PipelineRunStatusEnum,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  attempts: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  metadata: z.record(z.any())
});

export type PipelineRun = z.infer<typeof PipelineRunSchema>;
export type PipelineStageLog = z.infer<typeof PipelineStageLogSchema>;

