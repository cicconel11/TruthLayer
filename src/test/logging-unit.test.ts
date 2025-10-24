import { describe, it, expect } from 'vitest';
import { logger, createOperationLogger, generateCorrelationId } from '../utils/logger';

describe('Logging System', () => {
    it('should generate correlation IDs', () => {
        const correlationId1 = generateCorrelationId();
        const correlationId2 = generateCorrelationId();

        expect(correlationId1).toMatch(/^corr_\d+_[a-z0-9]+$/);
        expect(correlationId2).toMatch(/^corr_\d+_[a-z0-9]+$/);
        expect(correlationId1).not.toBe(correlationId2);
    });

    it('should create operation logger with correlation ID', () => {
        const correlationId = generateCorrelationId();
        const component = 'test-component';

        const opLogger = createOperationLogger(correlationId, component);

        expect(opLogger).toBeDefined();
        expect(typeof opLogger.info).toBe('function');
        expect(typeof opLogger.error).toBe('function');
        expect(typeof opLogger.debug).toBe('function');
        expect(typeof opLogger.warn).toBe('function');
        expect(typeof opLogger.audit).toBe('function');
        expect(typeof opLogger.performance).toBe('function');
        expect(typeof opLogger.security).toBe('function');
    });

    it('should log messages with structured context', () => {
        // This test verifies the logger interface works without actually checking output
        // since we can't easily capture winston output in tests

        expect(() => {
            logger.info('Test message', {
                correlationId: 'test-123',
                component: 'test-component',
                operation: 'test-operation',
                success: true,
                metadata: { test: true }
            });
        }).not.toThrow();

        expect(() => {
            logger.error('Test error', {
                correlationId: 'test-123',
                component: 'test-component',
                errorMessage: 'Test error message',
                success: false
            });
        }).not.toThrow();

        expect(() => {
            logger.audit('test_event', 'Test audit message', {
                correlationId: 'test-123',
                userId: 'test-user',
                metadata: { action: 'test' }
            });
        }).not.toThrow();

        expect(() => {
            logger.performance('test_operation', 1500, {
                correlationId: 'test-123',
                success: true
            });
        }).not.toThrow();

        expect(() => {
            logger.security('test_security_event', 'Test security message', {
                correlationId: 'test-123',
                userId: 'test-user'
            });
        }).not.toThrow();
    });

    it('should handle operation logger with correlation ID', () => {
        const correlationId = generateCorrelationId();
        const opLogger = createOperationLogger(correlationId, 'test-component');

        expect(() => {
            opLogger.info('Operation started', {
                operation: 'test-operation',
                metadata: { step: 1 }
            });

            opLogger.performance('test-operation', 2000, {
                success: true,
                metadata: { results: 10 }
            });

            opLogger.error('Operation failed', {
                operation: 'test-operation',
                errorMessage: 'Something went wrong',
                success: false
            });
        }).not.toThrow();
    });

    it('should handle flexible log context', () => {
        // Test that the logger accepts any additional properties in context
        expect(() => {
            logger.info('Flexible context test', {
                correlationId: 'test-123',
                customProperty: 'custom-value',
                nestedObject: {
                    key: 'value',
                    number: 42
                },
                arrayProperty: [1, 2, 3],
                booleanProperty: true
            });
        }).not.toThrow();
    });
});