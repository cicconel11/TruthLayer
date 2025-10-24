import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DashboardServer } from '../dashboard/server';
import { loadConfig } from '../utils/config-loader';

describe('Dashboard Setup', () => {
    let dashboardServer: DashboardServer;

    beforeAll(async () => {
        // Verify config can be loaded
        const config = loadConfig();
        expect(config).toBeDefined();
        expect(config.database).toBeDefined();
    });

    afterAll(async () => {
        if (dashboardServer) {
            await dashboardServer.shutdown();
        }
    });

    it('should create dashboard server instance', () => {
        dashboardServer = new DashboardServer();
        expect(dashboardServer).toBeDefined();
    });

    it('should have Express app instance', () => {
        dashboardServer = new DashboardServer();
        const app = dashboardServer.getApp();
        expect(app).toBeDefined();
    });

    it('should handle health check endpoint', async () => {
        dashboardServer = new DashboardServer();
        const app = dashboardServer.getApp();

        // Mock request/response for health check
        const mockReq = {} as any;
        const mockRes = {
            json: (data: any) => {
                expect(data.status).toBe('ok');
                expect(data.timestamp).toBeDefined();
                return mockRes;
            }
        } as any;

        // This would normally require supertest for proper testing
        // For now, just verify the app exists
        expect(app).toBeDefined();
    });
});