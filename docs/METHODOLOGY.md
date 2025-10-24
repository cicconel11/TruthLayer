# TruthLayer Methodology Documentation

## Overview

TruthLayer is a comprehensive system for measuring and analyzing bias in search engine results through systematic data collection, LLM-powered annotation, and quantitative bias metrics. This document provides detailed methodology for all aspects of the system to ensure transparency, reproducibility, and scientific rigor.

## Table of Contents

1. [Data Collection Methodology](#data-collection-methodology)
2. [Annotation Pipeline](#annotation-pipeline)
3. [Bias Metrics Calculations](#bias-metrics-calculations)
4. [Statistical Approaches](#statistical-approaches)
5. [Quality Assurance](#quality-assurance)
6. [Reproducibility Guidelines](#reproducibility-guidelines)

## Data Collection Methodology

### Search Engine Coverage

TruthLayer collects data from four major search platforms:

- **Google Search**: Traditional web search with personalization disabled
- **Bing Search**: Microsoft's search engine with standard settings
- **Perplexity AI**: AI-powered search with conversational interface
- **Brave Search**: Privacy-focused independent search index

### Query Selection and Management

#### Benchmark Query Sets

Queries are organized into four primary categories:

1. **Health Queries** (25% of dataset)
   - Medical treatments and procedures
   - Public health information
   - Mental health resources
   - Vaccine and medication safety

2. **Political Queries** (25% of dataset)
   - Election information and results
   - Policy debates and legislation
   - Government transparency
   - Political candidate information

3. **Technology Queries** (25% of dataset)
   - AI safety and ethics
   - Data privacy and security
   - Cryptocurrency and blockchain
   - Tech industry regulation

4. **Science Queries** (25% of dataset)
   - Climate change research
   - Space exploration
   - Genetic engineering
   - Renewable energy

#### Query Rotation Strategy

- **Core Queries**: 50 high-priority queries executed daily
- **Extended Queries**: 200 additional queries executed weekly
- **Seasonal Queries**: Event-driven queries added dynamically
- **A/B Testing**: Regular evaluation of query effectiveness

### Collection Process

#### Scraping Infrastructure

1. **Browser Automation**: Puppeteer-based headless Chrome instances
2. **Proxy Rotation**: Residential proxy pool with health monitoring
3. **Request Throttling**: Random delays between 2-8 seconds
4. **User Agent Rotation**: Realistic browser fingerprinting
5. **Anti-Detection**: CAPTCHA solving and Cloudflare bypass

#### Data Normalization

All search results are normalized to a common schema:

```typescript
interface SearchResult {
  id: string;              // UUID for unique identification
  query: string;           // Original search query
  engine: string;          // Source search engine
  rank: number;            // Position in results (1-20)
  title: string;           // Result title
  snippet: string;         // Result description/snippet
  url: string;             // Full URL
  timestamp: Date;         // Collection timestamp
  contentHash: string;     // SHA-256 hash for deduplication
  rawHtml?: string;        // Preserved HTML for auditing
}
```

#### Quality Controls

- **Deduplication**: Content hash verification within collection cycles
- **Completeness Validation**: Required field verification
- **Rate Limiting Compliance**: Respectful request patterns
- **Error Handling**: Automatic retry with exponential backoff

## Annotation Pipeline

### LLM Integration

#### Model Selection

- **Primary Model**: OpenAI GPT-4 Turbo for consistency and reliability
- **Backup Models**: Anthropic Claude for cross-validation
- **Temperature Setting**: 0.1 for consistent outputs
- **Context Window**: Optimized for search result content

#### Prompt Engineering

##### Domain Classification Prompt

```
Analyze this search result and classify its domain type:

Query: "{query}"
Title: "{title}"
Snippet: "{snippet}"
URL: "{url}"

Classify into one of these categories:
- news: News articles and journalism
- government: Official government sources
- academic: Research papers, universities, scholarly content
- blog: Personal blogs, opinion pieces
- commercial: Business websites, product pages
- social: Social media, forums, community content

Provide your classification with confidence score (0.0-1.0) and brief reasoning.

Format: {"domain": "category", "confidence": 0.95, "reasoning": "explanation"}
```

##### Factual Consistency Prompt

```
Evaluate the factual reliability of this search result:

Query: "{query}"
Title: "{title}"
Snippet: "{snippet}"
URL: "{url}"

Rate factual reliability on scale 0.0-1.0 where:
- 0.0-0.3: Low reliability (opinion, speculation, unverified claims)
- 0.4-0.6: Medium reliability (mixed factual content, some verification)
- 0.7-1.0: High reliability (well-sourced, authoritative, verifiable)

Consider:
- Source authority and reputation
- Presence of citations and evidence
- Factual accuracy of claims
- Potential bias or agenda

Format: {"factual_score": 0.85, "confidence": 0.90, "reasoning": "explanation"}
```

#### Batch Processing

- **Batch Size**: 10 results per API call for cost efficiency
- **Caching**: Results cached by content hash to avoid re-annotation
- **Rate Limiting**: Respect API limits with exponential backoff
- **Error Handling**: Retry failed annotations with different prompts

### Annotation Quality Assurance

#### Validation Checks

1. **Response Format Validation**: JSON schema compliance
2. **Score Range Validation**: Ensure scores within 0.0-1.0 range
3. **Confidence Thresholds**: Flag low-confidence annotations for review
4. **Cross-Model Validation**: Compare results across different LLMs

#### Human Review Process

- **Sample Auditing**: Manual review of 5% of annotations monthly
- **Disagreement Resolution**: Human arbitration for conflicting annotations
- **Prompt Refinement**: Iterative improvement based on review findings
- **Inter-Annotator Agreement**: Measure consistency across models

## Bias Metrics Calculations

### Core Metrics

#### 1. Domain Diversity Index (DDI)

**Formula**: `DDI = unique_domains / total_results`

**Calculation**:
```typescript
function calculateDomainDiversity(results: SearchResult[]): number {
  const domains = new Set(results.map(r => extractDomain(r.url)));
  return domains.size / results.length;
}
```

**Interpretation**:
- Range: 0.0 to 1.0
- Higher values indicate more diverse source representation
- 1.0 = all results from different domains
- 0.05 = all results from same domain (for 20 results)

#### 2. Engine Overlap Coefficient (EOC)

**Formula**: `EOC = shared_urls / total_unique_urls`

**Calculation**:
```typescript
function calculateEngineOverlap(engineResults: Map<string, SearchResult[]>): number {
  const allUrls = new Set<string>();
  const urlCounts = new Map<string, number>();
  
  for (const [engine, results] of engineResults) {
    for (const result of results) {
      allUrls.add(result.url);
      urlCounts.set(result.url, (urlCounts.get(result.url) || 0) + 1);
    }
  }
  
  const sharedUrls = Array.from(urlCounts.values()).filter(count => count > 1).length;
  return sharedUrls / allUrls.size;
}
```

**Interpretation**:
- Range: 0.0 to 1.0
- Higher values indicate more overlap between engines
- 1.0 = all engines return identical results
- 0.0 = no shared results between engines

#### 3. Factual Alignment Score (FAS)

**Formula**: `FAS = Σ(factual_score × confidence_score) / Σ(confidence_score)`

**Calculation**:
```typescript
function calculateFactualAlignment(annotations: Annotation[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const annotation of annotations) {
    const weight = annotation.confidenceScore;
    weightedSum += annotation.factualScore * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
```

**Interpretation**:
- Range: 0.0 to 1.0
- Higher values indicate more factually reliable results
- Weighted by annotation confidence for accuracy
- Accounts for uncertainty in LLM annotations

### Advanced Metrics

#### 4. Temporal Bias Drift

**Purpose**: Measure how bias metrics change over time

**Calculation**:
```typescript
function calculateBiasDrift(historicalMetrics: BiasMetric[], windowDays: number): number {
  const recent = historicalMetrics.filter(m => 
    m.timestamp > Date.now() - windowDays * 24 * 60 * 60 * 1000
  );
  
  if (recent.length < 2) return 0;
  
  const slope = calculateLinearRegression(recent.map(m => m.domainDiversity));
  return slope;
}
```

#### 5. Cross-Engine Bias Variance

**Purpose**: Measure consistency of bias across engines

**Calculation**:
```typescript
function calculateBiasVariance(engineMetrics: Map<string, BiasMetric>): number {
  const values = Array.from(engineMetrics.values()).map(m => m.domainDiversity);
  const mean = values.reduce((a, b) => a + b) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance); // Standard deviation
}
```

## Statistical Approaches

### Trend Analysis

#### Rolling Averages

- **7-day rolling average**: Smooth short-term fluctuations
- **30-day rolling average**: Identify medium-term trends
- **Seasonal adjustment**: Account for periodic variations

#### Statistical Significance Testing

**Mann-Whitney U Test** for comparing bias metrics between time periods:

```typescript
function testSignificance(before: number[], after: number[]): {
  pValue: number;
  isSignificant: boolean;
} {
  const uStatistic = mannWhitneyU(before, after);
  const pValue = calculatePValue(uStatistic, before.length, after.length);
  return {
    pValue,
    isSignificant: pValue < 0.05
  };
}
```

#### Anomaly Detection

**Z-Score Method** for identifying unusual bias patterns:

```typescript
function detectAnomalies(values: number[], threshold: number = 2.5): boolean[] {
  const mean = values.reduce((a, b) => a + b) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length
  );
  
  return values.map(val => Math.abs((val - mean) / stdDev) > threshold);
}
```

### Confidence Intervals

**Bootstrap Method** for calculating confidence intervals:

```typescript
function bootstrapConfidenceInterval(
  data: number[], 
  iterations: number = 1000, 
  confidence: number = 0.95
): [number, number] {
  const bootstrapSamples = [];
  
  for (let i = 0; i < iterations; i++) {
    const sample = [];
    for (let j = 0; j < data.length; j++) {
      sample.push(data[Math.floor(Math.random() * data.length)]);
    }
    bootstrapSamples.push(calculateMean(sample));
  }
  
  bootstrapSamples.sort((a, b) => a - b);
  const lowerIndex = Math.floor((1 - confidence) / 2 * iterations);
  const upperIndex = Math.floor((1 + confidence) / 2 * iterations);
  
  return [bootstrapSamples[lowerIndex], bootstrapSamples[upperIndex]];
}
```

## Quality Assurance

### Data Validation

#### Schema Validation

All data must conform to strict TypeScript interfaces:

```typescript
// Validation function for search results
function validateSearchResult(result: any): result is SearchResult {
  return (
    typeof result.id === 'string' &&
    typeof result.query === 'string' &&
    ['google', 'bing', 'perplexity', 'brave'].includes(result.engine) &&
    typeof result.rank === 'number' &&
    result.rank >= 1 && result.rank <= 20 &&
    typeof result.title === 'string' &&
    typeof result.snippet === 'string' &&
    typeof result.url === 'string' &&
    result.timestamp instanceof Date
  );
}
```

#### Content Integrity

- **Hash Verification**: SHA-256 hashes prevent data corruption
- **Duplicate Detection**: Content-based deduplication within cycles
- **Completeness Checks**: Ensure all required fields are present

### Monitoring and Alerting

#### Collection Success Rates

- **Target**: >95% successful collection rate per engine
- **Alert Threshold**: <90% success rate triggers investigation
- **Recovery**: Automatic retry with different proxies/methods

#### Annotation Quality

- **Confidence Monitoring**: Track average confidence scores
- **Consistency Checks**: Compare annotations across models
- **Human Validation**: Regular sampling for quality assurance

#### System Performance

- **Response Times**: Monitor API and database performance
- **Resource Usage**: Track memory and CPU utilization
- **Error Rates**: Alert on elevated error frequencies

## Reproducibility Guidelines

### Environment Setup

#### Required Dependencies

```json
{
  "node": ">=18.0.0",
  "postgresql": ">=13.0",
  "dependencies": {
    "puppeteer": "^21.0.0",
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "pg": "^8.11.0"
  }
}
```

#### Configuration Management

All configuration through environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/truthlayer

# LLM APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Scraping
PROXY_LIST=proxy1:port,proxy2:port
CAPTCHA_API_KEY=...

# Collection Settings
COLLECTION_DELAY_MIN=2000
COLLECTION_DELAY_MAX=8000
RESULTS_PER_QUERY=20
```

### Data Pipeline Reproduction

#### Step-by-Step Process

1. **Database Setup**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

2. **Query Configuration**:
   ```bash
   npm run queries:load -- --file queries/benchmark-2025.json
   ```

3. **Collection Execution**:
   ```bash
   npm run collect -- --engines google,bing --queries health
   ```

4. **Annotation Processing**:
   ```bash
   npm run annotate -- --model gpt-4-turbo --batch-size 10
   ```

5. **Metrics Calculation**:
   ```bash
   npm run metrics:calculate -- --date-range 2025-01-01,2025-01-31
   ```

#### Verification Steps

- **Data Integrity**: Verify SHA-256 hashes match expected values
- **Schema Compliance**: Run validation checks on all data
- **Metric Accuracy**: Compare calculated metrics with reference values
- **Statistical Tests**: Verify trend analysis and significance tests

### Version Control

#### Data Versioning

- **Semantic Versioning**: YYYY.MM.patch format for datasets
- **Metadata Tracking**: Complete provenance information
- **Backward Compatibility**: Maintain schema compatibility across versions

#### Code Versioning

- **Git Tags**: Tag releases with corresponding data versions
- **Dependency Locking**: Use package-lock.json for exact versions
- **Configuration Snapshots**: Version control for all settings

### Documentation Standards

#### Code Documentation

- **JSDoc Comments**: All public functions documented
- **Type Annotations**: Complete TypeScript coverage
- **README Files**: Component-level documentation

#### Methodology Documentation

- **Change Logs**: Document all methodology changes
- **Decision Records**: Architectural decision records (ADRs)
- **Validation Reports**: Regular quality assurance reports

This methodology ensures that TruthLayer produces reliable, reproducible, and scientifically rigorous measurements of search engine bias while maintaining transparency about all processes and limitations.