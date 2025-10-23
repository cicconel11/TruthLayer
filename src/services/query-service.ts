import { QueryRepository, RepositoryFactory } from '../database/repositories';
import { DatabaseConnection } from '../database/connection';
import { Query as DbQuery } from '../database/models';
import { QueryCategory, QuerySet, ScheduleConfig, Query as TypesQuery } from '../types/query';
import { logger } from '../utils/logger';

/**
 * Benchmark query sets organized by category
 */
export const BENCHMARK_QUERIES = {
    health: [
        'covid vaccine safety',
        'mental health treatment',
        'cancer screening guidelines',
        'diabetes management',
        'heart disease prevention',
        'flu vaccine effectiveness',
        'depression symptoms',
        'anxiety treatment options',
        'blood pressure medication',
        'cholesterol levels normal range',
        'vitamin D deficiency',
        'sleep apnea treatment',
        'migraine headache relief',
        'arthritis pain management',
        'weight loss strategies'
    ],
    politics: [
        'election results 2024',
        'climate change policy',
        'immigration reform',
        'healthcare legislation',
        'tax policy changes',
        'voting rights laws',
        'foreign policy updates',
        'supreme court decisions',
        'congressional bills',
        'presidential executive orders',
        'state government news',
        'political campaign finance',
        'lobbying regulations',
        'government transparency',
        'civil rights legislation'
    ],
    technology: [
        'AI safety research',
        'cryptocurrency regulation',
        'data privacy laws',
        'cybersecurity threats',
        'quantum computing advances',
        'electric vehicle adoption',
        'renewable energy technology',
        'social media regulation',
        'autonomous vehicle safety',
        'blockchain applications',
        'machine learning ethics',
        'internet privacy rights',
        'tech company antitrust',
        'digital currency policy',
        'artificial intelligence governance'
    ],
    science: [
        'renewable energy efficiency',
        'space exploration news',
        'genetic engineering ethics',
        'climate change research',
        'ocean pollution studies',
        'biodiversity conservation',
        'stem cell research',
        'nuclear energy safety',
        'asteroid impact risk',
        'vaccine development',
        'antibiotic resistance',
        'gene therapy advances',
        'environmental protection',
        'wildlife conservation',
        'sustainable agriculture'
    ]
};

/**
 * Seasonal and event-driven query configurations
 */
export const SEASONAL_QUERIES = {
    seasonal: {
        winter: ['flu season preparation', 'winter weather safety', 'seasonal depression'],
        spring: ['allergy season treatment', 'spring cleaning tips', 'tax filing deadline'],
        summer: ['heat wave safety', 'summer travel health', 'sun protection'],
        fall: ['back to school health', 'flu vaccination', 'seasonal allergies']
    },
    eventDriven: {
        election: ['voter registration', 'candidate positions', 'polling locations'],
        pandemic: ['public health measures', 'vaccine distribution', 'safety protocols'],
        naturalDisaster: ['emergency preparedness', 'disaster relief', 'safety guidelines'],
        economicCrisis: ['financial assistance', 'unemployment benefits', 'economic recovery']
    }
};

/**
 * Query service for managing benchmark queries and scheduling
 */
export class QueryService {
    private queryRepository: QueryRepository;

    constructor(private db: DatabaseConnection) {
        const repositoryFactory = new RepositoryFactory(db);
        this.queryRepository = repositoryFactory.createQueryRepository();
    }

    /**
     * Initialize benchmark query sets in the database
     */
    async initializeBenchmarkQueries(): Promise<void> {
        logger.info('Initializing benchmark query sets');

        try {
            for (const [category, queries] of Object.entries(BENCHMARK_QUERIES)) {
                // Get all existing queries for this category once
                const existingQueries = await this.queryRepository.findMany({
                    category: category as QueryCategory
                });

                const existingTexts = new Set(existingQueries.map(q => q.text));

                // Create only non-existing queries
                for (const queryText of queries) {
                    if (!existingTexts.has(queryText)) {
                        await this.queryRepository.create({
                            text: queryText,
                            category: category as QueryCategory
                        });
                        logger.debug('Created benchmark query', { category, text: queryText });
                    }
                }
            }

            logger.info('Benchmark query initialization completed');
        } catch (error) {
            logger.error('Failed to initialize benchmark queries', { error });
            throw error;
        }
    }

    /**
     * Get queries for a specific category
     */
    async getQueriesByCategory(category: QueryCategory, limit = 50): Promise<DbQuery[]> {
        return this.queryRepository.findMany({ category }, limit);
    }

