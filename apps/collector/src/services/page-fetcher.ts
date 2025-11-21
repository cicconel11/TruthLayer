import { createHash } from "node:crypto";
import PQueue from "p-queue";
import { Logger } from "../lib/logger";
import { upsertPageAndSnapshot } from "@truthlayer/core";

export interface FetchPagesOptions {
  /** Maximum number of concurrent page fetches */
  concurrency?: number;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Logger instance for error reporting */
  logger?: Logger;
  /** Maximum number of retries for transient errors */
  maxRetries?: number;
}

/**
 * Determines if an error is retryable (transient).
 * Retries on 5xx errors, timeouts, and network errors.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Timeout errors
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      return true;
    }
    // Network errors
    if (error.message.includes("ECONNRESET") || 
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ETIMEDOUT")) {
      return true;
    }
  }
  return false;
}

/**
 * Calculates exponential backoff delay with jitter.
 */
function calculateBackoff(attempt: number, baseMs: number = 1000): number {
  const exponentialDelay = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Fetches page content for a list of URLs and creates snapshots in Supabase.
 * Uses PQueue for concurrency control and includes error handling to prevent
 * single failures from crashing the entire operation.
 *
 * @param urls - Array of unique URLs to fetch
 * @param options - Fetch options including concurrency and timeout
 */
export async function fetchPagesAndCreateSnapshots(
  urls: string[],
  options: FetchPagesOptions = {}
): Promise<{ successCount: number; failureCount: number }> {
  const {
    concurrency = 5,
    timeoutMs = 30000,
    logger,
    maxRetries = 3
  } = options;

  const queue = new PQueue({ concurrency });
  const uniqueUrls = Array.from(new Set(urls));

  logger?.info("page fetching started", {
    totalUrls: uniqueUrls.length,
    concurrency,
    maxRetries
  });

  let successCount = 0;
  let failureCount = 0;

  for (const url of uniqueUrls) {
    queue.add(async () => {
      let lastError: unknown;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Create AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const response = await fetch(url, {
              method: "GET",
              redirect: "follow",
              signal: controller.signal,
              headers: {
                "User-Agent": "TruthLayerBot/0.1 (https://truthlayer.ai)"
              }
            });

            clearTimeout(timeoutId);

            // Check for 5xx errors (retryable)
            if (response.status >= 500 && response.status < 600 && attempt < maxRetries) {
              const backoffMs = calculateBackoff(attempt);
              logger?.warn("page fetch retryable error", {
                url,
                status: response.status,
                attempt: attempt + 1,
                maxRetries,
                retryingInMs: backoffMs
              });
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }

            const contentText = await response.text();
            const contentHash = createHash("sha256")
              .update(contentText)
              .digest("hex");

            await upsertPageAndSnapshot({
              url,
              httpStatus: response.status,
              contentText,
              contentHash
            });

            successCount++;
            if (attempt > 0) {
              logger?.info("page snapshot created after retry", {
                url,
                status: response.status,
                attempts: attempt + 1
              });
            } else {
              logger?.debug("page snapshot created", { url, status: response.status });
            }
            return; // Success, exit retry loop
          } catch (fetchError) {
            clearTimeout(timeoutId);
            lastError = fetchError;
            
            // Check if retryable and not last attempt
            if (isRetryableError(fetchError) && attempt < maxRetries) {
              const backoffMs = calculateBackoff(attempt);
              logger?.warn("page fetch retryable error", {
                url,
                error: fetchError instanceof Error ? fetchError.message : String(fetchError),
                attempt: attempt + 1,
                maxRetries,
                retryingInMs: backoffMs
              });
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            
            // Not retryable or last attempt, break and fail
            throw fetchError;
          }
        } catch (error) {
          lastError = error;
          // If this is the last attempt, break and record failure
          if (attempt >= maxRetries) {
            break;
          }
        }
      }

      // All retries exhausted, record failure
      failureCount++;
      const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
      logger?.warn("page fetch failed after retries", {
        url,
        error: errorMessage,
        attempts: maxRetries + 1
      });
    });
  }

  // Wait for all queued tasks to complete
  await queue.onIdle();

  logger?.info("page fetching completed", {
    totalUrls: uniqueUrls.length,
    successCount,
    failureCount
  });

  return { successCount, failureCount };
}

