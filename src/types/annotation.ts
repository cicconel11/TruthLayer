/**
 * Annotation request for LLM processing
 */
export interface AnnotationRequest {
    title: string;
    snippet: string;
    url: string;
    query: string;
}

/**
 * Annotation response from LLM
 */
export interface AnnotationResponse {
    domainType: DomainType;
    factualScore: number;
    confidenceScore: number;
    reasoning: string;
}

/**
 * Domain classification types
 */
export type DomainType = 'news' | 'government' | 'academic' | 'blog' | 'commercial' | 'social';

/**
 * Stored annotation with metadata
 */
export interface Annotation {
    id: string;
    resultId: string;
    domainType: DomainType;
    factualScore: number;
    confidenceScore: number;
    reasoning: string;
    modelVersion: string;
    annotatedAt: Date;
}

/**
 * Batch annotation request
 */
export interface BatchAnnotationRequest {
    requests: AnnotationRequest[];
    batchId: string;
    priority?: 'low' | 'normal' | 'high';
}

/**
 * Batch annotation response
 */
export interface BatchAnnotationResponse {
    responses: AnnotationResponse[];
    batchId: string;
    processedAt: Date;
    totalProcessed: number;
    errors: string[];
}