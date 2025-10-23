import { describe, it, expect } from 'vitest';
import { loadConfig } from '../utils/config-loader';

describe('Configuration Loading', () => {
    it('should load configuration without errors', () => {
        expect(() => loadConfig()).not.toThrow();
    });

    it('should have required database configuration', () => {
        const config = loadConfig();
        expect(config.database).toBeDefined();
        expect(config.database.host).toBeDefined();
        expect(config.database.port).toBeTypeOf('number');
        expect(config.database.database).toBeDefined();
        expect(config.database.username).toBeDefined();
        expect(config.database.password).toBeDefined();
    });

    it('should have required annotation configuration', () => {
        const config = loadConfig();
        expect(config.annotation).toBeDefined();
        expect(config.annotation.provider).toBeDefined();
        expect(config.annotation.apiKey).toBeDefined();
        expect(config.annotation.model).toBeDefined();
    });

    it('should have required scraping configuration', () => {
        const config = loadConfig();
        expect(config.scraping).toBeDefined();
        expect(config.scraping.delays).toBeDefined();
        expect(config.scraping.retries).toBeDefined();
        expect(config.scraping.timeout).toBeTypeOf('number');
    });

    it('should have required dashboard configuration', () => {
        const config = loadConfig();
        expect(config.dashboard).toBeDefined();
        expect(config.dashboard.port).toBeTypeOf('number');
        expect(config.dashboard.host).toBeDefined();
    });

    it('should have required monitoring configuration', () => {
        const config = loadConfig();
        expect(config.monitoring).toBeDefined();
        expect(config.monitoring.logLevel).toBeDefined();
        expect(config.monitoring.logFormat).toBeDefined();
    });
});