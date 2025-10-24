import { Pool, PoolClient } from 'pg';

// Database connection configuration
const dbConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/truthlayer',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};

// Global connection pool
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
    if (!pool) {
        pool = new Pool(dbConfig);

        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
    }

    return pool;
}

/**
 * Execute a database query
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const pool = getPool();
    const client = await pool.connect();

    try {
        const result = await client.query(text, params);
        return result.rows;
    } finally {
        client.release();
    }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const pool = getPool();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}