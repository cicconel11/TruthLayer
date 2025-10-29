import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import duckdb from "duckdb";
import pg, { type FieldDef } from "pg";
const { Pool } = pg as unknown as { Pool: typeof import("pg").Pool };
import type {
  AnnotatedResultView,
  AnnotationAggregateRecord,
  PipelineRun,
  PipelineStageLog,
  SearchResult
} from "@truthlayer/schema";
import {
  AnnotatedResultViewSchema,
  AnnotationAggregateRecordSchema,
  AuditSampleSchema,
  DatasetTypeEnum,
  DatasetFormatEnum,
  DatasetVersionSchema,
  SearchResultSchema
} from "@truthlayer/schema";
import {
  AnnotationAggregateRecordInput,
  AnnotationRecordInput,
  SearchResultInput,
  CrawlRunRecordInput,
  FetchAnnotatedResultsOptions,
  FetchPendingAnnotationsOptions,
  FetchAnnotationAggregateOptions,
  MetricRecordInput,
  DatasetExportOptions,
  DatasetExportResult,
  AuditSampleRecordInput,
  PipelineRunRecordInput,
  PipelineStageLogInput,
  FetchPipelineRunOptions,
  StorageClient
} from "./types";

const METRIC_COLUMNS = [
  "id",
  "crawl_run_id",
  "query_id",
  "engine",
  "metric_type",
  "value",
  "delta",
  "compared_to_run_id",
  "collected_at",
  "extra",
  "created_at"
];

const AUDIT_SAMPLE_COLUMNS = [
  "id",
  "run_id",
  "annotation_id",
  "query_id",
  "engine",
  "reviewer",
  "status",
  "notes",
  "created_at",
  "updated_at"
];

function buildTimestampSlug(date: Date): string {
  return date.toISOString().replace(/[-:.TZ]/g, "");
}

/**
 * Deduplicates search results by (query_id, engine, url) to prevent
 * "ON CONFLICT DO UPDATE command cannot affect row a second time" errors.
 * Keeps the last occurrence of each duplicate.
 * 
 * @param results - Array of search result records
 * @returns Deduplicated array with unique (query_id, engine, url) tuples
 */
