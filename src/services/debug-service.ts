import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { DatabaseConnection } from '../database/connection';
import { AuditService } from './audit-service';

/**
 * Debug session configuration
 */
export interface DebugConfig {
    verboseLogging: boolean;
    captureHtml: boolean;
    captureScreenshots: boolean;
    logPrompts: boolean;
    logResponses: boolean;
    captureTiming: boolean;
    validateCalculations: boolean;
    logIntermediateSteps: boolean;
    proxyDebug: boolean;
    networkTracing: boolean;
}

/**
 * Debug session interface
 */
export interface DebugSession {
    id: string;
    sessionName: string;
    component: string;
    startedAt: Date;
    endedAt?: Date;
    status: 'active' | 'completed' | 'aborted';
    debugLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    configuration: DebugConfig;
    summary?: string;
    createdBy: string;
}

/**
 * Debug log entry
 */
export interface DebugLogEntry {
    id: string;
    sessionId: string;
    timestamp: Date;
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    component: string;
    message: string;
    context: Record<string, any>;
    stackTrace?: string;
    correlationId?: string;
}

/**
 * System state snapshot
 */
export interface SystemStateSnapshot {
    id: string;
    snapshotName: string;
    timestamp: Date;
    component: string;
    stateData: Record<string, any>;
    metadata: Record<string, any>;
    correlationId?: string;
    createdBy: string;
}

/**
 * Collection failure analysis result
 */
export interface CollectionFailureAnalysis {
    failureId: string;
    engine: string;
    queryText: string;
    timestamp: Date;
    errorType: string;
    errorMessage: string;
    possibleCauses: string[];
    recommendedActions: string[];
    relatedFailures: string[];
    debugData: Record<string, any>;
}

/**
 * Debug service for comprehensive system troubleshooting
 */
export class DebugService extends EventEmitter {
    private db: DatabaseConnection;
    private auditService: AuditService;
    private activeSessions: Map<string, DebugSession> = new Map();

    constructor(db: DatabaseConnection, auditService: AuditService) {
        super();
        this.db = db;
        this.auditService = auditService;
    }

    /**
     * Start a new debug session
     */
    async startDebugSession(
        sessionName: string,
        component: string,
        debugLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error',
        configuration: Partial<DebugConfig>,
        createdBy: string = 'system'
    ): Promise<string> {
        const sessionId = this.generateSessionId();

        const defaultConfig: DebugConfig = {
            verboseLogging: false,
            captureHtml: false,
            captureScreenshots: false,
            logPrompts: false,
            logResponses: false,
            captureTiming: false,
            validateCalculations: false,
            logIntermediateSteps: false,
            proxyDebug: false,
            networkTracing: false
        };

        const session: DebugSession = {
            id: sessionId,
            sessionName,
            component,
            startedAt: new Date(),
            status: 'active',
            debugLevel,
            configuration: { ...defaultConfig, ...configuration },
            createdBy
        };

        this.activeSessions.set(sessionId, session);

        // Persist to database
        await this.db.query(`
            INSERT INTO debug_sessions (id, session_name, component, debug_level, configuration, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [sessionId, sessionName, component, debugLevel, JSON.stringify(session.configuration), createdBy]);

        logger.info('Debug session started', {
            sessionId,
            sessionName,
            component,
            debugLevel,
            createdBy
        });

        this.emit('debug_session_started', session);
        return sessionId;
    }

    /**
     * End a debug session
     */
    async endDebugSession(sessionId: string, summary?: string): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session ${sessionId} not found`);
        }

        session.endedAt = new Date();
        session.status = 'completed';
        session.summary = summary;

        // Update database
        await this.db.query(`
            UPDATE debug_sessions 
            SET ended_at = $1, status = $2, summary = $3
            WHERE id = $4
        `, [session.endedAt, session.status, summary, sessionId]);

        this.activeSessions.delete(sessionId);

        logger.info('Debug session ended', {
            sessionId,
            duration: session.endedAt.getTime() - session.startedAt.getTime(),
            summary
        });

