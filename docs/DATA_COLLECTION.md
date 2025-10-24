# Data Collection Methods

## Overview

This document provides comprehensive details on TruthLayer's data collection methodology, including technical implementation, anti-detection measures, quality controls, and ethical considerations.

## Search Engine Integration

### Supported Platforms

#### Google Search
- **Endpoint**: `https://www.google.com/search`
- **Parameters**: `q={query}&num=20&hl=en&gl=US`
- **Result Parsing**: CSS selectors for organic results
- **Rate Limiting**: 2-8 second delays between requests
- **Anti-Detection**: User-agent rotation, proxy cycling

**Implementation Details**:
```typescript
class GoogleScraper extends BaseScraper {
  protected async parseResults(page: Page): Promise<SearchResult[]> {
    return await page.evaluate(() => {
      const results: SearchResult[] = [];
      const resultElements = document.querySelectorAll('[data-ved] h3');
      
      resultElements.forEach((element, index) => {
        const titleElement = element as HTMLElement;
        const linkElement = titleElement.closest('a') as HTMLAnchorElement;
        const snippetElement = linkElement?.parentElement?.querySelector('[data-sncf]');
        
        if (titleElement && linkElement) {
          results.push({
            rank: index + 1,
            title: titleElement.textContent?.trim() || '',
            url: linkElement.href,
            snippet: snippetElement?.textContent?.trim() || ''
          });
        }
      });
      
      return results;
    });
  }
}
```

#### Bing Search
- **Endpoint**: `https://www.bing.com/search`
- **Parameters**: `q={query}&count=20&mkt=en-US`
- **Result Parsing**: Bing-specific DOM structure
- **Unique Features**: Rich snippets, knowledge panels

**Implementation Details**:
```typescript
class BingScraper extends BaseScraper {
  protected async parseResults(page: Page): Promise<SearchResult[]> {
    return await page.evaluate(() => {
      const results: SearchResult[] = [];
      const resultElements = document.querySelectorAll('.b_algo');
      
      resultElements.forEach((element, index) => {
        const titleElement = element.querySelector('h2 a');
        const snippetElement = element.querySelector('.b_caption p');
        
        if (titleElement && snippetElement) {
          results.push({
            rank: index + 1,
            title: titleElement.textContent?.trim() || '',
            url: (titleElement as HTMLAnchorElement).href,
            snippet: snippetElement.textContent?.trim() || ''
          });
        }
      });
      
      return results;
    });
  }
}
```

#### Perplexity AI
- **Endpoint**: `https://www.perplexity.ai/search`
- **Method**: Interactive search with AI responses
- **Unique Features**: AI-generated summaries, source citations
- **Parsing**: Extract both AI response and source links

**Implementation Details**:
```typescript
class PerplexityScraper extends BaseScraper {
  protected async performSearch(query: string): Promise<void> {
    await this.page.goto('https://www.perplexity.ai');
    await this.page.waitForSelector('textarea[placeholder*="Ask anything"]');
    
    await this.page.type('textarea[placeholder*="Ask anything"]', query);
    await this.page.keyboard.press('Enter');
    
    // Wait for AI response and sources to load
    await this.page.waitForSelector('[data-testid="sources"]', { timeout: 30000 });
    await this.page.waitForTimeout(5000); // Allow full response generation
  }
  
  protected async parseResults(page: Page): Promise<SearchResult[]> {
    return await page.evaluate(() => {
      const results: SearchResult[] = [];
      const sourceElements = document.querySelectorAll('[data-testid="sources"] a');
      
      sourceElements.forEach((element, index) => {
        const linkElement = element as HTMLAnchorElement;
        const titleElement = linkElement.querySelector('[data-testid="source-title"]');
        
        if (titleElement && linkElement.href) {
          results.push({
            rank: index + 1,
            title: titleElement.textContent?.trim() || '',
            url: linkElement.href,
            snippet: '' // Perplexity doesn't provide traditional snippets
          });
        }
      });
      
      return results;
    });
  }
}
```

#### Brave Search
- **Endpoint**: `https://search.brave.com/search`
- **Parameters**: `q={query}&source=web`
- **Unique Features**: Independent index, privacy-focused
- **Result Parsing**: Standard web result structure

## Anti-Detection Infrastructure

### Proxy Management

#### Residential Proxy Pool
```typescript
interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  country?: string;
  isActive: boolean;
  lastUsed: Date;
  failureCount: number;
}

class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;
  
  async getNextProxy(): Promise<ProxyConfig> {
    // Health check and rotation logic
    const availableProxies = this.proxies.filter(p => 
      p.isActive && p.failureCount < 3
    );
    
    if (availableProxies.length === 0) {
      await this.refreshProxyPool();
    }
    
    const proxy = availableProxies[this.currentIndex % availableProxies.length];
    this.currentIndex++;
    
    return proxy;
  }
  
  async testProxy(proxy: ProxyConfig): Promise<boolean> {
    try {
      const response = await fetch('https://httpbin.org/ip', {
        method: 'GET',
        timeout: 10000,
        agent: new HttpsProxyAgent(`http://${proxy.host}:${proxy.port}`)
      });
      
      return response.ok;
    } catch (error) {
      proxy.failureCount++;
      return false;
    }
  }
}
```

### Browser Fingerprinting

#### Realistic User Agent Rotation
```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