    /**
     * Get daily query set (core queries executed daily)
     */
    async getDailyQuerySet(): Promise<DbQuery[]> {
        const queries: DbQuery[] = [];

        // Get 12-13 queries from each category for daily execution (50 total)
        for (const category of ['health', 'politics', 'technology', 'science'] as QueryCategory[]) {
            const categoryQueries = await this.getQueriesByCategory(category, 13);
            queries.push(...categoryQueries);
        }

        // Shuffle to avoid predictable patterns
        return this.shuffleArray(queries).slice(0, 50);
    }

    /**
     * Get weekly query set (extended queries executed weekly)
     */
    async getWeeklyQuerySet(): Promise<DbQuery[]> {
        const queries: DbQuery[] = [];

        // Get all queries from each category for weekly execution
        for (const category of ['health', 'politics', 'technology', 'science'] as QueryCategory[]) {
            const categoryQueries = await this.getQueriesByCategory(category, 100);
            queries.push(...categoryQueries);
        }

        return this.shuffleArray(queries).slice(0, 200);
    }

    /**
     * Get seasonal queries based on current date
     */
    async getSeasonalQueries(): Promise<string[]> {
        const currentMonth = new Date().getMonth();
        let season: keyof typeof SEASONAL_QUERIES.seasonal;

        // Determine current season (Northern Hemisphere)
        if (currentMonth >= 2 && currentMonth <= 4) {
            season = 'spring';
        } else if (currentMonth >= 5 && currentMonth <= 7) {
            season = 'summer';
        } else if (currentMonth >= 8 && currentMonth <= 10) {
            season = 'fall';
        } else {
            season = 'winter';
        }

        return SEASONAL_QUERIES.seasonal[season];
    }

    /**
     * Add event-driven queries for specific events
     */
    async addEventDrivenQueries(eventType: keyof typeof SEASONAL_QUERIES.eventDriven): Promise<DbQuery[]> {
        const eventQueries = SEASONAL_QUERIES.eventDriven[eventType];
        const createdQueries: DbQuery[] = [];

        for (const queryText of eventQueries) {
            try {
                const query = await this.queryRepository.create({
                    text: queryText,
                    category: 'general' // Event-driven queries use general category
                });
                createdQueries.push(query);
                logger.info('Added event-driven query', { eventType, text: queryText });
            } catch (error) {
                logger.warn('Failed to add event-driven query', { eventType, text: queryText, error });
            }
        }

        return createdQueries;
    }

