# Bias Metrics Calculations

## Overview

This document provides detailed mathematical formulations, implementation details, and interpretation guidelines for all bias metrics used in TruthLayer. These metrics quantify different aspects of search engine bias and enable systematic comparison across platforms and time periods.

## Core Bias Metrics

### 1. Domain Diversity Index (DDI)

#### Mathematical Definition

The Domain Diversity Index measures the variety of unique sources returned for a query, indicating how concentrated or diverse the information sources are.

**Formula:**
```
DDI = |unique_domains| / |total_results|
```

Where:
- `|unique_domains|` = count of unique domains in result set
- `|total_results|` = total number of results (typically 20)

#### Implementation

```typescript
interface DomainDiversityCalculation {
  query: string;
  engine: string;
  uniqueDomains: number;
  totalResults: number;
  domainDiversityIndex: number;
  domains: string[];
}

function calculateDomainDiversity(results: SearchResult[]): DomainDiversityCalculation {
  const domains = results.map(result => extractDomain(result.url));
  const uniqueDomains = new Set(domains);
  
  return {
    query: results[0]?.query || '',
    engine: results[0]?.engine || '',
    uniqueDomains: uniqueDomains.size,
    totalResults: results.length,
    domainDiversityIndex: uniqueDomains.size / results.length,
    domains: Array.from(uniqueDomains)
  };
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove 'www.' prefix for consistency
    return parsed.hostname.replace(/^www\./, '');
  } catch (error) {
    return 'invalid-domain';
  }
}
```

#### Interpretation Guidelines

| DDI Range | Interpretation | Example Scenario |
|-----------|----------------|------------------|
| 0.95 - 1.0 | Extremely diverse | Each result from different domain |
| 0.80 - 0.94 | Highly diverse | Most results from unique sources |
| 0.60 - 0.79 | Moderately diverse | Some domain repetition |
| 0.40 - 0.59 | Low diversity | Significant domain concentration |
| 0.00 - 0.39 | Very low diversity | Heavy concentration in few domains |

#### Statistical Properties

- **Range**: [0.05, 1.0] for 20 results (minimum when all from same domain)
- **Distribution**: Typically right-skewed in real search results
- **Sensitivity**: More sensitive to changes when baseline diversity is low
- **Stability**: Generally stable across similar queries within topic areas

### 2. Engine Overlap Coefficient (EOC)

#### Mathematical Definition

The Engine Overlap Coefficient measures the degree to which different search engines return the same URLs for identical queries.

**Formula:**
```
EOC = |shared_urls| / |total_unique_urls|
```

Where:
- `|shared_urls|` = count of URLs appearing in multiple engines
- `|total_unique_urls|` = count of all unique URLs across all engines

#### Advanced Calculation Methods

##### Pairwise Overlap
```typescript
function calculatePairwiseOverlap(
  engine1Results: SearchResult[], 
  engine2Results: SearchResult[]
): number {
  const urls1 = new Set(engine1Results.map(r => normalizeUrl(r.url)));
  const urls2 = new Set(engine2Results.map(r => normalizeUrl(r.url)));
  
  const intersection = new Set([...urls1].filter(url => urls2.has(url)));
  const union = new Set([...urls1, ...urls2]);
  
  return intersection.size / union.size; // Jaccard similarity
}
```

##### Multi-Engine Overlap
```typescript
interface EngineOverlapCalculation {
  query: string;
  engines: string[];
  totalUniqueUrls: number;
  sharedUrls: number;
  engineOverlapCoefficient: number;
  pairwiseOverlaps: Map<string, number>;
  urlDistribution: Map<string, string[]>; // URL -> engines that returned it
}

function calculateEngineOverlap(
  engineResults: Map<string, SearchResult[]>
): EngineOverlapCalculation {
  const urlToEngines = new Map<string, string[]>();
  const engines = Array.from(engineResults.keys());
  
  // Build URL to engines mapping
  for (const [engine, results] of engineResults) {
    for (const result of results) {
      const normalizedUrl = normalizeUrl(result.url);
      
      if (!urlToEngines.has(normalizedUrl)) {
        urlToEngines.set(normalizedUrl, []);
      }
      
      urlToEngines.get(normalizedUrl)!.push(engine);
    }
  }
  
  // Count shared URLs (appearing in 2+ engines)
  const sharedUrls = Array.from(urlToEngines.values())
    .filter(engineList => engineList.length > 1).length;
  
  const totalUniqueUrls = urlToEngines.size;
  
  // Calculate pairwise overlaps
  const pairwiseOverlaps = new Map<string, number>();
  for (let i = 0; i < engines.length; i++) {
    for (let j = i + 1; j < engines.length; j++) {
      const engine1 = engines[i];
      const engine2 = engines[j];
      const overlap = calculatePairwiseOverlap(
        engineResults.get(engine1)!,
        engineResults.get(engine2)!
      );
      pairwiseOverlaps.set(`${engine1}-${engine2}`, overlap);
    }
  }
  
  return {
    query: engineResults.values().next().value?.[0]?.query || '',
    engines,
    totalUniqueUrls,
    sharedUrls,
    engineOverlapCoefficient: totalUniqueUrls > 0 ? sharedUrls / totalUniqueUrls : 0,
    pairwiseOverlaps,
    urlDistribution: urlToEngines
  };
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove tracking parameters and fragments
    const cleanUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    return cleanUrl.toLowerCase();
  } catch (error) {
    return url.toLowerCase();
  }
}
```

