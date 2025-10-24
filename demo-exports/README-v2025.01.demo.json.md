# TruthLayer Dataset v2025.01.demo.json

## Overview

Comprehensive dataset of search engine results with bias analysis and factual annotations for transparency research

**Version:** 2025.01.demo.json  
**Created:** 2025-10-24T01:32:46.320Z  
**Records:** 3  
**File:** truthlayer-dataset-v2025.01.demo.json.json  

## Methodology

### Data Collection

- **Search Engines:** google, bing
- **Results per Query:** 20
- **Collection Frequency:** Daily for core queries, weekly for extended set
- **Anti-Detection:** Proxy rotation, random delays (2-8s), realistic browser fingerprinting

### Annotation Process

- **Method:** LLM-powered classification using OpenAI GPT models with versioned prompts
- **Domain Types:** news, government, academic, blog, commercial, social
- **Factual Scoring:** Scale 0.0-1.0 based on factual reliability assessment using chain-of-thought reasoning
- **Model Versions:** gpt-4-turbo

### Bias Metrics

- **Domain Diversity:** Unique domains / total results (0.0-1.0, higher = more diverse)
- **Engine Overlap:** Shared URLs / total unique URLs (0.0-1.0, higher = more overlap)
- **Factual Alignment:** Weighted average of factual scores (0.0-1.0, higher = more factual)

## Dataset Statistics

- **Total Queries:** 2
- **Total Results:** 3
- **Total Annotations:** 3
- **Date Range:** 2024-10-24T01:32:46.318Z to 2025-10-24T01:32:46.318Z

### Engine Distribution

- **google:** 2 results
- **bing:** 1 results

### Category Distribution

- **science:** 2 queries

## Data Schema

### Search Results

- **query_id:** UUID - Foreign key to queries table
- **query_text:** string - Original search query text
- **query_category:** string - Topic category (health, politics, technology, science)
- **query_created_at:** timestamp - When query was first added to system
- **result_id:** UUID - Unique identifier for search result
- **engine:** string - Search engine (google, bing, perplexity, brave)
- **rank:** integer - Position in search results (1-20)
- **title:** string - Result title as displayed by search engine
- **snippet:** string - Result snippet/description text
- **url:** string - Full URL of the result
- **collected_at:** timestamp - When result was scraped
- **content_hash:** string - SHA-256 hash of result content for deduplication

### Annotations

- **annotation_id:** UUID - Unique identifier for annotation
- **result_id:** UUID - Foreign key to search_results table
- **domain_type:** string - Classified domain type
- **factual_score:** decimal - Factual reliability score (0.0-1.0)
- **confidence_score:** decimal - Annotation confidence (0.0-1.0)
- **reasoning:** string - LLM reasoning for classification
- **model_version:** string - LLM model version used for annotation
- **annotated_at:** timestamp - When annotation was generated

## Data Quality

- **Completeness:** All results include required fields: query, engine, rank, title, url, timestamp
- **Deduplication:** Content hash verification prevents duplicate results within collection cycles
- **Validation:** Schema validation ensures data integrity and type safety
- **Integrity:** SHA-256 hashes for file integrity and provenance tracking

## Usage and Citation

**License:** Creative Commons Attribution 4.0 International (CC BY 4.0)

**Citation:**
```
TruthLayer Team. (2025). TruthLayer Search Transparency Dataset. Retrieved from https://truthlayer.org/datasets
```

**Contact:** datasets@truthlayer.org

### Restrictions

- Attribution required for any use
- Commercial use permitted with attribution
- Derivative works permitted with attribution
- No warranty provided - use at your own risk

## File Integrity

**SHA-256 Hash:** `522978ac42b01df18b3fbfd28f631438e7b4b3c84985260627787942f45fc5f4`

To verify file integrity:
```bash
sha256sum truthlayer-dataset-v2025.01.demo.json.json
```

## Provenance

- **Source System:** TruthLayer MVP v1.0
- **Exported By:** DatasetExportService
- **Export Date:** 2025-10-24T01:32:46.318Z

---

For questions about this dataset or methodology, please contact datasets@truthlayer.org