    /**
     * Create a query set with scheduling configuration
     */
    async createQuerySet(
        name: string,
        description: string,
        queryIds: string[],
        schedule: ScheduleConfig
    ): Promise<QuerySet> {
        // Validate that all query IDs exist
        const queries: TypesQuery[] = [];
        for (const queryId of queryIds) {
            const dbQuery = await this.queryRepository.findById(queryId);
            if (!dbQuery) {
                throw new Error(`Query not found: ${queryId}`);
            }
            // Convert database query to types query
            const query: TypesQuery = {
                id: dbQuery.id,
                text: dbQuery.text,
                category: (dbQuery.category || 'general') as QueryCategory,
                createdAt: dbQuery.created_at,
                isActive: true, // Default to active
                metadata: undefined
            };
            queries.push(query);
        }

        const querySet: QuerySet = {
            id: crypto.randomUUID(),
            name,
            description,
            queries,
            schedule,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        logger.info('Created query set', {
            id: querySet.id,
            name,
            queryCount: queries.length,
            schedule: schedule.frequency
        });

        return querySet;
    }

    /**
     * Get next scheduled execution time for a query set
     */
    getNextExecutionTime(schedule: ScheduleConfig): Date {
        const now = new Date();
        const next = new Date(now);

        if (!schedule.enabled) {
            throw new Error('Schedule is disabled');
        }

        switch (schedule.frequency) {
            case 'daily':
                if (schedule.time) {
                    const [hours, minutes] = schedule.time.split(':').map(Number);
                    next.setHours(hours, minutes, 0, 0);

                    // If time has passed today, schedule for tomorrow
                    if (next <= now) {
                        next.setDate(next.getDate() + 1);
                    }
                } else {
                    // Default to next hour if no time specified
                    next.setHours(next.getHours() + 1, 0, 0, 0);
                }
                break;

            case 'weekly':
                const targetDay = schedule.dayOfWeek ?? 0; // Default to Sunday
                const currentDay = next.getDay();
                const daysUntilTarget = (targetDay - currentDay + 7) % 7;

                next.setDate(next.getDate() + (daysUntilTarget || 7));

                if (schedule.time) {
                    const [hours, minutes] = schedule.time.split(':').map(Number);
                    next.setHours(hours, minutes, 0, 0);
                } else {
                    next.setHours(9, 0, 0, 0); // Default to 9 AM
                }
                break;

            case 'monthly':
                const targetDate = schedule.dayOfMonth ?? 1;
                next.setDate(targetDate);

                // If date has passed this month, move to next month
                if (next <= now) {
                    next.setMonth(next.getMonth() + 1);
                    next.setDate(targetDate);
                }

                if (schedule.time) {
                    const [hours, minutes] = schedule.time.split(':').map(Number);
                    next.setHours(hours, minutes, 0, 0);
                } else {
                    next.setHours(9, 0, 0, 0); // Default to 9 AM
                }
                break;

            default:
                throw new Error(`Unsupported frequency: ${schedule.frequency}`);
        }

        return next;
    }

    /**
     * Create default query sets for the system
     */
    async createDefaultQuerySets(): Promise<QuerySet[]> {
        const querySets: QuerySet[] = [];

        // Daily core query set
        const dailyQueries = await this.getDailyQuerySet();
        const dailySet = await this.createQuerySet(
            'Daily Core Queries',
            'Core benchmark queries executed daily across all categories',
            dailyQueries.map(q => q.id),
            {
                frequency: 'daily',
                time: '09:00',
                enabled: true
            }
        );
        querySets.push(dailySet);

        // Weekly extended query set
        const weeklyQueries = await this.getWeeklyQuerySet();
        const weeklySet = await this.createQuerySet(
            'Weekly Extended Queries',
            'Extended benchmark queries executed weekly for comprehensive analysis',
            weeklyQueries.map(q => q.id),
            {
                frequency: 'weekly',
                dayOfWeek: 1, // Monday
                time: '10:00',
                enabled: true
            }
        );
        querySets.push(weeklySet);

        logger.info('Created default query sets', { count: querySets.length });
        return querySets;
    }

    /**
     * Rotate queries to avoid predictable patterns
     */
    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Validate query set configuration
     */
    validateQuerySet(querySet: QuerySet): boolean {
        if (!querySet.name || querySet.name.trim().length === 0) {
            throw new Error('Query set name is required');
        }

        if (!querySet.queries || querySet.queries.length === 0) {
            throw new Error('Query set must contain at least one query');
        }

        if (!querySet.schedule.frequency) {
            throw new Error('Schedule frequency is required');
        }

        if (querySet.schedule.frequency === 'weekly' && querySet.schedule.dayOfWeek === undefined) {
            throw new Error('Day of week is required for weekly schedules');
        }

        if (querySet.schedule.frequency === 'monthly' && querySet.schedule.dayOfMonth === undefined) {
            throw new Error('Day of month is required for monthly schedules');
        }

        return true;
    }

    /**
     * Get query statistics by category
     */
    async getQueryStatistics(): Promise<Record<QueryCategory, number>> {
        const stats: Record<QueryCategory, number> = {
            health: 0,
            politics: 0,
            technology: 0,
            science: 0,
            general: 0
        };

        for (const category of Object.keys(stats) as QueryCategory[]) {
            stats[category] = await this.queryRepository.count({ category });
        }

        return stats;
    }
}

/**
 * Query service interface for dependency injection
 */
export interface QueryServiceInterface {
    initializeBenchmarkQueries(): Promise<void>;
    getQueriesByCategory(category: QueryCategory, limit?: number): Promise<DbQuery[]>;
    getDailyQuerySet(): Promise<DbQuery[]>;
    getWeeklyQuerySet(): Promise<DbQuery[]>;
    getSeasonalQueries(): Promise<string[]>;
    addEventDrivenQueries(eventType: string): Promise<DbQuery[]>;
    createQuerySet(name: string, description: string, queryIds: string[], schedule: ScheduleConfig): Promise<QuerySet>;
    getNextExecutionTime(schedule: ScheduleConfig): Date;
    createDefaultQuerySets(): Promise<QuerySet[]>;
    validateQuerySet(querySet: QuerySet): boolean;
    getQueryStatistics(): Promise<Record<QueryCategory, number>>;
}