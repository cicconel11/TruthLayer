import express from 'express';
import cors from 'cors';
import { DatabaseConnection } from '../database/connection';
import { RepositoryFactory } from '../database/repositories';
import { logger, errorToLogContext } from '../utils/logger';

/**
 * Dashboard API server for serving metrics data to the Next.js frontend
 */
export class DashboardAPI {
    private app: express.Application;
    private repositories: RepositoryFactory;

    constructor(db: DatabaseConnection) {
        this.app = express();
        this.repositories = new RepositoryFactory(db);
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(cors({
            origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
            credentials: true,
        }));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    private setupRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Metrics endpoints
        this.app.get('/api/metrics/overview', this.getMetricsOverview.bind(this));
        this.app.get('/api/metrics/trends', this.getMetricsTrends.bind(this));
        this.app.get('/api/metrics/engines', this.getEngineComparison.bind(this));

        // Data export endpoints
        this.app.post('/api/export', this.exportData.bind(this));

        // Query and result endpoints
        this.app.get('/api/queries', this.getQueries.bind(this));
        this.app.get('/api/results', this.getSearchResults.bind(this));
    }

    private async getMetricsOverview(_req: express.Request, res: express.Response): Promise<void> {
        try {
            // TODO: Use start and end for date filtering
            // const { start, end } = req.query;
            // TODO: Use start and end for date filtering
            // const dateRange = {
            //     start: start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            //     end: end ? new Date(end as string) : new Date(),
            // };

            // This would typically call the metrics service
            // For now, return a placeholder response
            const overview = {
                totalQueries: 0,
                totalResults: 0,
                totalAnnotations: 0,
                averageDomainDiversity: 0,
                averageEngineOverlap: 0,
                averageFactualAlignment: 0,
                lastUpdated: new Date(),
            };

            res.json({ success: true, data: overview });
        } catch (error) {
            logger.error('Error fetching metrics overview:', errorToLogContext(error));
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    private async getMetricsTrends(_req: express.Request, res: express.Response): Promise<void> {
        try {
            // TODO: Use days and engines for filtering
            // const { days = '30', engines } = req.query;
            // TODO: Use days and engines for filtering
            // const daysCount = parseInt(days as string);
            // const engineList = engines ? (engines as string).split(',') : ['google', 'bing', 'perplexity', 'brave'];

            // Placeholder response
            const trends: any[] = [];
            res.json({ success: true, data: trends });
        } catch (error) {
            logger.error('Error fetching metrics trends:', errorToLogContext(error));
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    private async getEngineComparison(_req: express.Request, res: express.Response): Promise<void> {
        try {
            // TODO: Use start, end, and category for filtering
            // const { start, end, category } = req.query;
            // TODO: Use start, end, and category for filtering
            // const startDate = start;
            // const endDate = end;
            // const categoryFilter = category;

            // Placeholder response
            const comparisons: any[] = [];
            res.json({ success: true, data: comparisons });
        } catch (error) {
            logger.error('Error fetching engine comparison:', errorToLogContext(error));
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    private async exportData(_req: express.Request, res: express.Response): Promise<void> {
        try {
            // TODO: Use req.body for export implementation
            // const exportRequest = req.body;

            // Placeholder response
            res.json({ success: true, message: 'Export functionality not yet implemented' });
        } catch (error) {
            logger.error('Error exporting data:', errorToLogContext(error));
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    private async getQueries(req: express.Request, res: express.Response): Promise<void> {
        try {
            const queryRepo = this.repositories.createQueryRepository();
            const { page = 1, limit = 50, category } = req.query;

            const filter: any = {};
            if (category) filter.category = category as string;

            const queries = await queryRepo.findMany(
                filter,
                parseInt(limit as string),
                (parseInt(page as string) - 1) * parseInt(limit as string)
            );

            const total = await queryRepo.count(filter);

            res.json({
                success: true,
                data: queries,
                pagination: {
                    page: parseInt(page as string),
                    limit: parseInt(limit as string),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit as string)),
                },
            });
        } catch (error) {
            logger.error('Error fetching queries:', errorToLogContext(error));
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    private async getSearchResults(req: express.Request, res: express.Response): Promise<void> {
        try {
            const resultRepo = this.repositories.createSearchResultRepository();
            const { page = 1, limit = 50, engine, query_id } = req.query;

            const filter: any = {};
            if (engine) filter.engine = engine as string;
            if (query_id) filter.query_id = query_id as string;

            const results = await resultRepo.findMany(
                filter,
                parseInt(limit as string),
                (parseInt(page as string) - 1) * parseInt(limit as string)
            );

            const total = await resultRepo.count(filter);

            res.json({
                success: true,
                data: results,
                pagination: {
                    page: parseInt(page as string),
                    limit: parseInt(limit as string),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit as string)),
                },
            });
        } catch (error) {
            logger.error('Error fetching search results:', errorToLogContext(error));
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }

    public start(port: number = 3002): void {
        this.app.listen(port, () => {
            logger.info(`Dashboard API server started on port ${port}`);
        });
    }

    public getApp(): express.Application {
        return this.app;
    }
}