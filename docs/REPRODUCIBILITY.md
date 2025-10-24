# Reproducibility Guidelines

## Overview

This document provides comprehensive guidelines for reproducing TruthLayer's search engine bias analysis. Following these procedures ensures that independent researchers can replicate our findings, validate our methodology, and build upon our work with confidence.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Data Collection Reproduction](#data-collection-reproduction)
3. [Analysis Pipeline](#analysis-pipeline)
4. [Validation Procedures](#validation-procedures)
5. [Version Control and Documentation](#version-control-and-documentation)
6. [Quality Assurance Checklist](#quality-assurance-checklist)

## Environment Setup

### System Requirements

#### Minimum Hardware Specifications
- **CPU**: 4 cores, 2.5GHz or higher
- **RAM**: 16GB minimum, 32GB recommended
- **Storage**: 100GB available space for data and logs
- **Network**: Stable broadband connection (10+ Mbps)

#### Software Dependencies

```bash
# Core runtime
Node.js >= 18.0.0
npm >= 9.0.0
PostgreSQL >= 13.0

# System dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
  postgresql-client \
  chromium-browser \
  git \
  curl \
  build-essential

# macOS dependencies
brew install postgresql chromium git node
```

### Installation Process

#### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/truthlayer/truthlayer-mvp.git
cd truthlayer-mvp

# Verify git commit hash for reproducibility
git log --oneline -1
# Expected: [commit-hash] [commit-message]

# Install dependencies with exact versions
npm ci  # Uses package-lock.json for exact versions
```

#### 2. Database Configuration

```bash
# Create PostgreSQL database
createdb truthlayer_reproduction

# Set database URL
export DATABASE_URL="postgresql://username:password@localhost:5432/truthlayer_reproduction"

# Run migrations
npm run db:migrate

# Verify schema
npm run db:verify-schema
```

#### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env.reproduction

# Configure required variables
cat > .env.reproduction << EOF
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/truthlayer_reproduction

# LLM APIs (required for annotation reproduction)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Scraping configuration
PROXY_LIST=proxy1:port:user:pass,proxy2:port:user:pass
CAPTCHA_API_KEY=your-2captcha-key

# Collection settings
COLLECTION_DELAY_MIN=2000
COLLECTION_DELAY_MAX=8000
RESULTS_PER_QUERY=20
MAX_CONCURRENT_SCRAPERS=2

# Reproducibility settings
RANDOM_SEED=42
DETERMINISTIC_MODE=true
LOG_LEVEL=debug
EOF
```

#### 4. Verification Tests

```bash
# Run environment verification
npm run verify:environment

# Expected output:
# ✓ Node.js version: 18.x.x
# ✓ Database connection: OK
# ✓ OpenAI API: OK
# ✓ Chromium browser: OK
# ✓ All dependencies: OK
```

### Docker Setup (Alternative)

```dockerfile
# Dockerfile.reproduction
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Set reproducibility environment
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV RANDOM_SEED=42
ENV DETERMINISTIC_MODE=true

CMD ["npm", "run", "reproduce"]
```

```bash
# Build and run reproduction container
docker build -f Dockerfile.reproduction -t truthlayer-reproduction .
docker run --env-file .env.reproduction truthlayer-reproduction
```

## Data Collection Reproduction

### Query Set Preparation

#### 1. Load Benchmark Queries

```bash
# Load the exact query set used in original analysis
npm run queries:load -- --file data/benchmark-queries-2025.json --validate

# Verify query loading
npm run queries:verify -- --expected-count 250 --categories health,politics,technology,science
```

#### 2. Query Set Validation

```typescript
// scripts/verify-queries.ts
interface QueryValidation {
  totalQueries: number;
  categoryCounts: Record<string, number>;
  duplicates: string[];
  invalidQueries: string[];
}

async function validateQuerySet(): Promise<QueryValidation> {
  const queries = await loadBenchmarkQueries();
  
  const validation: QueryValidation = {
    totalQueries: queries.length,
    categoryCounts: {},
    duplicates: [],
    invalidQueries: []
  };
  
  const seenQueries = new Set<string>();
  
  for (const query of queries) {
    // Check for duplicates
    if (seenQueries.has(query.text)) {
      validation.duplicates.push(query.text);
    }
    seenQueries.add(query.text);
    
    // Count by category
    validation.categoryCounts[query.category] = 
      (validation.categoryCounts[query.category] || 0) + 1;
    
    // Validate query format
    if (!query.text || query.text.length < 3 || query.text.length > 200) {
      validation.invalidQueries.push(query.text);
    }
  }
  
  return validation;
}
```

### Collection Process

#### 1. Deterministic Collection

```bash
# Set deterministic mode for reproducible results
export RANDOM_SEED=42
export DETERMINISTIC_MODE=true

# Run collection with specific parameters
npm run collect:reproduce -- \
  --queries data/benchmark-queries-2025.json \
  --engines google,bing,perplexity,brave \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --delay-min 2000 \
  --delay-max 8000 \
  --max-concurrent 2
```

#### 2. Collection Verification

```typescript
// scripts/verify-collection.ts
interface CollectionVerification {
  expectedResults: number;
  actualResults: number;
  missingQueries: string[];
  incompleteEngines: string[];
  dataIntegrityIssues: string[];
}

async function verifyCollection(
  startDate: Date, 
  endDate: Date
): Promise<CollectionVerification> {
  const queries = await loadBenchmarkQueries();
  const engines = ['google', 'bing', 'perplexity', 'brave'];
  
  const expectedResults = queries.length * engines.length * 20; // 20 results per query
  
  const actualResults = await db.query(`
    SELECT COUNT(*) as count 
    FROM search_results 
    WHERE collected_at BETWEEN $1 AND $2
  `, [startDate, endDate]);
  
  // Check for missing data
  const missingQueries = await findMissingQueries(queries, engines, startDate, endDate);
  const incompleteEngines = await findIncompleteEngines(queries, engines, startDate, endDate);
  const dataIntegrityIssues = await validateDataIntegrity(startDate, endDate);
  
  return {
    expectedResults,
    actualResults: actualResults.rows[0].count,
    missingQueries,
    incompleteEngines,
    dataIntegrityIssues
  };
}
```

#### 3. Data Integrity Checks

```bash
# Verify data integrity
npm run verify:integrity -- --start-date 2025-01-01 --end-date 2025-01-31

# Expected output:
# ✓ Schema validation: PASSED
# ✓ Content hash verification: PASSED
# ✓ Completeness check: PASSED
# ✓ Duplicate detection: PASSED
# ✓ URL validation: PASSED
```

## Analysis Pipeline

### Annotation Reproduction

#### 1. LLM Configuration

```typescript
// config/annotation-reproduction.ts
export const REPRODUCTION_CONFIG = {
  models: {
    primary: {
      provider: 'openai',
      model: 'gpt-4-turbo-2024-04-09', // Specific model version
      temperature: 0.1,
      maxTokens: 1000,
      seed: 42 // For deterministic outputs
    },
    validation: {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      temperature: 0.1,
      maxTokens: 1000
    }
  },
  prompts: {
    version: '2025.01',
    domainClassification: 'prompts/domain-classification-v2025.01.txt',
    factualScoring: 'prompts/factual-scoring-v2025.01.txt'
  },
  batchSize: 10,
  retryAttempts: 3,
  cacheEnabled: true
};
```

#### 2. Annotation Execution

```bash
# Run annotation with exact configuration
npm run annotate:reproduce -- \
  --config config/annotation-reproduction.ts \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --model gpt-4-turbo-2024-04-09 \
  --temperature 0.1 \
  --seed 42 \
  --batch-size 10
```

#### 3. Annotation Validation

```typescript
// scripts/validate-annotations.ts
interface AnnotationValidation {
  totalAnnotations: number;
  averageConfidence: number;
  scoreDistribution: Record<string, number>;
  modelConsistency: number;
  crossValidationResults: CrossValidationResult[];
}

async function validateAnnotations(): Promise<AnnotationValidation> {
  const annotations = await loadAnnotations();
  
  // Calculate score distribution
  const scoreDistribution = {
    high: annotations.filter(a => a.factualScore >= 0.7).length,
    medium: annotations.filter(a => a.factualScore >= 0.4 && a.factualScore < 0.7).length,
    low: annotations.filter(a => a.factualScore < 0.4).length
  };
  
  // Cross-validate with secondary model
  const crossValidationResults = await performCrossValidation(
    annotations.slice(0, 100) // Sample for validation
  );
  
  return {
    totalAnnotations: annotations.length,
    averageConfidence: annotations.reduce((sum, a) => sum + a.confidenceScore, 0) / annotations.length,
    scoreDistribution,
    modelConsistency: calculateConsistency(annotations),
    crossValidationResults
  };
}
```

### Metrics Calculation

#### 1. Bias Metrics Computation

```bash
# Calculate bias metrics with verification
npm run metrics:calculate:reproduce -- \
  --start-date 2025-01-01 \
  --end-date 2025-01-31 \
  --verify-calculations \
  --output-format json \
  --save-intermediates
```

#### 2. Statistical Analysis

```typescript
// scripts/statistical-analysis.ts
interface StatisticalAnalysis {
  descriptiveStats: DescriptiveStatistics;
  significanceTests: SignificanceTestResults;
  confidenceIntervals: ConfidenceIntervalResults;
  trendAnalysis: TrendAnalysisResults;
}

async function performStatisticalAnalysis(): Promise<StatisticalAnalysis> {
  const metrics = await loadBiasMetrics();
  
  return {
    descriptiveStats: calculateDescriptiveStats(metrics),
    significanceTests: performSignificanceTests(metrics),
    confidenceIntervals: calculateConfidenceIntervals(metrics),
    trendAnalysis: analyzeTrends(metrics)
  };
}
```

## Validation Procedures

### Reference Data Comparison

#### 1. Load Reference Results

```bash
# Download reference dataset
curl -O https://data.truthlayer.org/reference/truthlayer-reference-2025.01.parquet

# Verify file integrity
sha256sum truthlayer-reference-2025.01.parquet
# Expected: [reference-hash]

# Load reference data
npm run reference:load -- --file truthlayer-reference-2025.01.parquet
```

#### 2. Comparison Analysis

```typescript
// scripts/compare-results.ts
interface ComparisonResult {
  metricsComparison: MetricsComparison;
  statisticalTests: StatisticalTestResults;
  toleranceChecks: ToleranceCheckResults;
  discrepancyAnalysis: DiscrepancyAnalysis;
}

async function compareWithReference(): Promise<ComparisonResult> {
  const reproduced = await loadReproducedMetrics();
  const reference = await loadReferenceMetrics();
  
  const metricsComparison = compareMetrics(reproduced, reference);
  const statisticalTests = performComparisonTests(reproduced, reference);
  const toleranceChecks = checkTolerances(reproduced, reference);
  const discrepancyAnalysis = analyzeDiscrepancies(reproduced, reference);
  
  return {
    metricsComparison,
    statisticalTests,
    toleranceChecks,
    discrepancyAnalysis
  };
}

function checkTolerances(
  reproduced: BiasMetric[], 
  reference: BiasMetric[]
): ToleranceCheckResults {
  const tolerances = {
    domainDiversity: 0.02,    // ±2%
    engineOverlap: 0.03,      // ±3%
    factualAlignment: 0.05    // ±5%
  };
  
  const results: ToleranceCheckResults = {
    withinTolerance: true,
    violations: []
  };
  
  for (let i = 0; i < reproduced.length; i++) {
    const r = reproduced[i];
    const ref = reference[i];
    
    if (Math.abs(r.domainDiversityIndex - ref.domainDiversityIndex) > tolerances.domainDiversity) {
      results.violations.push({
        metric: 'domainDiversity',
        reproduced: r.domainDiversityIndex,
        reference: ref.domainDiversityIndex,
        difference: Math.abs(r.domainDiversityIndex - ref.domainDiversityIndex)
      });
    }
    
    // Similar checks for other metrics...
  }
  
  results.withinTolerance = results.violations.length === 0;
  return results;
}
```

### Automated Validation

#### 1. Validation Test Suite

```bash
# Run comprehensive validation suite
npm run validate:reproduction -- \
  --reference-file truthlayer-reference-2025.01.parquet \
  --tolerance-config config/validation-tolerances.json \
  --output-report validation-report.json
```

#### 2. Continuous Validation

```typescript
// scripts/continuous-validation.ts
class ReproductionValidator {
  async validatePipeline(): Promise<ValidationReport> {
    const steps = [
      this.validateEnvironment,
      this.validateDataCollection,
      this.validateAnnotation,
      this.validateMetrics,
      this.validateStatistics
    ];
    
    const results: ValidationStepResult[] = [];
    
    for (const step of steps) {
      try {
        const result = await step();
        results.push({ step: step.name, status: 'passed', result });
      } catch (error) {
        results.push({ 
          step: step.name, 
          status: 'failed', 
          error: error.message 
        });
        break; // Stop on first failure
      }
    }
    
    return {
      timestamp: new Date(),
      overallStatus: results.every(r => r.status === 'passed') ? 'passed' : 'failed',
      steps: results
    };
  }
}
```

## Version Control and Documentation

### Reproducibility Package

#### 1. Create Reproduction Archive

```bash
# Create complete reproduction package
npm run package:reproduction -- \
  --version 2025.01 \
  --include-data \
  --include-environment \
  --output truthlayer-reproduction-2025.01.tar.gz
```

#### 2. Package Contents

```
truthlayer-reproduction-2025.01/
├── README-REPRODUCTION.md
├── CHANGELOG.md
├── package.json
├── package-lock.json
├── .env.reproduction.example
├── src/                          # Source code
├── data/
│   ├── benchmark-queries-2025.json
│   ├── reference-results.parquet
│   └── validation-data.json
├── config/
│   ├── annotation-reproduction.ts
│   ├── validation-tolerances.json
│   └── environment-specs.json
├── scripts/
│   ├── reproduce.sh
│   ├── validate.sh
│   └── compare-results.ts
├── docs/
│   ├── METHODOLOGY.md
│   ├── DATA_COLLECTION.md
│   ├── BIAS_METRICS.md
│   └── REPRODUCIBILITY.md
└── tests/
    ├── reproduction.test.ts
    └── validation.test.ts
```

### Documentation Standards

#### 1. Methodology Documentation

```markdown
# Reproduction Methodology v2025.01

## Data Collection Parameters
- Collection Period: 2025-01-01 to 2025-01-31
- Query Set: benchmark-queries-2025.json (250 queries)
- Search Engines: Google, Bing, Perplexity, Brave
- Results per Query: 20
- Collection Delays: 2-8 seconds random

## Annotation Configuration
- Primary Model: gpt-4-turbo-2024-04-09
- Temperature: 0.1
- Seed: 42
- Batch Size: 10
- Prompt Version: 2025.01

## Statistical Parameters
- Confidence Level: 95%
- Significance Threshold: p < 0.05
- Bootstrap Iterations: 1000
- Random Seed: 42
```

#### 2. Change Documentation

```markdown
# Reproduction Changelog

## Version 2025.01.1
- Fixed annotation caching issue affecting reproducibility
- Updated prompt templates for consistency
- Added deterministic mode for LLM calls

## Version 2025.01.0
- Initial reproduction package
- Baseline methodology established
- Reference dataset created
```

## Quality Assurance Checklist

### Pre-Reproduction Checklist

- [ ] Environment meets minimum requirements
- [ ] All dependencies installed with correct versions
- [ ] Database schema matches reference
- [ ] API keys configured and validated
- [ ] Proxy configuration tested
- [ ] Random seed set for deterministic execution

### During Reproduction Checklist

- [ ] Collection progress monitored
- [ ] Error rates within acceptable limits (<5%)
- [ ] Data integrity checks passing
- [ ] Annotation confidence scores reasonable (>0.7 average)
- [ ] Intermediate results saved for debugging

### Post-Reproduction Checklist

- [ ] All expected data collected
- [ ] Metrics calculated successfully
- [ ] Statistical tests completed
- [ ] Results compared with reference data
- [ ] Discrepancies documented and explained
- [ ] Validation report generated

### Validation Checklist

- [ ] Metrics within tolerance thresholds
- [ ] Statistical significance maintained
- [ ] Trend patterns consistent
- [ ] Cross-validation results acceptable
- [ ] Documentation updated with findings

### Troubleshooting Common Issues

#### Collection Failures
```bash
# Check proxy status
npm run proxy:test

# Verify browser configuration
npm run browser:test

# Review collection logs
tail -f logs/collection.log
```

#### Annotation Inconsistencies
```bash
# Check model configuration
npm run model:verify

# Validate prompt templates
npm run prompts:validate

# Review annotation logs
grep "confidence" logs/annotation.log | tail -20
```

#### Metric Discrepancies
```bash
# Recalculate with debug mode
npm run metrics:calculate -- --debug --verbose

# Compare intermediate calculations
npm run metrics:compare -- --show-steps

# Validate statistical functions
npm run test:statistics
```

This comprehensive reproducibility guide ensures that TruthLayer's bias analysis can be independently verified and replicated by researchers worldwide, maintaining the highest standards of scientific rigor and transparency.