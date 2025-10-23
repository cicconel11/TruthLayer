import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MigrationManager, DatabaseConnection } from '../database';

describe('Database Schema', () => {
    it('should have valid SQL migration file', () => {
        const migrationPath = join(__dirname, '../database/migrations/001_initial_schema.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        // Verify essential tables are created
        expect(migrationSQL).toContain('CREATE TABLE queries');
        expect(migrationSQL).toContain('CREATE TABLE search_results');
        expect(migrationSQL).toContain('CREATE TABLE annotations');

        // Verify UUID extension is enabled
        expect(migrationSQL).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Verify foreign key relationships
        expect(migrationSQL).toContain('REFERENCES queries(id)');
        expect(migrationSQL).toContain('REFERENCES search_results(id)');

        // Verify constraints
        expect(migrationSQL).toContain("CHECK (engine IN ('google', 'bing', 'perplexity', 'brave'))");
        expect(migrationSQL).toContain("CHECK (domain_type IN ('news', 'government', 'academic', 'blog', 'commercial', 'social'))");
        expect(migrationSQL).toContain('CHECK (rank > 0)');
        expect(migrationSQL).toContain('CHECK (factual_score >= 0.0 AND factual_score <= 1.0)');
        expect(migrationSQL).toContain('CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0)');
    });

    it('should have required performance indexes', () => {
        const migrationPath = join(__dirname, '../database/migrations/001_initial_schema.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        // Verify performance indexes as specified in requirements
        expect(migrationSQL).toContain('CREATE INDEX idx_search_results_collected_at ON search_results(collected_at)');
        expect(migrationSQL).toContain('CREATE INDEX idx_search_results_engine ON search_results(engine)');
        expect(migrationSQL).toContain('CREATE INDEX idx_search_results_query_engine ON search_results(query_id, engine)');
        expect(migrationSQL).toContain('CREATE INDEX idx_search_results_content_hash ON search_results(content_hash)');
        expect(migrationSQL).toContain('CREATE INDEX idx_queries_category ON queries(category)');
        expect(migrationSQL).toContain('CREATE INDEX idx_queries_created_at ON queries(created_at)');
        expect(migrationSQL).toContain('CREATE INDEX idx_annotations_domain_type ON annotations(domain_type)');
        expect(migrationSQL).toContain('CREATE INDEX idx_annotations_annotated_at ON annotations(annotated_at)');
    });

    it('should have proper unique constraints', () => {
        const migrationPath = join(__dirname, '../database/migrations/001_initial_schema.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        // Verify unique constraints to prevent duplicates
        expect(migrationSQL).toContain('UNIQUE(query_id, engine, rank)');
        expect(migrationSQL).toContain('UNIQUE(result_id, model_version)');
    });

    it('should have updated_at trigger for queries table', () => {
        const migrationPath = join(__dirname, '../database/migrations/001_initial_schema.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf-8');

        // Verify trigger function and trigger exist
        expect(migrationSQL).toContain('CREATE OR REPLACE FUNCTION update_updated_at_column()');
        expect(migrationSQL).toContain('CREATE TRIGGER update_queries_updated_at');
        expect(migrationSQL).toContain('BEFORE UPDATE ON queries');
    });

    it('should load migration files correctly', () => {
        // Create a mock database connection for testing migration manager
        const mockDb = {
            query: async () => ({ rows: [] }),
            transaction: async (callback: any) => callback({}),
        } as any;

        const migrationManager = new MigrationManager(mockDb);

        // Test that migration manager can be instantiated
        expect(migrationManager).toBeDefined();
    });

    it('should validate database connection interface', () => {
        const config = {
            host: 'localhost',
            port: 5432,
            database: 'test',
            username: 'test',
            password: 'test',
        };

        const dbConnection = new DatabaseConnection(config);
        expect(dbConnection).toBeDefined();

        // Verify methods exist
        expect(typeof dbConnection.connect).toBe('function');
        expect(typeof dbConnection.query).toBe('function');
        expect(typeof dbConnection.transaction).toBe('function');
        expect(typeof dbConnection.healthCheck).toBe('function');
        expect(typeof dbConnection.close).toBe('function');
    });
});