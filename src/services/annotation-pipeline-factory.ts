import { AnnotationPipeline, AnnotationPipelineConfig } from './annotation-pipeline';
import { AnnotationServiceInterface } from './annotation-service';
import { DatabaseConnection } from '../database/connection';
import { RepositoryFactory } from '../database/repositories';
import { logger } from '../utils/logger';

/**
 * Factory for creating annotation pipeline instances
 */
export class AnnotationPipelineFactory {
    constructor(private db: DatabaseConnection) { }

    /**
     * Create annotation pipeline with all required dependencies
     */
    createPipeline(
        annotationService: AnnotationServiceInterface,
        config?: Partial<AnnotationPipelineConfig>
    ): AnnotationPipeline {
        const repositoryFactory = new RepositoryFactory(this.db);

        const searchResultRepo = repositoryFactory.createSearchResultRepository();
        const annotationRepo = repositoryFactory.createAnnotationRepository();
        const queryRepo = repositoryFactory.createQueryRepository();

        const pipeline = new AnnotationPipeline(
            annotationService,
            searchResultRepo,
            annotationRepo,
            queryRepo,
            config
        );

        logger.info('Annotation pipeline created', {
            config: pipeline.getStats()
        });

        return pipeline;
    }
}

/**
 * Convenience function to create pipeline
 */
export function createAnnotationPipeline(
    db: DatabaseConnection,
    annotationService: AnnotationServiceInterface,
    config?: Partial<AnnotationPipelineConfig>
): AnnotationPipeline {
    const factory = new AnnotationPipelineFactory(db);
    return factory.createPipeline(annotationService, config);
}