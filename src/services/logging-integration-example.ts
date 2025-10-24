import { DatabaseConnection } from '../database/connection';
import { AuditService } from './audit-service';
import { DebugService } from './debug-service';
import { MonitoringService } from './monitoring-service';
import { LoggingIntegrationService } from './logging-integration-service';
import { CollectorService } from '../collectors/collector-service';
// import { AnnotationService } from './annotation-service'; // Commented out due to interface issues
import { logger, createOperationLogger, generateCorrelationId } from '../utils/logger';

/**
 * Example demonstrating comprehensive logging integration with existing services
 */
export class LoggingIntegrationExample {
    private db: DatabaseConnection;
    private auditService: AuditService;
    private debugService: DebugService;
    private monitoringService: MonitoringService;
    private loggingService: LoggingIntegrationService;
    private collectorService: CollectorService; // TODO: Use for collection operations
    // private annotationService: AnnotationService; // Commented out due to interface issues

    constructor() {
        // Initialize services
        const config = require('../utils/config-loader').getConfig();
        this.db = new DatabaseConnection(config.database);
        this.auditService = new AuditService(this.db);
        this.debugService = new DebugService(this.db, this.auditService);
        this.monitoringService = new MonitoringService(this.db);
        this.loggingService = new LoggingIntegrationService(
            this.db,
            this.auditService,
            this.debugService,
            this.monitoringService
        );
        this.collectorService = new CollectorService(this.db);
        // this.annotationService = new AnnotationService(); // Commented out due to interface issues
    }

