import { randomUUID } from "node:crypto";
import { subDays } from "date-fns";
import { AnnotatedResultView, FactualConsistencyEnum, DomainTypeEnum } from "@truthlayer/schema";
import type { MetricRecord } from "@truthlayer/schema";
import type { MetricRecordInput } from "@truthlayer/storage";

type MetricType = MetricRecord["metricType"];

export interface MetricComputation {
  runId: string;
  queryId: string;
  engine: string | null;
  metricType: MetricType;
  value: number;
  delta: number | null;
  comparedToRunId: string | null;
  collectedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  extra?: Record<string, unknown>;
}

interface RunGroup {
  runId: string;
  collectedAt: Date;
  results: AnnotatedResultView[];
}

function groupByQueryAndRun(records: AnnotatedResultView[]): Map<string, RunGroup[]> {
  const byQuery = new Map<string, Map<string, RunGroup>>();

  for (const record of records) {
    const queryMap = byQuery.get(record.queryId) ?? new Map<string, RunGroup>();
    if (!byQuery.has(record.queryId)) {
      byQuery.set(record.queryId, queryMap);
    }

    const runKey = record.runId;
    let runGroup = queryMap.get(runKey);
    if (!runGroup) {
      runGroup = {
        runId: runKey,
        collectedAt: record.collectedAt,
        results: []
      };
      queryMap.set(runKey, runGroup);
    } else if (record.collectedAt < runGroup.collectedAt) {
      runGroup.collectedAt = record.collectedAt;
    }

    runGroup.results.push(record);
  }

  const output = new Map<string, RunGroup[]>();
  for (const [queryId, runs] of byQuery.entries()) {
    output.set(
      queryId,
      Array.from(runs.values()).sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime())
    );
  }

  return output;
}

function computeDomainDiversity(run: RunGroup): MetricComputation {
  const allDomains = new Set(run.results.map((result) => result.domain.toLowerCase()));

  const domainsByEngine = new Map<string, Set<string>>();
  for (const result of run.results) {
    const engineDomains = domainsByEngine.get(result.engine) ?? new Set<string>();
    engineDomains.add(result.domain.toLowerCase());
    domainsByEngine.set(result.engine, engineDomains);
  }

  const perEngine = Object.fromEntries(
    Array.from(domainsByEngine.entries()).map(([engine, domains]) => [engine, domains.size])
  );

  return {
    runId: run.runId,
    queryId: run.results[0]?.queryId ?? "",
    engine: null,
    metricType: "domain_diversity",
    value: allDomains.size,
    delta: null,
    comparedToRunId: null,
    collectedAt: run.collectedAt,
    windowStart: run.collectedAt,
    windowEnd: run.collectedAt,
    extra: {
      perEngine,
      totalResults: run.results.length
    }
  };
}

function computeEngineOverlap(run: RunGroup): MetricComputation {
  const urlToEngines = new Map<string, Set<string>>();

  for (const result of run.results) {
    const key = result.normalizedUrl.toLowerCase();
    const engines = urlToEngines.get(key) ?? new Set<string>();
    engines.add(result.engine);
    urlToEngines.set(key, engines);
  }

  const totalUrls = urlToEngines.size;
  const sharedUrls = Array.from(urlToEngines.values()).filter((engines) => engines.size > 1).length;

  const pairwise: Record<string, number> = {};
  const engines = Array.from(new Set(run.results.map((r) => r.engine))).sort();
  for (let i = 0; i < engines.length; i++) {
    for (let j = i + 1; j < engines.length; j++) {
      const a = engines[i];
      const b = engines[j];
      const intersection = Array.from(urlToEngines.values()).filter(
        (set) => set.has(a) && set.has(b)
      ).length;
      const union = Array.from(urlToEngines.values()).filter(
        (set) => set.has(a) || set.has(b)
      ).length;
      const key = `${a}_${b}`;
      pairwise[key] = union === 0 ? 0 : intersection / union;
    }
  }

  return {
    runId: run.runId,
    queryId: run.results[0]?.queryId ?? "",
    engine: null,
    metricType: "engine_overlap",
    value: totalUrls === 0 ? 0 : sharedUrls / totalUrls,
    delta: null,
    comparedToRunId: null,
    collectedAt: run.collectedAt,
    windowStart: run.collectedAt,
    windowEnd: run.collectedAt,
    extra: {
      sharedCount: sharedUrls,
      totalUrls,
      pairwise,
      engines
    }
  };
}

