// Dashboard-specific types for metrics and data visualization

export interface BiasMetrics {
    domainDiversity: number;
    engineOverlap: number;
    factualAlignment: number;
    timestamp: Date;
    engine?: string;
    category?: string;
}

export interface MetricsTrend {
    date: string;
    domainDiversity: number;
    engineOverlap: number;
    factualAlignment: number;
    engine: string;
}

export interface EngineComparison {
    engine: string;
    domainDiversity: number;
    engineOverlap: number;
    factualAlignment: number;
    totalResults: number;
    uniqueDomains: number;
    averageRank: number;
}

export interface QueryAnalysis {
    queryId: string;
    queryText: string;
    category: string;
    engines: EngineComparison[];
    collectedAt: Date;
    totalResults: number;
}

export interface DomainDistribution {
    domainType: string;
    count: number;
    percentage: number;
    engine: string;
}

export interface ExportRequest {
    format: 'csv' | 'json';
    dateRange: {
        start: Date;
        end: Date;
    };
    engines?: string[];
    categories?: string[];
    includeAnnotations?: boolean;
    includeRawData?: boolean;
}

export interface DashboardFilters {
    dateRange: {
        start: Date;
        end: Date;
    };
    engines: string[];
    categories: string[];
    queryText?: string;
}

export interface MetricsOverview {
    totalQueries: number;
    totalResults: number;
    totalAnnotations: number;
    averageDomainDiversity: number;
    averageEngineOverlap: number;
    averageFactualAlignment: number;
    lastUpdated: Date;
}

// API response types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}