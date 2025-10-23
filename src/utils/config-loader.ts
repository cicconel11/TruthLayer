import { config } from 'dotenv';
import { z } from 'zod';
import { AppConfig, DatabaseConfig, ScrapingConfig, AnnotationConfig, DashboardConfig, MonitoringConfig } from '../types/config';
import { BypassConfig } from '../types/bypass';

// Load environment variables
config();

// Validation schemas
const DatabaseConfigSchema = z.object({
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    database: z.string(),
    username: z.string(),
    password: z.string(),
    ssl: z.boolean().default(false),
    maxConnections: z.number().default(20),
    connectionTimeout: z.number().default(30000),
});

const ProxyConfigSchema = z.object({
    host: z.string(),
    port: z.number(),
    username: z.string().optional(),
    password: z.string().optional(),
    protocol: z.enum(['http', 'https', 'socks4', 'socks5']).default('http'),
});

const ScrapingConfigSchema = z.object({
    userAgents: z.array(z.string()).default([
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]),
    proxies: z.array(ProxyConfigSchema).optional(),
    delays: z.object({
        min: z.number().default(2000),
        max: z.number().default(8000),
    }),
    retries: z.object({
        maxAttempts: z.number().default(3),
        backoffMultiplier: z.number().default(2),
    }),
    timeout: z.number().default(30000),
    requestsPerWindow: z.number().default(30),
    windowSizeMs: z.number().default(60000),
});

const AnnotationConfigSchema = z.object({
    provider: z.enum(['openai', 'anthropic']).default('openai'),
    apiKey: z.string(),
    model: z.string().default('gpt-4-turbo-preview'),
    temperature: z.number().default(0.1),
    maxTokens: z.number().default(1000),
    batchSize: z.number().default(10),
    rateLimits: z.object({
        requestsPerMinute: z.number().default(60),
        tokensPerMinute: z.number().default(90000),
    }),
});

const DashboardConfigSchema = z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost'),
    cors: z.object({
        origins: z.array(z.string()).default(['http://localhost:3000']),
        credentials: z.boolean().default(true),
    }),
    rateLimit: z.object({
        windowMs: z.number().default(900000), // 15 minutes
        maxRequests: z.number().default(100),
    }),
});

const MonitoringConfigSchema = z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    logFormat: z.enum(['json', 'text']).default('json'),
    metrics: z.object({
        enabled: z.boolean().default(true),
        port: z.number().optional(),
    }),
    alerts: z.object({
        enabled: z.boolean().default(false),
        webhookUrl: z.string().optional(),
        emailRecipients: z.array(z.string()).optional(),
    }),
});

const BypassConfigSchema = z.object({
    captcha: z.object({
        enabled: z.boolean().default(false),
        provider: z.enum(['twocaptcha', 'anticaptcha', 'capsolver']).default('twocaptcha'),
        apiKey: z.string().default(''),
        timeout: z.number().default(120000),
        pollingInterval: z.number().default(3000),
    }),
    cloudflare: z.object({
        enabled: z.boolean().default(false),
        proxyService: z.string().optional(),
        apiKey: z.string().optional(),
        timeout: z.number().default(30000),
    }),
    retries: z.object({
        maxAttempts: z.number().default(3),
        baseDelay: z.number().default(1000),
        maxDelay: z.number().default(30000),
        backoffMultiplier: z.number().default(2),
    }),
});

/**
 * Load and validate application configuration from environment variables
 */
