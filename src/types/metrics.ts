/**
 * Core bias metrics
 */
export interface BiasMetrics {
    domainDiversityIndex: number;
    engineOverlapCoefficient: number;
    factualAlignmentScore: number;
    calculatedAt: Date;
    queryId: string;
}

/**
 * Domain diversity calculation
 */
export interface DomainDiversityMetric {
    uniqueDomains: number;
    totalResults: number;
    diversityIndex: number;
    topDomains: Array<{
        domain: string;
        count: number;
        percentage: number;
    }>;
}

/**
 * Engine overlap calculation
 */
export interface EngineOverlapMetric {
    sharedUrls: number;
    totalUniqueUrls: number;
    overlapCoefficient: number;
    enginePairs: Array<{
        engines: [string, string];
        sharedCount: number;
        overlapPercentage: number;
    }>;
}

/**
 * Factual alignment calculation
 */
export interface FactualAlignmentMetric {
    averageScore: number;
    weightedScore: number;
    confidenceLevel: number;
    scoreDistribution: Array<{
        range: string;
        count: number;
        percentage: number;
    }>;
}

/**
 * Trend analysis data
 */
export interface TrendAnalysis {
    metric: string;
    timeframe: '7d' | '30d' | '90d';
    values: Array<{
        date: Date;
        value: number;
    }>;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercentage: number;
    significance: number;
}

/**
 * Rolling average calculation result
 */
export interface RollingAverage {
    date: Date;
    value: number;
    rollingAverage7d: number;
    rollingAverage30d: number;
    sampleSize7d: number;
    sampleSize30d: number;
}

/**
 * Statistical significance test result
 */
export interface SignificanceTest {
    pValue: number;
    isSignificant: boolean;
    confidenceLevel: number;
    testStatistic: number;
    testType: 'ttest' | 'mannwhitney' | 'welch';
    effectSize: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
    date: Date;
    value: number;
    expectedValue: number;
    deviation: number;
    isAnomaly: boolean;
    severity: 'low' | 'medium' | 'high';
    confidence: number;
}

/**
 * Historical metrics data point
 */
export interface HistoricalMetric {
    id: string;
    queryId: string;
    metricType: 'domain_diversity' | 'engine_overlap' | 'factual_alignment';
    value: number;
    calculatedAt: Date;
    metadata?: Record<string, any>;
}

/**
 * Comparative analysis between engines
 */
export interface EngineComparison {
    engines: string[];
    metrics: {
        domainDiversity: Record<string, number>;
        factualAlignment: Record<string, number>;
        resultCount: Record<string, number>;
    };
    rankings: Array<{
        engine: string;
        overallScore: number;
        rank: number;
    }>;
}