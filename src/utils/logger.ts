import winston from 'winston';
import { getConfig } from './config-loader';

/**
 * Create and configure Winston logger instance
 */
export function createLogger() {
    const config = getConfig();

    const format = config.monitoring.logFormat === 'json'
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        )
        : winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.simple()
        );

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

// Export singleton logger instance (lazy initialization)
export const logger = {
    debug: (message: string, ...meta: any[]) => getLogger().debug(message, ...meta),
    info: (message: string, ...meta: any[]) => getLogger().info(message, ...meta),
    warn: (message: string, ...meta: any[]) => getLogger().warn(message, ...meta),
    error: (message: string, ...meta: any[]) => getLogger().error(message, ...meta),
};