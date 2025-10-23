import { z } from 'zod';
import { SearchResult, AnnotationRequest, Query } from '../types';

/**
 * Validation schema for SearchResult
 */
export const SearchResultSchema = z.object({
    id: z.string().uuid(),
    query: z.string().min(1),
    engine: z.enum(['google', 'bing', 'perplexity', 'brave']),
    rank: z.number().int().min(1).max(100),
    title: z.string().min(1),
    snippet: z.string(),
    url: z.string().url(),
    timestamp: z.date(),
    rawHtml: z.string().optional(),
    contentHash: z.string().optional(),
});

/**
 * Validation schema for AnnotationRequest
 */
export const AnnotationRequestSchema = z.object({
    title: z.string().min(1),
    snippet: z.string(),
    url: z.string().url(),
    query: z.string().min(1),
});

/**
 * Validation schema for Query
 */
export const QuerySchema = z.object({
    id: z.string().uuid(),
    text: z.string().min(1),
    category: z.enum(['health', 'politics', 'technology', 'science', 'general']),
    createdAt: z.date(),
    isActive: z.boolean(),
    metadata: z.object({
        description: z.string().optional(),
        expectedResultCount: z.number().int().positive().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        tags: z.array(z.string()).optional(),
        seasonality: z.enum(['none', 'seasonal', 'event-driven']).optional(),
    }).optional(),
});

/**
 * Validate SearchResult object
 */
export function validateSearchResult(data: unknown): SearchResult {
    return SearchResultSchema.parse(data);
}

/**
 * Validate AnnotationRequest object
 */
export function validateAnnotationRequest(data: unknown): AnnotationRequest {
    return AnnotationRequestSchema.parse(data);
}

/**
 * Validate Query object
 */
export function validateQuery(data: unknown): Query {
    return QuerySchema.parse(data);
}

/**
 * Validate array of objects using provided schema
 */
export function validateArray<T>(data: unknown[], schema: z.ZodSchema<T>): T[] {
    return data.map(item => schema.parse(item));
}

/**
 * Safe validation that returns result with error information
 */
export function safeValidate<T>(data: unknown, schema: z.ZodSchema<T>): {
    success: boolean;
    data?: T;
    error?: string;
} {
    try {
        const result = schema.parse(data);
        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            };
        }
        return { success: false, error: 'Unknown validation error' };
    }
}