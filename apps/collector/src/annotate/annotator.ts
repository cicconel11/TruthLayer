/**
 * Main annotation orchestrator for TruthLayer.
 *
 * Handles URL validation, content chunking, LLM annotation with retries,
 * error tracking, and heuristic fallbacks.
 */

import { normalizeUrl, isValidForAnnotation, extractDomain } from "./url-utils";
import { chunkText, reduceChunkAnnotations, shouldChunk } from "./chunking";
import { annotateWithOpenAI, extractErrorInfo, validateOpenAIConfig } from "../lib/openai-client";
import { heuristicAnnotate } from "./heuristic";
import { createStorageClient } from "@truthlayer/storage";
import { createLogger } from "../lib/logger";
import { getMetrics } from "../lib/metrics";

// Types for annotation results
export interface AnnotationResult {
  domainType: string;
  factualConsistency: string;
  confidence: number;
  reasoning?: string;
  provider: string;
  modelId: string;
  sources?: string[];
  chunk_count?: number;
  merged?: boolean;
}

export interface AnnotationOptions {
  maxChars?: number;
  enableChunking?: boolean;
  enableFallback?: boolean;
}

/**
 * Builds a structured prompt for LLM annotation.
 *
 * @param domain - Domain name
 * @param title - Page title
 * @param snippet - Content snippet
 * @param content - Full page content (chunked if needed)
 * @returns Formatted prompt string
 */
function buildAnnotationPrompt(
  domain: string,
  title: string,
  snippet: string,
  content: string
): string {
  return `Analyze this search result and classify it according to the following criteria:

Domain: ${domain}
Title: ${title}
Snippet: ${snippet}

Content: ${content}

Return a JSON object with:
- domain_type: One of "news", "government", "academic", "blog", "other"
- factual_consistency: One of "aligned", "contradicted", "unclear", "not_applicable"
- confidence: Number between 0 and 1
- reasoning: Brief explanation of your classification

Respond with valid JSON only.`;
}

/**
 * Parses LLM response into structured annotation result.
 *
 * @param llmResponse - Raw LLM response text
 * @returns Parsed annotation result
 */
function parseLLMResponse(llmResponse: string): AnnotationResult {
  try {
    // Extract JSON from response
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in LLM response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      domainType: parsed.domain_type || 'other',
      factualConsistency: parsed.factual_consistency || 'unclear',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning || 'LLM classification',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      sources: []
    };
  } catch (error) {
    throw new Error(`Failed to parse LLM response: ${error}`);
  }
}

/**
 * Annotates a single page using LLM with full error handling and fallbacks.
 *
 * @param pageData - Page content and metadata
 * @param options - Annotation options
 * @returns Annotation result
 */
