import { BypassConfig } from './bypass';

/**
 * Application configuration interface
 */
export interface AppConfig {
    database: DatabaseConfig;
    scraping: ScrapingConfig;
    annotation: AnnotationConfig;
    dashboard: DashboardConfig;
    monitoring: MonitoringConfig;
    bypass: BypassConfig;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    maxConnections?: number;
    connectionTimeout?: number;
}

/**
 * Scraping configuration
 */
export interface ScrapingConfig {
    userAgents: string[];
    proxies?: ProxyConfig[];
    delays: {
        min: number;
        max: number;
    };
    retries: {
        maxAttempts: number;
        backoffMultiplier: number;
    };
    timeout: number;
    requestsPerWindow?: number;
    windowSizeMs?: number;
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
    protocol: 'http' | 'https' | 'socks4' | 'socks5';
}

/**
 * Annotation service configuration
 */
export interface AnnotationConfig {
    provider: 'openai' | 'anthropic';
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    batchSize: number;
    rateLimits: {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
    port: number;
    host: string;
    cors: {
        origins: string[];
        credentials: boolean;
    };
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logFormat: 'json' | 'text';
    metrics: {
        enabled: boolean;
        port?: number;
    };
    alerts: {
        enabled: boolean;
        webhookUrl?: string;
        emailRecipients?: string[];
    };
}