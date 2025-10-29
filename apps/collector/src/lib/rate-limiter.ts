/**
 * Token Bucket Rate Limiter
 * 
 * Implements a token bucket algorithm for rate limiting with configurable
 * requests per second and burst capacity. Useful for respecting API rate limits.
 * 
 * @see https://en.wikipedia.org/wiki/Token_bucket
 */

export interface RateLimiterConfig {
  /** Maximum requests per second */
  maxRequestsPerSecond: number;
  /** Maximum burst size (defaults to maxRequestsPerSecond) */
  maxBurst?: number;
}

export interface RateLimiterStats {
  rateLimitHits: number;
  totalRequests: number;
  averageWaitMs: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly config: RateLimiterConfig;
  private rateLimitHits: number = 0;
  private totalRequests: number = 0;
  private totalWaitMs: number = 0;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequestsPerSecond: config.maxRequestsPerSecond,
      maxBurst: config.maxBurst ?? config.maxRequestsPerSecond
    };
    this.tokens = this.config.maxBurst!;
    this.lastRefill = Date.now();
  }

  /**
   * Wait for a token to become available, then consume it.
   * Implements token bucket with jitter for fairness.
   */
  async waitForToken(): Promise<void> {
    this.totalRequests++;
    const startWait = Date.now();
    
    while (true) {
      this.refillTokens();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        const waitedMs = Date.now() - startWait;
        this.totalWaitMs += waitedMs;
        
        if (waitedMs > 10) {
          this.rateLimitHits++;
        }
        
        return;
      }

      // Calculate wait time until next token
      const tokensPerMs = this.config.maxRequestsPerSecond / 1000;
      const msUntilToken = (1 - this.tokens) / tokensPerMs;
      
      // Add small jitter (0-10ms) to prevent thundering herd
      const jitter = Math.random() * 10;
      const waitMs = Math.max(10, msUntilToken + jitter);
      
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  /**
   * Refill tokens based on time elapsed since last refill
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    
    if (elapsedMs > 0) {
      const tokensToAdd = (elapsedMs / 1000) * this.config.maxRequestsPerSecond;
      this.tokens = Math.min(this.config.maxBurst!, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Get statistics about rate limiting behavior
   */
  getStats(): RateLimiterStats {
    return {
      rateLimitHits: this.rateLimitHits,
      totalRequests: this.totalRequests,
      averageWaitMs: this.totalRequests > 0 ? this.totalWaitMs / this.totalRequests : 0
    };
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.rateLimitHits = 0;
    this.totalRequests = 0;
    this.totalWaitMs = 0;
  }
}

