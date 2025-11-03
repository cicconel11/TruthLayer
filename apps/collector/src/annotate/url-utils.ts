/**
 * URL normalization and validation utilities for TruthLayer annotation pipeline.
 *
 * Handles malformed URLs from search engine results, normalizes common issues,
 * and provides safe validation before annotation attempts.
 */

/**
 * Normalizes and validates URLs from search engine results.
 *
 * Fixes common issues like:
 * - Missing protocol (adds https://)
 * - Malformed prefixes (w. → www.)
 * - Trailing punctuation or brackets
 * - Extra quotes
 *
 * @param raw - Raw URL string from search results
 * @returns Normalized URL string or null if invalid
 */
export function normalizeUrl(raw: string): string | null {
  if (!raw) return null;

  let s = raw.trim();

  // Remove surrounding quotes
  s = s.replace(/^["']+|["']+$/g, "");

  // URL decode first to handle encoded characters
  try {
    s = decodeURIComponent(s);
  } catch {
    // Ignore decode errors
  }

  // Remove surrounding quotes (again after decoding)
  s = s.replace(/^["']+|["']+$/g, "");

  // Remove trailing brackets, punctuation, quotes, and other junk
  s = s.replace(/[}\]\)>"'}\]]+$/, "");

  // Fix common prefix issues - replace w. with www. (only at start)
  if (s.startsWith('w.')) {
    s = 'www.' + s.slice(2);
  }
  s = s.replace(/^https?:\/\/w\./i, "https://www.");

  // Add protocol if missing
  if (!/^https?:\/\//i.test(s)) {
    s = "https://" + s;
  }

  try {
    const u = new URL(s);

    // Basic sanity checks
    if (!u.hostname || u.hostname.includes(" ") || u.hostname.length > 253) {
      return null;
    }

    // Additional validation - hostname should have at least one dot (except localhost)
    if (!u.hostname.includes(".") && u.hostname !== "localhost") {
      return null;
    }

    // Check for obviously invalid hostnames
    if (/^(not-a-url|undefined|null|none)$/i.test(u.hostname)) {
      return null;
    }

    // Remove trailing slashes from path unless it's just "/"
    if (u.pathname.endsWith("/") && u.pathname.length > 1) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Validates if a URL is suitable for annotation.
 *
 * Checks for:
 * - Valid protocol (http/https only)
 * - Reasonable hostname length
 * - No suspicious patterns
 *
 * @param url - URL string to validate
 * @returns true if URL is valid for annotation
 */
export function isValidForAnnotation(url: string): boolean {
  try {
    const u = new URL(url);

    // Only allow http/https
    if (!["http:", "https:"].includes(u.protocol)) {
      return false;
    }

    // Basic hostname validation
    if (!u.hostname || u.hostname.length > 253 || u.hostname.startsWith(".")) {
      return false;
    }

    // Skip localhost/private IPs for security
    if (u.hostname === "localhost" ||
        u.hostname.startsWith("127.") ||
        u.hostname.startsWith("192.168.") ||
        u.hostname.startsWith("10.") ||
        u.hostname.startsWith("172.")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts domain from URL for grouping and analysis.
 *
 * @param url - URL string
 * @returns Domain string or null if invalid
 */
export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}
