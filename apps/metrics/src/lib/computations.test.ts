import { describe, expect, it } from "vitest";
import {
  AnnotatedResultView,
  DomainTypeEnum,
  EngineEnum,
  FactualConsistencyEnum,
  MetricTypeEnum
} from "@truthlayer/schema";
import { computeMetricSeries } from "./computations";

const QUERY_ID = "11111111-1111-1111-1111-111111111111";

function makeResult(params: Partial<AnnotatedResultView>): AnnotatedResultView {
  const defaults: AnnotatedResultView = {
    runId: "run-1",
    queryId: QUERY_ID,
    engine: EngineEnum.enum.google,
    normalizedUrl: "https://example.com/a",
    domain: "example.com",
    rank: 1,
    factualConsistency: FactualConsistencyEnum.enum.aligned,
    domainType: DomainTypeEnum.enum.news,
    collectedAt: new Date("2025-01-01T00:00:00Z")
  };

  return { ...defaults, ...params };
}

function getMetric(series: ReturnType<typeof computeMetricSeries>, type: MetricTypeEnum, runId: string) {
  const metric = series.find((entry) => entry.metricType === type && entry.runId === runId);
  if (!metric) throw new Error(`Metric ${type} for run ${runId} not found`);
  return metric;
}

describe("computeMetricSeries", () => {
  it("computes metrics and deltas across runs", () => {
    const run1Date = new Date("2025-01-01T00:00:00Z");
    const run2Date = new Date("2025-01-03T00:00:00Z");

    const records: AnnotatedResultView[] = [
      makeResult({
        runId: "run-1",
        engine: EngineEnum.enum.google,
        normalizedUrl: "https://example.com/a",
        domain: "example.com",
        factualConsistency: FactualConsistencyEnum.enum.aligned,
        collectedAt: run1Date,
        rank: 1
      }),
      makeResult({
        runId: "run-1",
        engine: EngineEnum.enum.google,
        normalizedUrl: "https://gov.gov/info",
        domain: "gov.gov",
        factualConsistency: FactualConsistencyEnum.enum.contradicted,
        collectedAt: run1Date,
        rank: 2
      }),
      makeResult({
        runId: "run-1",
        engine: EngineEnum.enum.bing,
        normalizedUrl: "https://example.com/a",
        domain: "example.com",
        factualConsistency: FactualConsistencyEnum.enum.aligned,
        collectedAt: run1Date,
        rank: 1
      }),
      makeResult({
        runId: "run-1",
        engine: EngineEnum.enum.perplexity,
        normalizedUrl: "https://news.org/report",
        domain: "news.org",
        factualConsistency: FactualConsistencyEnum.enum.unclear,
        collectedAt: run1Date,
        rank: 1
      }),
      makeResult({
        runId: "run-1",
        engine: EngineEnum.enum.brave,
        normalizedUrl: "https://news.org/report",
        domain: "news.org",
        factualConsistency: FactualConsistencyEnum.enum.unclear,
        collectedAt: run1Date,
        rank: 1
      }),
      makeResult({
        runId: "run-2",
        engine: EngineEnum.enum.google,
        normalizedUrl: "https://example.com/a",
        domain: "example.com",
        factualConsistency: FactualConsistencyEnum.enum.aligned,
        collectedAt: run2Date,
        rank: 1
      }),
      makeResult({
        runId: "run-2",
        engine: EngineEnum.enum.google,
        normalizedUrl: "https://health.org/info",
        domain: "health.org",
        factualConsistency: FactualConsistencyEnum.enum.aligned,
        collectedAt: run2Date,
        rank: 2
      }),
      makeResult({
        runId: "run-2",
        engine: EngineEnum.enum.bing,
        normalizedUrl: "https://example.com/a",
        domain: "example.com",
        factualConsistency: FactualConsistencyEnum.enum.aligned,
        collectedAt: run2Date,
        rank: 1
      }),
      makeResult({
        runId: "run-2",
        engine: EngineEnum.enum.perplexity,
        normalizedUrl: "https://health.org/info",
        domain: "health.org",
        factualConsistency: FactualConsistencyEnum.enum.aligned,
        collectedAt: run2Date,
        rank: 1
      }),
      makeResult({
        runId: "run-2",
        engine: EngineEnum.enum.brave,
        normalizedUrl: "https://blog.example/entry",
        domain: "blog.example",
        factualConsistency: FactualConsistencyEnum.enum.contradicted,
        collectedAt: run2Date,
        rank: 1
      })
    ];

    const series = computeMetricSeries(records, 7);

    const run1Domain = getMetric(series, MetricTypeEnum.enum.domain_diversity, "run-1");
    expect(run1Domain.value).toBe(3);
    expect(run1Domain.extra).toMatchObject({ perEngine: { google: 2, bing: 1, perplexity: 1, brave: 1 } });
    expect(run1Domain.delta).toBeNull();

    const run1Overlap = getMetric(series, MetricTypeEnum.enum.engine_overlap, "run-1");
    expect(run1Overlap.value).toBeCloseTo(2 / 3, 5);
    expect(run1Overlap.extra).toMatchObject({ sharedCount: 2, totalUrls: 3 });

    const run1Factual = getMetric(series, MetricTypeEnum.enum.factual_alignment, "run-1");
    expect(run1Factual.value).toBeCloseTo(3 / 5, 5);
    expect(run1Factual.extra).toMatchObject({ annotatedCount: 5, totalResults: 5 });

    const run2Domain = getMetric(series, MetricTypeEnum.enum.domain_diversity, "run-2");
    expect(run2Domain.value).toBe(3);
    expect(run2Domain.delta).toBe(0);
    expect(run2Domain.comparedToRunId).toBe("run-1");

    const run2Overlap = getMetric(series, MetricTypeEnum.enum.engine_overlap, "run-2");
    expect(run2Overlap.value).toBeCloseTo(2 / 3, 5);
    expect(run2Overlap.delta).toBeCloseTo(0, 5);

    const run2Factual = getMetric(series, MetricTypeEnum.enum.factual_alignment, "run-2");
    expect(run2Factual.value).toBeCloseTo(4 / 5, 5);
    expect(run2Factual.delta).toBeCloseTo(4 / 5 - 3 / 5, 5);
  });
});