#### Interpretation Guidelines

| EOC Range | Interpretation | Implication |
|-----------|----------------|-------------|
| 0.80 - 1.0 | Very high overlap | Engines show similar results |
| 0.60 - 0.79 | High overlap | Significant result similarity |
| 0.40 - 0.59 | Moderate overlap | Some shared sources |
| 0.20 - 0.39 | Low overlap | Different information sources |
| 0.00 - 0.19 | Very low overlap | Highly divergent results |

### 3. Factual Alignment Score (FAS)

#### Mathematical Definition

The Factual Alignment Score measures the overall factual reliability of search results based on LLM annotations, weighted by annotation confidence.

**Formula:**
```
FAS = Σ(factual_score_i × confidence_score_i) / Σ(confidence_score_i)
```

Where:
- `factual_score_i` = factual reliability score for result i (0.0-1.0)
- `confidence_score_i` = annotation confidence for result i (0.0-1.0)

#### Implementation

```typescript
interface FactualAlignmentCalculation {
  query: string;
  engine: string;
  totalResults: number;
  annotatedResults: number;
  factualAlignmentScore: number;
  averageConfidence: number;
  scoreDistribution: {
    high: number;    // 0.7-1.0
    medium: number;  // 0.4-0.6
    low: number;     // 0.0-0.3
  };
  weightedComponents: {
    numerator: number;
    denominator: number;
  };
}

function calculateFactualAlignment(
  results: SearchResult[],
  annotations: Annotation[]
): FactualAlignmentCalculation {
  const annotationMap = new Map<string, Annotation>();
  annotations.forEach(ann => annotationMap.set(ann.resultId, ann));
  
  let weightedSum = 0;
  let totalWeight = 0;
  let confidenceSum = 0;
  let annotatedCount = 0;
  
  const scoreDistribution = { high: 0, medium: 0, low: 0 };
  
  for (const result of results) {
    const annotation = annotationMap.get(result.id);
    
    if (annotation) {
      const weight = annotation.confidenceScore;
      weightedSum += annotation.factualScore * weight;
      totalWeight += weight;
      confidenceSum += annotation.confidenceScore;
      annotatedCount++;
      
      // Categorize scores
      if (annotation.factualScore >= 0.7) {
        scoreDistribution.high++;
      } else if (annotation.factualScore >= 0.4) {
        scoreDistribution.medium++;
      } else {
        scoreDistribution.low++;
      }
    }
  }
  
  return {
    query: results[0]?.query || '',
    engine: results[0]?.engine || '',
    totalResults: results.length,
    annotatedResults: annotatedCount,
    factualAlignmentScore: totalWeight > 0 ? weightedSum / totalWeight : 0,
    averageConfidence: annotatedCount > 0 ? confidenceSum / annotatedCount : 0,
    scoreDistribution,
    weightedComponents: {
      numerator: weightedSum,
      denominator: totalWeight
    }
  };
}
```

#### Confidence-Based Filtering

```typescript
function calculateFactualAlignmentWithThreshold(
  results: SearchResult[],
  annotations: Annotation[],
  minConfidence: number = 0.7
): FactualAlignmentCalculation {
  // Filter annotations by confidence threshold
  const highConfidenceAnnotations = annotations.filter(
    ann => ann.confidenceScore >= minConfidence
  );
  
  return calculateFactualAlignment(results, highConfidenceAnnotations);
}
```

## Advanced Metrics

### 4. Temporal Bias Drift

#### Mathematical Definition

Measures how bias metrics change over time to identify trends and sudden shifts.

**Formula:**
```
TBD = (current_metric - baseline_metric) / baseline_metric
```

#### Implementation

