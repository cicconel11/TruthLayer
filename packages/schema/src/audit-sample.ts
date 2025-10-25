import { z } from "zod";

export const AuditSampleSchema = z.object({
  id: z.string().uuid("audit_sample_id must be a UUID"),
  runId: z.string().uuid("run_id must be a UUID"),
  annotationId: z.string().uuid("annotation_id must be a UUID"),
  queryId: z.string().uuid("query_id must be a UUID"),
  engine: z.string().min(1),
  reviewer: z.string().nullable(),
  status: z.enum(["pending", "approved", "flagged"]).default("pending"),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type AuditSample = z.infer<typeof AuditSampleSchema>;

