import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { DatabaseConnection } from '../database/connection';

/**
 * Audit event types for different system operations
 */
export type AuditEventType =
    | 'collection_started'
    | 'collection_completed'
    | 'collection_failed'
    | 'annotation_started'
    | 'annotation_completed'
    | 'annotation_failed'
    | 'metrics_calculated'
    | 'data_exported'
    | 'system_alert_created'
    | 'system_alert_acknowledged'
    | 'data_integrity_check'
    | 'scheduler_job_executed'
    | 'query_processed'
    | 'user_action'
    | 'system_configuration_changed';

/**
 * Audit event severity levels
 */
export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit event interface
 */
export interface AuditEvent {
    id: string;
    eventType: AuditEventType;
    severity: AuditSeverity;
    timestamp: Date;
    component: string;
    action: string;
    description: string;
    userId?: string;
    sessionId?: string;
    metadata: Record<string, any>;
    correlationId?: string;
    duration?: number;
    success: boolean;
    errorMessage?: string;
    stackTrace?: string;
}

/**
 * Audit trail query options
 */
export interface AuditQueryOptions {
    eventTypes?: AuditEventType[];
    components?: string[];
    severity?: AuditSeverity[];
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    correlationId?: string;
    success?: boolean;
    limit?: number;
    offset?: number;
}

/**
 * Audit service for comprehensive system operation logging
 */
export class AuditService extends EventEmitter {
    private db: DatabaseConnection;
    private auditBuffer: AuditEvent[] = [];
    private bufferFlushInterval?: NodeJS.Timeout;
    private readonly bufferSize: number;
    private readonly flushIntervalMs: number;

    constructor(
        db: DatabaseConnection,
        config: {
            bufferSize?: number;
            flushIntervalMs?: number;
        } = {}
    ) {
        super();
        this.db = db;
        this.bufferSize = config.bufferSize || 100;
        this.flushIntervalMs = config.flushIntervalMs || 30000; // 30 seconds

        this.startBufferFlush();
    }

    /**
     * Record an audit event
     */
    async recordEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
        const auditEvent: AuditEvent = {
            id: this.generateEventId(),
            timestamp: new Date(),
            ...event
        };

        // Add to buffer for batch processing
        this.auditBuffer.push(auditEvent);

        // Log to application logger based on severity
        const logMessage = `[AUDIT] ${event.component}:${event.action} - ${event.description}`;
        const logMeta = {
            eventType: event.eventType,
            correlationId: event.correlationId,
            userId: event.userId,
            success: event.success,
            duration: event.duration,
            metadata: event.metadata
        };

        switch (event.severity) {
            case 'debug':
                logger.debug(logMessage, logMeta);
                break;
            case 'info':
                logger.info(logMessage, logMeta);
                break;
            case 'warning':
                logger.warn(logMessage, logMeta);
                break;
            case 'error':
            case 'critical':
                logger.error(logMessage, { ...logMeta, errorMessage: event.errorMessage, stackTrace: event.stackTrace });
                break;
        }

        // Flush buffer if it's full
        if (this.auditBuffer.length >= this.bufferSize) {
            await this.flushBuffer();
        }

