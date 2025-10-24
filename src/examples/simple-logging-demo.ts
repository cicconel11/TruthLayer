#!/usr/bin/env node

import * as winston from 'winston';

/**
 * Simple logging demonstration without config dependencies
 */

// Create a simple logger for demo purposes
const demoLogger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/demo.log' })
    ]
});

// Simple structured logger interface
interface LogContext {
    correlationId?: string;
    component?: string;
    operation?: string;
    success?: boolean;
    duration?: number;
    [key: string]: any;
}

const logger = {
    info: (message: string, context?: LogContext) => {
        demoLogger.info(message, { ...context, logType: 'application' });
    },
    error: (message: string, context?: LogContext) => {
        demoLogger.error(message, { ...context, logType: 'application' });
    },
    debug: (message: string, context?: LogContext) => {
        demoLogger.debug(message, { ...context, logType: 'application' });
    },
    audit: (eventType: string, message: string, context?: LogContext) => {
        demoLogger.info(message, { ...context, logType: 'audit', eventType });
    },
    performance: (operation: string, duration: number, context?: LogContext) => {
        demoLogger.info(`Performance: ${operation} completed in ${duration}ms`, {
            ...context,
            logType: 'performance',
            operation,
            duration
        });
    }
};

function generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

async function demonstrateLogging() {
    console.log('=== TruthLayer Logging System Demo ===\n');

    // 1. Basic structured logging
    console.log('1. Basic Structured Logging:');
    logger.info('System startup initiated', {
        component: 'system',
        operation: 'startup',
        version: '1.0.0',
        environment: 'demo'
    });

    logger.error('Simulated error for demonstration', {
        component: 'demo',
        errorType: 'simulation',
        errorMessage: 'This is a demo error',
        demoMode: true
    });

    // 2. Operation logging with correlation ID
    console.log('\n2. Operation Logging with Correlation ID:');
    const correlationId = generateCorrelationId();

    logger.info('Starting collection operation', {
        correlationId,
        component: 'collection_service',
        operation: 'collect_search_results',
        queryText: 'artificial intelligence ethics',
        engines: ['google', 'bing']
    });

    // Simulate operation
    await new Promise(resolve => setTimeout(resolve, 100));

    logger.info('Collection completed successfully', {
        correlationId,
        component: 'collection_service',
        operation: 'collect_search_results',
        success: true,
        duration: 100,
        resultsCount: 20
    });

    // 3. Audit logging
    console.log('\n3. Audit Logging:');
    logger.audit('collection_completed', 'Search results collection completed', {
        correlationId,
        userId: 'demo_user',
        component: 'collection_service',
        queryText: 'artificial intelligence ethics',
        resultsCount: 20,
        engines: ['google', 'bing']
    });

    // 4. Performance logging
    console.log('\n4. Performance Logging:');
    logger.performance('search_collection', 1500, {
        correlationId,
        component: 'collection_service',
        success: true,
        queryComplexity: 'medium',
        cacheHit: false,
        engineCount: 2
    });

    // 5. Complex operation tracing
    console.log('\n5. Complex Operation Tracing:');
    await demonstrateComplexOperation();

    console.log('\n=== Demo Complete ===');
    console.log('Check the logs/demo.log file for structured log entries.');
}

async function demonstrateComplexOperation() {
    const correlationId = generateCorrelationId();

    logger.info('Starting complex annotation pipeline', {
        correlationId,
        component: 'annotation_pipeline',
        operation: 'batch_annotation',
        batchId: 'batch_demo_001',
        resultCount: 50
    });

    // Step 1: Preparation
    logger.debug('Preparing annotation batch', {
        correlationId,
        component: 'annotation_pipeline',
        operation: 'batch_preparation',
        step: 1,
        modelVersion: 'gpt-4-turbo'
    });
    await new Promise(resolve => setTimeout(resolve, 30));

    // Step 2: Processing
    logger.debug('Processing annotations', {
        correlationId,
        component: 'annotation_pipeline',
        operation: 'annotation_processing',
        step: 2,
        progress: '50%',
        processedCount: 25,
        remainingCount: 25
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 3: Completion
    logger.info('Annotation pipeline completed', {
        correlationId,
        component: 'annotation_pipeline',
        operation: 'batch_annotation',
        success: true,
        duration: 130,
        batchId: 'batch_demo_001',
        successfulAnnotations: 48,
        failedAnnotations: 2,
        averageConfidence: 0.87
    });

    // Record performance metrics
    logger.performance('annotation_pipeline', 130, {
        correlationId,
        component: 'annotation_pipeline',
        success: true,
        batchSize: 50,
        throughput: 23, // annotations per second
        modelVersion: 'gpt-4-turbo'
    });

    // Record audit trail
    logger.audit('annotation_batch_completed', 'Annotation batch processing completed', {
        correlationId,
        component: 'annotation_pipeline',
        batchId: 'batch_demo_001',
        modelVersion: 'gpt-4-turbo',
        successRate: 0.96
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