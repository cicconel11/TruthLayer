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