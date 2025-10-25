import { describe, it, expect } from "vitest";
import { normalizeResults } from "./normalize";
import { SearchResultSchema } from "@truthlayer/schema";

describe("normalizeResults", () => {
  it("normalizes raw items to SearchResult schema", () => {
    const collectedAt = new Date("2024-01-01T00:00:00.000Z");
    const results = normalizeResults({
      engine: "google",
      query: { id: "11111111-1111-1111-1111-111111111111", query: "test", topic: "demo" },
      collectedAt,
      rawHtmlPath: "data/raw_html/google/run-1/1111.html",
      items: [
        { rank: 1, title: "Example Domain", snippet: "A snippet", url: "https://example.com/" },
        { rank: 2, title: "", snippet: undefined, url: "https://example.org/page" }
      ]
    });

    expect(results.length).toBe(2);
    for (const r of results) {
      // Should parse with schema coercions
      const parsed = SearchResultSchema.parse(r);
      expect(parsed.engine).toBe("google");
      expect(parsed.rank).toBeGreaterThanOrEqual(1);
      expect(typeof parsed.hash).toBe("string");
      expect(parsed.hash).toHaveLength(64);
    }
    // When title is missing, url should be used
    expect(results[1].title).toBe("https://example.org/page");
  });
});

