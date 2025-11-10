/**
 * Text chunking utilities for handling large content in annotation pipeline.
 *
 * Splits long page content into manageable chunks for LLM processing,
 * then merges results using map→reduce pattern.
 */

/**
 * Splits text into chunks of maximum character length.
 *
 * Preserves word boundaries where possible to maintain readability.
 *
 * @param input - Text content to chunk
 * @param maxChars - Maximum characters per chunk (default: 6000)
 * @returns Array of text chunks
 */
export function chunkText(input: string, maxChars = 6000): string[] {
  if (!input) return [];

  if (input.length <= maxChars) return [input];

  const chunks: string[] = [];
  let start = 0;

  while (start < input.length) {
    let end = start + maxChars;

    // If we're not at the end, try to find a good break point
    if (end < input.length) {
      // Look for sentence endings within the last 200 chars
      const searchEnd = Math.min(end, start + maxChars);
      const searchStart = Math.max(start, searchEnd - 200);

      let breakPoint = searchEnd;
      for (let i = searchEnd - 1; i >= searchStart; i--) {
        if (input[i] === '.' || input[i] === '!' || input[i] === '?') {
          // Make sure it's followed by space or end of string
          if (i + 1 >= input.length || /\s/.test(input[i + 1])) {
            breakPoint = i + 1;
            break;
          }
        }
      }

      // If no sentence break found, look for word boundaries
      if (breakPoint === searchEnd) {
        for (let i = searchEnd - 1; i >= searchStart; i--) {
          if (/\s/.test(input[i])) {
            breakPoint = i;
            break;
          }
        }
      }

      end = breakPoint;
    }

    chunks.push(input.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Merges multiple annotation results from chunked content.
 *
 * Uses domain-specific logic to combine results:
 * - Picks majority labels for categorical fields
 * - Averages confidence scores
 * - Unions sources and citations
 * - Preserves most confident predictions
 *
 * @param annotations - Array of annotation results from chunks
 * @returns Merged annotation result
 */
export function reduceChunkAnnotations(annotations: any[]): any {
  if (!annotations.length) return null;
  if (annotations.length === 1) return { ...annotations[0], chunk_count: 1 };

  // Group annotations by key fields for majority voting
  const domainTypeCounts: Record<string, number> = {};
  const factualConsistencyCounts: Record<string, number> = {};
  const sources: Set<string> = new Set();
  const confidences: number[] = [];
  const extras: any[] = [];

  for (const ann of annotations) {
    // Count categorical fields
    if (ann.domainType) {
      domainTypeCounts[ann.domainType] = (domainTypeCounts[ann.domainType] || 0) + 1;
    }
    if (ann.factualConsistency) {
      factualConsistencyCounts[ann.factualConsistency] = (factualConsistencyCounts[ann.factualConsistency] || 0) + 1;
    }

    // Collect sources and metadata
    if (ann.sources && Array.isArray(ann.sources)) {
      ann.sources.forEach((source: string) => sources.add(source));
    }

    // Collect confidence scores
    if (typeof ann.confidence === 'number') {
      confidences.push(ann.confidence);
    }

    // Collect extra metadata
    if (ann.extra) {
      extras.push(ann.extra);
    }
  }

  // Determine majority labels
  const domainType = Object.entries(domainTypeCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

  const factualConsistency = Object.entries(factualConsistencyCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unclear';

  // Calculate average confidence
  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.5;

  // Merge extras (simple union for now)
  const mergedExtras = Object.assign({}, ...extras);

  return {
    domainType,
    factualConsistency,
    confidence: Math.round(avgConfidence * 100) / 100, // Round to 2 decimal places
    sources: Array.from(sources),
    chunk_count: annotations.length,
    merged: true,
    extra: mergedExtras
  };
}

/**
 * Estimates token count for text (rough approximation).
 *
 * Uses 4 chars per token as a conservative estimate for English text.
 *
 * @param text - Text to estimate
 * @returns Approximate token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Validates if content size is appropriate for single annotation.
 *
 * @param text - Content to check
 * @param maxChars - Maximum allowed characters
 * @returns true if content should be chunked
 */
export function shouldChunk(text: string, maxChars = 6000): boolean {
  return !!text && text.length > maxChars;
}
