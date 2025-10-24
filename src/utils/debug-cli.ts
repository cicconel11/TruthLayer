#!/usr/bin/env node

import { Command } from 'commander';
import { DatabaseConnection } from '../database/connection';
import { AuditService } from '../services/audit-service';
import { DebugService } from '../services/debug-service';
import { MonitoringService } from '../services/monitoring-service';
import { LoggingIntegrationService } from '../services/logging-integration-service';
import { logger } from '../utils/logger';
import { getConfig } from '../utils/config-loader';

/**
 * Debug CLI utility for troubleshooting TruthLayer system issues
 */
class DebugCLI {
    private db: DatabaseConnection;
    private auditService: AuditService;
    private debugService: DebugService;
    private monitoringService: MonitoringService;
    private loggingService: LoggingIntegrationService;

    constructor() {
        const config = getConfig();
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
    }

    /**
     * Initialize CLI commands
     */
    initializeCommands(): Command {
        const program = new Command();

        program
            .name('debug-cli')
            .description('TruthLayer Debug and Troubleshooting CLI')
            .version('1.0.0');

        // Audit commands
        program
            .command('audit')
            .description('Audit event management')
            .addCommand(this.createAuditCommands());

        // Debug commands
        program
            .command('debug')
            .description('Debug session management')
            .addCommand(this.createDebugCommands());

        // Monitoring commands
        program
            .command('monitor')
            .description('System monitoring and health checks')
            .addCommand(this.createMonitoringCommands());

        // Analysis commands
        program
            .command('analyze')
            .description('System analysis and troubleshooting')
            .addCommand(this.createAnalysisCommands());

        // Cleanup commands
        program
            .command('cleanup')
            .description('Clean up old logs and debug data')
            .addCommand(this.createCleanupCommands());

        return program;
    }

