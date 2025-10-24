#!/usr/bin/env node

import { logger, createOperationLogger, generateCorrelationId } from '../utils/logger';

/**
 * Demonstration of the comprehensive logging system
 */
async function demonstrateLogging() {
    console.log('=== TruthLayer Logging System Demo ===\n');

    // 1. Basic structured logging
    console.log('1. Basic Structured Logging:');
    logger.info('System startup initiated', {
        component: 'system',
        operation: 'startup',
        metadata: { version: '1.0.0', environment: 'demo' }
    });

    logger.warn('Configuration warning detected', {
        component: 'config',
        warningType: 'missing_optional_setting',
        metadata: { setting: 'cache_ttl', defaultUsed: 300 }
    });

    logger.error('Simulated error for demonstration', {
        component: 'demo',
        errorType: 'simulation',
        errorMessage: 'This is a demo error',
        metadata: { demoMode: true }
    });

    // 2. Operation logging with correlation ID
    console.log('\n2. Operation Logging with Correlation ID:');
    const correlationId = generateCorrelationId();
    const opLogger = createOperationLogger(correlationId, 'collection_service');

    opLogger.info('Starting collection operation', {
        operation: 'collect_search_results',
        queryText: 'artificial intelligence ethics',
        engines: ['google', 'bing'],
        metadata: { requestId: 'req_123' }
    });

    // Simulate operation steps
    await new Promise(resolve => setTimeout(resolve, 100));

    opLogger.debug('Processing query for Google engine', {
        operation: 'engine_collection',
        engine: 'google',
        step: 'query_processing'
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    opLogger.info('Collection completed successfully', {
        operation: 'collect_search_results',
        success: true,
        duration: 150,
        resultsCount: 20,
        metadata: { engines_completed: ['google', 'bing'] }
    });

    // 3. Audit logging
    console.log('\n3. Audit Logging:');
    logger.audit('collection_completed', 'Search results collection completed', {
        correlationId,
        userId: 'demo_user',
        component: 'collection_service',
        metadata: {
            queryText: 'artificial intelligence ethics',
            resultsCount: 20,
            engines: ['google', 'bing']
        }
    });

    // 4. Performance logging
    console.log('\n4. Performance Logging:');
    logger.performance('search_collection', 1500, {
        correlationId,
        component: 'collection_service',
        success: true,
        metadata: {
            queryComplexity: 'medium',
            cacheHit: false,
            engineCount: 2
        }
    });

    // 5. Security logging
    console.log('\n5. Security Logging:');
    logger.security('rate_limit_exceeded', 'Rate limit exceeded for IP address', {
        correlationId: generateCorrelationId(),
        component: 'api_gateway',
        metadata: {
            ipAddress: '192.168.1.100',
            endpoint: '/api/search',
            requestCount: 105,
            timeWindow: '1 minute'
        }
    });

    // 6. Error handling with structured context
    console.log('\n6. Error Handling with Structured Context:');
    try {
        throw new Error('Simulated network timeout');
    } catch (error) {
        const errorCorrelationId = generateCorrelationId();
        const errorLogger = createOperationLogger(errorCorrelationId, 'network_service');

        errorLogger.error('Network operation failed', {
            operation: 'api_request',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorType: 'network_timeout',
            success: false,
            metadata: {
                url: 'https://api.example.com/search',
                timeout: 5000,
                retryAttempt: 3
            }
        });
    }

    // 7. Complex operation tracing
    console.log('\n7. Complex Operation Tracing:');
    await demonstrateComplexOperation();

    console.log('\n=== Demo Complete ===');
    console.log('Check the logs/ directory for structured log files:');
    console.log('- logs/combined.log - All log entries');
    console.log('- logs/error.log - Error entries only');
    console.log('- logs/audit.log - Audit trail entries');
    console.log('- logs/performance.log - Performance metrics');
    console.log('- logs/security.log - Security events');
}

/**
 * Demonstrate complex operation with multiple steps and correlation tracking
 */
async function demonstrateComplexOperation() {
    const correlationId = generateCorrelationId();
    const opLogger = createOperationLogger(correlationId, 'annotation_pipeline');

    opLogger.info('Starting complex annotation pipeline', {
        operation: 'batch_annotation',
        batchId: 'batch_demo_001',
        resultCount: 50
    });

    // Step 1: Preparation
    opLogger.debug('Preparing annotation batch', {
        operation: 'batch_preparation',
        step: 1,
        metadata: { modelVersion: 'gpt-4-turbo' }
    });
    await new Promise(resolve => setTimeout(resolve, 30));

    // Step 2: Processing
    opLogger.debug('Processing annotations', {
        operation: 'annotation_processing',
        step: 2,
        progress: '50%',
        metadata: { processedCount: 25, remainingCount: 25 }
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 3: Validation
    opLogger.debug('Validating annotation results', {
        operation: 'result_validation',
        step: 3,
        metadata: { validationRules: ['confidence_threshold', 'format_check'] }
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    // Step 4: Completion
    opLogger.info('Annotation pipeline completed', {
        operation: 'batch_annotation',
        success: true,
        duration: 150,
        metadata: {
            batchId: 'batch_demo_001',
            successfulAnnotations: 48,
            failedAnnotations: 2,
            averageConfidence: 0.87
        }
    });

    // Record performance metrics
    logger.performance('annotation_pipeline', 150, {
        correlationId,
        component: 'annotation_pipeline',
        success: true,
        metadata: {
            batchSize: 50,
            throughput: 20, // annotations per second
            modelVersion: 'gpt-4-turbo'
        }
    });

    // Record audit trail
    logger.audit('annotation_batch_completed', 'Annotation batch processing completed', {
        correlationId,
        component: 'annotation_pipeline',
        metadata: {
            batchId: 'batch_demo_001',
            modelVersion: 'gpt-4-turbo',
            successRate: 0.96
        }
    });
}

// Run the demo
if (require.main === module) {
    demonstrateLogging().catch(error => {
        console.error('Demo failed:', error);
        process.exit(1);
    });
}

export { demonstrateLogging };