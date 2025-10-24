import { describe, it, expect } from 'vitest';
import { errorToLogContext } from '../utils/logger';

describe('Error Logging', () => {
    it('should convert Error objects to LogContext', () => {
        const error = new Error('Test error message');
        const context = errorToLogContext(error);

        expect(context.errorMessage).toBe('Test error message');
        expect(context.errorName).toBe('Error');
        expect(context.success).toBe(false);
        expect(context.errorStack).toBeDefined();
    });

    it('should convert string errors to LogContext', () => {
        const error = 'String error message';
        const context = errorToLogContext(error);

        expect(context.errorMessage).toBe('String error message');
        expect(context.success).toBe(false);
    });

    it('should convert object errors to LogContext', () => {
        const error = { code: 'ERR001', details: 'Something went wrong' };
        const context = errorToLogContext(error);

        expect(context.errorMessage).toBe(JSON.stringify(error));
        expect(context.success).toBe(false);
    });

    it('should handle unknown error types', () => {
        const error = null;
        const context = errorToLogContext(error);

        expect(context.errorMessage).toBe('Unknown error');
        expect(context.success).toBe(false);
    });
});