// Simple logger for dashboard
interface Logger {
    info: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
}

export const logger: Logger = {
    info: (message: string, ...args: any[]) => {
        if (typeof console !== 'undefined') {
            console.log(`[INFO] ${message}`, ...args);
        }
    },
    error: (message: string, ...args: any[]) => {
        if (typeof console !== 'undefined') {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
    warn: (message: string, ...args: any[]) => {
        if (typeof console !== 'undefined') {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    debug: (message: string, ...args: any[]) => {
        if (typeof console !== 'undefined') {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },
};