import { describe, expect, it } from "vitest";
import { DomainTypeEnum, FactualConsistencyEnum } from "@truthlayer/schema";
import type { z } from "zod";
import { normalizeAnnotationResult } from "./llm-client";

type DomainType = z.infer<typeof DomainTypeEnum>;
type FactualConsistency = z.infer<typeof FactualConsistencyEnum>;

describe("normalizeAnnotationResult", () => {
  it("uses candidate values when valid", () => {
    const normalized = normalizeAnnotationResult({
      candidate: {
        domainType: "news" as DomainType,
        factualConsistency: "aligned" as FactualConsistency,
        confidence: 0.9,
        provider: "openai",
        modelId: "gpt-test",
        raw: { foo: "bar" }
      },
      fallbackDomain: "other" as DomainType,
      fallbackFactual: "unclear" as FactualConsistency
    });

    expect(normalized.domainType).toBe("news");
    expect(normalized.factualConsistency).toBe("aligned");
    expect(normalized.confidence).toBe(0.9);
    expect(normalized.provider).toBe("openai");
    expect(normalized.modelId).toBe("gpt-test");
  });

  it("falls back when candidate is invalid", () => {
    const normalized = normalizeAnnotationResult({
      candidate: {
        domainType: "mystery" as unknown as DomainType,
        factualConsistency: "unknown" as unknown as FactualConsistency,
        confidence: 3,
        provider: "openai",
        modelId: "gpt-test"
      },
      fallbackDomain: "blog" as DomainType,
      fallbackFactual: "not_applicable" as FactualConsistency
    });

    expect(normalized.domainType).toBe("blog");
    expect(normalized.factualConsistency).toBe("not_applicable");
    expect(normalized.confidence).toBeNull();
  });
});