        this.emit('debug_session_ended', session);
    }

    /**
     * Log debug information to a session
     */
    async logDebug(
        sessionId: string,
        level: 'trace' | 'debug' | 'info' | 'warn' | 'error',
        component: string,
        message: string,
        context: Record<string, any> = {},
        correlationId?: string
    ): Promise<void> {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            logger.warn('Attempted to log to non-existent debug session', { sessionId });
            return;
        }

        const logEntry: DebugLogEntry = {
            id: this.generateLogId(),
            sessionId,
            timestamp: new Date(),
            level,
            component,
            message,
            context,
            correlationId
        };

        // Persist to database
        await this.db.query(`
            INSERT INTO debug_logs (id, session_id, level, component, message, context, correlation_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [logEntry.id, sessionId, level, component, message, JSON.stringify(context), correlationId]);

        // Also log to application logger if verbose logging is enabled
        if (session.configuration.verboseLogging) {
            const logMessage = `[DEBUG:${sessionId}] ${component}: ${message}`;
            switch (level) {
                case 'trace':
                case 'debug':
                    logger.debug(logMessage, context);
                    break;
                case 'info':
                    logger.info(logMessage, context);
                    break;
                case 'warn':
                    logger.warn(logMessage, context);
                    break;
                case 'error':
                    logger.error(logMessage, context);
                    break;
            }
        }

        this.emit('debug_log_created', logEntry);
    }

    /**
     * Capture system state snapshot
     */
    async captureSystemState(
        snapshotName: string,
        component: string,
        stateData: Record<string, any>,
        metadata: Record<string, any> = {},
        correlationId?: string,
        createdBy: string = 'system'
    ): Promise<string> {
        const snapshotId = this.generateSnapshotId();

        const snapshot: SystemStateSnapshot = {
            id: snapshotId,
            snapshotName,
            timestamp: new Date(),
            component,
            stateData,
            metadata,
            correlationId,
            createdBy
        };

        // Persist to database
        await this.db.query(`
            INSERT INTO system_state_snapshots (id, snapshot_name, component, state_data, metadata, correlation_id, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [snapshotId, snapshotName, component, JSON.stringify(stateData), JSON.stringify(metadata), correlationId, createdBy]);

        logger.debug('System state snapshot captured', {
            snapshotId,
            snapshotName,
            component,
            correlationId
        });

        this.emit('system_state_captured', snapshot);
        return snapshotId;
    }

    /**
     * Analyze collection failures and provide troubleshooting recommendations
     */
    async analyzeCollectionFailures(hours = 24): Promise<CollectionFailureAnalysis[]> {
        try {
            // Get recent collection failures
            const failuresResult = await this.db.query(`
                SELECT 
                    cje.id,
                    cje.job_name,
                    cje.engine,
                    cje.error_message,
                    cje.started_at,
                    cje.metadata,
                    q.text as query_text
                FROM collection_job_executions cje
                LEFT JOIN queries q ON (cje.metadata->>'queryId')::uuid = q.id
                WHERE cje.status = 'failed' 
                  AND cje.started_at >= NOW() - INTERVAL '${hours} hours'
                ORDER BY cje.started_at DESC
            `);

            const analyses: CollectionFailureAnalysis[] = [];

            for (const failure of failuresResult.rows) {
                const analysis = await this.analyzeIndividualFailure(failure);
                analyses.push(analysis);
            }

            logger.info('Collection failure analysis completed', {
                totalFailures: analyses.length,
                timeRange: `${hours} hours`
            });

            return analyses;

        } catch (error) {
            logger.error('Failed to analyze collection failures', { error });
            throw error;
        }
    }

    /**
     * Analyze individual collection failure
     */
    private async analyzeIndividualFailure(failure: any): Promise<CollectionFailureAnalysis> {
        const errorMessage = failure.error_message || '';
        const engine = failure.engine;
        const metadata = failure.metadata || {};

        // Determine error type and possible causes
        let errorType = 'unknown';
        let possibleCauses: string[] = [];
        let recommendedActions: string[] = [];

        if (errorMessage.toLowerCase().includes('rate limit')) {
            errorType = 'rate_limit';
            possibleCauses = [
                'Too many requests sent to search engine',
                'IP address temporarily blocked',
                'Insufficient delay between requests'
            ];
            recommendedActions = [
                'Increase delay between requests',
                'Rotate proxy IP addresses',
                'Implement exponential backoff',
                'Check engine-specific rate limits'
            ];
        } else if (errorMessage.toLowerCase().includes('captcha') || errorMessage.toLowerCase().includes('challenge')) {
            errorType = 'captcha_challenge';
            possibleCauses = [
                'Search engine detected automated behavior',
                'IP address flagged for suspicious activity',
                'User-agent or browser fingerprint detected'
            ];
            recommendedActions = [
                'Integrate captcha solving service',
                'Improve browser fingerprinting',
                'Use residential proxy network',
                'Randomize request patterns'
            ];
        } else if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('network')) {
            errorType = 'network_timeout';
            possibleCauses = [
                'Network connectivity issues',
                'Proxy server problems',
                'Search engine server overload',
                'DNS resolution failures'
            ];
            recommendedActions = [
                'Check network connectivity',
                'Test proxy server health',
                'Implement retry with different proxy',
                'Increase timeout values'
            ];
        } else if (errorMessage.toLowerCase().includes('parse') || errorMessage.toLowerCase().includes('selector')) {
            errorType = 'parsing_error';
            possibleCauses = [
                'Search engine changed page structure',
                'Unexpected page format returned',
                'JavaScript-rendered content not loaded',
                'Anti-bot page served instead of results'
            ];
            recommendedActions = [
                'Update CSS selectors for result parsing',
                'Wait for JavaScript content to load',
                'Verify page structure manually',
                'Check for anti-bot detection'
            ];
        } else if (errorMessage.toLowerCase().includes('blocked') || errorMessage.toLowerCase().includes('forbidden')) {
            errorType = 'access_blocked';
            possibleCauses = [
                'IP address permanently blocked',
                'Geographic restrictions',
                'Terms of service violation detected',
                'User-agent blacklisted'
            ];
            recommendedActions = [
                'Switch to different proxy network',
                'Use residential IP addresses',
                'Update user-agent strings',
                'Review scraping patterns for compliance'
            ];
        }

        // Find related failures (same engine, similar time, similar error)
        const relatedFailuresResult = await this.db.query(`
            SELECT id FROM collection_job_executions
            WHERE engine = $1 
              AND status = 'failed'
              AND started_at >= $2 - INTERVAL '1 hour'
              AND started_at <= $2 + INTERVAL '1 hour'
              AND id != $3
            LIMIT 5
        `, [engine, failure.started_at, failure.id]);

        const relatedFailures = relatedFailuresResult.rows.map((row: any) => row.id);

        return {
            failureId: failure.id,
            engine: engine,
            queryText: failure.query_text || 'Unknown query',
            timestamp: failure.started_at,
            errorType,
            errorMessage,
            possibleCauses,
            recommendedActions,
            relatedFailures,
            debugData: {
                jobName: failure.job_name,
                metadata: metadata,
                analysisTimestamp: new Date()
            }
        };
    }

    /**
     * Get debug session logs
     */
    async getSessionLogs(
        sessionId: string,
        level?: 'trace' | 'debug' | 'info' | 'warn' | 'error',
        limit: number = 100
    ): Promise<DebugLogEntry[]> {
        try {
            const conditions = ['session_id = $1'];
            const params: any[] = [sessionId];

            if (level) {
                conditions.push('level = $2');
                params.push(level);
            }

            const result = await this.db.query(`
                SELECT * FROM debug_logs
                WHERE ${conditions.join(' AND ')}
                ORDER BY timestamp DESC
                LIMIT $${params.length + 1}
            `, [...params, limit]);

            return result.rows.map((row: any) => ({
                id: row.id,
                sessionId: row.session_id,
                timestamp: row.timestamp,
                level: row.level,
                component: row.component,
                message: row.message,
                context: row.context || {},
                stackTrace: row.stack_trace,
                correlationId: row.correlation_id
            }));

        } catch (error) {
            logger.error('Failed to get debug session logs', { error, sessionId });
            throw error;
        }
    }

    /**
     * Get system state snapshots
     */
    async getSystemSnapshots(
        component?: string,
        hours: number = 24,
        limit: number = 50
    ): Promise<SystemStateSnapshot[]> {
        try {
            const conditions = ['timestamp >= NOW() - INTERVAL $1'];
            const params: any[] = [`${hours} hours`];

            if (component) {
                conditions.push('component = $2');
                params.push(component);
            }

            const result = await this.db.query(`
                SELECT * FROM system_state_snapshots
                WHERE ${conditions.join(' AND ')}
                ORDER BY timestamp DESC
                LIMIT $${params.length + 1}
            `, [...params, limit]);

            return result.rows.map((row: any) => ({
                id: row.id,
                snapshotName: row.snapshot_name,
                timestamp: row.timestamp,
                component: row.component,
                stateData: row.state_data || {},
                metadata: row.metadata || {},
                correlationId: row.correlation_id,
                createdBy: row.created_by
            }));

        } catch (error) {
            logger.error('Failed to get system snapshots', { error, component, hours });
            throw error;
        }
    }

    /**
     * Generate troubleshooting report
     */
    async generateTroubleshootingReport(correlationId: string): Promise<{
        correlationId: string;
        timeRange: { start: Date; end: Date };
        auditEvents: any[];
        operationTraces: any[];
        debugLogs: DebugLogEntry[];
        systemSnapshots: SystemStateSnapshot[];
        failureAnalysis?: CollectionFailureAnalysis[];
        summary: string;
    }> {
        try {
            // Get audit events for correlation ID
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

            const debugLogs: DebugLogEntry[] = debugLogsResult.rows.map((row: any) => ({
                id: row.id,
                sessionId: row.session_id,
                timestamp: row.timestamp,
                level: row.level,
                component: row.component,
                message: row.message,
                context: row.context || {},
                stackTrace: row.stack_trace,
                correlationId: row.correlation_id
            }));

            // Get system snapshots
            const snapshotsResult = await this.db.query(`
                SELECT * FROM system_state_snapshots
                WHERE correlation_id = $1
                ORDER BY timestamp ASC
            `, [correlationId]);

            const systemSnapshots: SystemStateSnapshot[] = snapshotsResult.rows.map((row: any) => ({
                id: row.id,
                snapshotName: row.snapshot_name,
                timestamp: row.timestamp,
                component: row.component,
                stateData: row.state_data || {},
                metadata: row.metadata || {},
                correlationId: row.correlation_id,
                createdBy: row.created_by
            }));

            // Determine time range
            const allTimestamps = [
                ...auditResult.events.map(e => e.timestamp),
                ...tracesResult.rows.map((t: any) => t.timestamp),
                ...debugLogs.map(l => l.timestamp),
                ...systemSnapshots.map(s => s.timestamp)
            ];

            const timeRange = {
                start: new Date(Math.min(...allTimestamps.map(t => t.getTime()))),
                end: new Date(Math.max(...allTimestamps.map(t => t.getTime())))
            };

            // Generate summary
            const errorCount = auditResult.events.filter(e => !e.success).length;
            const componentCount = new Set([
                ...auditResult.events.map(e => e.component),
                ...debugLogs.map(l => l.component)
            ]).size;

            const summary = `Troubleshooting report for correlation ID ${correlationId}: ` +
                `${auditResult.events.length} audit events, ${tracesResult.rows.length} operation traces, ` +
                `${debugLogs.length} debug logs, ${systemSnapshots.length} system snapshots across ` +
                `${componentCount} components. ${errorCount} errors detected.`;

            return {
                correlationId,
                timeRange,
                auditEvents: auditResult.events,
                operationTraces: tracesResult.rows,
                debugLogs,
                systemSnapshots,
                summary
            };

        } catch (error) {
            logger.error('Failed to generate troubleshooting report', { error, correlationId });
            throw error;
        }
    }

    /**
     * Clean up old debug data
     */
    async cleanupOldDebugData(retentionDays: number = 30): Promise<void> {
        try {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

            // Clean up old debug sessions and their logs (cascade delete)
            const sessionsResult = await this.db.query(`
                DELETE FROM debug_sessions 
                WHERE started_at < $1 AND status != 'active'
                RETURNING id
            `, [cutoffDate]);

            // Clean up old system state snapshots
            const snapshotsResult = await this.db.query(`
                DELETE FROM system_state_snapshots 
                WHERE timestamp < $1
                RETURNING id
            `, [cutoffDate]);

            logger.info('Debug data cleanup completed', {
                deletedSessions: sessionsResult.rows.length,
                deletedSnapshots: snapshotsResult.rows.length,
                retentionDays
            });

        } catch (error) {
            logger.error('Failed to cleanup old debug data', { error });
            throw error;
        }
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique log ID
     */
    private generateLogId(): string {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate unique snapshot ID
     */
    private generateSnapshotId(): string {
        return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}