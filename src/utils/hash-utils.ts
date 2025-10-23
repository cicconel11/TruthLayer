import { createHash } from 'crypto';

/**
 * Generate SHA-256 hash of content for deduplication
 */
export function generateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate hash for search result content (title + snippet + url)
 */
export function generateSearchResultHash(title: string, snippet: string, url: string): string {
    const content = `${title}|${snippet}|${url}`;
    return generateContentHash(content);
}

/**
 * Generate unique ID using timestamp and random component
 */
export function generateUniqueId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
}

/**
 * Validate hash format (64-character hex string for SHA-256)
 */
export function isValidHash(hash: string): boolean {
    return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Compare two hashes for equality
 */
export function compareHashes(hash1: string, hash2: string): boolean {
    return hash1.toLowerCase() === hash2.toLowerCase();
}