        this.emit('audit_event_recorded', auditEvent);
        return auditEvent.id;
    }

    /**
     * Record collection operation audit event
     */
    async recordCollectionEvent(
        action: 'started' | 'completed' | 'failed',
        details: {
            queryId: string;
            queryText: string;
            engine: string;
            resultsCount?: number;
            duration?: number;
            errorMessage?: string;
            correlationId?: string;
        }
    ): Promise<string> {
        const eventType: AuditEventType = action === 'started' ? 'collection_started' :
            action === 'completed' ? 'collection_completed' : 'collection_failed';

        return this.recordEvent({
            eventType,
            severity: action === 'failed' ? 'error' : 'info',
            component: 'collector',
            action: `${action}_collection`,
            description: `Collection ${action} for query "${details.queryText}" on ${details.engine}`,
            correlationId: details.correlationId,
            duration: details.duration,
            success: action !== 'failed',
            errorMessage: details.errorMessage,
            metadata: {
                queryId: details.queryId,
                queryText: details.queryText,
                engine: details.engine,
                resultsCount: details.resultsCount
            }
        });
    }

    /**
     * Record annotation operation audit event
     */
    async recordAnnotationEvent(
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
            correlationId?: string;
        }
    ): Promise<string> {
        const eventType: AuditEventType = action === 'started' ? 'annotation_started' :
            action === 'completed' ? 'annotation_completed' : 'annotation_failed';

        return this.recordEvent({
            eventType,
            severity: action === 'failed' ? 'error' : 'info',
            component: 'annotation_pipeline',
            action: `${action}_annotation`,
            description: `Annotation ${action} for batch ${details.batchId} using ${details.modelVersion}`,
            correlationId: details.correlationId,
            duration: details.duration,
            success: action !== 'failed',
            errorMessage: details.errorMessage,
            metadata: {
                batchId: details.batchId,
                modelVersion: details.modelVersion,
                resultsCount: details.resultsCount,
                successfulAnnotations: details.successfulAnnotations,
                failedAnnotations: details.failedAnnotations,
                averageConfidence: details.averageConfidence
            }
        });
    }

    /**
     * Record metrics calculation audit event
     */
    async recordMetricsEvent(details: {
        metricsType: string;
        querySet?: string;
        timeRange?: string;
        calculatedMetrics: Record<string, number>;
        duration?: number;
        correlationId?: string;
    }): Promise<string> {
        return this.recordEvent({
            eventType: 'metrics_calculated',
            severity: 'info',
            component: 'metrics_engine',
            action: 'calculate_metrics',
            description: `Calculated ${details.metricsType} metrics${details.querySet ? ` for ${details.querySet}` : ''}`,
            correlationId: details.correlationId,
            duration: details.duration,
            success: true,
            metadata: {
                metricsType: details.metricsType,
                querySet: details.querySet,
                timeRange: details.timeRange,
                calculatedMetrics: details.calculatedMetrics
            }
        });
    }

    /**
     * Record data export audit event
     */
    async recordExportEvent(details: {
        exportType: string;
        format: string;
        recordCount: number;
        filters?: Record<string, any>;
        userId?: string;
        duration?: number;
        correlationId?: string;
    }): Promise<string> {
        return this.recordEvent({
            eventType: 'data_exported',
            severity: 'info',
            component: 'export_service',
            action: 'export_data',
            description: `Exported ${details.recordCount} records as ${details.format}`,
            userId: details.userId,
            correlationId: details.correlationId,
            duration: details.duration,
            success: true,
            metadata: {
                exportType: details.exportType,
                format: details.format,
                recordCount: details.recordCount,
                filters: details.filters
            }
        });
    }

    /**
     * Record system alert audit event
     */
    async recordAlertEvent(
        action: 'created' | 'acknowledged',
        details: {
            alertId: string;
            severity: string;
            title: string;
            source: string;
            userId?: string;
            correlationId?: string;
        }
    ): Promise<string> {
        const eventType: AuditEventType = action === 'created' ? 'system_alert_created' : 'system_alert_acknowledged';

        return this.recordEvent({
            eventType,
            severity: 'warning',
            component: 'monitoring_service',
            action: `${action}_alert`,
            description: `Alert ${action}: ${details.title}`,
            userId: details.userId,
            correlationId: details.correlationId,
            success: true,
            metadata: {
                alertId: details.alertId,
                alertSeverity: details.severity,
                title: details.title,
                source: details.source
            }
        });
    }

    /**
     * Record data integrity check audit event
     */
    async recordDataIntegrityEvent(details: {
        checkType: string;
        isValid: boolean;
        errorCount: number;
        warningCount: number;
        statistics: Record<string, any>;
        duration?: number;
        correlationId?: string;
    }): Promise<string> {
        return this.recordEvent({
            eventType: 'data_integrity_check',
            severity: details.isValid ? 'info' : 'warning',
            component: 'data_integrity_service',
            action: 'integrity_check',
            description: `Data integrity check ${details.isValid ? 'passed' : 'failed'} - ${details.errorCount} errors, ${details.warningCount} warnings`,
            correlationId: details.correlationId,
            duration: details.duration,
            success: details.isValid,
            metadata: {
                checkType: details.checkType,
                errorCount: details.errorCount,
                warningCount: details.warningCount,
                statistics: details.statistics
            }
        });
    }

    /**
     * Record scheduler job execution audit event
     */
    async recordSchedulerEvent(details: {
        jobName: string;
        status: 'started' | 'completed' | 'failed';
        duration?: number;
        errorMessage?: string;
        correlationId?: string;
    }): Promise<string> {
        return this.recordEvent({
            eventType: 'scheduler_job_executed',
            severity: details.status === 'failed' ? 'error' : 'info',
            component: 'scheduler_service',
            action: `job_${details.status}`,
            description: `Scheduler job "${details.jobName}" ${details.status}`,
            correlationId: details.correlationId,
            duration: details.duration,
            success: details.status !== 'failed',
            errorMessage: details.errorMessage,
            metadata: {
                jobName: details.jobName,
                status: details.status
            }
        });
    }

    /**
     * Record user action audit event
     */
    async recordUserAction(details: {
        userId: string;
        sessionId?: string;
        action: string;
        resource: string;
        description: string;
        metadata?: Record<string, any>;
        correlationId?: string;
    }): Promise<string> {
        return this.recordEvent({
            eventType: 'user_action',
            severity: 'info',
            component: 'dashboard',
            action: details.action,
            description: details.description,
            userId: details.userId,
            sessionId: details.sessionId,
            correlationId: details.correlationId,
            success: true,
            metadata: {
                resource: details.resource,
                ...details.metadata
            }
        });
    }

    /**
     * Query audit events with filtering options
     */
    async queryEvents(options: AuditQueryOptions = {}): Promise<{
        events: AuditEvent[];
        totalCount: number;
    }> {
        try {
            const conditions: string[] = [];
            const params: any[] = [];
            let paramIndex = 1;

            // Build WHERE conditions
            if (options.eventTypes && options.eventTypes.length > 0) {
                conditions.push(`event_type = ANY($${paramIndex})`);
                params.push(options.eventTypes);
                paramIndex++;
            }

            if (options.components && options.components.length > 0) {
                conditions.push(`component = ANY($${paramIndex})`);
                params.push(options.components);
                paramIndex++;
            }

            if (options.severity && options.severity.length > 0) {
                conditions.push(`severity = ANY($${paramIndex})`);
                params.push(options.severity);
                paramIndex++;
            }

            if (options.startDate) {
                conditions.push(`timestamp >= $${paramIndex}`);
                params.push(options.startDate);
                paramIndex++;
            }

            if (options.endDate) {
                conditions.push(`timestamp <= $${paramIndex}`);
                params.push(options.endDate);
                paramIndex++;
            }

            if (options.userId) {
                conditions.push(`user_id = $${paramIndex}`);
                params.push(options.userId);
                paramIndex++;
            }

            if (options.correlationId) {
                conditions.push(`correlation_id = $${paramIndex}`);
                params.push(options.correlationId);
                paramIndex++;
            }

            if (options.success !== undefined) {
                conditions.push(`success = $${paramIndex}`);
                params.push(options.success);
                paramIndex++;
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countQuery = `SELECT COUNT(*) as total FROM audit_events ${whereClause}`;
            const countResult = await this.db.query(countQuery, params);
            const totalCount = parseInt(countResult.rows[0].total);

            // Get events with pagination
            const limit = options.limit || 100;
            const offset = options.offset || 0;

            const eventsQuery = `
                SELECT * FROM audit_events 
                ${whereClause}
                ORDER BY timestamp DESC 
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;
            params.push(limit, offset);

            const eventsResult = await this.db.query(eventsQuery, params);

            const events: AuditEvent[] = eventsResult.rows.map((row: any) => ({
                id: row.id,
                eventType: row.event_type,
                severity: row.severity,
                timestamp: row.timestamp,
                component: row.component,
                action: row.action,
                description: row.description,
                userId: row.user_id,
                sessionId: row.session_id,
                metadata: row.metadata || {},
                correlationId: row.correlation_id,
                duration: row.duration,
                success: row.success,
                errorMessage: row.error_message,
                stackTrace: row.stack_trace
            }));

            return { events, totalCount };

        } catch (error) {
            logger.error('Failed to query audit events', { error, options });
            throw error;
        }
    }

    /**
     * Get audit statistics for dashboard
     */
    async getAuditStatistics(hours = 24): Promise<{
        totalEvents: number;
        eventsByType: Record<string, number>;
        eventsBySeverity: Record<string, number>;
        eventsByComponent: Record<string, number>;
        successRate: number;
        averageDuration: number;
        recentErrors: AuditEvent[];
    }> {
        try {
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

            // Get basic statistics
            const statsResult = await this.db.query(`
                SELECT 
                    COUNT(*) as total_events,
                    AVG(duration) as avg_duration,
                    COUNT(CASE WHEN success = true THEN 1 END) as successful_events
                FROM audit_events 
                WHERE timestamp >= $1
            `, [startTime]);

            const totalEvents = parseInt(statsResult.rows[0].total_events);
            const successfulEvents = parseInt(statsResult.rows[0].successful_events);
            const successRate = totalEvents > 0 ? successfulEvents / totalEvents : 1;
            const averageDuration = parseFloat(statsResult.rows[0].avg_duration) || 0;

            // Get events by type
            const typeResult = await this.db.query(`
                SELECT event_type, COUNT(*) as count
                FROM audit_events 
                WHERE timestamp >= $1
                GROUP BY event_type
                ORDER BY count DESC
            `, [startTime]);

            const eventsByType: Record<string, number> = {};
            typeResult.rows.forEach((row: any) => {
                eventsByType[row.event_type] = parseInt(row.count);
            });

            // Get events by severity
            const severityResult = await this.db.query(`
                SELECT severity, COUNT(*) as count
                FROM audit_events 
                WHERE timestamp >= $1
                GROUP BY severity
                ORDER BY count DESC
            `, [startTime]);

            const eventsBySeverity: Record<string, number> = {};
            severityResult.rows.forEach((row: any) => {
                eventsBySeverity[row.severity] = parseInt(row.count);
            });

            // Get events by component
            const componentResult = await this.db.query(`
                SELECT component, COUNT(*) as count
                FROM audit_events 
                WHERE timestamp >= $1
                GROUP BY component
                ORDER BY count DESC
            `, [startTime]);

            const eventsByComponent: Record<string, number> = {};
            componentResult.rows.forEach((row: any) => {
                eventsByComponent[row.component] = parseInt(row.count);
            });

            // Get recent errors
            const errorResult = await this.db.query(`
                SELECT * FROM audit_events 
                WHERE timestamp >= $1 AND success = false
                ORDER BY timestamp DESC
                LIMIT 10
            `, [startTime]);

            const recentErrors: AuditEvent[] = errorResult.rows.map((row: any) => ({
                id: row.id,
                eventType: row.event_type,
                severity: row.severity,
                timestamp: row.timestamp,
                component: row.component,
                action: row.action,
                description: row.description,
                userId: row.user_id,
                sessionId: row.session_id,
                metadata: row.metadata || {},
                correlationId: row.correlation_id,
                duration: row.duration,
                success: row.success,
                errorMessage: row.error_message,
                stackTrace: row.stack_trace
            }));

            return {
                totalEvents,
                eventsByType,
                eventsBySeverity,
                eventsByComponent,
                successRate,
                averageDuration,
                recentErrors
            };

        } catch (error) {
            logger.error('Failed to get audit statistics', { error });
            throw error;
        }
    }

    /**
     * Start buffer flush interval
     */
    private startBufferFlush(): void {
        this.bufferFlushInterval = setInterval(async () => {
            if (this.auditBuffer.length > 0) {
                await this.flushBuffer();
            }
        }, this.flushIntervalMs);
    }

    /**
     * Flush audit buffer to database
     */
    private async flushBuffer(): Promise<void> {
        if (this.auditBuffer.length === 0) {
            return;
        }

        const eventsToFlush = [...this.auditBuffer];
        this.auditBuffer = [];

        try {
            // Batch insert audit events
            const values = eventsToFlush.map((_event, index) => {
                const baseIndex = index * 14;
                return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14})`;
            }).join(', ');

            const params = eventsToFlush.flatMap(event => [
                event.id,
                event.eventType,
                event.severity,
                event.timestamp,
                event.component,
                event.action,
                event.description,
                event.userId,
                event.sessionId,
                JSON.stringify(event.metadata),
                event.correlationId,
                event.duration,
                event.success,
                event.errorMessage
            ]);

            await this.db.query(`
                INSERT INTO audit_events (
                    id, event_type, severity, timestamp, component, action, description,
                    user_id, session_id, metadata, correlation_id, duration, success, error_message
                ) VALUES ${values}
            `, params);

            logger.debug('Flushed audit events to database', { count: eventsToFlush.length });

        } catch (error) {
            logger.error('Failed to flush audit events to database', { error, eventCount: eventsToFlush.length });
            // Re-add events to buffer for retry
            this.auditBuffer.unshift(...eventsToFlush);
        }
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Stop the audit service and flush remaining events
     */
    async stop(): Promise<void> {
        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
            this.bufferFlushInterval = undefined;
        }

        // Flush any remaining events
        await this.flushBuffer();

        logger.info('Audit service stopped');
    }
}