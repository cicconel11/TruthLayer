import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../database/connection';
import { AuditService } from '../services/audit-service';
import { getConfig } from '../utils/config-loader';

describe('AuditService', () => {
    let db: DatabaseConnection;
    let auditService: AuditService;

    beforeEach(async () => {
        const config = getConfig();
        db = new DatabaseConnection(config.database);
        await db.connect();
        auditService = new AuditService(db);
    });

    afterEach(async () => {
        // Clean up test data
        await db.query('DELETE FROM audit_events WHERE id LIKE $1', ['test_%']);
        await db.disconnect();
    });

    it('should record audit events', async () => {
        const eventId = await auditService.recordEvent({
            eventType: 'collection_started',
            severity: 'info',
            component: 'test_collector',
            action: 'test_action',
            description: 'Test audit event',
            success: true,
            metadata: { test: true }
        });

        expect(eventId).toMatch(/^audit_/);

        // Verify event was stored
        const result = await auditService.queryEvents({
            eventTypes: ['collection_started'],
            components: ['test_collector']
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].description).toBe('Test audit event');
        expect(result.events[0].success).toBe(true);
    });

    it('should record collection events', async () => {
        const correlationId = await auditService.recordCollectionEvent('started', {
            queryId: 'test-query-123',
            queryText: 'test query',
            engine: 'google'
        });

        expect(correlationId).toMatch(/^audit_/);

        const events = await auditService.queryEvents({
            eventTypes: ['collection_started']
        });

        expect(events.events).toHaveLength(1);
        expect(events.events[0].metadata.queryText).toBe('test query');
        expect(events.events[0].metadata.engine).toBe('google');
    });

    it('should get audit statistics', async () => {
        // Record some test events
        await auditService.recordEvent({
            eventType: 'collection_completed',
            severity: 'info',
            component: 'test_collector',
            action: 'test_success',
            description: 'Successful test',
            success: true,
            metadata: {}
        });

        await auditService.recordEvent({
            eventType: 'collection_failed',
            severity: 'error',
            component: 'test_collector',
            action: 'test_failure',
            description: 'Failed test',
            success: false,
            errorMessage: 'Test error',
            metadata: {}
        });

        const stats = await auditService.getAuditStatistics(1);

        expect(stats.totalEvents).toBeGreaterThanOrEqual(2);
        expect(stats.successRate).toBeLessThan(1); // Should be less than 100% due to failure
        expect(stats.eventsByType).toHaveProperty('collection_completed');
        expect(stats.eventsByType).toHaveProperty('collection_failed');
        expect(stats.eventsBySeverity).toHaveProperty('info');
        expect(stats.eventsBySeverity).toHaveProperty('error');
    });

    it('should query events with filters', async () => {
        const correlationId = 'test-correlation-123';

        // Record events with same correlation ID
        await auditService.recordEvent({
            eventType: 'collection_started',
            severity: 'info',
            component: 'test_collector',
            action: 'start',
            description: 'Start test',
            correlationId,
            success: true,
            metadata: {}
        });

        await auditService.recordEvent({
            eventType: 'collection_completed',
            severity: 'info',
            component: 'test_collector',
            action: 'complete',
            description: 'Complete test',
            correlationId,
            success: true,
            metadata: {}
        });

        // Query by correlation ID
        const result = await auditService.queryEvents({
            correlationId,
            limit: 10
        });

        expect(result.events).toHaveLength(2);
        expect(result.events[0].correlationId).toBe(correlationId);
        expect(result.events[1].correlationId).toBe(correlationId);
    });
});