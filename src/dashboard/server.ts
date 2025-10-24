import { DatabaseConnection } from '../database/connection';
import { DashboardAPI } from './api';
import { logger, errorToLogContext } from '../utils/logger';
import { loadConfig } from '../utils/config-loader';

/**
 * Dashboard server integration
 * Starts the Express API server that serves data to the Next.js dashboard
 */
export class DashboardServer {
    private api: DashboardAPI;
    private db: DatabaseConnection;

    constructor() {
        const config = loadConfig();
        this.db = new DatabaseConnection(config.database);
        this.api = new DashboardAPI(this.db);
    }

    /**
     * Initialize database connection and start the API server
     */
    async start(port: number = 3002): Promise<void> {
        try {
            // Initialize database connection
            await this.db.connect();
            logger.info('Database connection established for dashboard API');

            // Start the API server
            this.api.start(port);
            logger.info(`Dashboard API server started on port ${port}`);

        } catch (error) {
            logger.error('Failed to start dashboard server:', errorToLogContext(error));
            throw error;
        }
    }

    /**
     * Gracefully shutdown the server
     */
    async shutdown(): Promise<void> {
        try {
            await this.db.close();
            logger.info('Dashboard server shutdown complete');
        } catch (error) {
            logger.error('Error during dashboard server shutdown:', errorToLogContext(error));
        }
    }

    /**
     * Get the Express app instance for testing
     */
    getApp() {
        return this.api.getApp();
    }
}

// Export singleton instance
export const dashboardServer = new DashboardServer();