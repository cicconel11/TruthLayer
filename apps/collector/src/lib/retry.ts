/**
 * Retry utilities with exponential backoff for transient failures.
 *
 * Handles network errors, rate limits, and temporary service issues
 * that are safe to retry with increasing delays.
 */

import pRetry from "p-retry";

export interface RetryOpts {
  /** Maximum number of retry attempts */
  retries: number;
  /** Base delay in milliseconds */
  baseMs: number;
  /** Maximum delay between attempts */
  maxMs: number;
  /** Optional jitter factor (0-1) */
  jitter?: number;
}

/**
 * Executes a function with retry logic and exponential backoff.
 *
 * @param fn - Function to execute
 * @param shouldRetry - Predicate to determine if error is retryable
 * @param opts - Retry configuration
 * @returns Promise resolving to function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: any) => boolean,
  opts: RetryOpts
): Promise<T> {
  let attempt = 0;
  let delay = opts.baseMs;

  for (;;) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;

      if (attempt > opts.retries || !shouldRetry(error)) {
        throw error;
      }

      // Add jitter to prevent thundering herd
      const jitter = opts.jitter ?? 0.1;
      const jitterMs = Math.floor(Math.random() * delay * jitter);
      const totalDelay = delay + jitterMs;

      await new Promise(resolve => setTimeout(resolve, totalDelay));

      // Exponential backoff with cap
      delay = Math.min(delay * 2, opts.maxMs);
    }
  }
}

/**
 * Determines if an error is transient and safe to retry.
 *
 * Retries for:
 * - Network timeouts (ETIMEDOUT, ECONNRESET)
 * - HTTP 408 (Request Timeout)
 * - HTTP 429 (Too Many Requests)
 * - HTTP 5xx (Server errors)
 * - Connection failures
 *
 * @param error - Error object to check
 * @returns true if error is retryable
 */
export function isTransient(error: any): boolean {
  // Network-level errors
  if (error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND') {
    return true;
  }

  // HTTP status codes
  const status = error?.status ?? error?.response?.status;
  if (status === 408 ||  // Request Timeout
      status === 429 ||  // Too Many Requests
      (status >= 500 && status < 600)) {  // Server errors
    return true;
  }

  return false;
}

/**
 * Creates a retry predicate for OpenAI-specific errors.
 *
 * @param error - Error to check
 * @returns true if OpenAI error is retryable
 */
export function isOpenAIRetryable(error: any): boolean {
  // Always check for transient errors first
  if (isTransient(error)) {
    return true;
  }

  // OpenAI-specific retryable errors
  const code = error?.code ?? error?.error?.code;
  if (code === 'rate_limit_exceeded' ||
      code === 'timeout' ||
      code === 'server_error') {
    return true;
  }

  return false;
}

// Legacy compatibility functions for existing collector code

export interface RetryOptions {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
  randomize?: boolean;
}

export interface RetryableFetchOptions {
  engine: string;
  query: string;
  logger: any; // Logger type
}

export interface CacheOptions {
  cacheDir: string;
  ttlMs: number;
  enabled: boolean;
}

/**
 * Determines whether a HTTP request should be retried
 */
export function shouldRetryHttpError(error: Error): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Don't retry for authentication errors, bad requests, or not found
    if (message.includes('status 401') || message.includes('status 403') || 
        message.includes('status 400') || message.includes('status 404')) {
      return false;
    }
    
    // Retry for rate limiting and server errors
    if (message.includes('status 429') || message.includes('status 5xx')) {
      return true;
    }
    
    // Retry for network errors
    if (message.includes('network') || message.includes('timeout') || 
        message.includes('fetch') || message.includes('connection')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Combined caching and retryable fetch (legacy compatibility)
 */
export async function cachedAndRetryableFetch(
  url: string,
  options: RequestInit,
  context: RetryableFetchOptions,
  cacheKey?: string,
  cacheOptions?: CacheOptions
): Promise<Response> {
  const { engine, query, logger } = context;
  
  return await pRetry(
    async () => {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        throw error;
      }
      
      return response;
    },
    {
      retries: 3,
      onFailedAttempt: async (failedAttemptError) => {
        const error = failedAttemptError as Error;
        if (shouldRetryHttpError(error)) {
          logger?.warn?.(`API attempt ${failedAttemptError.attemptNumber} failed, will retry`, {
            error: error.message || String(failedAttemptError),
            attempt: `${failedAttemptError.attemptNumber}/4`,
            engine,
            query
          });
        } else {
          // Stop retrying for non-retryable errors
          throw failedAttemptError;
        }
      }
    }
  );
}