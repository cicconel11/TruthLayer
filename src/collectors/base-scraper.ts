import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import { SearchResult, RawSearchResult } from '../types/search-result';
import { ProxyConfig, ScrapingConfig } from '../types/config';
import { getConfig } from '../utils/config-loader';
import { createHash } from 'crypto';
import { BypassServiceImpl } from '../services/bypass-service';
import { BypassService } from '../types/bypass';
import { logger } from '../utils/logger';

/**
 * Proxy rotation manager for handling proxy pools
 */
class ProxyRotator {
    private proxies: ProxyConfig[] = [];
    private currentIndex = 0;
    private failedProxies = new Set<string>();

    constructor(proxies: ProxyConfig[] = []) {
        this.proxies = proxies;
    }

    /**
     * Get next available proxy
     */
    getNextProxy(): ProxyConfig | null {
        if (this.proxies.length === 0) return null;

        const availableProxies = this.proxies.filter(
            proxy => !this.failedProxies.has(this.getProxyKey(proxy))
        );

        if (availableProxies.length === 0) {
            // Reset failed proxies if all are marked as failed
            this.failedProxies.clear();
            return this.proxies[0];
        }

        const proxy = availableProxies[this.currentIndex % availableProxies.length];
        this.currentIndex = (this.currentIndex + 1) % availableProxies.length;
        return proxy;
    }

    /**
     * Mark proxy as failed
     */
    markProxyFailed(proxy: ProxyConfig): void {
        this.failedProxies.add(this.getProxyKey(proxy));
    }

    /**
     * Reset failed proxy status
     */
    resetProxy(proxy: ProxyConfig): void {
        this.failedProxies.delete(this.getProxyKey(proxy));
    }

    private getProxyKey(proxy: ProxyConfig): string {
        return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    }
}

/**
 * Request throttling manager
 */
class RequestThrottler {
    private lastRequestTime = 0;
    private requestCount = 0;
    private windowStart = Date.now();
    private readonly windowSize = 60000; // 1 minute window
    private readonly maxRequestsPerWindow = 30;

    /**
     * Wait for appropriate delay before next request
     */
    async throttle(minDelay: number, maxDelay: number): Promise<void> {
        const now = Date.now();

        // Reset window if needed
        if (now - this.windowStart > this.windowSize) {
            this.windowStart = now;
            this.requestCount = 0;
        }

        // Check rate limit
        if (this.requestCount >= this.maxRequestsPerWindow) {
            const waitTime = this.windowSize - (now - this.windowStart);
            if (waitTime > 0) {
                await this.sleep(waitTime);
                this.windowStart = Date.now();
                this.requestCount = 0;
            }
        }

        // Apply random delay
        const timeSinceLastRequest = now - this.lastRequestTime;
        const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

        if (timeSinceLastRequest < randomDelay) {
            await this.sleep(randomDelay - timeSinceLastRequest);
        }

        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Abstract base class for search engine scrapers with advanced anti-detection features
 */
export abstract class BaseScraper {
    protected abstract engineName: string;
    protected config: ScrapingConfig;
    protected proxyRotator: ProxyRotator;
    protected throttler: RequestThrottler;
    protected bypassService: BypassService;
    protected browser: Browser | null = null;

    constructor() {
        const appConfig = getConfig();
        this.config = appConfig.scraping;
        this.proxyRotator = new ProxyRotator(this.config.proxies);
        this.throttler = new RequestThrottler();
        this.bypassService = new BypassServiceImpl(appConfig.bypass);
    }

    /**
     * Scrape search results for a given query
     */
    abstract scrapeResults(query: string, maxResults?: number): Promise<SearchResult[]>;

    /**
     * Normalize raw search result to standard format
     */
    protected abstract normalizeResult(rawResult: RawSearchResult, query: string, rank: number): SearchResult;

    /**
     * Initialize browser with anti-detection measures
     */
    protected async initializeBrowser(useProxy: boolean = true): Promise<Browser> {
        if (this.browser) {
            return this.browser;
        }

        const launchOptions: PuppeteerLaunchOptions = {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--window-size=1920,1080'
            ]
        };

        // Add proxy if available and requested
        if (useProxy) {
            const proxy = this.proxyRotator.getNextProxy();
            if (proxy) {
                launchOptions.args!.push(`--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}`);
            }
        }

        this.browser = await puppeteer.launch(launchOptions);
        return this.browser;
    }

    /**
     * Create a new page with realistic browser fingerprinting
     */
    protected async createStealthPage(): Promise<Page> {
        const browser = await this.initializeBrowser();
        const page = await browser.newPage();

        // Set realistic viewport
        await page.setViewport({
            width: 1920 + Math.floor(Math.random() * 100),
            height: 1080 + Math.floor(Math.random() * 100),
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false,
        });

        // Set random user agent
        const userAgent = this.getRandomUserAgent();
        await page.setUserAgent(userAgent);

        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        });

