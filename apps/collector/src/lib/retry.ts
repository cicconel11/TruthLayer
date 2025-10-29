import pRetry from 'p-retry';
import { Logger } from './logger';

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
  logger: Logger;
}

export interface CacheOptions {
  cacheDir: string;
  ttlMs: number;
  enabled: boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  retries: 3,
  factor: 2,
  minTimeout: 1000,  // 1 second
  maxTimeout: 60000, // 1 minute
  randomize: true
};

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
 * Wrapper for API calls with automatic retry logic
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  options: RetryOptions & { logger: Logger }
): Promise<T> {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const { retries, logger } = retryOptions;
  
  return await pRetry(
    async () => {
      try {
        return await apiCall();
      } catch (error) {
        // Log the retry attempt
        logger.error('API call failed, retrying', {
          error: error instanceof Error ? error.message : String(error),
          attempt: 'retrying'
        });
        
        // Re-throw to let p-retry handle the retry logic
        throw error;
      }
    },
    {
      retries,
      onFailedAttempt: async (error, attempt) => {
        if (shouldRetryHttpError(error as Error)) {
          logger.warn(`API attempt ${attempt} failed, will retry`, {
            error: error instanceof Error ? error.message : String(error),
            attempt: `${attempt}/${retries + 1}`
          });
        } else {
          logger.error(`API attempt ${attempt} failed with non-retryable error`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      },
      shouldRetry: (error) => shouldRetryHttpError(error as Error)
    }
  );
}

/**
 * Enhanced fetch with retry logic
 */
export async function retryableFetch(
  url: string,
  options: RequestInit,
  context: RetryableFetchOptions,
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const { engine, query, logger } = context;
  
  return await retryApiCall(
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
      ...retryOptions,
      logger
    }
  );
}

/**
 * Combined caching and retryable fetch
 */
export async function cachedAndRetryableFetch(
  url: string,
  options: RequestInit,
  context: RetryableFetchOptions,
  cacheKey?: string,
  cacheOptions?: CacheOptions
): Promise<Response> {
  // For now, just return the retryable fetch
  // Cache functionality can be added later
  return await retryableFetch(url, options, context); 
}
