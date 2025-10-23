/**
 * Bypass service configuration and types
 */

export interface BypassConfig {
    captcha: CaptchaConfig;
    cloudflare: CloudflareConfig;
    retries: BypassRetryConfig;
}

export interface CaptchaConfig {
    enabled: boolean;
    provider: 'twocaptcha' | 'anticaptcha' | 'capsolver';
    apiKey: string;
    timeout: number;
    pollingInterval: number;
}

export interface CloudflareConfig {
    enabled: boolean;
    proxyService?: string;
    apiKey?: string;
    timeout: number;
}

export interface BypassRetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

export interface CaptchaChallenge {
    type: 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'turnstile';
    siteKey: string;
    pageUrl: string;
    action?: string; // For reCAPTCHA v3
    minScore?: number; // For reCAPTCHA v3
    data?: string; // For Turnstile
}

export interface CaptchaSolution {
    token: string;
    cost?: number;
    solveTime?: number;
}

export interface BypassResult {
    success: boolean;
    method: 'captcha' | 'cloudflare' | 'proxy_rotation' | 'none';
    cost?: number;
    duration?: number;
    error?: string;
}

export interface BypassService {
    solveCaptcha(challenge: CaptchaChallenge): Promise<CaptchaSolution>;
    bypassCloudflare(url: string): Promise<BypassResult>;
    isAvailable(): Promise<boolean>;
    handlePageBlocks(page: any): Promise<BypassResult>;
    withRetry<T>(operation: () => Promise<T>, context?: string): Promise<T>;
}

export interface CaptchaProvider {
    solve(challenge: CaptchaChallenge): Promise<CaptchaSolution>;
    getBalance(): Promise<number>;
    reportBad(captchaId: string): Promise<boolean>;
}

export enum BypassError {
    CAPTCHA_UNSOLVABLE = 'CAPTCHA_UNSOLVABLE',
    CAPTCHA_TIMEOUT = 'CAPTCHA_TIMEOUT',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    CLOUDFLARE_BLOCKED = 'CLOUDFLARE_BLOCKED',
    PROXY_FAILED = 'PROXY_FAILED',
    SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
    INVALID_CHALLENGE = 'INVALID_CHALLENGE'
}

export class BypassException extends Error {
    constructor(
        public readonly code: BypassError,
        message: string,
        public readonly retryable: boolean = true
    ) {
        super(message);
        this.name = 'BypassException';
    }
}