export function loadConfig(): AppConfig {
    try {
        const database: DatabaseConfig = DatabaseConfigSchema.parse({
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME,
            username: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            ssl: process.env.DATABASE_SSL === 'true',
            maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
            connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
        });

        // Parse proxy configuration from environment
        const proxies = process.env.SCRAPING_PROXIES ?
            JSON.parse(process.env.SCRAPING_PROXIES) : undefined;

        const scraping: ScrapingConfig = ScrapingConfigSchema.parse({
            proxies,
            delays: {
                min: parseInt(process.env.SCRAPING_MIN_DELAY || '2000'),
                max: parseInt(process.env.SCRAPING_MAX_DELAY || '8000'),
            },
            retries: {
                maxAttempts: parseInt(process.env.SCRAPING_MAX_RETRIES || '3'),
                backoffMultiplier: parseInt(process.env.SCRAPING_BACKOFF_MULTIPLIER || '2'),
            },
            timeout: parseInt(process.env.SCRAPING_TIMEOUT || '30000'),
            requestsPerWindow: parseInt(process.env.SCRAPING_REQUESTS_PER_WINDOW || '30'),
            windowSizeMs: parseInt(process.env.SCRAPING_WINDOW_SIZE_MS || '60000'),
        });

        const annotation: AnnotationConfig = AnnotationConfigSchema.parse({
            provider: process.env.ANNOTATION_PROVIDER as 'openai' | 'anthropic' || 'openai',
            apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
            model: process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || 'gpt-4-turbo-preview',
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
            batchSize: parseInt(process.env.ANNOTATION_BATCH_SIZE || '10'),
            rateLimits: {
                requestsPerMinute: parseInt(process.env.ANNOTATION_REQUESTS_PER_MINUTE || '60'),
                tokensPerMinute: parseInt(process.env.ANNOTATION_TOKENS_PER_MINUTE || '90000'),
            },
        });

        const dashboard: DashboardConfig = DashboardConfigSchema.parse({
            port: parseInt(process.env.DASHBOARD_PORT || '3000'),
            host: process.env.DASHBOARD_HOST || 'localhost',
            cors: {
                origins: process.env.DASHBOARD_CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
                credentials: process.env.DASHBOARD_CORS_CREDENTIALS !== 'false',
            },
            rateLimit: {
                windowMs: parseInt(process.env.DASHBOARD_RATE_LIMIT_WINDOW || '900000'),
                maxRequests: parseInt(process.env.DASHBOARD_RATE_LIMIT_MAX || '100'),
            },
        });

        const monitoring: MonitoringConfig = MonitoringConfigSchema.parse({
            logLevel: process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' || 'info',
            logFormat: process.env.LOG_FORMAT as 'json' | 'text' || 'json',
            metrics: {
                enabled: process.env.METRICS_ENABLED !== 'false',
                port: process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : undefined,
            },
            alerts: {
                enabled: process.env.ALERTS_ENABLED === 'true',
                webhookUrl: process.env.ALERTS_WEBHOOK_URL,
                emailRecipients: process.env.ALERTS_EMAIL_RECIPIENTS?.split(','),
            },
        });

        const bypass: BypassConfig = BypassConfigSchema.parse({
            captcha: {
                enabled: process.env.BYPASS_CAPTCHA_ENABLED === 'true',
                provider: process.env.BYPASS_CAPTCHA_PROVIDER as 'twocaptcha' | 'anticaptcha' | 'capsolver' || 'twocaptcha',
                apiKey: process.env.BYPASS_CAPTCHA_API_KEY || '',
                timeout: parseInt(process.env.BYPASS_CAPTCHA_TIMEOUT || '120000'),
                pollingInterval: parseInt(process.env.BYPASS_CAPTCHA_POLLING_INTERVAL || '3000'),
            },
            cloudflare: {
                enabled: process.env.BYPASS_CLOUDFLARE_ENABLED === 'true',
                proxyService: process.env.BYPASS_CLOUDFLARE_PROXY_SERVICE,
                apiKey: process.env.BYPASS_CLOUDFLARE_API_KEY,
                timeout: parseInt(process.env.BYPASS_CLOUDFLARE_TIMEOUT || '30000'),
            },
            retries: {
                maxAttempts: parseInt(process.env.BYPASS_RETRY_MAX_ATTEMPTS || '3'),
                baseDelay: parseInt(process.env.BYPASS_RETRY_BASE_DELAY || '1000'),
                maxDelay: parseInt(process.env.BYPASS_RETRY_MAX_DELAY || '30000'),
                backoffMultiplier: parseInt(process.env.BYPASS_RETRY_BACKOFF_MULTIPLIER || '2'),
            },
        });

        return {
            database,
            scraping,
            annotation,
            dashboard,
            monitoring,
            bypass,
        };
    } catch (error) {
        console.error('Configuration validation failed:', error);
        throw new Error('Invalid configuration. Please check your environment variables.');
    }
}

/**
 * Get configuration instance (singleton)
 */
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
    if (!configInstance) {
        configInstance = loadConfig();
    }
    return configInstance;
}