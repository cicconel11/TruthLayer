/**
 * Test setup file for Vitest
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_NAME = 'truthlayer_test';
process.env.DATABASE_USER = 'test_user';
process.env.DATABASE_PASSWORD = 'test_password';
process.env.OPENAI_API_KEY = 'test_api_key';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global test utilities can be added here