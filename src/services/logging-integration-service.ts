import { EventEmitter } from 'events';
import { logger, createOperationLogger, generateCorrelationId } from '../utils/logger';
import { DatabaseConnection } from '../database/connection';
import { AuditService } from './audit-service';
import { DebugService } from './debug-service';
import { MonitoringService } from './monitoring-service';

/**
 * Operation context for comprehensive logging
 */
export interface OperationContext {
    correlationId: string;
    operationName: string;
    component: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
}

/**
 * Operation step for detailed tracing
 */
export interface OperationStep {
    stepName: string;
    stepOrder: number;
    inputData?: Record<string, any>;
    outputData?: Record<string, any>;
    errorDetails?: Record<string, any>;
    metadata?: Record<string, any>;
}

/**
 * Comprehensive logging integration service
 */
export class LoggingIntegrationService extends EventEmitter {
    private db: DatabaseConnection;
    private auditService: AuditService;
    private debugService: DebugService;
    private monitoringService: MonitoringService;
    private activeOperations: Map<string, OperationContext> = new Map();

    constructor(
        db: DatabaseConnection,
        auditService: AuditService,
        debugService: DebugService,
        monitoringService: MonitoringService
    ) {
        super();
        this.db = db;
        this.auditService = auditService;
        this.debugService = debugService;
        this.monitoringService = monitoringService;
    }

    /**
     * Start a comprehensive logged operation
     */
    async startOperation(
        operationName: string,
        component: string,
        userId?: string,
        sessionId?: string,
        metadata?: Record<string, any>
    ): Promise<OperationContext> {
        const correlationId = generateCorrelationId();

        const context: OperationContext = {
            correlationId,
            operationName,
            component,
            userId,
            sessionId,
            metadata
        };

        this.activeOperations.set(correlationId, context);

        // Create operation logger
        const opLogger = createOperationLogger(correlationId, component);

        // Log operation start
        opLogger.info(`Operation started: ${operationName}`, {
            operation: operationName,
            userId,
            sessionId,
            metadata
        });

        // Record audit event
        await this.auditService.recordEvent({
            eventType: this.mapOperationToEventType(operationName),
            severity: 'info',
            component,
            action: 'operation_started',
            description: `Started operation: ${operationName}`,
            userId,
            sessionId,
            correlationId,
            success: true,
            metadata: metadata || {}
        });

        this.emit('operation_started', context);
        return context;
    }

    /**
     * Complete an operation with success
     */
    async completeOperation(
        correlationId: string,
        outputData?: Record<string, any>,
        duration?: number
    ): Promise<void> {
        const context = this.activeOperations.get(correlationId);
        if (!context) {
            logger.warn('Attempted to complete unknown operation', { correlationId });
            return;
        }

        const opLogger = createOperationLogger(correlationId, context.component);

        // Log operation completion
        opLogger.info(`Operation completed: ${context.operationName}`, {
            operation: context.operationName,
            duration,
            success: true,
            outputData
        });

        // Record performance metrics
        if (duration) {
            opLogger.performance(context.operationName, duration, {
                success: true,
                outputData
            });
        }

        // Record audit event
        await this.auditService.recordEvent({
            eventType: this.mapOperationToEventType(context.operationName, 'completed'),
            severity: 'info',
            component: context.component,
            action: 'operation_completed',
            description: `Completed operation: ${context.operationName}`,
            userId: context.userId,
            sessionId: context.sessionId,
            correlationId,
            duration,
            success: true,
            metadata: {
                ...context.metadata,
                outputData
            }
        });

        this.activeOperations.delete(correlationId);
        this.emit('operation_completed', { context, outputData, duration });
    }

    /**
     * Fail an operation with error details
     */
    async failOperation(
        correlationId: string,
        error: Error | string,
        duration?: number,
        errorData?: Record<string, any>
    ): Promise<void> {
        const context = this.activeOperations.get(correlationId);
        if (!context) {
            logger.warn('Attempted to fail unknown operation', { correlationId });
            return;
        }

        const opLogger = createOperationLogger(correlationId, context.component);
        const errorMessage = error instanceof Error ? error.message : error;
        const stackTrace = error instanceof Error ? error.stack : undefined;

        // Log operation failure
        opLogger.error(`Operation failed: ${context.operationName}`, {
            operation: context.operationName,
            duration,
            success: false,
            errorMessage,
            errorData
        });

        // Record performance metrics for failed operation
        if (duration) {
            opLogger.performance(context.operationName, duration, {
                success: false,
                errorMessage,
                errorData
            });
        }

        // Record audit event
        await this.auditService.recordEvent({
            eventType: this.mapOperationToEventType(context.operationName, 'failed'),
            severity: 'error',
            component: context.component,
            action: 'operation_failed',
            description: `Failed operation: ${context.operationName}`,
            userId: context.userId,
            sessionId: context.sessionId,
            correlationId,
            duration,
            success: false,
            errorMessage,
            stackTrace,
            metadata: {
                ...context.metadata,
                errorData
            }
        });

        // Create monitoring alert for critical failures
        if (this.isCriticalOperation(context.operationName)) {
            this.monitoringService.createAlert(
                'error',
                `Critical Operation Failed: ${context.operationName}`,
                errorMessage,
                context.component,
                {
                    correlationId,
                    operationName: context.operationName,
                    errorData
                }
            );
        }

        this.activeOperations.delete(correlationId);
        this.emit('operation_failed', { context, error, duration, errorData });
    }