export async function annotatePage(
  pageData: {
    queryId: string;
    url: string;
    title: string;
    snippet?: string;
    pageText: string;
    engine: string;
  },
  options: AnnotationOptions = {}
): Promise<AnnotationResult> {
  const logger = createLogger();
  const metrics = getMetrics();
  const startTime = Date.now();

  const {
    maxChars = 6000,
    enableChunking = true,
    enableFallback = true
  } = options;

  const storage = createStorageClient();

  try {
    // Step 1: Validate and normalize URL
    const normalizedUrl = normalizeUrl(pageData.url);
    if (!normalizedUrl) {
      logger.warn("Skipping annotation for malformed URL", {
        url: pageData.url,
        queryId: pageData.queryId,
        engine: pageData.engine
      });

      await storage.markAnnotationFailure({
        queryId: pageData.queryId,
        url: pageData.url,
        engine: pageData.engine,
        status: "SKIPPED_BAD_URL"
      });

      metrics.count("annotate.skipped_bad_url", 1, { engine: pageData.engine });
      return heuristicAnnotate(pageData.pageText, pageData.url, extractDomain(pageData.url) || 'unknown');
    }

    // Step 2: Check content validity
    if (!pageData.pageText || pageData.pageText.trim().length === 0) {
      await storage.markAnnotationFailure({
        queryId: pageData.queryId,
        url: normalizedUrl,
        engine: pageData.engine,
        status: "SKIPPED_EMPTY"
      });

      metrics.count("annotate.skipped_empty", 1, { engine: pageData.engine });
      metrics.histogram("annotate.input_chars", content.length);
      return heuristicAnnotate(content, normalizedUrl, extractDomain(normalizedUrl) || 'unknown');
    }

    // Step 3: Prepare content for annotation
    const domain = extractDomain(normalizedUrl) || 'unknown';
    const content = pageData.pageText.trim();
    const shouldUseChunking = enableChunking && shouldChunk(content, maxChars);

    if (shouldUseChunking) {
      // Chunked annotation approach
      const chunks = chunkText(content, maxChars);
      const chunkResults: AnnotationResult[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const prompt = buildAnnotationPrompt(domain, pageData.title, pageData.snippet || '', chunk);

        try {
          const llmResponse = await annotateWithOpenAI(
            prompt,
            process.env.ANNOTATION_MODEL || 'gpt-4o-mini',
            process.env.OPENAI_API_KEY!
          );

          const result = parseLLMResponse(llmResponse);
          result.provider = `openai-chunk-${i + 1}`;
          chunkResults.push(result);

        } catch (error: any) {
          const errorInfo = extractErrorInfo(error, 'gpt-4o-mini', chunk.length);

          logger.error("Chunk annotation failed", {
            chunkIndex: i,
            totalChunks: chunks.length,
            ...errorInfo,
            queryId: pageData.queryId,
            url: normalizedUrl,
            engine: pageData.engine
          });

          // Continue with other chunks rather than failing entirely
          continue;
        }
      }

      if (chunkResults.length > 0) {
        const mergedResult = reduceChunkAnnotations(chunkResults);
        mergedResult.provider = 'openai-merged';

        await storage.markAnnotationSuccess({
          queryId: pageData.queryId,
          url: normalizedUrl,
          engine: pageData.engine,
          source: 'llm'
        });

        return mergedResult;
      }
    } else {
      // Single annotation approach
      const prompt = buildAnnotationPrompt(domain, pageData.title, pageData.snippet || '', content);

      try {
        const llmResponse = await annotateWithOpenAI(
          prompt,
          process.env.ANNOTATION_MODEL || 'gpt-4o-mini',
          process.env.OPENAI_API_KEY!
        );

        const result = parseLLMResponse(llmResponse);

        await storage.markAnnotationSuccess({
          queryId: pageData.queryId,
          url: normalizedUrl,
          engine: pageData.engine,
          source: 'llm'
        });

        metrics.count("annotate.success", 1, { provider: "llm", engine: pageData.engine });
        metrics.histogram("annotate.duration_ms", Date.now() - startTime);
        metrics.histogram("annotate.input_chars", content.length);

        return result;

      } catch (error: any) {
        const errorInfo = extractErrorInfo(error, 'gpt-4o-mini', content.length);

        logger.error("LLM annotation failed", {
          ...errorInfo,
          queryId: pageData.queryId,
          url: normalizedUrl,
          engine: pageData.engine
        });

        metrics.count("annotate.error", 1, {
          code: errorInfo.code || "unknown",
          status: String(errorInfo.status),
          engine: pageData.engine
        });
        metrics.histogram("annotate.input_chars", content.length);

        await storage.markAnnotationFailure({
          queryId: pageData.queryId,
          url: normalizedUrl,
          engine: pageData.engine,
          errorCode: errorInfo.code,
          errorMessage: errorInfo.message,
          status: "LLM_FAILED"
        });
      }
    }

    // Fallback to heuristic if LLM failed
    if (enableFallback) {
      logger.info("Using heuristic fallback for annotation", {
        queryId: pageData.queryId,
        url: normalizedUrl,
        engine: pageData.engine
      });

      const heuristicResult = heuristicAnnotate(content, normalizedUrl, domain);
      heuristicResult.provider = 'heuristic-fallback';

      await storage.markAnnotationSuccess({
        queryId: pageData.queryId,
        url: normalizedUrl,
        engine: pageData.engine,
        source: 'heuristic_fallback'
      });

      metrics.count("annotate.fallback_heuristic", 1, { engine: pageData.engine });
      metrics.histogram("annotate.duration_ms", Date.now() - startTime);
      metrics.histogram("annotate.input_chars", content.length);

      return heuristicResult;
    }

    // Ultimate fallback
    throw new Error("All annotation methods failed");

  } catch (error: any) {
    logger.error("Annotation completely failed", {
      error: error.message,
      queryId: pageData.queryId,
      url: pageData.url,
      engine: pageData.engine,
      duration: Date.now() - startTime
    });

    // Return minimal fallback result
    return {
      domainType: 'other',
      factualConsistency: 'unclear',
      confidence: 0.1,
      reasoning: 'Annotation failed completely',
      provider: 'error-fallback',
      modelId: 'none',
      sources: []
    };
  } finally {
    await storage.close();
  }
}

/**
 * Batch annotates multiple pages with concurrency control.
 *
 * @param pages - Array of page data to annotate
 * @param options - Annotation options
 * @param concurrency - Maximum concurrent annotations
 * @returns Array of annotation results
 */
export async function annotatePagesBatch(
  pages: Array<{
    queryId: string;
    url: string;
    title: string;
    snippet?: string;
    pageText: string;
    engine: string;
  }>,
  options: AnnotationOptions = {},
  concurrency = 3
): Promise<AnnotationResult[]> {
  const results: AnnotationResult[] = [];
  const logger = createLogger();

  // Process in batches to control concurrency
  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);

    logger.info(`Processing annotation batch ${Math.floor(i / concurrency) + 1}`, {
      batchSize: batch.length,
      totalProcessed: i,
      totalRemaining: pages.length - i
    });

    const batchPromises = batch.map(page => annotatePage(page, options));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Validates annotation configuration on startup.
 */
export async function validateAnnotationConfig(): Promise<void> {
  const logger = createLogger();

  // Check required environment variables
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  if (!process.env.ANNOTATION_MODEL) {
    logger.warn("ANNOTATION_MODEL not set, using default: gpt-4o-mini");
  }

  // Validate OpenAI configuration
  try {
    await validateOpenAIConfig(
      process.env.OPENAI_API_KEY,
      process.env.ANNOTATION_MODEL || 'gpt-4o-mini'
    );
    logger.info("OpenAI configuration validated successfully");
  } catch (error: any) {
    logger.error("OpenAI configuration validation failed", { error: error.message });
    throw error;
  }
}
