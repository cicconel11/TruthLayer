/**
 * Query definition and metadata
 */
export interface Query {
    id: string;
    text: string;
    category: QueryCategory;
    createdAt: Date;
    isActive: boolean;
    metadata?: QueryMetadata;
}

/**
 * Query categories for benchmark sets
 */
export type QueryCategory = 'health' | 'politics' | 'technology' | 'science' | 'general';

/**
 * Query metadata for tracking and analysis
 */
export interface QueryMetadata {
    description?: string;
    expectedResultCount?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
    seasonality?: 'none' | 'seasonal' | 'event-driven';
}

/**
 * Query set for batch processing
 */
export interface QuerySet {
    id: string;
    name: string;
    description: string;
    queries: Query[];
    schedule: ScheduleConfig;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Schedule configuration for automated collection
 */
export interface ScheduleConfig {
    frequency: 'daily' | 'weekly' | 'monthly';
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6, Sunday = 0
    dayOfMonth?: number; // 1-31
    timezone?: string;
    enabled: boolean;
}

/**
 * Query execution result
 */
export interface QueryExecution {
    id: string;
    queryId: string;
    executedAt: Date;
    status: 'pending' | 'running' | 'completed' | 'failed';
    engines: string[];
    resultCount: number;
    duration: number;
    errors?: string[];
}