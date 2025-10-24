#!/usr/bin/env tsx

import { dashboardServer } from '../src/dashboard/server';
import { logger } from '../src/utils/logger';

/**
 * Startup script for the TruthLayer dashboard
 * Starts both the backend API server and provides instructions for the Next.js frontend
 */

async function main() {
    try {
        logger.info('Starting TruthLayer Dashboard...');

        // Start the backend API server
        const apiPort = parseInt(process.env.DASHBOARD_API_PORT || '3002');
        await dashboardServer.start(apiPort);

        logger.info('Dashboard backend API is running');
        logger.info(`API server: http://localhost:${apiPort}`);
        logger.info('');
        logger.info('To start the Next.js dashboard frontend:');
        logger.info('  cd dashboard');
        logger.info('  npm run dev');
        logger.info('');
        logger.info('Dashboard will be available at: http://localhost:3001');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await dashboardServer.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await dashboardServer.shutdown();
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start dashboard:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}