    /**
     * Create audit-related commands
     */
    private createAuditCommands(): Command {
        const auditCmd = new Command('audit');

        auditCmd
            .command('list')
            .description('List recent audit events')
            .option('-t, --type <type>', 'Filter by event type')
            .option('-c, --component <component>', 'Filter by component')
            .option('-s, --severity <severity>', 'Filter by severity')
            .option('-h, --hours <hours>', 'Hours to look back', '24')
            .option('-l, --limit <limit>', 'Maximum number of events', '50')
            .action(async (options) => {
                try {
                    const startDate = new Date(Date.now() - parseInt(options.hours) * 60 * 60 * 1000);
                    const result = await this.auditService.queryEvents({
                        eventTypes: options.type ? [options.type] : undefined,
                        components: options.component ? [options.component] : undefined,
                        severity: options.severity ? [options.severity] : undefined,
                        startDate,
                        limit: parseInt(options.limit)
                    });

                    console.log(`\nFound ${result.totalCount} audit events (showing ${result.events.length}):\n`);

                    result.events.forEach(event => {
                        console.log(`[${event.timestamp.toISOString()}] ${event.severity.toUpperCase()} - ${event.component}`);
                        console.log(`  Event: ${event.eventType}`);
                        console.log(`  Action: ${event.action}`);
                        console.log(`  Description: ${event.description}`);
                        console.log(`  Success: ${event.success}`);
                        if (event.correlationId) {
                            console.log(`  Correlation ID: ${event.correlationId}`);
                        }
                        if (event.errorMessage) {
                            console.log(`  Error: ${event.errorMessage}`);
                        }
                        console.log('');
                    });
                } catch (error) {
                    console.error('Failed to list audit events:', error);
                    process.exit(1);
                }
            });

        auditCmd
            .command('stats')
            .description('Show audit statistics')
            .option('-h, --hours <hours>', 'Hours to analyze', '24')
            .action(async (options) => {
                try {
                    const stats = await this.auditService.getAuditStatistics(parseInt(options.hours));

                    console.log(`\nAudit Statistics (last ${options.hours} hours):\n`);
                    console.log(`Total Events: ${stats.totalEvents}`);
                    console.log(`Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
                    console.log(`Average Duration: ${stats.averageDuration.toFixed(0)}ms`);

                    console.log('\nEvents by Type:');
                    Object.entries(stats.eventsByType).forEach(([type, count]) => {
                        console.log(`  ${type}: ${count}`);
                    });

                    console.log('\nEvents by Severity:');
                    Object.entries(stats.eventsBySeverity).forEach(([severity, count]) => {
                        console.log(`  ${severity}: ${count}`);
                    });

                    console.log('\nEvents by Component:');
                    Object.entries(stats.eventsByComponent).forEach(([component, count]) => {
                        console.log(`  ${component}: ${count}`);
                    });

                    if (stats.recentErrors.length > 0) {
                        console.log('\nRecent Errors:');
                        stats.recentErrors.forEach(error => {
                            console.log(`  [${error.timestamp.toISOString()}] ${error.component}: ${error.description}`);
                        });
                    }
                } catch (error) {
                    console.error('Failed to get audit statistics:', error);
                    process.exit(1);
                }
            });

        return auditCmd;
    }

    /**
     * Create debug-related commands
     */
    private createDebugCommands(): Command {
        const debugCmd = new Command('debug');

        debugCmd
            .command('start')
            .description('Start a debug session')
            .requiredOption('-n, --name <name>', 'Debug session name')
            .requiredOption('-c, --component <component>', 'Component to debug')
            .option('-l, --level <level>', 'Debug level', 'debug')
            .option('--verbose', 'Enable verbose logging')
            .option('--capture-html', 'Capture HTML for scraping debug')
            .option('--log-prompts', 'Log LLM prompts and responses')
            .action(async (options) => {
                try {
                    const config = {
                        verboseLogging: options.verbose || false,
                        captureHtml: options.captureHtml || false,
                        logPrompts: options.logPrompts || false,
                        logResponses: options.logPrompts || false,
                        captureTiming: true,
                        validateCalculations: false,
                        logIntermediateSteps: true,
                        proxyDebug: false,
                        networkTracing: false,
                        captureScreenshots: false
                    };

                    const sessionId = await this.debugService.startDebugSession(
                        options.name,
                        options.component,
                        options.level,
                        config,
                        'cli-user'
                    );

                    console.log(`Debug session started: ${sessionId}`);
                    console.log(`Session name: ${options.name}`);
                    console.log(`Component: ${options.component}`);
                    console.log(`Debug level: ${options.level}`);
                    console.log('\nUse "debug-cli debug logs" to view session logs');
                } catch (error) {
                    console.error('Failed to start debug session:', error);
                    process.exit(1);
                }
            });

        debugCmd
            .command('logs')
            .description('View debug session logs')
            .requiredOption('-s, --session <sessionId>', 'Debug session ID')
            .option('-l, --level <level>', 'Filter by log level')
            .option('--limit <limit>', 'Maximum number of logs', '100')
            .action(async (options) => {
                try {
                    const logs = await this.debugService.getSessionLogs(
                        options.session,
                        options.level,
                        parseInt(options.limit)
                    );

                    console.log(`\nDebug logs for session ${options.session}:\n`);

                    logs.forEach(log => {
                        console.log(`[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} - ${log.component}`);
                        console.log(`  ${log.message}`);
                        if (Object.keys(log.context).length > 0) {
                            console.log(`  Context: ${JSON.stringify(log.context, null, 2)}`);
                        }
                        console.log('');
                    });
                } catch (error) {
                    console.error('Failed to get debug logs:', error);
                    process.exit(1);
                }
            });

        debugCmd
            .command('snapshots')
            .description('View system state snapshots')
            .option('-c, --component <component>', 'Filter by component')
            .option('-h, --hours <hours>', 'Hours to look back', '24')
            .action(async (options) => {
                try {
                    const snapshots = await this.debugService.getSystemSnapshots(
                        options.component,
                        parseInt(options.hours)
                    );

                    console.log(`\nSystem state snapshots (last ${options.hours} hours):\n`);

                    snapshots.forEach(snapshot => {
                        console.log(`[${snapshot.timestamp.toISOString()}] ${snapshot.component} - ${snapshot.snapshotName}`);
                        console.log(`  Created by: ${snapshot.createdBy}`);
                        if (snapshot.correlationId) {
                            console.log(`  Correlation ID: ${snapshot.correlationId}`);
                        }
                        console.log(`  State data: ${JSON.stringify(snapshot.stateData, null, 2)}`);
                        console.log('');
                    });
                } catch (error) {
                    console.error('Failed to get system snapshots:', error);
                    process.exit(1);
                }
            });

        return debugCmd;
    }

    /**
     * Create monitoring-related commands
     */
    private createMonitoringCommands(): Command {
        const monitorCmd = new Command('monitor');

        monitorCmd
            .command('health')
            .description('Check system health')
            .action(async () => {
                try {
                    const health = this.monitoringService.getSystemHealth();

                    console.log(`\nSystem Health Status: ${health.status.toUpperCase()}\n`);
                    console.log(`Summary: ${health.summary}\n`);

                    console.log('Component Health:');
                    health.components.forEach(component => {
                        const statusIcon = component.status === 'healthy' ? '✓' :
                            component.status === 'degraded' ? '⚠' : '✗';
                        console.log(`  ${statusIcon} ${component.component}: ${component.status}`);
                        if (component.message) {
                            console.log(`    ${component.message}`);
                        }
                        if (component.responseTime) {
                            console.log(`    Response time: ${component.responseTime}ms`);
                        }
                    });
                } catch (error) {
                    console.error('Failed to check system health:', error);
                    process.exit(1);
                }
            });

        monitorCmd
            .command('alerts')
            .description('List system alerts')
            .option('-s, --severity <severity>', 'Filter by severity')
            .option('--unacknowledged', 'Show only unacknowledged alerts')
            .action(async (options) => {
                try {
                    const alerts = this.monitoringService.getAlerts(
                        options.severity,
                        options.unacknowledged ? false : undefined
                    );

                    console.log(`\nSystem Alerts (${alerts.length} found):\n`);

                    alerts.forEach(alert => {
                        const severityIcon = alert.severity === 'critical' ? '🔴' :
                            alert.severity === 'error' ? '🟠' :
                                alert.severity === 'warning' ? '🟡' : '🔵';
                        const ackStatus = alert.acknowledged ? '✓ Acknowledged' : '⚠ Unacknowledged';

                        console.log(`${severityIcon} [${alert.timestamp.toISOString()}] ${alert.severity.toUpperCase()}`);
                        console.log(`  Title: ${alert.title}`);
                        console.log(`  Message: ${alert.message}`);
                        console.log(`  Source: ${alert.source}`);
                        console.log(`  Status: ${ackStatus}`);
                        if (alert.acknowledgedBy) {
                            console.log(`  Acknowledged by: ${alert.acknowledgedBy} at ${alert.acknowledgedAt?.toISOString()}`);
                        }
                        console.log('');
                    });
                } catch (error) {
                    console.error('Failed to list alerts:', error);
                    process.exit(1);
                }
            });

        return monitorCmd;
    }

    /**
     * Create analysis-related commands
     */
    private createAnalysisCommands(): Command {
        const analyzeCmd = new Command('analyze');

        analyzeCmd
            .command('failures')
            .description('Analyze collection failures')
            .option('-h, --hours <hours>', 'Hours to analyze', '24')
            .action(async (options) => {
                try {
                    const analyses = await this.debugService.analyzeCollectionFailures(parseInt(options.hours));

                    console.log(`\nCollection Failure Analysis (last ${options.hours} hours):\n`);
                    console.log(`Total failures analyzed: ${analyses.length}\n`);

                    analyses.forEach((analysis, index) => {
                        console.log(`${index + 1}. Failure ID: ${analysis.failureId}`);
                        console.log(`   Engine: ${analysis.engine}`);
                        console.log(`   Query: ${analysis.queryText}`);
                        console.log(`   Time: ${analysis.timestamp.toISOString()}`);
                        console.log(`   Error Type: ${analysis.errorType}`);
                        console.log(`   Error Message: ${analysis.errorMessage}`);

                        console.log('   Possible Causes:');
                        analysis.possibleCauses.forEach(cause => {
                            console.log(`     - ${cause}`);
                        });

                        console.log('   Recommended Actions:');
                        analysis.recommendedActions.forEach(action => {
                            console.log(`     - ${action}`);
                        });

                        if (analysis.relatedFailures.length > 0) {
                            console.log(`   Related Failures: ${analysis.relatedFailures.length}`);
                        }
                        console.log('');
                    });
                } catch (error) {
                    console.error('Failed to analyze failures:', error);
                    process.exit(1);
                }
            });

        analyzeCmd
            .command('operation')
            .description('Analyze a specific operation by correlation ID')
            .requiredOption('-c, --correlation <correlationId>', 'Correlation ID to analyze')
            .action(async (options) => {
                try {
                    const report = await this.debugService.generateTroubleshootingReport(options.correlation);

                    console.log(`\nOperation Analysis Report\n`);
                    console.log(`Correlation ID: ${report.correlationId}`);
                    console.log(`Time Range: ${report.timeRange.start.toISOString()} - ${report.timeRange.end.toISOString()}`);
                    console.log(`Summary: ${report.summary}\n`);

                    console.log('Audit Events:');
                    report.auditEvents.forEach(event => {
                        console.log(`  [${event.timestamp.toISOString()}] ${event.component}: ${event.description}`);
                        console.log(`    Success: ${event.success}, Duration: ${event.duration || 'N/A'}ms`);
                    });

                    console.log('\nOperation Traces:');
                    report.operationTraces.forEach(trace => {
                        console.log(`  ${trace.step_order}. ${trace.step_name} (${trace.status})`);
                        if (trace.duration) {
                            console.log(`     Duration: ${trace.duration}ms`);
                        }
                        if (trace.error_details && Object.keys(trace.error_details).length > 0) {
                            console.log(`     Error: ${JSON.stringify(trace.error_details)}`);
                        }
                    });

                    if (report.debugLogs.length > 0) {
                        console.log('\nDebug Logs:');
                        report.debugLogs.forEach(log => {
                            console.log(`  [${log.timestamp.toISOString()}] ${log.level}: ${log.message}`);
                        });
                    }

                    if (report.systemSnapshots.length > 0) {
                        console.log('\nSystem Snapshots:');
                        report.systemSnapshots.forEach(snapshot => {
                            console.log(`  [${snapshot.timestamp.toISOString()}] ${snapshot.snapshotName}`);
                        });
                    }
                } catch (error) {
                    console.error('Failed to analyze operation:', error);
                    process.exit(1);
                }
            });

        return analyzeCmd;
    }

    /**
     * Create cleanup-related commands
     */
    private createCleanupCommands(): Command {
        const cleanupCmd = new Command('cleanup');

        cleanupCmd
            .command('logs')
            .description('Clean up old logs and debug data')
            .option('-d, --days <days>', 'Retention period in days', '30')
            .option('--dry-run', 'Show what would be deleted without actually deleting')
            .action(async (options) => {
                try {
                    const retentionDays = parseInt(options.days);

                    if (options.dryRun) {
                        console.log(`\nDry run: Would clean up logs older than ${retentionDays} days\n`);
                        // TODO: Implement dry run logic
                        console.log('Dry run mode not yet implemented');
                        return;
                    }

                    console.log(`\nCleaning up logs older than ${retentionDays} days...\n`);

                    await this.loggingService.cleanupOldLogs(retentionDays);

                    console.log('Cleanup completed successfully');
                } catch (error) {
                    console.error('Failed to cleanup logs:', error);
                    process.exit(1);
                }
            });

        return cleanupCmd;
    }

    /**
     * Run the CLI
     */
    async run(): Promise<void> {
        try {
            // Initialize database connection
            await this.db.connect();

            // Initialize and run CLI
            const program = this.initializeCommands();
            await program.parseAsync(process.argv);

        } catch (error) {
            logger.error('CLI execution failed', { error });
            console.error('CLI execution failed:', error);
            process.exit(1);
        } finally {
            // Clean up database connection
            // await this.db.disconnect(); // DatabaseConnection doesn't have disconnect method
        }
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const cli = new DebugCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { DebugCLI };