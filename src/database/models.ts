// Database model interfaces matching the PostgreSQL schema

export interface Query {
    id: string;
    text: string;
    category?: string;
    created_at: Date;
    updated_at: Date;
}

export interface CreateQueryRequest {
    text: string;
    category?: string;
}

export interface SearchResult {
    id: string;
    query_id: string;
    engine: 'google' | 'bing' | 'perplexity' | 'brave';
    rank: number;
    title: string;
    snippet?: string;
    url: string;
    collected_at: Date;
    content_hash?: string;
    raw_html_path?: string;
}

export interface CreateSearchResultRequest {
    query_id: string;
    engine: 'google' | 'bing' | 'perplexity' | 'brave';
    rank: number;
    title: string;
    snippet?: string;
    url: string;
    content_hash?: string;
    raw_html_path?: string;
}

export interface Annotation {
    id: string;
    result_id: string;
    domain_type?: 'news' | 'government' | 'academic' | 'blog' | 'commercial' | 'social';
    factual_score?: number;
    confidence_score?: number;
    reasoning?: string;
    model_version: string;
    annotated_at: Date;
}

export interface CreateAnnotationRequest {
    result_id: string;
    domain_type?: 'news' | 'government' | 'academic' | 'blog' | 'commercial' | 'social';
    factual_score?: number;
    confidence_score?: number;
    reasoning?: string;
    model_version: string;
}

// Extended interfaces for joined queries
export interface SearchResultWithQuery extends SearchResult {
    query: Query;
}

export interface SearchResultWithAnnotation extends SearchResult {
    annotation?: Annotation;
}

export interface FullSearchResult extends SearchResult {
    query: Query;
    annotation?: Annotation;
}

// Utility types for database operations
export type QueryFilter = {
    category?: string;
    created_after?: Date;
    created_before?: Date;
};

export type SearchResultFilter = {
    engine?: 'google' | 'bing' | 'perplexity' | 'brave';
    query_id?: string;
    collected_after?: Date;
    collected_before?: Date;
    has_annotation?: boolean;
};

export type AnnotationFilter = {
    domain_type?: 'news' | 'government' | 'academic' | 'blog' | 'commercial' | 'social';
    min_factual_score?: number;
    max_factual_score?: number;
    min_confidence_score?: number;
    model_version?: string;
    annotated_after?: Date;
    annotated_before?: Date;
};