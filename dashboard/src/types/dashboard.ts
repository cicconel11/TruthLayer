export interface DashboardFilters {
    dateRange: {
        start: Date;
        end: Date;
    };
    engines: string[];
    categories: string[];
    queryText?: string;
}

export interface QueryData {
    queryId: string;
    queryText: string;
    category: string;
    timestamp: Date;
    engines: {
        [engine: string]: {
            resultCount: number;
            avgRelevance: number;
            avgBias: number;
            status: 'completed' | 'failed' | 'pending';
        };
    };
}

export interface MetricsData {
    totalQueries: number;
    totalResults: number;
    avgRelevance: number;
    avgBias: number;
    enginePerformance: {
        [engine: string]: {
            queries: number;
            avgRelevance: number;
            avgBias: number;
            uptime: number;
        };
    };
}

export interface UpdateEvent {
    id: string;
    type: 'collection' | 'annotation' | 'metrics' | 'error';
    message: string;
    timestamp: Date;
    data?: any;
}

export interface ExportConfig {
    format: 'csv' | 'json';
    engines: string[];
    categories: string[];
    dateRange: {
        start: Date;
        end: Date;
    };
    includeAnnotations: boolean;
    includeRawData: boolean;
}export
    interface QueryAnalysis {
    queryId: string;
    queryText: string;
    category: string;
    timestamp: Date;
    totalResults: number;
    avgRelevance: number;
    avgBias: number;
    diversityScore: number;
    factualScore: number;
    engines: {
        [engine: string]: {
            resultCount: number;
            avgRelevance: number;
            avgBias: number;
            status: 'completed' | 'failed' | 'pending';
        };
    };
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}export
    interface ExportRequest {
    format: 'csv' | 'json';
    engines: string[];
    categories: string[];
    dateRange: {
        start: string;
        end: string;
    };
    includeAnnotations: boolean;
    includeRawData: boolean;
}