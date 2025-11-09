import { Logger } from "../lib/logger";
import { LLMAnnotationInput, LLMAnnotationResult, LLMClient } from "./llm-client";

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 32000,
  backoffMultiplier: 2
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  const err = error as any;
  
  // OpenAI SDK error structure
  if (err.status) {
    const status = Number(err.status);
    // Retry on rate limits and server errors
    return status === 429 || (status >= 500 && status < 600);
  }
  
  // Network errors
  if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND") {
    return true;
  }
  
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  logger: Logger,
  context: { queryId: string; url: string }
): Promise<T> {
  let lastError: unknown;
  let delayMs = config.initialDelayMs;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === config.maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      // Add jitter (±25%)
      const jitter = delayMs * (0.75 + Math.random() * 0.5);
      
      logger.warn("Annotation attempt failed, retrying...", {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delayMs: Math.round(jitter),
        queryId: context.queryId,
        url: context.url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      await delay(jitter);
      
      delayMs = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs);
    }
  }
  
  throw lastError;
}

export interface BatchAnnotationOptions {
  batchSize?: number;
  maxConcurrency?: number;
  retryConfig?: Partial<RetryConfig>;
}

export async function annotateBatch(
  client: LLMClient,
  inputs: LLMAnnotationInput[],
  logger: Logger,
  options: BatchAnnotationOptions = {}
): Promise<LLMAnnotationResult[]> {
  const {
    batchSize = 20,
    maxConcurrency = 3,
    retryConfig: partialRetryConfig = {}
  } = options;
  
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...partialRetryConfig
  };
  
  logger.info("Starting batch annotation", {
    totalInputs: inputs.length,
    batchSize,
    maxConcurrency,
    provider: client.provider
  });
  
  const results: LLMAnnotationResult[] = [];
  const chunks: LLMAnnotationInput[][] = [];
  
  // Split into chunks
  for (let i = 0; i < inputs.length; i += batchSize) {
    chunks.push(inputs.slice(i, i + batchSize));
  }
  
  // Process chunks with concurrency control
  let activePromises = 0;
  let chunkIndex = 0;
  const errors: Array<{ input: LLMAnnotationInput; error: unknown }> = [];
  
  const processChunk = async (chunk: LLMAnnotationInput[]) => {
    for (const input of chunk) {
      try {
        const result = await withRetry(
          () => client.annotate(input),
          retryConfig,
          logger,
          { queryId: input.queryId, url: input.url }
        );
        results.push(result);
      } catch (error) {
        logger.error("Annotation failed after all retries", {
          queryId: input.queryId,
          url: input.url,
          error: error instanceof Error ? error.message : String(error)
        });
        errors.push({ input, error });
        
        // Use default/heuristic result as fallback
        const fallbackResult = await client.annotate(input);
        results.push(fallbackResult);
      }
    }
  };
  
  // Process all chunks with concurrency control
  await new Promise<void>((resolve, reject) => {
    const tryProcessNext = () => {
      while (activePromises < maxConcurrency && chunkIndex < chunks.length) {
        const chunk = chunks[chunkIndex++];
        activePromises++;
        
        processChunk(chunk)
          .then(() => {
            activePromises--;
            
            if (chunkIndex >= chunks.length && activePromises === 0) {
              resolve();
            } else {
              tryProcessNext();
            }
          })
          .catch((error) => {
            reject(error);
          });
      }
      
      if (chunkIndex >= chunks.length && activePromises === 0) {
        resolve();
      }
    };
    
    tryProcessNext();
  });
  
  logger.info("Batch annotation completed", {
    totalProcessed: results.length,
    totalErrors: errors.length,
    successRate: `${Math.round((results.length / inputs.length) * 100)}%`
  });
  
  if (errors.length > 0) {
    logger.warn("Some annotations failed", {
      failedCount: errors.length,
      sampleErrors: errors.slice(0, 3).map(({ input, error }) => ({
        queryId: input.queryId,
        url: input.url,
        error: error instanceof Error ? error.message : String(error)
      }))
    });
  }
  
  return results;
}
