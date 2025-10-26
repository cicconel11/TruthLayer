import { writeFileSync } from "fs";

interface SelectorHealth {
  engine: string;
  selector: string;
  successCount: number;
  failCount: number;
  lastSuccess: Date | null;
  lastFail: Date | null;
}

const healthMap = new Map<string, SelectorHealth>();

/**
 * Record the result of using a specific selector
 */
export function recordSelectorResult(
  engine: string,
  selector: string,
  success: boolean
): void {
  const key = `${engine}:${selector}`;
  const existing = healthMap.get(key) || {
    engine,
    selector,
    successCount: 0,
    failCount: 0,
    lastSuccess: null,
    lastFail: null
  };
  
  if (success) {
    existing.successCount++;
    existing.lastSuccess = new Date();
  } else {
    existing.failCount++;
    existing.lastFail = new Date();
  }
  
  healthMap.set(key, existing);
}

/**
 * Get all selector health metrics
 */
export function getSelectorHealth(): SelectorHealth[] {
  return Array.from(healthMap.values());
}

/**
 * Export selector health metrics to JSON file
 */
export function exportSelectorHealth(outputPath: string): void {
  const health = getSelectorHealth();
  writeFileSync(outputPath, JSON.stringify(health, null, 2));
}

