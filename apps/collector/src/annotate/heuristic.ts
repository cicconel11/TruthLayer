/**
 * Heuristic-based annotation fallback for TruthLayer.
 *
 * Provides simple rules-based annotation when LLM services fail.
 * Never throws errors - always returns a valid annotation result.
 */

export interface HeuristicAnnotation {
  domainType: string;
  factualConsistency: string;
  confidence: number;
  reasoning: string;
  provider: string;
  modelId: string;
  sources: string[];
}

/**
 * Simple keyword-based domain type inference.
 *
 * @param domain - Domain name
 * @returns Inferred domain type
 */
function inferDomainType(domain: string): string {
  const lowerDomain = domain.toLowerCase();

  // Government domains
  if (lowerDomain.endsWith('.gov') ||
      lowerDomain.endsWith('.gov.uk') ||
      lowerDomain.endsWith('.gov.au') ||
      lowerDomain.includes('government') ||
      lowerDomain.includes('parliament')) {
    return 'government';
  }

  // Academic domains
  if (lowerDomain.endsWith('.edu') ||
      lowerDomain.endsWith('.ac.uk') ||
      lowerDomain.endsWith('.edu.au') ||
      lowerDomain.includes('university') ||
      lowerDomain.includes('college') ||
      lowerDomain.includes('school')) {
    return 'academic';
  }

  // News domains
  if (lowerDomain.includes('news') ||
      lowerDomain.includes('bbc') ||
      lowerDomain.includes('cnn') ||
      lowerDomain.includes('reuters') ||
      lowerDomain.includes('guardian') ||
      lowerDomain.includes('nytimes') ||
      lowerDomain.includes('washingtonpost')) {
    return 'news';
  }

  return 'other';
}

/**
 * Simple keyword-based factual consistency inference.
 *
 * @param text - Content text to analyze
 * @returns Inferred factual consistency rating
 */
function inferFactualConsistency(text: string): string {
  const lowerText = text.toLowerCase();

  // Look for hedging language (suggests uncertainty)
  const uncertainWords = ['might', 'could', 'possibly', 'perhaps', 'maybe', 'allegedly', 'reportedly'];
  const uncertainCount = uncertainWords.reduce((count, word) =>
    count + (lowerText.split(word).length - 1), 0);

  // Look for factual language
  const factualWords = ['according to', 'research shows', 'study found', 'data indicates', 'evidence suggests'];
  const factualCount = factualWords.reduce((count, word) =>
    count + (lowerText.split(word).length - 1), 0);

  // Look for contradictory language
  const contradictionWords = ['however', 'but', 'although', 'despite', 'contrary', 'versus', 'vs'];
  const contradictionCount = contradictionWords.reduce((count, word) =>
    count + (lowerText.split(word).length - 1), 0);

  // Simple scoring
  if (factualCount > uncertainCount && contradictionCount === 0) {
    return 'aligned';
  } else if (contradictionCount > factualCount) {
    return 'contradicted';
  } else {
    return 'unclear';
  }
}

/**
 * Extracts potential sources from text.
 *
 * Looks for common citation patterns.
 *
 * @param text - Content text
 * @returns Array of potential source strings
 */
function extractSources(text: string): string[] {
  const sources: string[] = [];

  // Look for quoted sources
  const quoteMatches = text.match(/"([^"]*)" \([^)]*\)/g);
  if (quoteMatches) {
    sources.push(...quoteMatches.slice(0, 3)); // Limit to 3 sources
  }

  // Look for academic-style citations
  const citationMatches = text.match(/\([^)]*\d{4}[^)]*\)/g);
  if (citationMatches) {
    sources.push(...citationMatches.slice(0, 2));
  }

  return sources.slice(0, 5); // Max 5 sources
}

/**
 * Heuristic annotation fallback that never fails.
 *
 * Uses simple rules and keyword analysis to provide basic annotations
 * when LLM services are unavailable.
 *
 * @param pageText - Raw page content
 * @param url - Page URL
 * @param domain - Extracted domain
 * @returns Heuristic annotation result
 */
export function heuristicAnnotate(
  pageText: string,
  url: string,
  domain: string
): HeuristicAnnotation {
  try {
    // Input validation
    if (!pageText || typeof pageText !== 'string') {
      pageText = '';
    }

    if (!domain || typeof domain !== 'string') {
      domain = 'unknown';
    }

    // Extract domain type
    const domainType = inferDomainType(domain);

    // Analyze content for factual consistency
    const factualConsistency = pageText.length > 10
      ? inferFactualConsistency(pageText)
      : 'unclear';

    // Calculate confidence based on content length and patterns
    let confidence = 0.3; // Base low confidence for heuristics

    if (pageText.length > 100) confidence += 0.2;
    if (pageText.length > 500) confidence += 0.2;
    if (domainType !== 'other') confidence += 0.1;
    if (factualConsistency !== 'unclear') confidence += 0.1;

    confidence = Math.min(confidence, 0.7); // Cap at 70% confidence

    // Extract sources
    const sources = extractSources(pageText);

    // Build reasoning
    const reasoning = `Heuristic analysis: ${domainType} domain, ${factualConsistency} content, ${pageText.length} chars analyzed`;

    return {
      domainType,
      factualConsistency,
      confidence: Math.round(confidence * 100) / 100,
      reasoning,
      provider: 'heuristic',
      modelId: 'rules-based-v1',
      sources
    };

  } catch (error: any) {
    // Ultimate fallback - never throw
    return {
      domainType: 'other',
      factualConsistency: 'unclear',
      confidence: 0.1,
      reasoning: 'Heuristic analysis failed, using minimal fallback',
      provider: 'heuristic',
      modelId: 'fallback-v1',
      sources: []
    };
  }
}

/**
 * Batch heuristic annotation for multiple pages.
 *
 * @param pages - Array of page data
 * @returns Array of heuristic annotations
 */
export function heuristicAnnotateBatch(pages: Array<{
  pageText: string;
  url: string;
  domain: string;
}>): HeuristicAnnotation[] {
  return pages.map(page =>
    heuristicAnnotate(page.pageText, page.url, page.domain)
  );
}
