import { z } from "zod";
import { DomainTypeEnum, FactualConsistencyEnum } from "./annotation";

/**
 * Query Insight API Types
 * 
 * These types define the contract between the Query Comparison API endpoint
 * and the frontend dashboard. They enable users to compare how different
 * search engines answered a tracked query in a specific crawl run.
 */

// Individual search result with annotation data
export interface QueryInsightEngineResult {
  rank: number;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  domainType: "news" | "government" | "academic" | "blog" | "other";
  factualScore: "aligned" | "contradicted" | "unclear" | "not_applicable" | null;
  confidence: number | null;
}

// Metrics for the query comparison
export interface QueryInsightMetrics {
  aggregate: {
    overlap: number;           // engine overlap percentage (0-1)
    domainDiversity: number;   // unique domains count
    factualAlignment: number;  // avg factual score (0-1)
  };
  perEngine: Record<string, {
    domainDiversity?: number;
    factualAlignment?: number;
  }>;
}

// Complete API response
export interface QueryInsightResponse {
  query: string;
  queryId: string;
  runId: string;
  timestamp: string;
  engines: Record<string, QueryInsightEngineResult[]>;
  metrics: QueryInsightMetrics;
  enginesPresent: string[];
}

// Zod schemas for runtime validation
export const QueryInsightEngineResultSchema = z.object({
  rank: z.number().int().min(1),
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  domain: z.string(),
  domainType: DomainTypeEnum,
  factualScore: FactualConsistencyEnum.nullable(),
  confidence: z.number().min(0).max(1).nullable()
});

export const QueryInsightMetricsSchema = z.object({
  aggregate: z.object({
    overlap: z.number().min(0).max(1),
    domainDiversity: z.number().int().min(0),
    factualAlignment: z.number().min(0).max(1)
  }),
  perEngine: z.record(z.object({
    domainDiversity: z.number().int().min(0).optional(),
    factualAlignment: z.number().min(0).max(1).optional()
  }))
});

export const QueryInsightResponseSchema = z.object({
  query: z.string(),
  queryId: z.string().uuid(),
  runId: z.string(),
  timestamp: z.string().datetime(),
  engines: z.record(z.array(QueryInsightEngineResultSchema)),
  metrics: QueryInsightMetricsSchema,
  enginesPresent: z.array(z.string())
});

