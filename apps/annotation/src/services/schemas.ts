import { z } from "zod";
import { DomainTypeEnum, FactualConsistencyEnum } from "@truthlayer/schema";

export const LLMAnnotationOutputSchema = z.object({
  domain_type: DomainTypeEnum,
  factual_consistency: FactualConsistencyEnum,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional()
});

export type LLMAnnotationOutput = z.infer<typeof LLMAnnotationOutputSchema>;

export const StanceEnum = z.enum([
  "supporting",
  "opposing",
  "neutral",
  "not_applicable"
]);

export type Stance = z.infer<typeof StanceEnum>;

export const AnnotationBatchResultSchema = z.object({
  successful: z.number().int().min(0),
  failed: z.number().int().min(0),
  totalProcessed: z.number().int().min(0),
  successRate: z.number().min(0).max(100),
  errors: z.array(z.object({
    queryId: z.string(),
    url: z.string(),
    error: z.string()
  }))
});

export type AnnotationBatchResult = z.infer<typeof AnnotationBatchResultSchema>;
