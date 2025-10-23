# TruthLayer MVP

Infrastructure system for search and AI transparency that creates auditable datasets and bias metrics to reveal how information visibility differs across search engines and AI models over time.

## Project Structure

```
src/
├── collectors/          # Multi-engine search result collection
│   ├── base-scraper.ts     # Abstract base scraper class
│   ├── google-scraper.ts   # Google search scraper
│   ├── bing-scraper.ts     # Bing search scraper
│   ├── perplexity-scraper.ts # Perplexity AI scraper
│   ├── brave-scraper.ts    # Brave search scraper
│   └── collector-service.ts # Collection orchestration
├── services/            # Business logic and orchestration
│   ├── annotation-service.ts # LLM annotation pipeline
│   ├── metrics-service.ts    # Bias metrics computation
│   ├── query-service.ts      # Query management
│   └── scheduler-service.ts  # Automated scheduling
├── database/            # Data access layer
│   ├── connection.ts       # Database connection utilities
│   ├── repositories.ts     # Data repositories
│   ├── migrations.ts       # Database migrations
│   └── models.ts          # Database models
├── dashboard/           # Web interface and API
│   ├── api.ts             # API routes
│   ├── utils.ts           # Dashboard utilities
│   └── types.ts           # Dashboard types
├── types/               # Core type definitions
│   ├── search-result.ts   # Search result interfaces
│   ├── annotation.ts      # Annotation interfaces
│   ├── metrics.ts         # Bias metrics interfaces
│   ├── query.ts           # Query management interfaces
│   └── config.ts          # Configuration interfaces
├── utils/               # Utility functions
│   ├── config-loader.ts   # Environment configuration
│   ├── logger.ts          # Logging utilities
│   ├── validation.ts      # Data validation
│   └── hash-utils.ts      # Content hashing
└── test/                # Test files
    ├── setup.ts           # Test setup
    ├── config.test.ts     # Configuration tests
    └── interfaces.test.ts # Interface validation tests
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration values

### Development

- **Build**: `npm run build`
- **Development**: `npm run dev`
- **Test**: `npm test`
- **Type Check**: `npm run typecheck`
- **Lint**: `npm run lint`

### Configuration

The application uses environment variables for configuration. See `.env.example` for all available options:

- **Database**: PostgreSQL connection settings
- **OpenAI**: API key and model configuration
- **Scraping**: Delays, retries, and proxy settings
- **Dashboard**: Port, CORS, and rate limiting
- **Monitoring**: Logging and alerting configuration

## Core Interfaces

### SearchResult
Normalized search result from any engine:
```typescript
interface SearchResult {
  id: string;
  query: string;
  engine: 'google' | 'bing' | 'perplexity' | 'brave';
  rank: number;
  title: string;
  snippet: string;
  url: string;
  timestamp: Date;
  rawHtml?: string;
  contentHash?: string;
}
```

### AnnotationRequest
Request for LLM annotation:
```typescript
interface AnnotationRequest {
  title: string;
  snippet: string;
  url: string;
  query: string;
}
```

### BiasMetrics
Core bias measurement metrics:
```typescript
interface BiasMetrics {
  domainDiversityIndex: number;
  engineOverlapCoefficient: number;
  factualAlignmentScore: number;
  calculatedAt: Date;
  queryId: string;
}
```

## Next Steps

This is the foundational structure for the TruthLayer MVP. The next tasks involve:

1. Implementing database schema and data models
2. Building multi-engine collector system
3. Creating LLM annotation pipeline
4. Developing bias metrics computation engine
5. Building query management and scheduling
6. Creating transparency dashboard
7. Implementing monitoring and validation
8. Generating transparency reports
9. Deploying production infrastructure

See `.kiro/specs/truthlayer-mvp/tasks.md` for the complete implementation plan.