    /**
     * Example: Enhanced collection operation with comprehensive logging
     */
    async performEnhancedCollection(queryText: string, engines: string[]): Promise<void> {
        // Start comprehensive logged operation
        const context = await this.loggingService.startOperation(
            'collection',
            'collector',
            'system-user',
            undefined,
            { queryText, engines, requestedAt: new Date() }
        );

        const opLogger = createOperationLogger(context.correlationId, 'collector');

        try {
            // Log operation step: Initialize collection
            await this.loggingService.logOperationStep(context.correlationId, {
                stepName: 'initialize_collection',
                stepOrder: 1,
                inputData: { queryText, engines },
                metadata: { startTime: Date.now() }
            });

            opLogger.info('Starting enhanced collection with comprehensive logging', {
                operation: 'collection',
                queryText,
                engines,
                metadata: { enhancedLogging: true }
            });

            // Create or get query record
            const queryId = await this.createOrGetQuery(queryText, context.correlationId);

            // Log operation step: Query preparation
            await this.loggingService.logOperationStep(context.correlationId, {
                stepName: 'prepare_query',
                stepOrder: 2,
                inputData: { queryText },
                outputData: { queryId },
                metadata: { queryCreated: true }
            });

            // Collect from each engine with detailed logging
            const allResults: any[] = [];
            for (let i = 0; i < engines.length; i++) {
                const engine = engines[i];
                const engineStartTime = Date.now();

                try {
                    // Log collection start for this engine
                    const collectionCorrelationId = await this.loggingService.logCollectionOperation(
                        'started',
                        {
                            queryId,
                            queryText,
                            engine,
                            userId: 'system-user'
                        }
                    );

                    // Log operation step: Engine collection start
                    await this.loggingService.logOperationStep(context.correlationId, {
                        stepName: `collect_${engine}`,
                        stepOrder: 3 + i,
                        inputData: { engine, queryText },
                        metadata: { engineStartTime, collectionCorrelationId }
                    }, 'started');

                    opLogger.info(`Starting collection from ${engine}`, {
                        operation: 'engine_collection',
                        engine,
                        queryText,
                        metadata: { collectionCorrelationId }
                    });

                    // Perform actual collection (simulated here)
                    const results = await this.simulateEngineCollection(engine, queryText, context.correlationId);
                    const engineDuration = Date.now() - engineStartTime;

                    // Log successful collection
                    await this.loggingService.logCollectionOperation(
                        'completed',
                        {
                            queryId,
                            queryText,
                            engine,
                            resultsCount: results.length,
                            duration: engineDuration,
                            userId: 'system-user'
                        }
                    );

                    // Log operation step: Engine collection completed
                    await this.loggingService.logOperationStep(context.correlationId, {
                        stepName: `collect_${engine}`,
                        stepOrder: 3 + i,
                        inputData: { engine, queryText },
                        outputData: { resultsCount: results.length, duration: engineDuration },
                        metadata: { collectionCorrelationId }
                    }, 'completed', engineDuration);

                    allResults.push(...results);

                    opLogger.info(`Completed collection from ${engine}`, {
                        operation: 'engine_collection',
                        engine,
                        resultsCount: results.length,
                        duration: engineDuration,
                        success: true
                    });

                } catch (error) {
                    const engineDuration = Date.now() - engineStartTime;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                    // Log failed collection
                    await this.loggingService.logCollectionOperation(
                        'failed',
                        {
                            queryId,
                            queryText,
                            engine,
                            duration: engineDuration,
                            errorMessage,
                            userId: 'system-user'
                        }
                    );

                    // Log operation step: Engine collection failed
                    await this.loggingService.logOperationStep(context.correlationId, {
                        stepName: `collect_${engine}`,
                        stepOrder: 3 + i,
                        inputData: { engine, queryText },
                        errorDetails: { errorMessage, duration: engineDuration },
                        metadata: { collectionFailed: true }
                    }, 'failed', engineDuration);

                    opLogger.error(`Collection failed for ${engine}`, {
                        operation: 'engine_collection',
                        engine,
                        errorMessage,
                        duration: engineDuration,
                        success: false
                    });

                    // Continue with other engines instead of failing completely
                }
            }

            // Log operation step: Finalize collection
            await this.loggingService.logOperationStep(context.correlationId, {
                stepName: 'finalize_collection',
                stepOrder: 3 + engines.length,
                inputData: { totalEngines: engines.length },
                outputData: { totalResults: allResults.length },
                metadata: { collectionComplete: true }
            });

            // Complete the operation successfully
            const totalDuration = Date.now() - new Date(context.metadata?.requestedAt).getTime();
            await this.loggingService.completeOperation(
                context.correlationId,
                { totalResults: allResults.length, engines: engines.length },
                totalDuration
            );

            opLogger.info('Enhanced collection completed successfully', {
                operation: 'collection',
                totalResults: allResults.length,
                totalEngines: engines.length,
                duration: totalDuration,
                success: true
            });

        } catch (error) {
            const totalDuration = Date.now() - new Date(context.metadata?.requestedAt).getTime();

            // Fail the operation with detailed error information
            await this.loggingService.failOperation(
                context.correlationId,
                error instanceof Error ? error : new Error('Unknown collection error'),
                totalDuration,
                { queryText, engines, partialResults: true }
            );

            opLogger.error('Enhanced collection failed', {
                operation: 'collection',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                duration: totalDuration,
                success: false
            });

            throw error;
        }
    }

