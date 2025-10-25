import { describe, expect, it } from "vitest";
import { DomainTypeEnum, FactualConsistencyEnum } from "@truthlayer/schema";
import { normalizeAnnotationResult } from "./llm-client";

describe("normalizeAnnotationResult", () => {
  it("uses candidate values when valid", () => {
    const normalized = normalizeAnnotationResult({
      candidate: {
        domainType: DomainTypeEnum.enum.news,
        factualConsistency: FactualConsistencyEnum.enum.aligned,
        confidence: 0.9,
        provider: "openai",
        modelId: "gpt-test",
        raw: { foo: "bar" }
      },
      fallbackDomain: DomainTypeEnum.enum.other,
      fallbackFactual: FactualConsistencyEnum.enum.unclear
    });

    expect(normalized.domainType).toBe(DomainTypeEnum.enum.news);
    expect(normalized.factualConsistency).toBe(FactualConsistencyEnum.enum.aligned);
    expect(normalized.confidence).toBe(0.9);
    expect(normalized.provider).toBe("openai");
    expect(normalized.modelId).toBe("gpt-test");
  });

  it("falls back when candidate is invalid", () => {
    const normalized = normalizeAnnotationResult({
      candidate: {
        domainType: "mystery" as unknown as DomainTypeEnum,
        factualConsistency: "unknown" as unknown as FactualConsistencyEnum,
        confidence: 3,
        provider: "openai",
        modelId: "gpt-test"
      },
      fallbackDomain: DomainTypeEnum.enum.blog,
      fallbackFactual: FactualConsistencyEnum.enum.not_applicable
    });

    expect(normalized.domainType).toBe(DomainTypeEnum.enum.blog);
    expect(normalized.factualConsistency).toBe(FactualConsistencyEnum.enum.not_applicable);
    expect(normalized.confidence).toBeNull();
  });
});

