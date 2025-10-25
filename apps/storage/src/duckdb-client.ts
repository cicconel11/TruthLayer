import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import duckdb from "duckdb";
import {
  AnnotatedResultView,
  AnnotatedResultViewSchema,
  AnnotationAggregateRecord,
  AnnotationAggregateRecordSchema,
  AuditSampleSchema,
  DatasetVersionSchema,
  DatasetTypeEnum,
  DatasetFormatEnum,
  PipelineRun,
  PipelineStageLog,
  SearchResult,
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
  PipelineRunRecordInput,
  PipelineStageLogInput,
  FetchPipelineRunOptions,
  AuditSampleRecordInput,
  StorageClient
} from "./types";

function ensureDirectoryExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function run(conn: duckdb.Connection, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const callback = (err: unknown) => {
      if (err) reject(err);
      else resolve();
    };

    if (params.length) {
      conn.run(sql, ...params, callback as (...args: unknown[]) => void);
    } else {
      conn.run(sql, callback as (...args: unknown[]) => void);
    }
  });
}

function all<T = Record<string, unknown>>(
  conn: duckdb.Connection,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const callback = (err: unknown, rows: unknown) => {
      if (err) {
        reject(err);
      } else {
        resolve((rows as T[]) ?? []);
      }
    };

    if (params.length) {
      conn.all(sql, ...params, callback as (...args: unknown[]) => void);
    } else {
      conn.all(sql, callback as (...args: unknown[]) => void);
    }
  });
}