    /**
     * Example: Enhanced annotation operation with comprehensive logging
     */
    async performEnhancedAnnotation(resultIds: string[], batchId: string): Promise<void> {
        // Start comprehensive logged operation
        const context = await this.loggingService.startOperation(
            'annotation',
            'annotation_pipeline',
            'system-user',
            undefined,
            { resultIds, batchId, requestedAt: new Date() }
        );

        const opLogger = createOperationLogger(context.correlationId, 'annotation_pipeline');

        try {
            // Log annotation start
            const annotationCorrelationId = await this.loggingService.logAnnotationOperation(
                'started',
                {
                    batchId,
                    modelVersion: 'gpt-4-turbo',
                    resultsCount: resultIds.length,
                    userId: 'system-user'
                }
            );

            // Log operation step: Prepare batch
            await this.loggingService.logOperationStep(context.correlationId, {
                stepName: 'prepare_annotation_batch',
                stepOrder: 1,
                inputData: { resultIds, batchId },
                outputData: { batchSize: resultIds.length },
                metadata: { annotationCorrelationId }
            });

            opLogger.info('Starting enhanced annotation with comprehensive logging', {
                operation: 'annotation',
                batchId,
                resultCount: resultIds.length,
                metadata: { enhancedLogging: true }
            });

            // Simulate annotation processing
            const startTime = Date.now();
            const annotations = await this.simulateAnnotationProcessing(resultIds, context.correlationId);
            const duration = Date.now() - startTime;

            // Log operation step: Process annotations
            await this.loggingService.logOperationStep(context.correlationId, {
                stepName: 'process_annotations',
                stepOrder: 2,
                inputData: { resultIds },
                outputData: {
                    successfulAnnotations: annotations.successful,
                    failedAnnotations: annotations.failed,
                    averageConfidence: annotations.averageConfidence
                },
                metadata: { processingDuration: duration }
            });

            // Log successful annotation
            await this.loggingService.logAnnotationOperation(
                'completed',
                {
                    batchId,
                    modelVersion: 'gpt-4-turbo',
                    resultsCount: resultIds.length,
                    successfulAnnotations: annotations.successful,
                    failedAnnotations: annotations.failed,
                    averageConfidence: annotations.averageConfidence,
                    duration,
                    userId: 'system-user'
                }
            );

            // Complete the operation
            await this.loggingService.completeOperation(
                context.correlationId,
                {
                    batchId,
                    successfulAnnotations: annotations.successful,
                    failedAnnotations: annotations.failed,
                    averageConfidence: annotations.averageConfidence
                },
                duration
            );

            opLogger.info('Enhanced annotation completed successfully', {
                operation: 'annotation',
                batchId,
                successfulAnnotations: annotations.successful,
                duration,
                success: true
            });

        } catch (error) {
            const duration = Date.now() - new Date(context.metadata?.requestedAt).getTime();

            // Log failed annotation
            await this.loggingService.logAnnotationOperation(
                'failed',
                {
                    batchId,
                    modelVersion: 'gpt-4-turbo',
                    resultsCount: resultIds.length,
                    duration,
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    userId: 'system-user'
                }
            );

            // Fail the operation
            await this.loggingService.failOperation(
                context.correlationId,
                error instanceof Error ? error : new Error('Unknown annotation error'),
                duration,
                { batchId, resultIds }
            );

            throw error;
        }
    }