        // Override navigator properties to appear more human-like
        await page.evaluateOnNewDocument(() => {
            // Override the `plugins` property to use a custom getter
            Object.defineProperty((globalThis as any).navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5].map(() => 'Plugin'),
            });

            // Override the `languages` property to use a custom getter
            Object.defineProperty((globalThis as any).navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Override the `webdriver` property to remove automation detection
            Object.defineProperty((globalThis as any).navigator, 'webdriver', {
                get: () => false,
            });

            // Mock chrome object
            (globalThis as any).chrome = {
                runtime: {},
                loadTimes: function () { },
                csi: function () { },
                app: {}
            };

            // Mock permissions if available
            const nav = (globalThis as any).navigator;
            if (nav.permissions && nav.permissions.query) {
                const originalQuery = nav.permissions.query;
                nav.permissions.query = (parameters: any) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: 'default' }) :
                        originalQuery(parameters)
                );
            }
        });

        return page;
    }

    /**
     * Perform request with throttling and retry logic
     */
    protected async performRequest<T>(
        requestFn: () => Promise<T>
    ): Promise<T> {
        return await this.bypassService.withRetry(async () => {
            // Apply throttling
            await this.throttler.throttle(
                this.config.delays.min,
                this.config.delays.max
            );

            return await requestFn();
        }, `${this.engineName} request`);
    }

    /**
     * Get random delay between requests
     */
    protected getRandomDelay(min: number = 2000, max: number = 8000): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Sleep for specified milliseconds
     */
    protected async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get random user agent with realistic browser fingerprinting
     */
    protected getRandomUserAgent(): string {
        const userAgents = [
            // Chrome on macOS
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',

            // Chrome on Windows
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',

            // Chrome on Linux
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

            // Firefox variants
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',

            // Safari variants
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
        ];

        return userAgents[Math.floor(Math.random() * userAgents.length)];
    }

    /**
     * Generate content hash for duplicate detection
     */
    protected generateContentHash(content: string): string {
        return createHash('sha256').update(content).digest('hex');
    }

    /**
     * Clean up browser resources
     */
    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Check if page is blocked or showing CAPTCHA
     */
    protected async isPageBlocked(page: Page): Promise<boolean> {
        const content = await page.content();
        const blockedIndicators = [
            'captcha',
            'blocked',
            'unusual traffic',
            'verify you are human',
            'robot',
            'automated queries',
            'suspicious activity'
        ];

        return blockedIndicators.some(indicator =>
            content.toLowerCase().includes(indicator)
        );
    }

    /**
     * Handle page blocks using bypass service
     */
    protected async handlePageBlocks(page: Page): Promise<boolean> {
        try {
            const result = await this.bypassService.handlePageBlocks(page);

            if (result.success) {
                logger.info('Successfully bypassed page block', {
                    engine: this.engineName,
                    method: result.method,
                    duration: result.duration,
                    cost: result.cost
                });
                return true;
            } else {
                logger.warn('Failed to bypass page block', {
                    engine: this.engineName,
                    method: result.method,
                    error: result.error,
                    duration: result.duration
                });
                return false;
            }
        } catch (error: any) {
            logger.error('Error handling page blocks', {
                engine: this.engineName,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Wait for page to load with realistic human-like behavior
     */
    protected async waitForPageLoad(page: Page, timeout: number = 30000): Promise<void> {
        try {
            await page.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout
            });
        } catch (error) {
            // Navigation might already be complete, continue
        }

        // Add small random delay to simulate human reading time
        await this.sleep(Math.random() * 2000 + 1000);
    }
}