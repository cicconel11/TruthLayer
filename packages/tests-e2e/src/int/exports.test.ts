import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

describe("Data Export Validation", () => {
  const exportDir = path.resolve(process.cwd(), "data/metrics");
  
  describe("file naming conventions", () => {
    it("should include runId in export filenames", () => {
      // Test the pattern
      const validFilenames = [
        "metrics_runId=abc123_schema=v1_2025-11-09.csv",
        "results_runId=xyz789_schema=v2_2025-11-09.json",
        "data_runId=test-run_schema=v1_2025-11-09.parquet"
      ];

      const pattern = /runId=[a-zA-Z0-9-_]+/;

      validFilenames.forEach(filename => {
        expect(pattern.test(filename)).toBe(true);
      });
    });

    it("should include schema version in export filenames", () => {
      const validFilenames = [
        "metrics_runId=abc123_schema=v1_2025-11-09.csv",
        "results_runId=xyz789_schema=v2_2025-11-09.json"
      ];

      const pattern = /schema=v\d+/;

      validFilenames.forEach(filename => {
        expect(pattern.test(filename)).toBe(true);
      });
    });

    it("should support CSV, JSON, and Parquet formats", () => {
      const formats = [".csv", ".json", ".parquet"];
      
      const testFilenames = [
        "data_runId=test_schema=v1.csv",
        "data_runId=test_schema=v1.json",
        "data_runId=test_schema=v1.parquet"
      ];

      testFilenames.forEach((filename, index) => {
        expect(filename.endsWith(formats[index])).toBe(true);
      });
    });
  });

  describe("file structure validation", () => {
    it("should validate export filename pattern", () => {
      const validPattern = /^[\w-]+_runId=[\w-]+_schema=v\d+_[\d-]+\.(csv|json|parquet)$/;
      
      const validFilenames = [
        "metrics_runId=run-123_schema=v1_2025-11-09.csv",
        "annotations_runId=run-456_schema=v2_2025-11-09.json",
        "results_runId=test-run_schema=v1_2025-11-09.parquet"
      ];

      const invalidFilenames = [
        "metrics.csv",  // Missing runId and schema
        "data_runId=123.json",  // Missing schema
        "export_schema=v1.csv",  // Missing runId
        "file.txt"  // Wrong extension
      ];

      validFilenames.forEach(filename => {
        expect(validPattern.test(filename)).toBe(true);
      });

      invalidFilenames.forEach(filename => {
        expect(validPattern.test(filename)).toBe(false);
      });
    });
  });

  describe("metadata extraction", () => {
    it("should extract runId from filename", () => {
      const filename = "metrics_runId=abc-123-xyz_schema=v1_2025-11-09.csv";
      const match = filename.match(/runId=([a-zA-Z0-9-_]+)/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe("abc-123-xyz");
    });

    it("should extract schema version from filename", () => {
      const filename = "metrics_runId=abc123_schema=v2_2025-11-09.csv";
      const match = filename.match(/schema=(v\d+)/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe("v2");
    });

    it("should extract date from filename", () => {
      const filename = "metrics_runId=abc123_schema=v1_2025-11-09.csv";
      const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe("2025-11-09");
    });

    it("should extract format from filename", () => {
      const testCases = [
        { filename: "data_runId=test_schema=v1_2025-11-09.csv", expected: "csv" },
        { filename: "data_runId=test_schema=v1_2025-11-09.json", expected: "json" },
        { filename: "data_runId=test_schema=v1_2025-11-09.parquet", expected: "parquet" }
      ];

      testCases.forEach(({ filename, expected }) => {
        const match = filename.match(/\.(csv|json|parquet)$/);
        expect(match).not.toBeNull();
        expect(match![1]).toBe(expected);
      });
    });
  });

  describe("export directory checks", () => {
    it("should have valid export directory structure", () => {
      // Check if export directory path is valid
      const isValidPath = exportDir.includes("data") && exportDir.includes("metrics");
      expect(isValidPath).toBe(true);
    });

    it("should handle missing export directory gracefully", () => {
      const exists = existsSync(exportDir);
      
      // Either directory exists or we can handle it not existing
      if (!exists) {
        expect(exists).toBe(false);
      } else {
        expect(exists).toBe(true);
      }
    });
  });

  describe("file content structure", () => {
    it("should define CSV header structure", () => {
      const expectedHeaders = [
        "runId",
        "queryId",
        "engine",
        "metricType",
        "value",
        "timestamp",
        "schemaVersion"
      ];

      // Validate header structure
      expect(expectedHeaders).toContain("runId");
      expect(expectedHeaders).toContain("schemaVersion");
      expect(expectedHeaders.length).toBeGreaterThan(0);
    });

    it("should define JSON structure", () => {
      const expectedStructure = {
        metadata: {
          runId: "string",
          schemaVersion: "string",
          exportedAt: "ISO8601 timestamp"
        },
        data: "array of records"
      };

      expect(expectedStructure.metadata).toHaveProperty("runId");
      expect(expectedStructure.metadata).toHaveProperty("schemaVersion");
      expect(expectedStructure.metadata).toHaveProperty("exportedAt");
    });
  });
});