    /**
     * Log an operation step with detailed tracing
     */
    async logOperationStep(
        correlationId: string,
        step: OperationStep,
        status: 'started' | 'completed' | 'failed' | 'skipped' = 'completed',
        duration?: number
    ): Promise<void> {
        const context = this.activeOperations.get(correlationId);
        if (!context) {
            logger.warn('Attempted to log step for unknown operation', { correlationId, step: step.stepName });
            return;
        }

        const opLogger = createOperationLogger(correlationId, context.component);

        // Log step details
        opLogger.debug(`Operation step ${status}: ${step.stepName}`, {
            operation: context.operationName,
            step: step.stepName,
            stepOrder: step.stepOrder,
            status,
            duration,
            inputData: step.inputData,
            outputData: step.outputData,
            errorDetails: step.errorDetails
        });

        // Record operation trace in database
        await this.db.query(`
            INSERT INTO operation_traces (
                correlation_id, operation_name, step_name, step_order, 
                duration, status, input_data, output_data, error_details, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            correlationId,
            context.operationName,
            step.stepName,
            step.stepOrder,
            duration,
            status,
            JSON.stringify(step.inputData || {}),
            JSON.stringify(step.outputData || {}),
            JSON.stringify(step.errorDetails || {}),
            JSON.stringify(step.metadata || {})
        ]);

        this.emit('operation_step_logged', { context, step, status, duration });
    }

    /**
     * Log collection operation with specific details
     */
    async logCollectionOperation(
        action: 'started' | 'completed' | 'failed',
        details: {
            queryId: string;
            queryText: string;
            engine: string;
            resultsCount?: number;
            duration?: number;
            errorMessage?: string;
            userId?: string;
            sessionId?: string;
        }
    ): Promise<string> {
        const correlationId = generateCorrelationId();
        const opLogger = createOperationLogger(correlationId, 'collector');

        // Log to application logger
        const logMessage = `Collection ${action}: ${details.queryText} on ${details.engine}`;
        if (action === 'failed') {
            opLogger.error(logMessage, {
                operation: 'collection',
                queryId: details.queryId,
                engine: details.engine,
                errorMessage: details.errorMessage,
                duration: details.duration
            });
        } else {
            opLogger.info(logMessage, {
                operation: 'collection',
                queryId: details.queryId,
                engine: details.engine,
                resultsCount: details.resultsCount,
                duration: details.duration
            });
        }

        // Record audit event
        await this.auditService.recordCollectionEvent(action, {
            ...details,
            correlationId
        });

        // Record monitoring metrics
        if (action === 'completed' && details.duration) {
            await this.monitoringService.recordCollectionJob({
                jobName: `collection_${details.engine}`,
                querySet: 'dynamic',
                engine: details.engine,
                status: 'completed',
                durationSeconds: Math.round(details.duration / 1000),
                resultsCollected: details.resultsCount || 0,
                metadata: {
                    queryId: details.queryId,
                    queryText: details.queryText
                }
            });
        } else if (action === 'failed') {
            await this.monitoringService.recordCollectionJob({
                jobName: `collection_${details.engine}`,
                querySet: 'dynamic',
                engine: details.engine,
                status: 'failed',
                durationSeconds: details.duration ? Math.round(details.duration / 1000) : undefined,
                errorsEncountered: 1,
                errorMessage: details.errorMessage,
                metadata: {
                    queryId: details.queryId,
                    queryText: details.queryText
                }
            });
        }

        return correlationId;
    }

    /**
     * Log annotation operation with specific details
     */
    async logAnnotationOperation(
        action: 'started' | 'completed' | 'failed',
        details: {
            batchId: string;
            modelVersion: string;
            resultsCount?: number;
            successfulAnnotations?: number;
            failedAnnotations?: number;
            averageConfidence?: number;
            duration?: number;
            errorMessage?: string;
            userId?: string;
            sessionId?: string;
        }
    ): Promise<string> {
        const correlationId = generateCorrelationId();
        const opLogger = createOperationLogger(correlationId, 'annotation_pipeline');

        // Log to application logger
        const logMessage = `Annotation ${action}: batch ${details.batchId} using ${details.modelVersion}`;
        if (action === 'failed') {
            opLogger.error(logMessage, {
                operation: 'annotation',
                batchId: details.batchId,
                modelVersion: details.modelVersion,
                errorMessage: details.errorMessage,
                duration: details.duration
            });
        } else {
            opLogger.info(logMessage, {
                operation: 'annotation',
                batchId: details.batchId,
                modelVersion: details.modelVersion,
                resultsCount: details.resultsCount,
                successfulAnnotations: details.successfulAnnotations,
                averageConfidence: details.averageConfidence,
                duration: details.duration
            });
        }

        // Record audit event
        await this.auditService.recordAnnotationEvent(action, {
            ...details,
            correlationId
        });

        // Record monitoring metrics
        if (action === 'completed' && details.duration) {
            await this.monitoringService.recordAnnotationJob({
                batchId: details.batchId,
                modelVersion: details.modelVersion,
                status: 'completed',
                durationSeconds: Math.round(details.duration / 1000),
                resultsProcessed: details.resultsCount || 0,
                successfulAnnotations: details.successfulAnnotations || 0,
                failedAnnotations: details.failedAnnotations || 0,
                averageConfidence: details.averageConfidence,
                metadata: {}
            });
        } else if (action === 'failed') {
            await this.monitoringService.recordAnnotationJob({
                batchId: details.batchId,
                modelVersion: details.modelVersion,
                status: 'failed',
                durationSeconds: details.duration ? Math.round(details.duration / 1000) : undefined,
                errorMessage: details.errorMessage,
                metadata: {}
            });
        }

        return correlationId;
    }

    /**
     * Create debug session for troubleshooting
     */
    async createDebugSession(
        sessionName: string,
        component: string,
        debugLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error',
        configuration: any,
        createdBy: string = 'system'
    ): Promise<string> {
        const sessionId = await this.debugService.startDebugSession(
            sessionName,
            component,
            debugLevel,
            configuration,
            createdBy
        );

        // Log debug session creation
        logger.info('Debug session created', {
            sessionId,
            sessionName,
            component,
            debugLevel,
            createdBy
        });

        // Record audit event
        await this.auditService.recordEvent({
            eventType: 'system_configuration_changed',
            severity: 'info',
            component: 'debug_service',
            action: 'create_debug_session',
            description: `Created debug session: ${sessionName}`,
            userId: createdBy,
            success: true,
            metadata: {
                sessionId,
                sessionName,
                component,
                debugLevel,
                configuration
            }
        });

        return sessionId;
    }

    /**
     * Capture system state for debugging
     */
    async captureSystemState(
        snapshotName: string,
        component: string,
        stateData: Record<string, any>,
        correlationId?: string,
        createdBy: string = 'system'
    ): Promise<string> {
        const snapshotId = await this.debugService.captureSystemState(
            snapshotName,
            component,
            stateData,
            { captureReason: 'debugging', trigger: 'manual' },
            correlationId,
            createdBy
        );

        // Log state capture
        logger.debug('System state captured', {
            snapshotId,
            snapshotName,
            component,
            correlationId,
            createdBy
        });

        return snapshotId;
    }

    /**
     * Get comprehensive operation logs
     */
    async getOperationLogs(correlationId: string): Promise<{
        auditEvents: any[];
        operationTraces: any[];
        debugLogs: any[];
        systemSnapshots: any[];
    }> {
        // Get audit events
        const auditResult = await this.auditService.queryEvents({
            correlationId,
            limit: 100
        });

        // Get operation traces
        const tracesResult = await this.db.query(`
            SELECT * FROM operation_traces
            WHERE correlation_id = $1
            ORDER BY step_order ASC
        `, [correlationId]);

        // Get debug logs
        const debugLogsResult = await this.db.query(`
            SELECT * FROM debug_logs
            WHERE correlation_id = $1
            ORDER BY timestamp ASC
        `, [correlationId]);

        // Get system snapshots
        const snapshotsResult = await this.db.query(`
            SELECT * FROM system_state_snapshots
            WHERE correlation_id = $1
            ORDER BY timestamp ASC
        `, [correlationId]);

        return {
            auditEvents: auditResult.events,
            operationTraces: tracesResult.rows,
            debugLogs: debugLogsResult.rows,
            systemSnapshots: snapshotsResult.rows
        };
    }

    /**
     * Map operation names to audit event types
     */
    private mapOperationToEventType(operationName: string, suffix?: string): any {
        const baseMapping: Record<string, string> = {
            'collection': 'collection',
            'annotation': 'annotation',
            'metrics_calculation': 'metrics_calculated',
            'data_export': 'data_exported',
            'scheduler_job': 'scheduler_job_executed',
            'query_processing': 'query_processed'
        };

        const baseType = baseMapping[operationName] || 'system_configuration_changed';

        if (suffix) {
            return `${baseType}_${suffix}` as any;
        }

        return `${baseType}_started` as any;
    }

    /**
     * Check if operation is critical and requires immediate alerting
     */
    private isCriticalOperation(operationName: string): boolean {
        const criticalOperations = [
            'collection',
            'annotation',
            'data_export',
            'metrics_calculation'
        ];

        return criticalOperations.includes(operationName);
    }

    /**
     * Clean up old logging data
     */
    async cleanupOldLogs(retentionDays: number = 30): Promise<void> {
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        // Clean up operation traces
        const tracesResult = await this.db.query(`
            DELETE FROM operation_traces 
            WHERE timestamp < $1
            RETURNING id
        `, [cutoffDate]);

        // Clean up debug data
        await this.debugService.cleanupOldDebugData(retentionDays);

        logger.info('Logging data cleanup completed', {
            deletedTraces: tracesResult.rows.length,
            retentionDays
        });
    }
}