function deduplicateSearchResults(results: SearchResultInput[]): SearchResultInput[] {
  const map = new Map<string, SearchResultInput>();
  for (const r of results) {
    const key = `${r.queryId}-${r.engine}-${r.url}`;
    map.set(key, r);
  }
  return Array.from(map.values());
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      normalized[key] = value.toISOString();
    } else if (typeof value === "bigint") {
      normalized[key] = value.toString();
    } else if (Buffer.isBuffer(value)) {
      normalized[key] = value.toString("utf8");
    } else if (Array.isArray(value)) {
      normalized[key] = value.map((item) =>
        item instanceof Date ? item.toISOString() : item
      );
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

function mapPostgresTypeToDuckDB(field: FieldDef): string {
  switch (field.dataTypeID) {
    case 16:
      return "BOOLEAN";
    case 20:
      return "BIGINT";
    case 21:
    case 23:
      return "INTEGER";
    case 700:
    case 701:
    case 1700:
      return "DOUBLE";
    case 1082:
      return "DATE";
    case 1114:
    case 1184:
      return "TIMESTAMP";
    case 2950:
      return "UUID";
    case 114:
    case 3802:
      return "JSON";
    default:
      return "VARCHAR";
  }
}

async function convertJsonToParquet(
  jsonPath: string,
  outputPath: string,
  fields: FieldDef[],
  hasRows: boolean
): Promise<void> {
  const db = new duckdb.Database(":memory:");
  const connection = db.connect();

  const run = (sql: string) =>
    new Promise<void>((resolve, reject) => {
      connection.run(sql, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const tableName = `export_${randomUUID().replace(/-/g, "")}`;

  try {
    if (hasRows) {
      const escapedJson = jsonPath.replace(/'/g, "''");
      await run(
        `CREATE TABLE ${tableName} AS SELECT * FROM read_json_auto('${escapedJson}')`
      );
    } else {
      const columns = fields.length
        ? fields
            .map((field) => `"${field.name}" ${mapPostgresTypeToDuckDB(field)}`)
            .join(", ")
        : '"placeholder" BOOLEAN';
      await run(`CREATE TABLE ${tableName} (${columns})`);
    }

    const escapedOutput = outputPath.replace(/'/g, "''");
    await run(
      `COPY (SELECT * FROM ${tableName}) TO '${escapedOutput}' (FORMAT 'parquet')`
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      connection.close((err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
    await new Promise<void>((resolve, reject) => {
      db.close((err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function writeParquetFromRows(
  rows: Record<string, unknown>[],
  fields: FieldDef[],
  outputPath: string
): Promise<void> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "truthlayer-export-"));
  const tempJsonPath = path.join(tempDir, "dataset.jsonl");

  try {
    if (rows.length) {
      const jsonLines = rows.map((row) => JSON.stringify(row)).join("\n");
      await fs.writeFile(tempJsonPath, `${jsonLines}\n`, "utf8");
    } else {
      await fs.writeFile(tempJsonPath, "", "utf8");
    }

    await convertJsonToParquet(tempJsonPath, outputPath, fields, rows.length > 0);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const normalizedValue =
    typeof value === "object" ? JSON.stringify(value) : String(value);

  const escaped = normalizedValue.replace(/"/g, '""');
  return `"${escaped}"`;
}

export class PostgresStorageClient implements StorageClient {
  private readonly pool: Pool;
  private metricTableEnsured = false;
  private aggregateTableEnsured = false;
  private annotationTableEnsured = false;
  private searchResultsTableEnsured = false;
  private crawlRunsTableEnsured = false;
  private datasetVersionsTableEnsured = false;
  private auditSamplesTableEnsured = false;
  private viewpointsTableEnsured = false;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  private async ensureMetricTable() {
    if (this.metricTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS metric_records (
        id UUID PRIMARY KEY,
        crawl_run_id UUID,
        query_id UUID NOT NULL,
        engine TEXT,
        metric_type TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        delta DOUBLE PRECISION,
        compared_to_run_id UUID,
        collected_at TIMESTAMPTZ NOT NULL,
        extra JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.metricTableEnsured = true;
  }

  private async ensureAnnotationAggregateTable() {
    if (this.aggregateTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS annotation_aggregates (
        id UUID PRIMARY KEY,
        run_id TEXT NOT NULL,
        query_id UUID NOT NULL,
        engine TEXT,
        domain_type TEXT NOT NULL,
        factual_consistency TEXT NOT NULL,
        count INTEGER NOT NULL,
        total_annotations INTEGER NOT NULL,
        collected_at TIMESTAMPTZ NOT NULL,
        extra JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.aggregateTableEnsured = true;
  }

  private async ensureAnnotationTable() {
    if (this.annotationTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS annotations (
        id UUID PRIMARY KEY,
        search_result_id UUID NOT NULL REFERENCES search_results(id),
        query_id UUID NOT NULL,
        engine TEXT NOT NULL,
        domain_type TEXT NOT NULL,
        factual_consistency TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        prompt_version TEXT NOT NULL,
        model_id TEXT NOT NULL,
        extra JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.annotationTableEnsured = true;
  }

  private async ensureSearchResultsTable() {
    if (this.searchResultsTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS search_results (
        id UUID PRIMARY KEY,
        crawl_run_id UUID,
        query_id UUID NOT NULL,
        engine TEXT NOT NULL,
        rank INTEGER NOT NULL,
        title TEXT NOT NULL,
        snippet TEXT,
        url TEXT NOT NULL,
        normalized_url TEXT NOT NULL,
        domain TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        hash TEXT NOT NULL,
        raw_html_path TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create unique index on (query_id, engine, url) to prevent logical duplicates
    await this.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS search_results_unique_idx
        ON search_results (query_id, engine, url)
    `);
    
    this.searchResultsTableEnsured = true;
  }

  private async ensureCrawlRunsTable() {
    if (this.crawlRunsTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS crawl_runs (
        id UUID PRIMARY KEY,
        batch_id UUID NOT NULL,
        query_id UUID NOT NULL,
        engine TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        error TEXT,
        result_count INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.crawlRunsTableEnsured = true;
  }

  private async ensureDatasetVersionsTable() {
    if (this.datasetVersionsTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS dataset_versions (
        id UUID PRIMARY KEY,
        dataset_type TEXT NOT NULL,
        format TEXT NOT NULL,
        path TEXT NOT NULL,
        run_id UUID,
        record_count INTEGER NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.datasetVersionsTableEnsured = true;
  }

  private async ensureViewpointsTable() {
    if (this.viewpointsTableEnsured) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS viewpoints (
        id UUID PRIMARY KEY,
        query_id UUID NOT NULL,
        crawl_run_id UUID,
        engine TEXT NOT NULL,
        num_results INTEGER NOT NULL DEFAULT 0,
        summary TEXT,
        citations_count INTEGER DEFAULT 0,
        overlap_hash TEXT,
        collected_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(query_id, crawl_run_id, engine)
      )
    `);
    this.viewpointsTableEnsured = true;
  }

  private async ensureAuditSamplesTable() {
    if (this.auditSamplesTableEnsured) return;
    await this.ensurePipelineTables();
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_samples (
        id UUID PRIMARY KEY,
        run_id UUID NOT NULL REFERENCES pipeline_runs(id),
        annotation_id UUID NOT NULL,
        query_id UUID NOT NULL,
        engine TEXT NOT NULL,
        reviewer TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.auditSamplesTableEnsured = true;
  }

  private async ensurePipelineTables() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id UUID PRIMARY KEY,
        status TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        error TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pipeline_stage_logs (
        id UUID PRIMARY KEY,
        run_id UUID NOT NULL REFERENCES pipeline_runs(id),
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        error TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async fetchPendingAnnotations(options: FetchPendingAnnotationsOptions): Promise<SearchResult[]> {
    await this.ensureAnnotationTable();
    await this.ensureSearchResultsTable();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.queryIds && options.queryIds.length) {
      const placeholders = options.queryIds
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(`sr.query_id IN (${placeholders})`);
    }

    if (options.engines && options.engines.length) {
      const placeholders = options.engines
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(`sr.engine IN (${placeholders})`);
    }

    const filterClause = conditions.length ? `AND ${conditions.join(" AND ")}` : "";
    const limitClause = options.limit ? `LIMIT ${options.limit}` : "";

    const { rows } = await this.pool.query<{
      id: string;
      crawl_run_id: string | null;
      query_id: string;
      engine: string;
      rank: number;
      title: string;
      snippet: string | null;
      url: string;
      normalized_url: string;
      domain: string;
      timestamp: Date;
      hash: string;
      raw_html_path: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT
          sr.id,
          sr.crawl_run_id,
          sr.query_id,
          sr.engine,
          sr.rank,
          sr.title,
          sr.snippet,
          sr.url,
          sr.normalized_url,
          sr.domain,
          sr.timestamp,
          sr.hash,
          sr.raw_html_path,
          sr.created_at,
          sr.updated_at
        FROM search_results sr
        LEFT JOIN annotations ann ON ann.search_result_id = sr.id
        WHERE ann.id IS NULL
        ${filterClause}
        ORDER BY sr.timestamp ASC
        ${limitClause}
      `,
      params
    );

    return rows.map((row) =>
      SearchResultSchema.parse({
        id: row.id,
        crawlRunId: row.crawl_run_id,
        queryId: row.query_id,
        engine: row.engine,
        rank: row.rank,
        title: row.title,
        snippet: row.snippet ?? undefined,
        url: row.url,
        normalizedUrl: row.normalized_url,
        domain: row.domain,
        timestamp: row.timestamp,
        hash: row.hash,
        rawHtmlPath: row.raw_html_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      })
    );
  }

  async insertAnnotationRecords(records: AnnotationRecordInput[]): Promise<void> {
    if (!records.length) return;
    await this.ensureAnnotationTable();

    const columns = [
      "id",
      "search_result_id",
      "query_id",
      "engine",
      "domain_type",
      "factual_consistency",
      "confidence",
      "prompt_version",
      "model_id",
      "extra",
      "created_at",
      "updated_at"
    ];

    const placeholders: string[] = [];
    const params: unknown[] = [];

    records.forEach((record, index) => {
      const offset = index * columns.length;
      placeholders.push(`(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`);
      params.push(
        record.id,
        record.searchResultId,
        record.queryId,
        record.engine,
        record.domainType,
        record.factualConsistency,
        record.confidence,
        record.promptVersion,
        record.modelId,
        record.extra ?? {},
        record.createdAt.toISOString(),
        record.updatedAt.toISOString()
      );
    });

    await this.pool.query(
      `
        INSERT INTO annotations (
          ${columns.join(",")}
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (id)
        DO UPDATE SET
          search_result_id = EXCLUDED.search_result_id,
          query_id = EXCLUDED.query_id,
          engine = EXCLUDED.engine,
          domain_type = EXCLUDED.domain_type,
          factual_consistency = EXCLUDED.factual_consistency,
          confidence = EXCLUDED.confidence,
          prompt_version = EXCLUDED.prompt_version,
          model_id = EXCLUDED.model_id,
          extra = EXCLUDED.extra,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `,
      params
    );
  }

  async insertSearchResults(records: SearchResultInput[]): Promise<void> {
    if (!records.length) return;
    await this.ensureSearchResultsTable();

    console.info(`[Storage] insertSearchResults called with ${records.length} records`);

    // Deduplicate by (query_id, engine, url) to prevent ON CONFLICT errors
    const deduped = deduplicateSearchResults(records);
    
    console.info(
      `[Storage] After dedup: ${records.length} → ${deduped.length} (removed ${records.length - deduped.length})`
    );
    
    // Log a sample of what we're about to insert
    if (deduped.length > 0) {
      const sample = deduped.slice(0, 3).map(r => `${r.queryId.substring(0,8)}-${r.engine}-${r.url.substring(0,30)}`);
      console.info(`[Storage] Sample records: ${sample.join(', ')}`);
    }

    const columns = [
      "id",
      "crawl_run_id",
      "query_id",
      "engine",
      "rank",
      "title",
      "snippet",
      "url",
      "normalized_url",
      "domain",
      "timestamp",
      "hash",
      "raw_html_path",
      "created_at",
      "updated_at"
    ];

    const params: unknown[] = [];
    const placeholders: string[] = [];

    deduped.forEach((record, index) => {
      const offset = index * columns.length;
      placeholders.push(`(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`);
      params.push(
        record.id,
        record.crawlRunId,
        record.queryId,
        record.engine,
        record.rank,
        record.title,
        record.snippet ?? null,
        record.url,
        record.normalizedUrl,
        record.domain,
        record.timestamp.toISOString(),
        record.hash,
        record.rawHtmlPath,
        record.createdAt.toISOString(),
        record.updatedAt.toISOString()
      );
    });

    console.info(`[Storage] Executing INSERT with ${deduped.length} rows, ${params.length} params`);
    
    try {
      await this.pool.query(
        `
          INSERT INTO search_results (
            ${columns.join(", ")}
          ) VALUES ${placeholders.join(", ")}
          ON CONFLICT (query_id, engine, url)
          DO UPDATE SET
            id = EXCLUDED.id,
          crawl_run_id = EXCLUDED.crawl_run_id,
          rank = EXCLUDED.rank,
          title = EXCLUDED.title,
          snippet = EXCLUDED.snippet,
          normalized_url = EXCLUDED.normalized_url,
          domain = EXCLUDED.domain,
          timestamp = EXCLUDED.timestamp,
          hash = EXCLUDED.hash,
          raw_html_path = EXCLUDED.raw_html_path,
          updated_at = EXCLUDED.updated_at
        `,
        params
      );
      console.info(`[Storage] INSERT completed successfully`);
    } catch (error) {
      console.error(`[Storage] INSERT failed:`, error);
      throw error;
    }
  }

  async recordCrawlRuns(records: CrawlRunRecordInput[]): Promise<void> {
    if (!records.length) return;
    await this.ensureCrawlRunsTable();

    console.info(`[Storage] recordCrawlRuns called with ${records.length} records`);
    
    // Check for duplicates by ID
    const idMap = new Map<string, number>();
    records.forEach(r => {
      idMap.set(r.id, (idMap.get(r.id) || 0) + 1);
    });
    const dupIds = Array.from(idMap.entries()).filter(([k,v]) => v > 1);
    if (dupIds.length > 0) {
      console.warn(`[Storage] recordCrawlRuns has ${dupIds.length} duplicate IDs!`);
      dupIds.slice(0, 3).forEach(([id, cnt]) => console.warn(`  ${id} → ${cnt} times`));
    }

    const columns = [
      "id",
      "batch_id",
      "query_id",
      "engine",
      "status",
      "started_at",
      "completed_at",
      "error",
      "result_count",
      "created_at",
      "updated_at"
    ];

    const params: unknown[] = [];
    const placeholders: string[] = [];

    records.forEach((record, index) => {
      const offset = index * columns.length;
      placeholders.push(`(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`);
      params.push(
        record.id,
        record.batchId,
        record.queryId,
        record.engine,
        record.status,
        record.startedAt.toISOString(),
        record.completedAt ? record.completedAt.toISOString() : null,
        record.error,
        record.resultCount,
        record.createdAt.toISOString(),
        record.updatedAt.toISOString()
      );
    });

    await this.pool.query(
      `
        INSERT INTO crawl_runs (
          ${columns.join(", ")}
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (id)
        DO UPDATE SET
          batch_id = EXCLUDED.batch_id,
          query_id = EXCLUDED.query_id,
          engine = EXCLUDED.engine,
          status = EXCLUDED.status,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          error = EXCLUDED.error,
          result_count = EXCLUDED.result_count,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `,
      params
    );
  }

  async fetchAnnotatedResults(options: FetchAnnotatedResultsOptions): Promise<AnnotatedResultView[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.since) {
      params.push(options.since.toISOString());
      conditions.push(`sr.timestamp >= $${params.length}`);
    }

    if (options.until) {
      params.push(options.until.toISOString());
      conditions.push(`sr.timestamp <= $${params.length}`);
    }

    if (options.queryIds && options.queryIds.length) {
      const placeholders = options.queryIds
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(`sr.query_id IN (${placeholders})`);
    }

    if (options.runIds && options.runIds.length) {
      const placeholders = options.runIds
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(
        `COALESCE(sr.crawl_run_id::text, ann.query_id || '-' || to_char(sr.timestamp, 'YYYYMMDDHH24MISS')) IN (${placeholders})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await this.pool.query<{
      run_id: string | null;
      batch_id: string | null;
      annotation_id: string;
      query_id: string;
      engine: string;
      normalized_url: string;
      domain: string;
      rank: number;
      factual_consistency: string;
      domain_type: string;
      collected_at: Date;
    }>(
      `
        SELECT
          COALESCE(sr.crawl_run_id::text, ann.query_id || '-' || to_char(sr.timestamp, 'YYYYMMDDHH24MISS')) AS run_id,
          cr.batch_id::text,
          ann.id::text AS annotation_id,
          sr.query_id::text,
          sr.engine,
          sr.normalized_url,
          sr.domain,
          sr.rank,
          ann.factual_consistency,
          ann.domain_type,
          sr.timestamp AS collected_at
        FROM annotations ann
        JOIN search_results sr ON sr.id = ann.search_result_id
        LEFT JOIN crawl_runs cr ON cr.id = sr.crawl_run_id
        ${whereClause}
        ORDER BY collected_at ASC, sr.query_id ASC, sr.engine ASC, sr.rank ASC
      `,
      params
    );

    return rows.map((row) =>
      AnnotatedResultViewSchema.parse({
        runId: row.run_id ?? `${row.query_id}-${row.collected_at.toISOString()}`,
        batchId: row.batch_id ?? undefined,
        annotationId: row.annotation_id,
        queryId: row.query_id,
        engine: row.engine,
        normalizedUrl: row.normalized_url,
        domain: row.domain,
        rank: row.rank,
        factualConsistency: row.factual_consistency,
        domainType: row.domain_type,
        collectedAt: row.collected_at
      })
    );
  }

  async fetchAlternativeSources(options: import("./types").FetchAlternativeSourcesOptions): Promise<AnnotatedResultView[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    // Filter by domain types
    if (options.domainTypes && options.domainTypes.length) {
      const placeholders = options.domainTypes.map((_, i) => `$${conditions.length + i + 1}`).join(", ");
      conditions.push(`ann.domain_type IN (${placeholders})`);
      params.push(...options.domainTypes);
    }

    // Filter by factual consistency
    if (options.factualConsistency && options.factualConsistency.length) {
      const placeholders = options.factualConsistency.map((_, i) => `$${conditions.length + i + 1}`).join(", ");
      conditions.push(`ann.factual_consistency IN (${placeholders})`);
      params.push(...options.factualConsistency);
    }

    // Exclude specific URLs
    if (options.excludeUrls && options.excludeUrls.length) {
      const placeholders = options.excludeUrls.map((_, i) => `$${conditions.length + i + 1}`).join(", ");
      conditions.push(`sr.normalized_url NOT IN (${placeholders})`);
      params.push(...options.excludeUrls);
    }

    // Filter by keywords in title/snippet
    if (options.queryKeywords && options.queryKeywords.length) {
      const keywordConditions = options.queryKeywords.map((keyword, i) => 
        `(LOWER(sr.title) LIKE LOWER($${conditions.length + i + 1}) OR LOWER(sr.snippet) LIKE LOWER($${conditions.length + i + 2}))`
      ).join(" OR ");
      conditions.push(`(${keywordConditions})`);
      params.push(...options.queryKeywords.flatMap(keyword => [`%${keyword}%`, `%${keyword}%`]));
    }

    // Filter by date
    if (options.since) {
      conditions.push(`sr.timestamp >= $${conditions.length + 1}`);
      params.push(options.since.toISOString());
    }

    // Limit results
    const limit = options.limit || 50;

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
      SELECT
        cr.id AS run_id,
        cr.batch_id,
        ann.id AS annotation_id,
        sr.query_id,
        sr.engine,
        sr.normalized_url,
        sr.domain,
        sr.rank,
        ann.factual_consistency,
        ann.domain_type,
        sr.timestamp AS collected_at
      FROM annotations ann
      JOIN search_results sr ON sr.id = ann.search_result_id
      LEFT JOIN crawl_runs cr ON cr.id = sr.crawl_run_id
      ${whereClause}
      ORDER BY sr.timestamp DESC, sr.rank ASC
      LIMIT $${conditions.length + 1}
    `;

    params.push(limit);

    const result = await this.pool.query(query, params);

    return result.rows.map((row): AnnotatedResultView => ({
      runId: row.run_id || "",
      batchId: row.batch_id || "",
      annotationId: row.annotation_id,
      queryId: row.query_id,
      engine: row.engine,
      normalizedUrl: row.normalized_url,
      domain: row.domain,
      rank: row.rank,
      factualConsistency: row.factual_consistency,
      domainType: row.domain_type,
      collectedAt: new Date(row.collected_at)
    }));
  }

  async insertMetricRecords(records: MetricRecordInput[]): Promise<void> {
    if (!records.length) return;
    await this.ensureMetricTable();

    const placeholders: string[] = [];
    const params: unknown[] = [];

    records.forEach((record, index) => {
      const offset = index * METRIC_COLUMNS.length;
      placeholders.push(
        `(${METRIC_COLUMNS.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`
      );

      params.push(
        record.id,
        record.crawlRunId,
        record.queryId,
        record.engine,
        record.metricType,
        record.value,
        record.delta,
        record.comparedToRunId,
        record.collectedAt.toISOString(),
        record.extra ?? {},
        record.createdAt.toISOString()
      );
    });

    await this.pool.query(
      `
        INSERT INTO metric_records (
          ${METRIC_COLUMNS.join(",")}
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (id)
        DO UPDATE SET
          crawl_run_id = EXCLUDED.crawl_run_id,
          query_id = EXCLUDED.query_id,
          engine = EXCLUDED.engine,
          metric_type = EXCLUDED.metric_type,
          value = EXCLUDED.value,
          delta = EXCLUDED.delta,
          compared_to_run_id = EXCLUDED.compared_to_run_id,
          collected_at = EXCLUDED.collected_at,
          extra = EXCLUDED.extra,
          created_at = EXCLUDED.created_at
      `,
      params
    );
  }

  async fetchRecentMetricRecords(
    metricType: MetricRecordInput["metricType"],
    limit: number
  ): Promise<MetricRecordInput[]> {
    await this.ensureMetricTable();
    const { rows } = await this.pool.query<{
      id: string;
      crawl_run_id: string | null;
      query_id: string;
      engine: string | null;
      metric_type: string;
      value: number;
      delta: number | null;
      compared_to_run_id: string | null;
      collected_at: Date;
      extra: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `
        SELECT *
        FROM metric_records
        WHERE metric_type = $1
        ORDER BY collected_at DESC
        LIMIT $2
      `,
      [metricType, limit]
    );

    return rows.map((row) => ({
      id: row.id,
      crawlRunId: row.crawl_run_id,
      queryId: row.query_id,
      engine: row.engine,
      metricType: row.metric_type as MetricRecordInput["metricType"],
      value: row.value,
      delta: row.delta,
      comparedToRunId: row.compared_to_run_id,
      collectedAt: row.collected_at,
      extra: row.extra ?? undefined,
      createdAt: row.created_at
    }));
  }

  async exportDataset(options: DatasetExportOptions): Promise<DatasetExportResult> {
    await this.ensureDatasetVersionsTable();

    const format = options.format ?? DatasetFormatEnum.enum.parquet;
    if (!DatasetFormatEnum.options.includes(format)) {
      throw new Error(`Unsupported dataset format for Postgres export: ${format}`);
    }

    await fs.mkdir(options.outputDir, { recursive: true });

    const filters = (options.filters ?? {}) as NonNullable<DatasetExportOptions["filters"]>;
    const params: unknown[] = [];

    const buildWhereClause = (
      alias: string,
      timestampColumn: string,
      allowNullEngine = false
    ): string => {
      const conditions: string[] = [];

      if (filters.queryIds && filters.queryIds.length) {
        const placeholders = filters.queryIds.map(() => `$${params.length + 1}`).join(", ");
        params.push(...filters.queryIds);
        conditions.push(`${alias}.query_id IN (${placeholders})`);
      }

      if (filters.engines && filters.engines.length) {
        const column = allowNullEngine ? `COALESCE(${alias}.engine, '')` : `${alias}.engine`;
        const placeholders = filters.engines.map(() => `$${params.length + 1}`).join(", ");
        params.push(...filters.engines);
        conditions.push(`${column} IN (${placeholders})`);
      }

      if (filters.since) {
        params.push(filters.since.toISOString());
        conditions.push(`${alias}.${timestampColumn} >= $${params.length}`);
      }

      if (filters.until) {
        params.push(filters.until.toISOString());
        conditions.push(`${alias}.${timestampColumn} <= $${params.length}`);
      }

      return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    };

    let query = "";
    let summaryQuery = "";
    let whereClause = "";

    switch (options.datasetType) {
      case DatasetTypeEnum.enum.search_results: {
        await this.ensureSearchResultsTable();
        whereClause = buildWhereClause("sr", "timestamp");
        query = `
          SELECT
            sr.id,
            sr.crawl_run_id,
            sr.query_id,
            sr.engine,
            sr.rank,
            sr.title,
            sr.snippet,
            sr.url,
            sr.normalized_url,
            sr.domain,
            sr.timestamp,
            sr.hash,
            sr.raw_html_path,
            sr.created_at,
            sr.updated_at
          FROM search_results sr
          ${whereClause}
          ORDER BY sr.timestamp ASC, sr.query_id ASC, sr.engine ASC, sr.rank ASC
        `;
        summaryQuery = `
          SELECT
            COUNT(*) AS count,
            COUNT(DISTINCT sr.query_id) AS distinct_queries,
            COUNT(DISTINCT sr.engine) AS distinct_engines,
            MIN(sr.timestamp) AS min_ts,
            MAX(sr.timestamp) AS max_ts
          FROM search_results sr
          ${whereClause}
        `;
        break;
      }
      case DatasetTypeEnum.enum.annotated_results: {
        await this.ensureAnnotationTable();
        await this.ensureSearchResultsTable();
        whereClause = buildWhereClause("sr", "timestamp");
        query = `
          SELECT
            ann.id AS annotation_id,
            sr.id AS search_result_id,
            sr.query_id,
            sr.engine,
            sr.rank,
            sr.title,
            sr.snippet,
            sr.url,
            sr.normalized_url,
            sr.domain,
            sr.timestamp,
            sr.hash,
            sr.raw_html_path,
            ann.domain_type,
            ann.factual_consistency,
            ann.confidence,
            ann.prompt_version,
            ann.model_id,
            ann.extra,
            sr.crawl_run_id,
            sr.created_at,
            sr.updated_at,
            ann.created_at AS annotated_at
          FROM annotations ann
          JOIN search_results sr ON sr.id = ann.search_result_id
          ${whereClause}
          ORDER BY sr.timestamp ASC, sr.query_id ASC, sr.engine ASC, sr.rank ASC
        `;
        summaryQuery = `
          SELECT
            COUNT(*) AS count,
            COUNT(DISTINCT sr.query_id) AS distinct_queries,
            COUNT(DISTINCT sr.engine) AS distinct_engines,
            MIN(sr.timestamp) AS min_ts,
            MAX(sr.timestamp) AS max_ts
          FROM annotations ann
          JOIN search_results sr ON sr.id = ann.search_result_id
          ${whereClause}
        `;
        break;
      }
      case DatasetTypeEnum.enum.metrics: {
        await this.ensureMetricTable();
        whereClause = buildWhereClause("mr", "collected_at", true);
        query = `
          SELECT
            mr.id,
            mr.crawl_run_id,
            mr.query_id,
            mr.engine,
            mr.metric_type,
            mr.value,
            mr.delta,
            mr.compared_to_run_id,
            mr.collected_at,
            mr.extra,
            mr.created_at
          FROM metric_records mr
          ${whereClause}
          ORDER BY mr.collected_at ASC
        `;
        summaryQuery = `
          SELECT
            COUNT(*) AS count,
            COUNT(DISTINCT mr.query_id) AS distinct_queries,
            COUNT(DISTINCT COALESCE(mr.engine, '')) AS distinct_engines,
            MIN(mr.collected_at) AS min_ts,
            MAX(mr.collected_at) AS max_ts
          FROM metric_records mr
          ${whereClause}
        `;
        break;
      }
      default:
        throw new Error(`Unsupported dataset type for Postgres export: ${options.datasetType}`);
    }

    const queryParams = [...params];
    const queryResult = await this.pool.query<Record<string, unknown>>(query, queryParams);
    const normalizedRows = queryResult.rows.map((row) => normalizeRow(row));
    const fieldDefs = queryResult.fields ?? [];

    const summaryParams = [...params];
    const { rows: summaryRows } = await this.pool.query<{
      count: string | number;
      distinct_queries: string | number | null;
      distinct_engines: string | number | null;
      min_ts: Date | null;
      max_ts: Date | null;
    }>(summaryQuery, summaryParams);

    const summary = summaryRows[0] ?? {
      count: 0,
      distinct_queries: 0,
      distinct_engines: 0,
      min_ts: null,
      max_ts: null
    };

    const recordCount = Number(summary.count ?? 0);
    const distinctQueries = Number(summary.distinct_queries ?? 0);
    const distinctEngines = Number(summary.distinct_engines ?? 0);
    const minTimestamp = summary.min_ts ? new Date(summary.min_ts) : null;
    const maxTimestamp = summary.max_ts ? new Date(summary.max_ts) : null;

    const timestamp = new Date();
    const slug = buildTimestampSlug(timestamp);
    const extension =
      format === DatasetFormatEnum.enum.json ? "jsonl" : format === DatasetFormatEnum.enum.csv ? "csv" : "parquet";
    const fileName = `${options.datasetType}-${slug}.${extension}`;
    const filePath = path.join(options.outputDir, fileName);

    switch (format) {
      case DatasetFormatEnum.enum.parquet: {
        await writeParquetFromRows(normalizedRows, fieldDefs, filePath);
        break;
      }
      case DatasetFormatEnum.enum.csv: {
        const headers = fieldDefs.map((field) => field.name);
        const effectiveHeaders = headers.length
          ? headers
          : normalizedRows.length
            ? Object.keys(normalizedRows[0])
            : [];
        const lines: string[] = [];
        if (effectiveHeaders.length) {
          lines.push(effectiveHeaders.join(","));
          for (const row of normalizedRows) {
            const values = effectiveHeaders.map((header) =>
              formatCsvValue((row as Record<string, unknown>)[header])
            );
            lines.push(values.join(","));
          }
        }
        await fs.writeFile(filePath, lines.length ? `${lines.join("\n")}\n` : "");
        break;
      }
      case DatasetFormatEnum.enum.json: {
        const jsonLines = normalizedRows.map((row) => JSON.stringify(row)).join("\n");
        await fs.writeFile(filePath, jsonLines ? `${jsonLines}\n` : "");
        break;
      }
      default:
        throw new Error(`Unsupported dataset format for Postgres export: ${format}`);
    }

    const metadata = {
      datasetType: options.datasetType,
      filters: {
        ...filters,
        since: filters.since ? filters.since.toISOString() : undefined,
        until: filters.until ? filters.until.toISOString() : undefined
      },
      runId: options.runId ?? null,
      distinctQueries,
      distinctEngines,
      timeRange: {
        from: minTimestamp ? minTimestamp.toISOString() : null,
        to: maxTimestamp ? maxTimestamp.toISOString() : null
      },
      generatedAt: timestamp.toISOString()
    } as const;

    const versionId = randomUUID();

    await this.pool.query(
      `
        INSERT INTO dataset_versions (
          id,
          dataset_type,
          format,
          path,
          run_id,
          record_count,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        versionId,
        options.datasetType,
        format,
        filePath,
        options.runId ?? null,
        recordCount,
        metadata,
        timestamp.toISOString()
      ]
    );

    const version = DatasetVersionSchema.parse({
      id: versionId,
      datasetType: options.datasetType,
      format,
      path: filePath,
      runId: options.runId ?? null,
      recordCount,
      metadata,
      createdAt: timestamp
    });

    return {
      version,
      filePath
    };
  }

  async upsertAnnotationAggregates(records: AnnotationAggregateRecordInput[]): Promise<void> {
    if (!records.length) return;
    await this.ensureAnnotationAggregateTable();

    const placeholders: string[] = [];
    const params: unknown[] = [];
    const columns = [
      "id",
      "run_id",
      "query_id",
      "engine",
      "domain_type",
      "factual_consistency",
      "count",
      "total_annotations",
      "collected_at",
      "extra",
      "created_at"
    ];

    records.forEach((record, index) => {
      const offset = index * columns.length;
      placeholders.push(`(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`);
      params.push(
        record.id,
        record.runId,
        record.queryId,
        record.engine,
        record.domainType,
        record.factualConsistency,
        record.count,
        record.totalAnnotations,
        record.collectedAt.toISOString(),
        record.extra ?? {},
        record.createdAt.toISOString()
      );
    });

    await this.pool.query(
      `
        INSERT INTO annotation_aggregates (
          ${columns.join(",")}
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (id)
        DO UPDATE SET
          run_id = EXCLUDED.run_id,
          query_id = EXCLUDED.query_id,
          engine = EXCLUDED.engine,
          domain_type = EXCLUDED.domain_type,
          factual_consistency = EXCLUDED.factual_consistency,
          count = EXCLUDED.count,
          total_annotations = EXCLUDED.total_annotations,
          collected_at = EXCLUDED.collected_at,
          extra = EXCLUDED.extra,
          created_at = EXCLUDED.created_at
      `,
      params
    );
  }

  async fetchAnnotationAggregates(options: FetchAnnotationAggregateOptions): Promise<AnnotationAggregateRecord[]> {
    await this.ensureAnnotationAggregateTable();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.runIds && options.runIds.length) {
      const placeholders = options.runIds
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(`run_id IN (${placeholders})`);
    }

    if (options.queryIds && options.queryIds.length) {
      const placeholders = options.queryIds
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(`query_id IN (${placeholders})`);
    }

    if (options.engines && options.engines.length) {
      const placeholders = options.engines
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(`COALESCE(engine, '') IN (${placeholders})`);
    }

    if (options.domainTypes && options.domainTypes.length) {
      const placeholders = options.domainTypes
        .map((value) => {
          params.push(value);
          return `$${params.length}`;
        })
        .join(", ");
      conditions.push(`domain_type IN (${placeholders})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await this.pool.query<{
      id: string;
      run_id: string;
      query_id: string;
      engine: string | null;
      domain_type: string;
      factual_consistency: string;
      count: number;
      total_annotations: number;
      collected_at: Date;
      extra: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `
        SELECT *
        FROM annotation_aggregates
        ${whereClause}
      `,
      params
    );

    return rows.map((row) =>
      AnnotationAggregateRecordSchema.parse({
        id: row.id,
        runId: row.run_id,
        queryId: row.query_id,
        engine: row.engine,
        domainType: row.domain_type,
        factualConsistency: row.factual_consistency,
        count: row.count,
        totalAnnotations: row.total_annotations,
        collectedAt: row.collected_at,
        extra: row.extra ?? undefined,
        createdAt: row.created_at
      })
    );
  }

  async recordAuditSamples(samples: AuditSampleRecordInput[]): Promise<void> {
    if (!samples.length) return;
    await this.ensureAuditSamplesTable();

    const params: unknown[] = [];
    const placeholders: string[] = [];

    samples.forEach((sample, index) => {
      const offset = index * AUDIT_SAMPLE_COLUMNS.length;
      placeholders.push(
        `(${AUDIT_SAMPLE_COLUMNS.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`
      );
      params.push(
        sample.id,
        sample.runId,
        sample.annotationId,
        sample.queryId,
        sample.engine,
        sample.reviewer,
        sample.status,
        sample.notes,
        sample.createdAt.toISOString(),
        sample.updatedAt.toISOString()
      );
    });

    await this.pool.query(
      `
        INSERT INTO audit_samples (
          ${AUDIT_SAMPLE_COLUMNS.join(",")}
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (id)
        DO UPDATE SET
          run_id = EXCLUDED.run_id,
          annotation_id = EXCLUDED.annotation_id,
          query_id = EXCLUDED.query_id,
          engine = EXCLUDED.engine,
          reviewer = EXCLUDED.reviewer,
          status = EXCLUDED.status,
          notes = EXCLUDED.notes,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `,
      params
    );
  }

  async fetchAuditSamples(runId: string): Promise<AuditSampleRecordInput[]> {
    await this.ensureAuditSamplesTable();
    const { rows } = await this.pool.query<{
      id: string;
      run_id: string;
      annotation_id: string;
      query_id: string;
      engine: string;
      reviewer: string | null;
      status: string;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT *
        FROM audit_samples
        WHERE run_id = $1
        ORDER BY created_at ASC
      `,
      [runId]
    );

    return rows.map((row) => {
      const parsed = AuditSampleSchema.parse({
        id: row.id,
        runId: row.run_id,
        annotationId: row.annotation_id,
        queryId: row.query_id,
        engine: row.engine,
        reviewer: row.reviewer,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });

      return {
        id: parsed.id,
        runId: parsed.runId,
        annotationId: parsed.annotationId,
        queryId: parsed.queryId,
        engine: parsed.engine,
        reviewer: parsed.reviewer,
        status: parsed.status,
        notes: parsed.notes,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt
      } satisfies AuditSampleRecordInput;
    });
  }

  async recordPipelineRun(input: PipelineRunRecordInput): Promise<void> {
    await this.ensurePipelineTables();
    await this.pool.query(
      `
        INSERT INTO pipeline_runs (
          id,
          status,
          started_at,
          completed_at,
          error,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          error = EXCLUDED.error,
          metadata = EXCLUDED.metadata,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        input.id,
        input.status,
        input.startedAt.toISOString(),
        input.completedAt ? input.completedAt.toISOString() : null,
        input.error,
        input.metadata ?? {},
        input.createdAt.toISOString(),
        input.updatedAt.toISOString()
      ]
    );
  }

  async recordPipelineStage(input: PipelineStageLogInput): Promise<void> {
    await this.ensurePipelineTables();
    await this.pool.query(
      `
        INSERT INTO pipeline_stage_logs (
          id,
          run_id,
          stage,
          status,
          attempts,
          started_at,
          completed_at,
          error,
          metadata,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id)
        DO UPDATE SET
          run_id = EXCLUDED.run_id,
          stage = EXCLUDED.stage,
          status = EXCLUDED.status,
          attempts = EXCLUDED.attempts,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          error = EXCLUDED.error,
          metadata = EXCLUDED.metadata,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at
      `,
      [
        input.id,
        input.runId,
        input.stage,
        input.status,
        input.attempts,
        input.startedAt.toISOString(),
        input.completedAt ? input.completedAt.toISOString() : null,
        input.error,
        input.metadata ?? {},
        input.createdAt.toISOString(),
        input.updatedAt.toISOString()
      ]
    );
  }

  async fetchPipelineRuns(options: FetchPipelineRunOptions = {}): Promise<PipelineRun[]> {
    await this.ensurePipelineTables();
    const limit = options.limit ?? 50;
    const { rows } = await this.pool.query<{
      id: string;
      status: string;
      started_at: Date;
      completed_at: Date | null;
      error: string | null;
      metadata: Record<string, unknown> | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT *
        FROM pipeline_runs
        ORDER BY started_at DESC
        LIMIT $1
      `,
      [limit]
    );

    return rows.map((row) => ({
      id: row.id,
      status: row.status as PipelineRun["status"],
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async fetchPipelineStages(runId: string): Promise<PipelineStageLog[]> {
    await this.ensurePipelineTables();
    const { rows } = await this.pool.query<{
      id: string;
      run_id: string;
      stage: string;
      status: string;
      attempts: number;
      started_at: Date;
      completed_at: Date | null;
      error: string | null;
      metadata: Record<string, unknown> | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT *
        FROM pipeline_stage_logs
        WHERE run_id = $1
        ORDER BY started_at ASC
      `,
      [runId]
    );

    return rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      stage: row.stage as PipelineStageLog["stage"],
      status: row.status as PipelineRun["status"],
      attempts: row.attempts,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async upsertViewpoints(records: import("./types").ViewpointRecordInput[]): Promise<void> {
    if (records.length === 0) return;
    await this.ensureViewpointsTable();

    const values = records.map((r) => [
      r.id,
      r.queryId,
      r.crawlRunId,
      r.engine,
      r.numResults,
      r.summary ?? null,
      r.citationsCount,
      r.overlapHash ?? null,
      r.collectedAt.toISOString(),
      r.createdAt.toISOString(),
      r.updatedAt.toISOString()
    ]);

    const placeholders = values
      .map((_, i) => {
        const base = i * 11;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11})`;
      })
      .join(", ");

    const flatValues = values.flat();

    await this.pool.query(
      `
        INSERT INTO viewpoints (
          id, query_id, crawl_run_id, engine, num_results, summary,
          citations_count, overlap_hash, collected_at, created_at, updated_at
        )
        VALUES ${placeholders}
        ON CONFLICT (query_id, crawl_run_id, engine)
        DO UPDATE SET
          num_results = EXCLUDED.num_results,
          summary = EXCLUDED.summary,
          citations_count = EXCLUDED.citations_count,
          overlap_hash = EXCLUDED.overlap_hash,
          collected_at = EXCLUDED.collected_at,
          updated_at = EXCLUDED.updated_at
      `,
      flatValues
    );
  }

  async fetchViewpointsByQuery(options: import("./types").FetchViewpointsByQueryOptions): Promise<import("./types").ViewpointRecordInput[]> {
    await this.ensureViewpointsTable();

    const conditions: string[] = ["query_id = $1"];
    const params: any[] = [options.queryId];

    if (options.runId) {
      conditions.push("crawl_run_id = $2");
      params.push(options.runId);
    }

    if (options.engines && options.engines.length > 0) {
      const enginePlaceholders = options.engines.map((_, i) => `$${params.length + i + 1}`).join(", ");
      conditions.push(`engine IN (${enginePlaceholders})`);
      params.push(...options.engines);
    }

    const { rows } = await this.pool.query<{
      id: string;
      query_id: string;
      crawl_run_id: string | null;
      engine: string;
      num_results: number;
      summary: string | null;
      citations_count: number;
      overlap_hash: string | null;
      collected_at: Date;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT *
        FROM viewpoints
        WHERE ${conditions.join(" AND ")}
        ORDER BY engine, collected_at DESC
      `,
      params
    );

    return rows.map((row) => ({
      id: row.id,
      queryId: row.query_id,
      crawlRunId: row.crawl_run_id,
      engine: row.engine,
      numResults: row.num_results,
      summary: row.summary,
      citationsCount: row.citations_count,
      overlapHash: row.overlap_hash,
      collectedAt: row.collected_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPostgresStorageClient(url: string): StorageClient {
  return new PostgresStorageClient(url);
}