class BrowserManager {
  async createBrowserInstance(): Promise<Browser> {
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        `--user-agent=${userAgent}`
      ]
    });
    
    return browser;
  }
  
  async configurePage(page: Page): Promise<void> {
    // Set realistic viewport
    await page.setViewport({
      width: 1366 + Math.floor(Math.random() * 200),
      height: 768 + Math.floor(Math.random() * 200)
    });
    
    // Override webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // Set realistic headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
  }
}
```

### CAPTCHA and Cloudflare Bypass

#### CAPTCHA Solving Integration
```typescript
interface CaptchaSolver {
  solveCaptcha(imageData: Buffer, type: 'recaptcha' | 'hcaptcha'): Promise<string>;
}

class TwoCaptchaSolver implements CaptchaSolver {
  constructor(private apiKey: string) {}
  
  async solveCaptcha(imageData: Buffer, type: 'recaptcha' | 'hcaptcha'): Promise<string> {
    // Submit captcha to 2captcha service
    const submitResponse = await fetch('http://2captcha.com/in.php', {
      method: 'POST',
      body: new FormData({
        key: this.apiKey,
        method: type === 'recaptcha' ? 'userrecaptcha' : 'hcaptcha',
        file: imageData
      })
    });
    
    const captchaId = await submitResponse.text();
    
    // Poll for solution
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const resultResponse = await fetch(
        `http://2captcha.com/res.php?key=${this.apiKey}&action=get&id=${captchaId}`
      );
      
      const result = await resultResponse.text();
      
      if (result.startsWith('OK|')) {
        return result.substring(3);
      }
      
      attempts++;
    }
    
    throw new Error('CAPTCHA solving timeout');
  }
}
```

#### Cloudflare Bypass
```typescript
class CloudflareBypass {
  async bypassChallenge(page: Page): Promise<boolean> {
    try {
      // Wait for Cloudflare challenge page
      await page.waitForSelector('#cf-challenge-running', { timeout: 5000 });
      
      // Wait for challenge to complete automatically
      await page.waitForSelector('#cf-challenge-running', { 
        hidden: true, 
        timeout: 30000 
      });
      
      // Verify bypass success
      const currentUrl = page.url();
      return !currentUrl.includes('cf-browser-verification');
      
    } catch (error) {
      // Challenge not present or already bypassed
      return true;
    }
  }
  