const FACTUAL_SCORES: Record<FactualConsistencyEnum, number> = {
  aligned: 1,
  contradicted: 0,
  unclear: 0.5,
  not_applicable: NaN
};

function computeFactualAlignment(run: RunGroup): MetricComputation {
  const relevant = run.results.filter(
    (result) => result.factualConsistency !== FactualConsistencyEnum.enum.not_applicable
  );

  const counts: Record<FactualConsistencyEnum, number> = {
    aligned: 0,
    contradicted: 0,
    unclear: 0,
    not_applicable: 0
  };

  for (const result of run.results) {
    counts[result.factualConsistency] = (counts[result.factualConsistency] ?? 0) + 1;
  }

  const scoreSum = relevant.reduce((total, result) => total + FACTUAL_SCORES[result.factualConsistency], 0);
  const value = relevant.length === 0 ? 0 : scoreSum / relevant.length;

  return {
    runId: run.runId,
    queryId: run.results[0]?.queryId ?? "",
    engine: null,
    metricType: "factual_alignment",
    value,
    delta: null,
    comparedToRunId: null,
    collectedAt: run.collectedAt,
    windowStart: run.collectedAt,
    windowEnd: run.collectedAt,
    extra: {
      counts,
      annotatedCount: relevant.length,
      totalResults: run.results.length
    }
  };
}

function applyChangeOverTime(
  series: MetricComputation[],
  previous: Map<MetricType, MetricComputation>
): MetricComputation[] {
  return series.map((metric) => {
    const prior = previous.get(metric.metricType);
    const updated = {
      ...metric,
      delta: prior ? metric.value - prior.value : null,
      comparedToRunId: prior?.runId ?? null
    };
    previous.set(metric.metricType, updated);
    return updated;
  });
}

export function computeMetricSeries(records: AnnotatedResultView[], windowSizeDays: number): MetricComputation[] {
  if (!records.length) return [];

  const grouped = groupByQueryAndRun(records);
  const metrics: MetricComputation[] = [];

  for (const [queryId, runs] of grouped.entries()) {
    const previousByMetric = new Map<MetricType, MetricComputation>();

    for (const run of runs) {
      const windowStart = subDays(run.collectedAt, Math.max(0, windowSizeDays - 1));

      const seriesForRun = [
        computeDomainDiversity(run),
        computeEngineOverlap(run),
        computeFactualAlignment(run)
      ].map((metric) => ({
        ...metric,
        queryId,
        windowStart,
        windowEnd: new Date(run.collectedAt.getTime())
      }));

      const withChange = applyChangeOverTime(seriesForRun, previousByMetric);

      for (const metric of withChange) {
        metrics.push(metric);
      }
    }
  }

  return metrics.sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime());
}

export function toMetricRecordInputs(metrics: MetricComputation[], createdAt: Date): MetricRecordInput[] {
  return metrics.map((metric) => ({
    id: randomUUID(),
    crawlRunId: metric.runId,
    queryId: metric.queryId,
    engine: metric.engine,
    metricType: metric.metricType,
    value: metric.value,
    delta: metric.delta,
    comparedToRunId: metric.comparedToRunId,
    collectedAt: metric.collectedAt,
    extra: {
      windowStart: metric.windowStart,
      windowEnd: metric.windowEnd,
      ...(metric.extra ?? {}),
      delta: metric.delta,
      comparedToRunId: metric.comparedToRunId
    },
    createdAt
  }));
}

// Viewpoint-specific metrics computation functions

export function computeViewpointDiversityScore(run: RunGroup): MetricComputation | null {
  if (!run.results.length) return null;

  const domainDistribution = calculateDomainDistribution(run.results);
  const diversityScore = calculateViewpointDiversityScore(domainDistribution, run.results.length);

  return {
    runId: run.runId,
    queryId: run.results[0]?.queryId ?? "",
    engine: null,
    metricType: "viewpoint_diversity_score",
    value: diversityScore,
    delta: null,
    comparedToRunId: null,
    collectedAt: run.collectedAt,
    windowStart: run.collectedAt,
    windowEnd: run.collectedAt,
    extra: {
      domainDistribution: domainDistribution,
      resultCount: run.results.length,
      representedTypes: Object.values(domainDistribution).filter(p => p > 0).length
    }
  };
}

