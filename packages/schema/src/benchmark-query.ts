import { z } from "zod";

export const BenchmarkQuerySchema = z.object({
  id: z.string().uuid("benchmark query id must be a UUID"),
  query: z.string().min(1, "query text is required"),
  topic: z.string().min(1, "topic is required"),
  tags: z.array(z.string()).default([])
});

export const BenchmarkQuerySetSchema = z.array(BenchmarkQuerySchema);

export type BenchmarkQuery = z.infer<typeof BenchmarkQuerySchema>;