    /**
     * Example: Debug session for troubleshooting collection issues
     */
    async debugCollectionIssues(engine: string, queryText: string): Promise<void> {
        // Start debug session
        const sessionId = await this.loggingService.createDebugSession(
            `collection_debug_${engine}_${Date.now()}`,
            'collector',
            'debug',
            {
                verboseLogging: true,
                captureHtml: true,
                proxyDebug: true,
                networkTracing: true,
                captureTiming: true,
                validateCalculations: false,
                logIntermediateSteps: true,
                logPrompts: false,
                logResponses: false,
                captureScreenshots: false
            },
            'debug-user'
        );

        const correlationId = generateCorrelationId();

        try {
            logger.info('Starting collection debug session', {
                sessionId,
                engine,
                queryText,
                correlationId
            });

            // Capture initial system state
            await this.loggingService.captureSystemState(
                'pre_collection_state',
                'collector',
                {
                    engine,
                    queryText,
                    timestamp: new Date(),
                    proxyStatus: 'active',
                    scraperStatus: 'initialized'
                },
                correlationId,
                'debug-user'
            );

            // Log debug information during collection
            await this.debugService.logDebug(
                sessionId,
                'debug',
                'collector',
                `Starting debug collection for ${engine}`,
                { engine, queryText, correlationId }
            );

            // Simulate collection with debug logging
            const results = await this.simulateEngineCollection(engine, queryText, correlationId, sessionId);

            // Capture post-collection state
            await this.loggingService.captureSystemState(
                'post_collection_state',
                'collector',
                {
                    engine,
                    queryText,
                    timestamp: new Date(),
                    resultsCollected: results.length,
                    collectionStatus: 'completed'
                },
                correlationId,
                'debug-user'
            );

            await this.debugService.logDebug(
                sessionId,
                'info',
                'collector',
                `Debug collection completed successfully`,
                { engine, resultsCount: results.length, correlationId }
            );

            // End debug session
            await this.debugService.endDebugSession(
                sessionId,
                `Debug collection for ${engine} completed successfully. Collected ${results.length} results.`
            );

            logger.info('Collection debug session completed', {
                sessionId,
                engine,
                resultsCount: results.length,
                correlationId
            });

        } catch (error) {
            await this.debugService.logDebug(
                sessionId,
                'error',
                'collector',
                `Debug collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                { engine, queryText, error: error instanceof Error ? error.message : 'Unknown error', correlationId }
            );

            // End debug session with error summary
            await this.debugService.endDebugSession(
                sessionId,
                `Debug collection for ${engine} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            throw error;
        }
    }

    /**
     * Simulate engine collection (replace with actual collection logic)
     */
    private async simulateEngineCollection(
        engine: string,
        queryText: string,
        correlationId: string,
        debugSessionId?: string
    ): Promise<any[]> {
        // Simulate collection delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));

        if (debugSessionId) {
            await this.debugService.logDebug(
                debugSessionId,
                'debug',
                'collector',
                `Simulating collection from ${engine}`,
                { engine, queryText, correlationId }
            );
        }

        // Simulate occasional failures for demonstration
        if (Math.random() < 0.1) {
            throw new Error(`Simulated collection failure for ${engine}`);
        }

        // Return simulated results
        const resultCount = Math.floor(Math.random() * 20) + 1;
        return Array.from({ length: resultCount }, (_, i) => ({
            id: `result_${engine}_${i}`,
            title: `Result ${i + 1} from ${engine}`,
            snippet: `This is a simulated result snippet for query "${queryText}"`,
            url: `https://example.com/${engine}/result${i + 1}`,
            rank: i + 1,
            engine
        }));
    }

    /**
     * Simulate annotation processing (replace with actual annotation logic)
     */
    private async simulateAnnotationProcessing(
        resultIds: string[],
        _correlationId: string // TODO: Use for correlation tracking
    ): Promise<{ successful: number; failed: number; averageConfidence: number }> {
        // Simulate annotation delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));

        const successful = Math.floor(resultIds.length * 0.9); // 90% success rate
        const failed = resultIds.length - successful;
        const averageConfidence = 0.8 + Math.random() * 0.15; // 0.8-0.95 confidence

        return { successful, failed, averageConfidence };
    }

    /**
     * Create or get query record (simplified)
     */
    private async createOrGetQuery(_queryText: string, _correlationId: string): Promise<string> {
        // Simulate query creation/retrieval
        return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Initialize services and run example
     */
    async runExample(): Promise<void> {
        try {
            await this.db.connect();

            logger.info('Starting logging integration example');

            // Example 1: Enhanced collection with comprehensive logging
            console.log('\n=== Example 1: Enhanced Collection ===');
            await this.performEnhancedCollection('climate change research', ['google', 'bing']);

            // Example 2: Enhanced annotation with comprehensive logging
            console.log('\n=== Example 2: Enhanced Annotation ===');
            const mockResultIds = ['result1', 'result2', 'result3', 'result4', 'result5'];
            await this.performEnhancedAnnotation(mockResultIds, 'batch_example_001');

            // Example 3: Debug session for troubleshooting
            console.log('\n=== Example 3: Debug Session ===');
            await this.debugCollectionIssues('google', 'artificial intelligence ethics');

            logger.info('Logging integration example completed successfully');

        } catch (error) {
            logger.error('Logging integration example failed', {
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        } finally {
            // await this.db.disconnect(); // DatabaseConnection doesn't have disconnect method
        }
    }
}

// Run example if this file is executed directly
if (require.main === module) {
    const example = new LoggingIntegrationExample();
    example.runExample().catch(error => {
        console.error('Example execution failed:', error);
        process.exit(1);
    });
}