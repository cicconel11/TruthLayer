import { format, subDays, eachDayOfInterval } from 'date-fns';

/**
 * Utility functions for dashboard data processing and formatting
 */

/**
 * Calculate domain diversity index for a set of search results
 */
export function calculateDomainDiversity(urls: string[]): number {
    if (urls.length === 0) return 0;

    const domains = new Set(urls.map(url => {
        try {
            return new URL(url).hostname;
        } catch {
            return url; // Fallback for invalid URLs
        }
    }));

    return domains.size / urls.length;
}

/**
 * Calculate engine overlap coefficient for multiple engine results
 */
export function calculateEngineOverlap(engineResults: Record<string, string[]>): number {
    const engines = Object.keys(engineResults);
    if (engines.length < 2) return 0;

    const allUrls = new Set<string>();
    const sharedUrls = new Set<string>();

    // Collect all URLs
    engines.forEach(engine => {
        engineResults[engine].forEach(url => allUrls.add(url));
    });

    // Find shared URLs (present in more than one engine)
    allUrls.forEach(url => {
        const enginesWithUrl = engines.filter(engine =>
            engineResults[engine].includes(url)
        );
        if (enginesWithUrl.length > 1) {
            sharedUrls.add(url);
        }
    });

    return allUrls.size > 0 ? sharedUrls.size / allUrls.size : 0;
}

/**
 * Calculate factual alignment score from annotation scores
 */
export function calculateFactualAlignment(scores: number[]): number {
    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/**
 * Generate date range for trend analysis
 */
export function generateDateRange(days: number): string[] {
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    return eachDayOfInterval({ start: startDate, end: endDate })
        .map(date => format(date, 'yyyy-MM-dd'));
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
    return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format large numbers with commas
 */
export function formatNumber(value: number): string {
    return value.toLocaleString();
}

/**
 * Generate color palette for charts
 */
export function getEngineColors(): Record<string, string> {
    return {
        google: '#4285F4',
        bing: '#00BCF2',
        perplexity: '#20B2AA',
        brave: '#FB542B',
    };
}

/**
 * Validate date range
 */
export function validateDateRange(start: Date, end: Date): boolean {
    return start <= end && start <= new Date() && end <= new Date();
}

/**
 * Parse query parameters for API requests
 */
export function parseQueryParams(searchParams: URLSearchParams): {
    dateRange: { start: Date; end: Date };
    engines: string[];
    categories: string[];
    page: number;
    limit: number;
} {
    const now = new Date();
    const defaultStart = subDays(now, 30);

    return {
        dateRange: {
            start: searchParams.get('start') ? new Date(searchParams.get('start')!) : defaultStart,
            end: searchParams.get('end') ? new Date(searchParams.get('end')!) : now,
        },
        engines: searchParams.get('engines')?.split(',') || ['google', 'bing', 'perplexity', 'brave'],
        categories: searchParams.get('categories')?.split(',') || [],
        page: parseInt(searchParams.get('page') || '1'),
        limit: Math.min(parseInt(searchParams.get('limit') || '50'), 1000), // Cap at 1000
    };
}

/**
 * Calculate statistical significance for metric changes
 */
export function calculateSignificance(
    current: number[],
    previous: number[],
    threshold: number = 0.05
): { significant: boolean; pValue: number } {
    // Simple t-test implementation for demonstration
    // In production, you might want to use a proper statistics library

    if (current.length === 0 || previous.length === 0) {
        return { significant: false, pValue: 1 };
    }

    const currentMean = current.reduce((sum, val) => sum + val, 0) / current.length;
    const previousMean = previous.reduce((sum, val) => sum + val, 0) / previous.length;

    const currentVariance = current.reduce((sum, val) => sum + Math.pow(val - currentMean, 2), 0) / current.length;
    const previousVariance = previous.reduce((sum, val) => sum + Math.pow(val - previousMean, 2), 0) / previous.length;

    const pooledStdError = Math.sqrt(currentVariance / current.length + previousVariance / previous.length);

    if (pooledStdError === 0) {
        return { significant: false, pValue: 1 };
    }

    const tStat = Math.abs(currentMean - previousMean) / pooledStdError;

    // Simplified p-value calculation (not exact, but sufficient for demonstration)
    const pValue = Math.max(0.001, 1 / (1 + tStat * tStat));

    return {
        significant: pValue < threshold,
        pValue,
    };
}

/**
 * Detect anomalies in metric trends
 */
export function detectAnomalies(
    values: number[],
    threshold: number = 2
): { isAnomaly: boolean; zScore: number }[] {
    if (values.length < 3) {
        return values.map(() => ({ isAnomaly: false, zScore: 0 }));
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
        return values.map(() => ({ isAnomaly: false, zScore: 0 }));
    }

    return values.map(value => {
        const zScore = Math.abs(value - mean) / stdDev;
        return {
            isAnomaly: zScore > threshold,
            zScore,
        };
    });
}

/**
 * Export utilities for different formats
 */
export class ExportUtils {
    static convertToCSV(data: any[]): string {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    const value = row[header];
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value || '';
                }).join(',')
            )
        ].join('\n');

        return csvContent;
    }

    static generateFilename(format: string, prefix: string = 'truthlayer-export'): string {
        const timestamp = new Date().toISOString().split('T')[0];
        return `${prefix}-${timestamp}.${format}`;
    }
}