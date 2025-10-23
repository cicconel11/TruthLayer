/**
 * TruthLayer MVP - Main Entry Point
 * Infrastructure system for search and AI transparency
 */

import { getConfig } from './utils/config-loader';

// Import core modules
export * from './types';
export * from './utils';
export * from './collectors';
export * from './services';
export * from './database';
export * from './dashboard';

/**
 * Initialize the TruthLayer system
 */
export async function initializeTruthLayer() {
    try {
        // Load and validate configuration
        const config = getConfig();
        console.log('Configuration loaded successfully');

        // TODO: Initialize database connection
        // TODO: Initialize collectors
        // TODO: Initialize services
        // TODO: Start dashboard server

        console.log('TruthLayer MVP initialized successfully');
        return config;
    } catch (error) {
        console.error('Failed to initialize TruthLayer:', error);
        throw error;
    }
}

// Auto-initialize if this file is run directly
if (require.main === module) {
    initializeTruthLayer()
        .then(() => {
            console.log('TruthLayer MVP is running...');
        })
        .catch((error) => {
            console.error('Startup failed:', error);
            process.exit(1);
        });
}