```typescript
interface TemporalDriftCalculation {
  metric: 'ddi' | 'eoc' | 'fas';
  timeWindow: number; // days
  currentValue: number;
  baselineValue: number;
  driftPercentage: number;
  isSignificant: boolean;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
}

function calculateTemporalDrift(
  historicalMetrics: BiasMetric[],
  currentMetric: BiasMetric,
  metricType: 'ddi' | 'eoc' | 'fas',
  windowDays: number = 30
): TemporalDriftCalculation {
  const cutoffDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  
  const baselineMetrics = historicalMetrics.filter(
    m => m.calculatedAt >= cutoffDate && m.calculatedAt < currentMetric.calculatedAt
  );
  
  if (baselineMetrics.length === 0) {
    throw new Error('Insufficient historical data for drift calculation');
  }
  
  const baselineValue = baselineMetrics.reduce((sum, m) => {
    switch (metricType) {
      case 'ddi': return sum + m.domainDiversityIndex;
      case 'eoc': return sum + m.engineOverlapCoefficient;
      case 'fas': return sum + m.factualAlignmentScore;
    }
  }, 0) / baselineMetrics.length;
  
  const currentValue = (() => {
    switch (metricType) {
      case 'ddi': return currentMetric.domainDiversityIndex;
      case 'eoc': return currentMetric.engineOverlapCoefficient;
      case 'fas': return currentMetric.factualAlignmentScore;
    }
  })();
  
  const driftPercentage = baselineValue > 0 
    ? ((currentValue - baselineValue) / baselineValue) * 100 
    : 0;
  
  // Statistical significance test (simplified)
  const isSignificant = Math.abs(driftPercentage) > 5; // 5% threshold
  
  const trendDirection = driftPercentage > 1 ? 'increasing' 
    : driftPercentage < -1 ? 'decreasing' 
    : 'stable';
  
  return {
    metric: metricType,
    timeWindow: windowDays,
    currentValue,
    baselineValue,
    driftPercentage,
    isSignificant,
    trendDirection
  };
}
```

### 5. Cross-Engine Bias Variance

#### Mathematical Definition

Measures the consistency of bias metrics across different search engines.

**Formula:**
```
CEBV = √(Σ(metric_i - mean_metric)² / n)
```

#### Implementation

```typescript
interface CrossEngineVarianceCalculation {
  query: string;
  engines: string[];
  metricType: 'ddi' | 'eoc' | 'fas';
  values: Map<string, number>;
  mean: number;
  variance: number;
  standardDeviation: number;
  coefficientOfVariation: number;
  outliers: string[];
}

function calculateCrossEngineVariance(
  engineMetrics: Map<string, BiasMetric>,
  metricType: 'ddi' | 'eoc' | 'fas'
): CrossEngineVarianceCalculation {
  const engines = Array.from(engineMetrics.keys());
  const values = new Map<string, number>();
  
  // Extract metric values
  for (const [engine, metric] of engineMetrics) {
    const value = (() => {
      switch (metricType) {
        case 'ddi': return metric.domainDiversityIndex;
        case 'eoc': return metric.engineOverlapCoefficient;
        case 'fas': return metric.factualAlignmentScore;
      }
    })();
    values.set(engine, value);
  }
  
  const valueArray = Array.from(values.values());
  const mean = valueArray.reduce((a, b) => a + b, 0) / valueArray.length;
  
  const variance = valueArray.reduce(
    (acc, val) => acc + Math.pow(val - mean, 2), 
    0
  ) / valueArray.length;
  
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 0;
  
  // Identify outliers (values > 2 standard deviations from mean)
  const outliers = engines.filter(engine => {
    const value = values.get(engine)!;
    return Math.abs(value - mean) > 2 * standardDeviation;
  });
  
  return {
    query: engineMetrics.values().next().value?.queryId || '',
    engines,
    metricType,
    values,
    mean,
    variance,
    standardDeviation,
    coefficientOfVariation,
    outliers
  };
}
```

## Composite Metrics

### 6. Overall Bias Index (OBI)

#### Mathematical Definition

A composite metric combining all three core bias measures into a single score.

**Formula:**
```
OBI = w₁ × DDI + w₂ × (1 - EOC) + w₃ × FAS
```

Where weights sum to 1: `w₁ + w₂ + w₃ = 1`

#### Implementation