function closeConnection(conn: duckdb.Connection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.close((err?: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function closeDatabase(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((err?: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export interface DuckDBStorageOptions {
  path: string;
}

export class DuckDBStorageClient implements StorageClient {
  private readonly db: duckdb.Database;

  constructor(options: DuckDBStorageOptions) {
    ensureDirectoryExists(options.path);
    this.db = new duckdb.Database(options.path);
  }

  private async getConnection(): Promise<duckdb.Connection> {
    return this.db.connect();
  }

  private async ensureAnnotationTable(conn: duckdb.Connection) {
    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS annotations (
          id VARCHAR PRIMARY KEY,
          search_result_id VARCHAR NOT NULL,
          query_id VARCHAR NOT NULL,
          engine VARCHAR NOT NULL,
          domain_type VARCHAR NOT NULL,
          factual_consistency VARCHAR NOT NULL,
          confidence DOUBLE,
          prompt_version VARCHAR NOT NULL,
          model_id VARCHAR NOT NULL,
          extra JSON,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL
        )
      `
    );
  }

  private async ensureSearchResultsTable(conn: duckdb.Connection) {
    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS search_results (
          id VARCHAR PRIMARY KEY,
          crawl_run_id VARCHAR,
          query_id VARCHAR NOT NULL,
          engine VARCHAR NOT NULL,
          rank INTEGER NOT NULL,
          title VARCHAR NOT NULL,
          snippet VARCHAR,
          url VARCHAR NOT NULL,
          normalized_url VARCHAR NOT NULL,
          domain VARCHAR NOT NULL,
          timestamp TIMESTAMP NOT NULL,
          hash VARCHAR NOT NULL,
          raw_html_path VARCHAR NOT NULL,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL
        )
      `
    );
  }

  private async ensureCrawlRunsTable(conn: duckdb.Connection) {
    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS crawl_runs (
          id VARCHAR PRIMARY KEY,
          batch_id VARCHAR NOT NULL,
          query_id VARCHAR NOT NULL,
          engine VARCHAR NOT NULL,
          status VARCHAR NOT NULL,
          started_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP,
          error VARCHAR,
          result_count INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL
        )
      `
    );
  }

  private async ensureDatasetVersionsTable(conn: duckdb.Connection) {
    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS dataset_versions (
          id VARCHAR PRIMARY KEY,
          dataset_type VARCHAR NOT NULL,
          format VARCHAR NOT NULL,
          path VARCHAR NOT NULL,
          run_id VARCHAR,
          record_count INTEGER NOT NULL,
          metadata JSON NOT NULL,
          created_at TIMESTAMP NOT NULL
        )
      `
    );
  }

  private async ensurePipelineTables(conn: duckdb.Connection) {
    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS pipeline_runs (
          id VARCHAR PRIMARY KEY,
          status VARCHAR NOT NULL,
          started_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP,
          error VARCHAR,
          metadata JSON,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL
        )
      `
    );

    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS pipeline_stage_logs (
          id VARCHAR PRIMARY KEY,
          run_id VARCHAR NOT NULL REFERENCES pipeline_runs(id),
          stage VARCHAR NOT NULL,
          status VARCHAR NOT NULL,
          attempts INTEGER NOT NULL,
          started_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP,
          error VARCHAR,
          metadata JSON,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL
        )
      `
    );

    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS audit_samples (
          id VARCHAR PRIMARY KEY,
          run_id VARCHAR NOT NULL REFERENCES pipeline_runs(id),
          annotation_id VARCHAR NOT NULL,
          query_id VARCHAR NOT NULL,
          engine VARCHAR NOT NULL,
          reviewer VARCHAR,
          status VARCHAR NOT NULL,
          notes VARCHAR,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL
        )
      `
    );
  }

  async fetchPendingAnnotations(options: FetchPendingAnnotationsOptions): Promise<SearchResult[]> {
    const conn = await this.getConnection();
    try {
      await this.ensureAnnotationTable(conn);

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options.queryIds && options.queryIds.length) {
        const placeholders = options.queryIds.map(() => "?").join(", ");
        conditions.push(`sr.query_id IN (${placeholders})`);
        params.push(...options.queryIds);
      }

      if (options.engines && options.engines.length) {
        const placeholders = options.engines.map(() => "?").join(", ");
        conditions.push(`sr.engine IN (${placeholders})`);
        params.push(...options.engines);
      }

      const filters = conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
      const limitClause = options.limit ? `LIMIT ${options.limit}` : "";

      const rows = await all<Record<string, unknown>>(
        conn,
        `
          SELECT
            sr.id AS id,
            sr.crawl_run_id AS crawlRunId,
            sr.query_id AS queryId,
            sr.engine,
            sr.rank,
            sr.title,
            sr.snippet,
            sr.url,
            sr.normalized_url AS normalizedUrl,
            sr.domain,
            sr.timestamp,
            sr.hash,
            sr.raw_html_path AS rawHtmlPath,
            sr.created_at AS createdAt,
            sr.updated_at AS updatedAt
          FROM search_results sr
          LEFT JOIN annotations ann ON ann.search_result_id = sr.id
          WHERE ann.id IS NULL
          ${filters}
          ORDER BY sr.timestamp ASC
          ${limitClause}
        `,
        params
      );

      return rows.map((row) => SearchResultSchema.parse(row));
    } finally {
      await closeConnection(conn);
    }
  }

  async insertAnnotationRecords(records: AnnotationRecordInput[]): Promise<void> {
    if (!records.length) return;

    const conn = await this.getConnection();
    try {
      await this.ensureAnnotationTable(conn);

      const placeholders = records.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params: unknown[] = [];

      for (const record of records) {
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
          record.extra ? JSON.stringify(record.extra) : null,
          record.createdAt.toISOString(),
          record.updatedAt.toISOString()
        );
      }

      await run(
        conn,
        `
          INSERT INTO annotations (
            id,
            search_result_id,
            query_id,
            engine,
            domain_type,
            factual_consistency,
            confidence,
            prompt_version,
            model_id,
            extra,
            created_at,
            updated_at
          ) VALUES ${placeholders}
          ON CONFLICT(id) DO UPDATE SET
            search_result_id = excluded.search_result_id,
            query_id = excluded.query_id,
            engine = excluded.engine,
            domain_type = excluded.domain_type,
            factual_consistency = excluded.factual_consistency,
            confidence = excluded.confidence,
            prompt_version = excluded.prompt_version,
            model_id = excluded.model_id,
            extra = excluded.extra,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `,
        params
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async insertSearchResults(records: SearchResultInput[]): Promise<void> {
    if (!records.length) return;

    const conn = await this.getConnection();
    try {
      await this.ensureSearchResultsTable(conn);

      const placeholders = records.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params: unknown[] = [];

      for (const record of records) {
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
      }

      await run(
        conn,
        `
          INSERT INTO search_results (
            id,
            crawl_run_id,
            query_id,
            engine,
            rank,
            title,
            snippet,
            url,
            normalized_url,
            domain,
            timestamp,
            hash,
            raw_html_path,
            created_at,
            updated_at
          ) VALUES ${placeholders}
          ON CONFLICT(id) DO UPDATE SET
            crawl_run_id = excluded.crawl_run_id,
            query_id = excluded.query_id,
            engine = excluded.engine,
            rank = excluded.rank,
            title = excluded.title,
            snippet = excluded.snippet,
            url = excluded.url,
            normalized_url = excluded.normalized_url,
            domain = excluded.domain,
            timestamp = excluded.timestamp,
            hash = excluded.hash,
            raw_html_path = excluded.raw_html_path,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `,
        params
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async recordCrawlRuns(records: CrawlRunRecordInput[]): Promise<void> {
    if (!records.length) return;

    const conn = await this.getConnection();
    try {
      await this.ensureCrawlRunsTable(conn);

      const placeholders = records.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params: unknown[] = [];

      for (const record of records) {
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
      }

      await run(
        conn,
        `
          INSERT INTO crawl_runs (
            id,
            batch_id,
            query_id,
            engine,
            status,
            started_at,
            completed_at,
            error,
            result_count,
            created_at,
            updated_at
          ) VALUES ${placeholders}
          ON CONFLICT(id) DO UPDATE SET
            batch_id = excluded.batch_id,
            query_id = excluded.query_id,
            engine = excluded.engine,
            status = excluded.status,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            error = excluded.error,
            result_count = excluded.result_count,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `,
        params
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async fetchAnnotatedResults(options: FetchAnnotatedResultsOptions): Promise<AnnotatedResultView[]> {
    const conn = await this.getConnection();
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options.since) {
        conditions.push("sr.timestamp >= ?");
        params.push(options.since.toISOString());
      }

      if (options.until) {
        conditions.push("sr.timestamp <= ?");
        params.push(options.until.toISOString());
      }

      if (options.queryIds && options.queryIds.length) {
        const placeholders = options.queryIds.map(() => "?").join(", ");
        conditions.push(`sr.query_id IN (${placeholders})`);
        params.push(...options.queryIds);
      }

      if (options.runIds && options.runIds.length) {
        const placeholders = options.runIds.map(() => "?").join(", ");
        conditions.push(
          `COALESCE(
            sr.crawl_run_id,
            ann.query_id || '-' || strftime(sr.timestamp, '%Y%m%d%H%M%S')
          ) IN (${placeholders})`
        );
        params.push(...options.runIds);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const rows = await all<{
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
        collected_at: string | Date;
      }>(
        conn,
        `
          SELECT
            COALESCE(sr.crawl_run_id, ann.query_id || '-' || strftime(sr.timestamp, '%Y%m%d%H%M%S')) AS run_id,
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
          ORDER BY collected_at ASC, sr.query_id ASC, sr.engine ASC, sr.rank ASC
        `,
        params
      );

          return rows.map((row) =>
            AnnotatedResultViewSchema.parse({
              runId: row.run_id ?? `${row.query_id}-${String(row.collected_at)}`,
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
    } finally {
      await closeConnection(conn);
    }
  }

  async insertMetricRecords(records: MetricRecordInput[]): Promise<void> {
    if (!records.length) return;

    const conn = await this.getConnection();
    try {
      await run(
        conn,
        `
          CREATE TABLE IF NOT EXISTS metric_records (
            id VARCHAR PRIMARY KEY,
            crawl_run_id VARCHAR,
            query_id VARCHAR NOT NULL,
            engine VARCHAR,
            metric_type VARCHAR NOT NULL,
            value DOUBLE NOT NULL,
            delta DOUBLE,
            compared_to_run_id VARCHAR,
            collected_at TIMESTAMP NOT NULL,
            extra JSON,
            created_at TIMESTAMP NOT NULL
          )
        `
      );

      const placeholders = records
        .map(
          () =>
            "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .join(", ");

      const params: unknown[] = [];
      for (const record of records) {
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
          record.extra ? JSON.stringify(record.extra) : null,
          record.createdAt.toISOString()
        );
      }

      await run(
        conn,
        `
          INSERT INTO metric_records (
            id,
            crawl_run_id,
            query_id,
            engine,
            metric_type,
            value,
            delta,
            compared_to_run_id,
            collected_at,
            extra,
            created_at
          ) VALUES ${placeholders}
        `,
        params
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async fetchRecentMetricRecords(
    metricType: MetricRecordInput["metricType"],
    limit: number
  ): Promise<MetricRecordInput[]> {
    const conn = await this.getConnection();
    try {
      await run(
        conn,
        `
          CREATE TABLE IF NOT EXISTS metric_records (
            id VARCHAR PRIMARY KEY,
            crawl_run_id VARCHAR,
            query_id VARCHAR NOT NULL,
            engine VARCHAR,
            metric_type VARCHAR NOT NULL,
            value DOUBLE NOT NULL,
            delta DOUBLE,
            compared_to_run_id VARCHAR,
            collected_at TIMESTAMP NOT NULL,
            extra JSON,
            created_at TIMESTAMP NOT NULL
          )
        `
      );

      const rows = await all<{
        id: string;
        crawl_run_id: string | null;
        query_id: string;
        engine: string | null;
        metric_type: string;
        value: number;
        delta: number | null;
        compared_to_run_id: string | null;
        collected_at: string | Date;
        extra: string | null;
        created_at: string | Date;
      }>(
        conn,
        `
          SELECT *
          FROM metric_records
          WHERE metric_type = ?
          ORDER BY collected_at DESC
          LIMIT ?
        `,
        [metricType, limit]
      );

      return rows.map((row) => ({
        id: row.id,
        crawlRunId: row.crawl_run_id ?? null,
        queryId: row.query_id,
        engine: row.engine,
        metricType: row.metric_type as MetricRecordInput["metricType"],
        value: row.value,
        delta: row.delta,
        comparedToRunId: row.compared_to_run_id,
        collectedAt: new Date(row.collected_at),
        extra: row.extra ? JSON.parse(row.extra) : undefined,
        createdAt: new Date(row.created_at)
      }));
    } finally {
      await closeConnection(conn);
    }
  }

  private async ensureAnnotationAggregatesTable(conn: duckdb.Connection) {
    await run(
      conn,
      `
        CREATE TABLE IF NOT EXISTS annotation_aggregates (
          id VARCHAR PRIMARY KEY,
          run_id VARCHAR NOT NULL,
          query_id VARCHAR NOT NULL,
          engine VARCHAR,
          domain_type VARCHAR NOT NULL,
          factual_consistency VARCHAR NOT NULL,
          count INTEGER NOT NULL,
          total_annotations INTEGER NOT NULL,
          collected_at TIMESTAMP NOT NULL,
          extra JSON,
          created_at TIMESTAMP NOT NULL
        )
      `
    );
  }

  async upsertAnnotationAggregates(records: AnnotationAggregateRecordInput[]): Promise<void> {
    if (!records.length) return;

    const conn = await this.getConnection();
    try {
      await this.ensureAnnotationAggregatesTable(conn);

      const placeholders = records.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params: unknown[] = [];

      for (const record of records) {
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
          record.extra ? JSON.stringify(record.extra) : null,
          record.createdAt.toISOString()
        );
      }

      await run(
        conn,
        `
          INSERT INTO annotation_aggregates (
            id,
            run_id,
            query_id,
            engine,
            domain_type,
            factual_consistency,
            count,
            total_annotations,
            collected_at,
            extra,
            created_at
          ) VALUES ${placeholders}
          ON CONFLICT(id) DO UPDATE SET
            run_id = excluded.run_id,
            query_id = excluded.query_id,
            engine = excluded.engine,
            domain_type = excluded.domain_type,
            factual_consistency = excluded.factual_consistency,
            count = excluded.count,
            total_annotations = excluded.total_annotations,
            collected_at = excluded.collected_at,
            extra = excluded.extra,
            created_at = excluded.created_at
        `,
        params
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async fetchAnnotationAggregates(options: FetchAnnotationAggregateOptions): Promise<AnnotationAggregateRecord[]> {
    const conn = await this.getConnection();
    try {
      await this.ensureAnnotationAggregatesTable(conn);

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options.runIds && options.runIds.length) {
        const placeholders = options.runIds.map(() => "?").join(", ");
        conditions.push(`run_id IN (${placeholders})`);
        params.push(...options.runIds);
      }

      if (options.queryIds && options.queryIds.length) {
        const placeholders = options.queryIds.map(() => "?").join(", ");
        conditions.push(`query_id IN (${placeholders})`);
        params.push(...options.queryIds);
      }

      if (options.engines && options.engines.length) {
        const placeholders = options.engines.map(() => "?").join(", ");
        conditions.push(`COALESCE(engine, '') IN (${placeholders})`);
        params.push(...options.engines);
      }

      if (options.domainTypes && options.domainTypes.length) {
        const placeholders = options.domainTypes.map(() => "?").join(", ");
        conditions.push(`domain_type IN (${placeholders})`);
        params.push(...options.domainTypes);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const rows = await all<{
        id: string;
        run_id: string;
        query_id: string;
        engine: string | null;
        domain_type: string;
        factual_consistency: string;
        count: number;
        total_annotations: number;
        collected_at: string | Date;
        extra: string | null;
        created_at: string | Date;
      }>(
        conn,
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
          extra: row.extra ? JSON.parse(row.extra) : undefined,
          createdAt: row.created_at
        })
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async exportDataset(options: DatasetExportOptions): Promise<DatasetExportResult> {
    const format = options.format ?? DatasetFormatEnum.enum.parquet;
    if (format !== DatasetFormatEnum.enum.parquet) {
      throw new Error(`DuckDB exporter currently supports only Parquet format. Requested: ${format}`);
    }

    const timestamp = new Date();
    const safeDatasetDir = path.join(options.outputDir, options.datasetType);
    const fileName = `${options.datasetType}-${timestamp.toISOString().replace(/[:.]/g, "-")}.parquet`;
    const filePath = path.join(safeDatasetDir, fileName);
    ensureDirectoryExists(filePath);

    const conn = await this.getConnection();

    const filters = options.filters ?? {};
    const sanitize = (value: string) => value.replace(/'/g, "''");

    const buildWhereClause = (tableAlias: string) => {
      const clauses: string[] = [];

      if (filters.queryIds && filters.queryIds.length) {
        const values = filters.queryIds.map((value) => `'${sanitize(value)}'`).join(", ");
        clauses.push(`${tableAlias}.query_id IN (${values})`);
      }

      if (filters.engines && filters.engines.length) {
        const values = filters.engines.map((value) => `'${sanitize(value)}'`).join(", ");
        clauses.push(`${tableAlias}.engine IN (${values})`);
      }

      if (filters.since) {
        clauses.push(`${tableAlias}.timestamp >= '${filters.since.toISOString()}'`);
      }

      if (filters.until) {
        clauses.push(`${tableAlias}.timestamp <= '${filters.until.toISOString()}'`);
      }

      return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    };

    try {
      let query: string;
      let summaryQuery: string;

      switch (options.datasetType) {
        case DatasetTypeEnum.enum.search_results: {
          await this.ensureSearchResultsTable(conn);
          const whereClause = buildWhereClause("search_results");
          query = `SELECT * FROM search_results ${whereClause}`;
          summaryQuery = `
            SELECT
              COUNT(*) AS count,
              COUNT(DISTINCT query_id) AS distinct_queries,
              COUNT(DISTINCT engine) AS distinct_engines,
              MIN(timestamp) AS min_ts,
              MAX(timestamp) AS max_ts
            FROM search_results
            ${whereClause}
          `;
          break;
        }
        case DatasetTypeEnum.enum.annotated_results: {
          await this.ensureAnnotationTable(conn);
          await this.ensureSearchResultsTable(conn);
          const whereClause = buildWhereClause("sr");
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
          const clauses: string[] = [];
          if (filters.queryIds && filters.queryIds.length) {
            const values = filters.queryIds.map((value) => `'${sanitize(value)}'`).join(", ");
            clauses.push(`query_id IN (${values})`);
          }
          if (filters.engines && filters.engines.length) {
            const values = filters.engines.map((value) => `'${sanitize(value)}'`).join(", ");
            clauses.push(`COALESCE(engine, '') IN (${values})`);
          }
          if (filters.since) {
            clauses.push(`collected_at >= '${filters.since.toISOString()}'`);
          }
          if (filters.until) {
            clauses.push(`collected_at <= '${filters.until.toISOString()}'`);
          }
          const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
          await run(
            conn,
            `
              CREATE TABLE IF NOT EXISTS metric_records (
                id VARCHAR PRIMARY KEY,
                crawl_run_id VARCHAR,
                query_id VARCHAR NOT NULL,
                engine VARCHAR,
                metric_type VARCHAR NOT NULL,
                value DOUBLE NOT NULL,
                delta DOUBLE,
                compared_to_run_id VARCHAR,
                collected_at TIMESTAMP NOT NULL,
                extra JSON,
                created_at TIMESTAMP NOT NULL
              )
            `
          );
          query = `SELECT * FROM metric_records ${whereClause}`;
          summaryQuery = `
            SELECT
              COUNT(*) AS count,
              COUNT(DISTINCT query_id) AS distinct_queries,
              COUNT(DISTINCT engine) AS distinct_engines,
              MIN(collected_at) AS min_ts,
              MAX(collected_at) AS max_ts
            FROM metric_records
            ${whereClause}
          `;
          break;
        }
        default:
          throw new Error(`Unsupported dataset type: ${options.datasetType}`);
      }

      await run(conn, `COPY (${query}) TO '${filePath}' (FORMAT '${format}')`);

      const summaryRows = await all<{
        count: number;
        distinct_queries: number;
        distinct_engines: number;
        min_ts: string | Date | null;
        max_ts: string | Date | null;
      }>(conn, summaryQuery);

      const summary = summaryRows[0] ?? {
        count: 0,
        distinct_queries: 0,
        distinct_engines: 0,
        min_ts: null,
        max_ts: null
      };

      await this.ensureDatasetVersionsTable(conn);

      const versionRecord = {
        id: randomUUID(),
        dataset_type: options.datasetType,
        format,
        path: filePath,
        run_id: options.runId ?? null,
        record_count: summary.count,
        metadata: JSON.stringify({
          datasetType: options.datasetType,
          filters,
          runId: options.runId ?? null,
          distinctQueries: summary.distinct_queries,
          distinctEngines: summary.distinct_engines,
          timeRange: {
            from: summary.min_ts ? new Date(summary.min_ts).toISOString() : null,
            to: summary.max_ts ? new Date(summary.max_ts).toISOString() : null
          },
          generatedAt: timestamp.toISOString()
        }),
        created_at: timestamp.toISOString()
      } as const;

      await run(
        conn,
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          versionRecord.id,
          versionRecord.dataset_type,
          versionRecord.format,
          versionRecord.path,
          versionRecord.run_id,
          versionRecord.record_count,
          versionRecord.metadata,
          versionRecord.created_at
        ]
      );

      const parsedVersion = DatasetVersionSchema.parse({
        id: versionRecord.id,
        datasetType: options.datasetType,
        format,
        path: versionRecord.path,
        runId: options.runId ?? null,
        recordCount: summary.count,
        metadata: JSON.parse(versionRecord.metadata),
        createdAt: timestamp
      });

      return {
        version: parsedVersion,
        filePath
      };
    } finally {
      await closeConnection(conn);
    }
  }

  async close(): Promise<void> {
    await closeDatabase(this.db);
  }

  async recordPipelineRun(input: PipelineRunRecordInput): Promise<void> {
    const conn = await this.getConnection();
    try {
      await this.ensurePipelineTables(conn);
      await run(
        conn,
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            error = excluded.error,
            metadata = excluded.metadata,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `,
        [
          input.id,
          input.status,
          input.startedAt.toISOString(),
          input.completedAt ? input.completedAt.toISOString() : null,
          input.error,
          JSON.stringify(input.metadata ?? {}),
          input.createdAt.toISOString(),
          input.updatedAt.toISOString()
        ]
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async recordPipelineStage(input: PipelineStageLogInput): Promise<void> {
    const conn = await this.getConnection();
    try {
      await this.ensurePipelineTables(conn);
      await run(
        conn,
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            run_id = excluded.run_id,
            stage = excluded.stage,
            status = excluded.status,
            attempts = excluded.attempts,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            error = excluded.error,
            metadata = excluded.metadata,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
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
          JSON.stringify(input.metadata ?? {}),
          input.createdAt.toISOString(),
          input.updatedAt.toISOString()
        ]
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async fetchPipelineRuns(options: FetchPipelineRunOptions = {}): Promise<PipelineRun[]> {
    const conn = await this.getConnection();
    try {
      await this.ensurePipelineTables(conn);
      const limit = options.limit ?? 50;
      const rows = await all<{
        id: string;
        status: string;
        started_at: string | Date;
        completed_at: string | Date | null;
        error: string | null;
        metadata: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        conn,
        `
          SELECT *
          FROM pipeline_runs
          ORDER BY started_at DESC
          LIMIT ?
        `,
        [limit]
      );

      return rows.map((row) => ({
        id: row.id,
        status: row.status as PipelineRun["status"],
        startedAt: new Date(row.started_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
        error: row.error,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      await closeConnection(conn);
    }
  }

  async fetchPipelineStages(runId: string): Promise<PipelineStageLog[]> {
    const conn = await this.getConnection();
    try {
      await this.ensurePipelineTables(conn);
      const rows = await all<{
        id: string;
        run_id: string;
        stage: string;
        status: string;
        attempts: number;
        started_at: string | Date;
        completed_at: string | Date | null;
        error: string | null;
        metadata: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        conn,
        `
          SELECT *
          FROM pipeline_stage_logs
          WHERE run_id = ?
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
        startedAt: new Date(row.started_at),
        completedAt: row.completed_at ? new Date(row.completed_at) : null,
        error: row.error,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      await closeConnection(conn);
    }
  }

  async recordAuditSamples(samples: AuditSampleRecordInput[]): Promise<void> {
    if (!samples.length) return;
    const conn = await this.getConnection();
    try {
      await this.ensurePipelineTables(conn);
      const placeholders = samples.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
      const params: unknown[] = [];
      for (const sample of samples) {
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
      }
      await run(
        conn,
        `
          INSERT INTO audit_samples (
            id,
            run_id,
            annotation_id,
            query_id,
            engine,
            reviewer,
            status,
            notes,
            created_at,
            updated_at
          ) VALUES ${placeholders}
          ON CONFLICT(id) DO UPDATE SET
            run_id = excluded.run_id,
            annotation_id = excluded.annotation_id,
            query_id = excluded.query_id,
            engine = excluded.engine,
            reviewer = excluded.reviewer,
            status = excluded.status,
            notes = excluded.notes,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `,
        params
      );
    } finally {
      await closeConnection(conn);
    }
  }

  async fetchAuditSamples(runId: string): Promise<AuditSampleRecordInput[]> {
    const conn = await this.getConnection();
    try {
      await this.ensurePipelineTables(conn);
      const rows = await all<{
        id: string;
        run_id: string;
        annotation_id: string;
        query_id: string;
        engine: string;
        reviewer: string | null;
        status: string;
        notes: string | null;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        conn,
        `
          SELECT *
          FROM audit_samples
          WHERE run_id = ?
        `,
        [runId]
      );

      return rows.map((row) => ({
        id: row.id,
        runId: row.run_id,
        annotationId: row.annotation_id,
        queryId: row.query_id,
        engine: row.engine,
        reviewer: row.reviewer,
        status: row.status as "pending" | "approved" | "flagged",
        notes: row.notes,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } finally {
      await closeConnection(conn);
    }
  }
}

export function createDuckDBStorageClient(url: string): StorageClient {
  let normalized = url;
  if (normalized.startsWith("duckdb://")) {
    normalized = normalized.replace(/^duckdb:\/\//, "");
  } else if (normalized.startsWith("duckdb:")) {
    normalized = normalized.replace(/^duckdb:/, "");
  }

  const dbPath = normalized === "" || normalized === "::memory:" ? ":memory:" : normalized;
  return new DuckDBStorageClient({ path: dbPath });
}
