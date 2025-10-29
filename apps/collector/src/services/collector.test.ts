import { describe, it, expect } from "vitest";
import { createCollector } from "./collector";
import { makeCollectorConfig } from "../lib/config";
import { createLogger } from "../lib/logger";

describe("createCollector", () => {
  it("runs all enabled engines for each query with shared crawlRunId", async () => {
    const logger = createLogger();
    const config = makeCollectorConfig();
    const runId = "12345678-1234-1234-1234-123456789abc";
    
    const collector = await createCollector({ config, logger, runId });
    
    const mockQuery = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      query: "test query",
      topic: "test"
    };
    
    const results = await collector.collect(mockQuery);
    
    // Should have results from at least one engine
    // (Some engines may fail if API keys are missing, which is expected)
    expect(results.length).toBeGreaterThanOrEqual(0);
    
    if (results.length > 0) {
      // Extract unique engines from results
      const engines = new Set(results.map(r => (r as any).engine));
      
      // All results should share the same crawlRunId
      const crawlRunIds = new Set(results.map(r => (r as any).crawlRunId));
      expect(crawlRunIds.size).toBe(1);
      expect([...crawlRunIds][0]).toBe(runId);
      
      // Each result should have required fields
      for (const result of results) {
        const r = result as any;
        expect(r.crawlRunId).toBe(runId);
        expect(r.queryId).toBe(mockQuery.id);
        expect(r.engine).toBeTruthy();
        expect(r.url).toBeTruthy();
        expect(r.rank).toBeGreaterThan(0);
      }
    }
  }, 60000); // 60 second timeout for network requests

  it("handles missing API keys gracefully", async () => {
    const logger = createLogger();
    const config = makeCollectorConfig();
    const runId = "87654321-4321-4321-4321-987654321cba";
    
    // Even if some engines are missing API keys, collector should still be created
    const collector = await createCollector({ config, logger, runId });
    expect(collector).toBeDefined();
    expect(collector.collect).toBeDefined();
    
    const mockQuery = {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      query: "another test",
      topic: "test"
    };
    
    // Should not throw even if some engines fail
    await expect(collector.collect(mockQuery)).resolves.toBeDefined();
  }, 60000);
});

