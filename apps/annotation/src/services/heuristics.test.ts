import { describe, expect, it } from "vitest";
import { DomainTypeEnum, FactualConsistencyEnum } from "@truthlayer/schema";
import {
  coerceDomainType,
  coerceFactualConsistency,
  inferDomainType,
  inferFactualConsistency
} from "./heuristics";

describe("inferDomainType", () => {
  it("classifies government domains", () => {
    expect(inferDomainType("whitehouse.gov")).toBe(DomainTypeEnum.enum.government);
  });

  it("classifies academic domains", () => {
    expect(inferDomainType("mit.edu")).toBe(DomainTypeEnum.enum.academic);
  });

  it("classifies news domains", () => {
    expect(inferDomainType("guardian.co.uk")).toBe(DomainTypeEnum.enum.news);
  });

  it("classifies blog platforms", () => {
    expect(inferDomainType("example.substack.com")).toBe(DomainTypeEnum.enum.blog);
  });

  it("falls back to other", () => {
    expect(inferDomainType("unknown.example"))
      .toBe(DomainTypeEnum.enum.other);
  });
});

describe("inferFactualConsistency", () => {
  it("returns not_applicable for empty snippets", () => {
    expect(inferFactualConsistency(" ")).toBe(FactualConsistencyEnum.enum.not_applicable);
  });

  it("returns unclear when snippet exists", () => {
    expect(inferFactualConsistency("Example snippet"))
      .toBe(FactualConsistencyEnum.enum.unclear);
  });
});

describe("coerce helpers", () => {
  it("coerces valid domain type", () => {
    expect(coerceDomainType("NEWS", DomainTypeEnum.enum.other))
      .toBe(DomainTypeEnum.enum.news);
  });

  it("returns fallback for unknown domain type", () => {
    expect(coerceDomainType("unknown", DomainTypeEnum.enum.blog))
      .toBe(DomainTypeEnum.enum.blog);
  });

  it("coerces factual consistency", () => {
    expect(coerceFactualConsistency("Aligned", FactualConsistencyEnum.enum.unclear))
      .toBe(FactualConsistencyEnum.enum.aligned);
  });

  it("returns fallback for unknown factual consistency", () => {
    expect(coerceFactualConsistency("mystery", FactualConsistencyEnum.enum.not_applicable))
      .toBe(FactualConsistencyEnum.enum.not_applicable);
  });
});