```typescript
interface OverallBiasCalculation {
  domainDiversityIndex: number;
  engineOverlapCoefficient: number;
  factualAlignmentScore: number;
  overallBiasIndex: number;
  weights: {
    diversity: number;
    independence: number;
    factuality: number;
  };
  components: {
    diversityComponent: number;
    independenceComponent: number;
    factualityComponent: number;
  };
}

function calculateOverallBiasIndex(
  ddi: number,
  eoc: number,
  fas: number,
  weights: { diversity: number; independence: number; factuality: number } = {
    diversity: 0.4,
    independence: 0.3,
    factuality: 0.3
  }
): OverallBiasCalculation {
  // Validate weights sum to 1
  const weightSum = weights.diversity + weights.independence + weights.factuality;
  if (Math.abs(weightSum - 1.0) > 0.001) {
    throw new Error('Weights must sum to 1.0');
  }
  
  // Calculate components
  const diversityComponent = weights.diversity * ddi;
  const independenceComponent = weights.independence * (1 - eoc); // Invert EOC
  const factualityComponent = weights.factuality * fas;
  
  const overallBiasIndex = diversityComponent + independenceComponent + factualityComponent;
  
  return {
    domainDiversityIndex: ddi,
    engineOverlapCoefficient: eoc,
    factualAlignmentScore: fas,
    overallBiasIndex,
    weights,
    components: {
      diversityComponent,
      independenceComponent,
      factualityComponent
    }
  };
}
```

## Statistical Analysis

### Significance Testing

#### Mann-Whitney U Test for Metric Comparisons

```typescript
function mannWhitneyUTest(group1: number[], group2: number[]): {
  uStatistic: number;
  pValue: number;
  isSignificant: boolean;
} {
  const n1 = group1.length;
  const n2 = group2.length;
  
  // Combine and rank all values
  const combined = [...group1.map(v => ({ value: v, group: 1 })), 
                   ...group2.map(v => ({ value: v, group: 2 }))];
  
  combined.sort((a, b) => a.value - b.value);
  
  // Assign ranks (handle ties)
  let currentRank = 1;
  for (let i = 0; i < combined.length; i++) {
    let tieCount = 1;
    while (i + tieCount < combined.length && 
           combined[i].value === combined[i + tieCount].value) {
      tieCount++;
    }
    
    const averageRank = currentRank + (tieCount - 1) / 2;
    for (let j = 0; j < tieCount; j++) {
      combined[i + j].rank = averageRank;
    }
    
    currentRank += tieCount;
    i += tieCount - 1;
  }
  
  // Calculate U statistic
  const r1 = combined.filter(item => item.group === 1)
                    .reduce((sum, item) => sum + item.rank!, 0);
  
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const uStatistic = Math.min(u1, u2);
  
  // Calculate p-value (approximation for large samples)
  const meanU = (n1 * n2) / 2;
  const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const zScore = (uStatistic - meanU) / stdU;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
  
  return {
    uStatistic,
    pValue,
    isSignificant: pValue < 0.05
  };
}
```

### Confidence Intervals

#### Bootstrap Confidence Intervals

```typescript
function bootstrapConfidenceInterval(
  data: number[],
  statistic: (sample: number[]) => number,
  confidence: number = 0.95,
  iterations: number = 1000
): { lower: number; upper: number; estimate: number } {
  const bootstrapStats: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    // Resample with replacement
    const sample: number[] = [];
    for (let j = 0; j < data.length; j++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      sample.push(data[randomIndex]);
    }
    
    bootstrapStats.push(statistic(sample));
  }
  
  bootstrapStats.sort((a, b) => a - b);
  
  const alpha = 1 - confidence;
  const lowerIndex = Math.floor(alpha / 2 * iterations);
  const upperIndex = Math.floor((1 - alpha / 2) * iterations);
  
  return {
    lower: bootstrapStats[lowerIndex],
    upper: bootstrapStats[upperIndex],
    estimate: statistic(data)
  };
}
```

## Metric Validation

### Synthetic Data Testing

```typescript
function validateMetricCalculations(): void {
  // Test Domain Diversity Index
  const testResults: SearchResult[] = [
    { url: 'https://example1.com/page', /* other fields */ },
    { url: 'https://example2.com/page', /* other fields */ },
    { url: 'https://example1.com/other', /* other fields */ }
  ];
  
  const ddi = calculateDomainDiversity(testResults);
  console.assert(ddi.domainDiversityIndex === 2/3, 'DDI calculation failed');
  
  // Test Engine Overlap Coefficient
  const engineResults = new Map([
    ['google', [
      { url: 'https://shared.com', /* other fields */ },
      { url: 'https://google-only.com', /* other fields */ }
    ]],
    ['bing', [
      { url: 'https://shared.com', /* other fields */ },
      { url: 'https://bing-only.com', /* other fields */ }
    ]]
  ]);
  
  const eoc = calculateEngineOverlap(engineResults);
  console.assert(eoc.engineOverlapCoefficient === 1/3, 'EOC calculation failed');
  
  console.log('All metric validations passed');
}
```

This comprehensive bias metrics documentation ensures accurate, reproducible, and interpretable measurements of search engine bias across multiple dimensions.