  async handleTurnstile(page: Page): Promise<boolean> {
    try {
      const turnstileFrame = await page.waitForSelector(
        'iframe[src*="turnstile"]', 
        { timeout: 5000 }
      );
      
      if (turnstileFrame) {
        // Use CAPTCHA solving service for Turnstile
        const solver = new TwoCaptchaSolver(process.env.CAPTCHA_API_KEY!);
        const solution = await solver.solveCaptcha(
          await page.screenshot(), 
          'hcaptcha'
        );
        
        // Submit solution
        await page.evaluate((token) => {
          window.turnstile?.render('#turnstile-widget', {
            callback: (token: string) => {
              document.querySelector('input[name="cf-turnstile-response"]')?.setAttribute('value', token);
            }
          });
        }, solution);
        
        return true;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

## Request Management

### Rate Limiting and Delays

#### Adaptive Delay Strategy
```typescript
class RequestThrottler {
  private lastRequestTime = 0;
  private consecutiveFailures = 0;
  
  async waitBeforeRequest(): Promise<void> {
    const baseDelay = 2000; // 2 seconds minimum
    const maxDelay = 8000;  // 8 seconds maximum
    const jitter = Math.random() * 1000; // Random jitter up to 1 second
    
    // Increase delay based on consecutive failures
    const failureMultiplier = Math.min(this.consecutiveFailures * 0.5, 3);
    
    const delay = Math.min(
      baseDelay + (baseDelay * failureMultiplier) + jitter,
      maxDelay
    );
    
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    const remainingDelay = Math.max(0, delay - timeSinceLastRequest);
    
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }
  
  recordFailure(): void {
    this.consecutiveFailures++;
  }
}
```

### Error Handling and Recovery

#### Retry Logic with Exponential Backoff
```typescript
class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Log retry attempt
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      }
    }
    
    throw lastError!;
  }
}
```

## Data Quality Controls

### Result Validation

#### Schema Validation
```typescript
function validateSearchResult(result: any): ValidationResult {
  const errors: string[] = [];
  
  // Required fields
  if (!result.title || typeof result.title !== 'string') {
    errors.push('Title is required and must be a string');
  }
  
  if (!result.url || typeof result.url !== 'string') {
    errors.push('URL is required and must be a string');
  }
  
  if (!isValidUrl(result.url)) {
    errors.push('URL must be a valid HTTP/HTTPS URL');
  }
  
  if (typeof result.rank !== 'number' || result.rank < 1 || result.rank > 20) {
    errors.push('Rank must be a number between 1 and 20');
  }
  
  // Optional but validated if present
  if (result.snippet && typeof result.snippet !== 'string') {
    errors.push('Snippet must be a string if provided');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

#### Content Deduplication
```typescript
class ContentDeduplicator {
  private seenHashes = new Set<string>();
  
  generateContentHash(result: SearchResult): string {
    const content = `${result.title}|${result.url}|${result.snippet}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  isDuplicate(result: SearchResult): boolean {
    const hash = this.generateContentHash(result);
    
    if (this.seenHashes.has(hash)) {
      return true;
    }
    
    this.seenHashes.add(hash);
    return false;
  }
  
  reset(): void {
    this.seenHashes.clear();
  }
}
```

### Collection Monitoring

#### Success Rate Tracking
```typescript
class CollectionMonitor {
  private stats = {
    totalAttempts: 0,
    successfulCollections: 0,
    failedCollections: 0,
    captchaEncounters: 0,
    proxyFailures: 0
  };
  
  recordAttempt(): void {
    this.stats.totalAttempts++;
  }
  
  recordSuccess(): void {
    this.stats.successfulCollections++;
  }
  
  recordFailure(reason: 'captcha' | 'proxy' | 'parsing' | 'network'): void {
    this.stats.failedCollections++;
    
    switch (reason) {
      case 'captcha':
        this.stats.captchaEncounters++;
        break;
      case 'proxy':
        this.stats.proxyFailures++;
        break;
    }
  }
  
  getSuccessRate(): number {
    return this.stats.totalAttempts > 0 
      ? this.stats.successfulCollections / this.stats.totalAttempts 
      : 0;
  }
  
  shouldAlert(): boolean {
    return this.getSuccessRate() < 0.9 && this.stats.totalAttempts >= 10;
  }
}
```

## Ethical Considerations

### Respectful Scraping Practices

#### Robots.txt Compliance
```typescript
class RobotsChecker {
  private robotsCache = new Map<string, RobotsDirectives>();
  
  async checkRobots(url: string, userAgent: string = '*'): Promise<boolean> {
    const domain = new URL(url).origin;
    
    if (!this.robotsCache.has(domain)) {
      try {
        const robotsResponse = await fetch(`${domain}/robots.txt`);
        const robotsText = await robotsResponse.text();
        this.robotsCache.set(domain, this.parseRobots(robotsText));
      } catch (error) {
        // If robots.txt is not accessible, assume scraping is allowed
        return true;
      }
    }
    
    const directives = this.robotsCache.get(domain)!;
    return this.isAllowed(directives, url, userAgent);
  }
  
  private parseRobots(robotsText: string): RobotsDirectives {
    // Parse robots.txt format
    // Implementation details...
  }
}
```

#### Rate Limiting Compliance
- **Minimum Delays**: 2-second minimum between requests
- **Respectful Patterns**: Avoid overwhelming servers
- **Peak Hour Avoidance**: Reduce collection during high-traffic periods
- **Graceful Degradation**: Back off when encountering rate limits

### Data Privacy

#### Personal Information Handling
- **No PII Collection**: Avoid collecting personal information from results
- **URL Sanitization**: Remove tracking parameters and personal identifiers
- **Content Filtering**: Exclude results containing personal data

#### Compliance Framework
- **GDPR Compliance**: Right to erasure and data portability
- **CCPA Compliance**: California privacy rights
- **Data Retention**: 2-year maximum retention for raw data
- **Anonymization**: Remove identifying information from logs

## Performance Optimization

### Concurrent Collection

#### Parallel Engine Processing
```typescript
class ConcurrentCollector {
  private maxConcurrency = 4; // Limit concurrent requests
  
  async collectFromAllEngines(query: string): Promise<Map<string, SearchResult[]>> {
    const engines = ['google', 'bing', 'perplexity', 'brave'];
    const results = new Map<string, SearchResult[]>();
    
    // Process engines in parallel with concurrency limit
    const semaphore = new Semaphore(this.maxConcurrency);
    
    const promises = engines.map(async (engine) => {
      await semaphore.acquire();
      
      try {
        const scraper = this.createScraper(engine);
        const engineResults = await scraper.search(query);
        results.set(engine, engineResults);
      } finally {
        semaphore.release();
      }
    });
    
    await Promise.all(promises);
    return results;
  }
}
```

### Resource Management

#### Memory Optimization
- **Browser Instance Pooling**: Reuse browser instances
- **Page Cleanup**: Close pages after use
- **Memory Monitoring**: Track and limit memory usage
- **Garbage Collection**: Force GC after large operations

#### Storage Optimization
- **Batch Inserts**: Group database operations
- **Connection Pooling**: Reuse database connections
- **Compression**: Compress raw HTML storage
- **Partitioning**: Partition large tables by date

This comprehensive data collection methodology ensures reliable, ethical, and scalable gathering of search engine data while maintaining high quality standards and respecting platform policies.