export function computeViewpointUnderrepresentedCount(run: RunGroup): MetricComputation | null {
  if (!run.results.length) return null;

  const domainDistribution = calculateDomainDistribution(run.results);
  const underrepresentedTypes = identifyUnderrepresentedTypes(domainDistribution);

  return {
    runId: run.runId,
    queryId: run.results[0]?.queryId ?? "",
    engine: null,
    metricType: "viewpoint_underrepresented_count",
    value: underrepresentedTypes.length,
    delta: null,
    comparedToRunId: null,
    collectedAt: run.collectedAt,
    windowStart: run.collectedAt,
    windowEnd: run.collectedAt,
    extra: {
      underrepresentedTypes,
      domainDistribution,
      totalTypes: Object.keys(domainDistribution).length
    }
  };
}

export function computeViewpointAlternativeSourcesAvailable(run: RunGroup): MetricComputation | null {
  if (!run.results.length) return null;

  // For this metric, we calculate the potential for alternative sources
  // based on what domain types are underrepresented in the current results
  const domainDistribution = calculateDomainDistribution(run.results);
  const underrepresentedTypes = identifyUnderrepresentedTypes(domainDistribution);
  
  // Score based on potential: 0.0 to 1.0
  const totalTypes = Object.keys(domainDistribution).length;
  const potentialScore = Math.max(0.2, underrepresentedTypes.length / totalTypes);

  return {
    runId: run.runId,
    queryId: run.results[0]?.queryId ?? "",
    engine: null,
    metricType: "viewpoint_alternative_sources_available",
    value: potentialScore,
    delta: null,
    comparedToRunId: null,
    collectedAt: run.collectedAt,
    windowStart: run.collectedAt,
    windowEnd: run.collectedAt,
    extra: {
      underrepresentedTypes,
      potentialScore,
      underrepresentedCount: underrepresentedTypes.length,
      totalTypes
    }
  };
}

// Helper functions for viewpoint calculations

function calculateDomainDistribution(results: AnnotatedResultView[]): Record<string, number> {
  const total = results.length;
  const distribution: Record<string, number> = {};
  
  Object.values(DomainTypeEnum.enum).forEach(type => {
    distribution[type] = 0;
  });
  
  results.forEach(result => {
    distribution[result.domainType] = (distribution[result.domainType] || 0) + 1;
  });
  
  Object.keys(distribution).forEach(type => {
    distribution[type] = total > 0 ? distribution[type] / total : 0;
  });
  
  return distribution;
}

const DOMAIN_WEIGHTS: Record<string, number> = {
  [DomainTypeEnum.enum.government]: 1.5,
  [DomainTypeEnum.enum.academic]: 1.3,
  [DomainTypeEnum.enum.news]: 1.0,
  [DomainTypeEnum.enum.blog]: 0.7,
  [DomainTypeEnum.enum.other]: 0.5
};

function calculateViewpointDiversityScore(domainDistribution: Record<string, number>, totalResults: number): number {
  let weightedScore = 0;
  
  Object.entries(domainDistribution).forEach(([domainType, percentage]) => {
    if (percentage > 0) {
      const weight = DOMAIN_WEIGHTS[domainType] || 0.5;
      weightedScore += percentage * weight;
    }
  });
  
  weightedScore *= 100;
  
  const representedTypes = Object.values(domainDistribution).filter(p => p > 0).length;
  const varietyBonus = Math.min(representedTypes * 5, 25);
  
  const resultCountPenalty = totalResults < 10 ? (10 - totalResults) * 2 : 0;
  
  const idealPerType = 1 / representedTypes;
  const balancePenalty = Object.values(domainDistribution).reduce((penalty, percentage) => {
    if (percentage > 0) {
      const deviation = Math.abs(percentage - idealPerType);
      return penalty + deviation * 20;
    }
    return penalty;
  }, 0);
  
  const finalScore = Math.max(0, Math.min(100, weightedScore + varietyBonus - balancePenalty - resultCountPenalty));
  
  return Math.round(finalScore);
}

const DIVERSITY_THRESHOLDS = {
  government: 0.15,
  academic: 0.10,
  news: 0.40,
  blog: 0.20,
  other: 0.15
};

function identifyUnderrepresentedTypes(domainDistribution: Record<string, number>): string[] {
  const underrepresented: string[] = [];
  
  Object.entries(DIVERSITY_THRESHOLDS).forEach(([domainType, target]) => {
    const actual = domainDistribution[domainType] || 0;
    if (actual < target) {
      underrepresented.push(domainType);
    }
  });
  
  return underrepresented.sort((a, b) => {
    const deficitA = DIVERSITY_THRESHOLDS[a] - (domainDistribution[a] || 0);
    const deficitB = DIVERSITY_THRESHOLDS[b] - (domainDistribution[b] || 0);
    return deficitB - deficitA;
  });
}
