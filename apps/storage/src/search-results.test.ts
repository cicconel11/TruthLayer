import { describe, it, expect } from "vitest";
import { createStorageClient } from "./index";
import type { SearchResultInput } from "./types";

describe("insertSearchResults + fetchPendingAnnotations", () => {
  it("inserts search results and returns them as pending annotations", async () => {
    const storage = createStorageClient({ url: "memory://" });
    const now = new Date("2024-01-01T00:00:00.000Z");

    const hash1 = "a".repeat(64);
    const hash2 = "b".repeat(64);

    const records: SearchResultInput[] = [
      {
        id: "00000000-0000-0000-0000-000000000001",
        crawlRunId: null,
        queryId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        engine: "google",
        rank: 1,
        title: "Example Domain",
        snippet: "A snippet",
        url: "https://example.com/",
        normalizedUrl: "https://example.com/",
        domain: "example.com",
        timestamp: now,
        hash: hash1,
        rawHtmlPath: "data/raw_html/google/run-1/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.html",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        crawlRunId: null,
        queryId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        engine: "bing",
        rank: 2,
        title: "Example Org",
        snippet: "Another snippet",
        url: "https://example.org/path",
        normalizedUrl: "https://example.org/path",
        domain: "example.org",
        timestamp: now,
        hash: hash2,
        rawHtmlPath: "data/raw_html/bing/run-1/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.html",
        createdAt: now,
        updatedAt: now
      }
    ];

    await storage.insertSearchResults(records);
    const pending = await storage.fetchPendingAnnotations({ limit: 10 });
    expect(pending.length).toBe(2);
    expect(new Set(pending.map((p) => p.engine))).toEqual(new Set(["google", "bing"]));

    await storage.close();
  });
});
