import { OpenAI } from "openai";
import { AnnotationConfig } from "../lib/config";
import { Logger } from "../lib/logger";
import {
  LLMClient,
  LLMAnnotationInput,
  LLMAnnotationResult,
  buildPrompt,
  defaultAnnotationResult,
  normalizeAnnotationResult
} from "./llm-client";
import { inferDomainType, inferFactualConsistency } from "./heuristics";

function extractJsonFromText(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unable to locate JSON object in LLM response");
  }

  const jsonString = text.slice(start, end + 1);
  return JSON.parse(jsonString) as Record<string, unknown>;
}

function buildSystemPrompt(promptVersion: string): string {
  return `You are an annotation assistant classifying search results. Prompt version ${promptVersion}.
Return ONLY valid JSON with keys domain_type, factual_consistency, confidence (0-1), reasoning.`;
}

export function createOpenAIAnnotator({
  config,
  logger
}: {
  config: AnnotationConfig;
  logger: Logger;
}): LLMClient {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for OpenAI annotations");
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });

  async function annotate(input: LLMAnnotationInput): Promise<LLMAnnotationResult> {
    const fallbackDomain = inferDomainType(input.domain);
    const fallbackFactual = inferFactualConsistency(input.snippet);

    const prompt = buildPrompt(input);

    try {
      const response = await client.responses.create({
        model: config.model,
        input: [
          {
            role: "system",
            content: buildSystemPrompt(config.promptVersion)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const textOutput = response.output_text ??
        (response.output?.map((item) => (item.content ?? []).map((content) => (content as any).text).join(" ").trim()).join(" ") ?? "");

      const parsed = textOutput ? extractJsonFromText(textOutput) : {};

      const candidate = normalizeAnnotationResult({
        candidate: {
          domainType: parsed.domain_type,
          factualConsistency: parsed.factual_consistency,
          confidence:
            typeof parsed.confidence === "number"
              ? parsed.confidence
              : typeof parsed.confidence === "string"
                ? Number.parseFloat(parsed.confidence)
                : null,
          reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
          provider: "openai",
          modelId: response.model ?? config.model,
          raw: {
            parsed,
            model: response.model,
            id: (response as { id?: string }).id
          }
        },
        fallbackDomain,
        fallbackFactual
      });

      return candidate;
    } catch (error) {
      logger.error("OpenAI annotation failed", {
        error,
        engine: input.engine,
        queryId: input.queryId,
        url: input.url
      });
      return defaultAnnotationResult(input, "openai");
    }
  }

  return {
    provider: "openai",
    annotate
  };
}
