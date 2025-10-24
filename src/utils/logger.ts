import * as winston from 'winston';
import { getConfig } from './config-loader';

/**
 * Structured log context interface - flexible to allow any additional properties
 */
export interface LogContext {
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    component?: string;
    operation?: string;
    duration?: number;
    success?: boolean;
    errorCode?: string;
    metadata?: Record<string, any>;
    [key: string]: any; // Allow any additional properties
}

/**
 * Enhanced logger interface with structured logging
 */
export interface StructuredLogger {
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    audit(eventType: string, message: string, context?: LogContext): void;
    performance(operation: string, duration: number, context?: LogContext): void;
    security(event: string, message: string, context?: LogContext): void;
}

/**
 * Create and configure Winston logger instance
 */
export function createLogger() {
    const config = getConfig();

    // Custom format for structured logging
    const structuredFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const logEntry: any = {
                timestamp,
                level,
                message,
                ...meta
            };

            // Extract structured context if present
            if (meta.context) {
                Object.assign(logEntry, meta.context);
                delete logEntry.context;
            }

            return config.monitoring.logFormat === 'json'
                ? JSON.stringify(logEntry)
                : `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
    );

    const format = config.monitoring.logFormat === 'json'
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        )
        : structuredFormat;

    return winston.createLogger({
        level: config.monitoring.logLevel,
        format,
        transports: [
            new winston.transports.Console({
                handleExceptions: true,
                handleRejections: true,
            }),
            new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                handleExceptions: true,
            }),
            new winston.transports.File({
                filename: 'logs/combined.log',
                handleExceptions: true,
            }),
            // Separate audit log file
            new winston.transports.File({
                filename: 'logs/audit.log',
                level: 'info',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            }),
            // Performance log file
            new winston.transports.File({
                filename: 'logs/performance.log',
                level: 'info',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            }),
            // Security log file
            new winston.transports.File({
                filename: 'logs/security.log',
                level: 'warn',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                )
            })
        ],
    });
}

// Lazy logger instance
let loggerInstance: winston.Logger | null = null;

export function getLogger(): winston.Logger {
    if (!loggerInstance) {
        loggerInstance = createLogger();
    }
    return loggerInstance;
}

/**
 * Create structured logger with enhanced capabilities
 */
function createStructuredLogger(): StructuredLogger {
    const winstonLogger = getLogger();

    return {
        debug: (message: string, context?: LogContext) => {
            winstonLogger.debug(message, { context, logType: 'application' });
        },

        info: (message: string, context?: LogContext) => {
            winstonLogger.info(message, { context, logType: 'application' });
        },

        warn: (message: string, context?: LogContext) => {
            winstonLogger.warn(message, { context, logType: 'application' });
        },

        error: (message: string, context?: LogContext) => {
            winstonLogger.error(message, { context, logType: 'application' });
        },

        audit: (eventType: string, message: string, context?: LogContext) => {
            winstonLogger.info(message, {
                ...context,
                logType: 'audit',
                eventType,
                auditTimestamp: new Date().toISOString()
            });
        },

        performance: (operation: string, duration: number, context?: LogContext) => {
            winstonLogger.info(`Performance: ${operation} completed in ${duration}ms`, {
                ...context,
                logType: 'performance',
                operation,
                duration,
                performanceTimestamp: new Date().toISOString()
            });
        },

        security: (event: string, message: string, context?: LogContext) => {
            winstonLogger.warn(message, {
                ...context,
                logType: 'security',
                securityEvent: event,
                securityTimestamp: new Date().toISOString()
            });
        }
    };
}

// Export structured logger instance
export const logger = createStructuredLogger();

// Export legacy logger interface for backward compatibility
export const legacyLogger = {
    debug: (message: string, ...meta: any[]) => getLogger().debug(message, ...meta),
    info: (message: string, ...meta: any[]) => getLogger().info(message, ...meta),
    warn: (message: string, ...meta: any[]) => getLogger().warn(message, ...meta),
    error: (message: string, ...meta: any[]) => getLogger().error(message, ...meta),
};

/**
 * Create operation logger with correlation ID
 */
export function createOperationLogger(correlationId: string, component: string): StructuredLogger {
    const baseLogger = createStructuredLogger();

    return {
        debug: (message: string, context?: LogContext) => {
            baseLogger.debug(message, { ...context, correlationId, component });
        },

        info: (message: string, context?: LogContext) => {
            baseLogger.info(message, { ...context, correlationId, component });
        },

        warn: (message: string, context?: LogContext) => {
            baseLogger.warn(message, { ...context, correlationId, component });
        },

        error: (message: string, context?: LogContext) => {
            baseLogger.error(message, { ...context, correlationId, component });
        },

        audit: (eventType: string, message: string, context?: LogContext) => {
            baseLogger.audit(eventType, message, { ...context, correlationId, component });
        },

        performance: (operation: string, duration: number, context?: LogContext) => {
            baseLogger.performance(operation, duration, { ...context, correlationId, component });
        },

        security: (event: string, message: string, context?: LogContext) => {
            baseLogger.security(event, message, { ...context, correlationId, component });
        }
    };
}

/**
 * Log operation timing decorator
 */
export function logTiming(operation: string, correlationId?: string, component?: string) {
    return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const startTime = Date.now();
            const opLogger = correlationId && component
                ? createOperationLogger(correlationId, component)
                : logger;

            try {
                opLogger.debug(`Starting operation: ${operation}`);
                const result = await method.apply(this, args);
                const duration = Date.now() - startTime;

                opLogger.performance(operation, duration, { success: true });
                return result;
            } catch (error) {
                const duration = Date.now() - startTime;
                opLogger.performance(operation, duration, { success: false });
                opLogger.error(`Operation failed: ${operation}`, {
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                    duration
                });
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Convert error object to LogContext
 */
export function errorToLogContext(error: unknown): LogContext {
    if (error instanceof Error) {
        return {
            errorMessage: error.message,
            errorName: error.name,
            errorStack: error.stack,
            success: false
        };
    }

    if (typeof error === 'string') {
        return {
            errorMessage: error,
            success: false
        };
    }

    if (typeof error === 'object' && error !== null) {
        return {
            errorMessage: JSON.stringify(error),
            success: false
        };
    }

    return {
        errorMessage: 'Unknown error',
        success: false
    };
}

/**
 * Enhanced logger that can handle error objects directly
 */
export const safeLogger = {
    debug: (message: string, context?: LogContext | unknown) => {
        const safeContext = context && typeof context === 'object' && 'errorMessage' in (context as any)
            ? context as LogContext
            : context ? errorToLogContext(context) : undefined;
        logger.debug(message, safeContext);
    },

    info: (message: string, context?: LogContext | unknown) => {
        const safeContext = context && typeof context === 'object' && 'errorMessage' in (context as any)
            ? context as LogContext
            : context ? errorToLogContext(context) : undefined;
        logger.info(message, safeContext);
    },

    warn: (message: string, context?: LogContext | unknown) => {
        const safeContext = context && typeof context === 'object' && 'errorMessage' in (context as any)
            ? context as LogContext
            : context ? errorToLogContext(context) : undefined;
        logger.warn(message, safeContext);
    },

    error: (message: string, context?: LogContext | unknown) => {
        const safeContext = context && typeof context === 'object' && 'errorMessage' in (context as any)
            ? context as LogContext
            : context ? errorToLogContext(context) : undefined;
        logger.error(message, safeContext);
    }
};

/**
 * Create correlation ID for operation tracking
 */
export function generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}