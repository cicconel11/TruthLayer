import { randomUUID } from "node:crypto";
import { DomainTypeEnum, FactualConsistencyEnum } from "@truthlayer/schema";
import type { AnnotationRecord } from "@truthlayer/schema";
import { AnnotationConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import { coerceDomainType, coerceFactualConsistency, inferDomainType } from "./heuristics";
import { createOpenAIAnnotator } from "./openai-client";
import { createClaudeBridgeAnnotator } from "./python-bridge";

export interface LLMAnnotationInput {
  title: string;
  snippet?: string | null;
  url: string;
  domain: string;
  engine: string;
  queryId: string;
}

type DomainType = AnnotationRecord["domainType"];
type FactualConsistency = AnnotationRecord["factualConsistency"];

export interface LLMAnnotationResult {
  domainType: DomainType;
  factualConsistency: FactualConsistency;
  confidence: number | null;
  reasoning?: string;
  provider: "openai" | "claude";
  modelId: string;
  raw: unknown;
}

export interface LLMClient {
  annotate: (input: LLMAnnotationInput) => Promise<LLMAnnotationResult>;
  provider: "openai" | "claude";
}

function resolveProvider(config: AnnotationConfig): "openai" | "claude" {
  if (config.provider === "auto") {
    if (config.openaiApiKey) return "openai";
    if (config.anthropicApiKey) return "claude";
    throw new Error("No API keys available for auto provider selection");
  }
  return config.provider;
}

export function createLLMClient({
  config,
  logger
}: {
  config: AnnotationConfig;
  logger: Logger;
}): LLMClient {
  const provider = resolveProvider(config);

  if (provider === "claude") {
    return createClaudeBridgeAnnotator({ config, logger });
  }

  return createOpenAIAnnotator({ config, logger });
}

export function normalizeAnnotationResult({
  candidate,
  fallbackDomain,
  fallbackFactual
}: {
  candidate: Partial<LLMAnnotationResult>;
  fallbackDomain: DomainType;
  fallbackFactual: FactualConsistency;
}): LLMAnnotationResult {
  const domainType = coerceDomainType(candidate.domainType, fallbackDomain);
  const factualConsistency = coerceFactualConsistency(candidate.factualConsistency, fallbackFactual);

  const clampedConfidence = candidate.confidence ?? null;
  const confidence =
    typeof clampedConfidence === "number" && clampedConfidence >= 0 && clampedConfidence <= 1
      ? clampedConfidence
      : null;

  return {
    domainType,
    factualConsistency,
    confidence,
    reasoning: candidate.reasoning,
    provider: candidate.provider ?? "openai",
    modelId: candidate.modelId ?? "unknown",
    raw: candidate.raw ?? {}
  };
}

export function buildPrompt(input: LLMAnnotationInput): string {
  return `Evaluate the following search result and classify both its source domain type and factual consistency. Respond ONLY with JSON matching this schema:
{
  "domain_type": "news | government | academic | blog | other",
  "factual_consistency": "aligned | contradicted | unclear | not_applicable",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation"
}

Search Result:
- Engine: ${input.engine}
- Query ID: ${input.queryId}
- Title: ${input.title}
- Snippet: ${input.snippet ?? ""}
- URL: ${input.url}
- Domain: ${input.domain}
`;
}

export function defaultAnnotationResult(
  input: LLMAnnotationInput,
  provider: "openai" | "claude"
): LLMAnnotationResult {
  const fallbackDomain = inferDomainType(input.domain);
  const fallbackFactual: FactualConsistency = input.snippet && input.snippet.trim().length > 0
    ? FactualConsistencyEnum.enum.unclear
    : FactualConsistencyEnum.enum.not_applicable;

  return {
    domainType: fallbackDomain,
    factualConsistency: fallbackFactual,
    confidence: null,
    reasoning: undefined,
    provider,
    modelId: "heuristic",
    raw: {}
  };
}
