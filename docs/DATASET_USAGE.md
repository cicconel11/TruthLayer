# Dataset Usage Instructions

## Overview

This document provides comprehensive instructions for accessing, understanding, and using TruthLayer datasets for research, analysis, and transparency initiatives. Our datasets are designed to support academic research, policy analysis, and public interest investigations into search engine bias and information visibility.

## Table of Contents

1. [Dataset Overview](#dataset-overview)
2. [Access and Download](#access-and-download)
3. [Data Schema and Structure](#data-schema-and-structure)
4. [Usage Examples](#usage-examples)
5. [Analysis Tools and Libraries](#analysis-tools-and-libraries)
6. [Citation and Attribution](#citation-and-attribution)
7. [Ethical Guidelines](#ethical-guidelines)

## Dataset Overview

### Available Datasets

#### 1. TruthLayer Search Results Dataset
- **Description**: Raw search results from multiple engines with annotations
- **Format**: Parquet, CSV, JSON
- **Update Frequency**: Monthly releases
- **Size**: ~50GB per monthly release (compressed)
- **Time Range**: January 2025 - Present

#### 2. TruthLayer Bias Metrics Dataset
- **Description**: Computed bias metrics and trend analysis
- **Format**: Parquet, CSV
- **Update Frequency**: Daily updates, monthly aggregations
- **Size**: ~1GB per monthly release
- **Time Range**: January 2025 - Present

#### 3. TruthLayer Annotation Dataset
- **Description**: LLM annotations for domain classification and factual scoring
- **Format**: Parquet, JSON
- **Update Frequency**: Monthly releases
- **Size**: ~10GB per monthly release
- **Time Range**: January 2025 - Present

### Dataset Versions

```
Version Format: YYYY.MM[.patch]
Examples:
- 2025.01    - January 2025 release
- 2025.01.1  - January 2025 with hotfix
- 2025.02    - February 2025 release
```

## Access and Download

### Direct Download

#### Latest Release
```bash
# Download latest complete dataset
curl -O https://data.truthlayer.org/latest/truthlayer-complete-latest.parquet

# Download specific version
curl -O https://data.truthlayer.org/v2025.01/truthlayer-dataset-v2025.01.parquet

# Download by component
curl -O https://data.truthlayer.org/v2025.01/search-results-v2025.01.parquet
curl -O https://data.truthlayer.org/v2025.01/bias-metrics-v2025.01.parquet
curl -O https://data.truthlayer.org/v2025.01/annotations-v2025.01.parquet
```

#### Verify Download Integrity
```bash
# Download checksums
curl -O https://data.truthlayer.org/v2025.01/checksums.sha256

# Verify file integrity
sha256sum -c checksums.sha256
```

### Programmatic Access

#### Python SDK
```python
import truthlayer

# Initialize client
client = truthlayer.Client()

# Download latest dataset
dataset = client.download_dataset(version='latest', format='parquet')

# Load specific date range
results = client.load_search_results(
    start_date='2025-01-01',
    end_date='2025-01-31',
    engines=['google', 'bing'],
    categories=['health', 'politics']
)
```

#### R Package
```r
library(truthlayer)

# Load dataset
dataset <- load_truthlayer_data(version = "2025.01")

# Filter and analyze
health_results <- dataset %>%
  filter(category == "health") %>%
  calculate_bias_metrics()
```

#### REST API
```bash
# Get dataset metadata
curl "https://api.truthlayer.org/v1/datasets/2025.01/metadata"

# Download filtered data
curl "https://api.truthlayer.org/v1/datasets/2025.01/search-results?engine=google&category=health" \
  -H "Accept: application/json" \
  -o health-google-results.json
```

## Data Schema and Structure

### Search Results Schema

#### Parquet Schema
```sql
CREATE TABLE search_results (
  -- Identifiers
  result_id UUID PRIMARY KEY,
  query_id UUID NOT NULL,
  
  -- Query Information
  query_text TEXT NOT NULL,
  query_category VARCHAR(50) NOT NULL,
  query_created_at TIMESTAMP NOT NULL,
  
  -- Search Result Data
  engine VARCHAR(20) NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 20),
  title TEXT NOT NULL,
  snippet TEXT,
  url TEXT NOT NULL,
  
  -- Collection Metadata
  collected_at TIMESTAMP NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  
  -- Optional Fields
  raw_html_path TEXT,
  processing_notes TEXT
);
```

#### Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `result_id` | UUID | Unique identifier for each result | `550e8400-e29b-41d4-a716-446655440000` |
| `query_id` | UUID | Links to queries table | `550e8400-e29b-41d4-a716-446655440001` |
| `query_text` | String | Original search query | `"covid vaccine safety"` |
| `query_category` | String | Topic category | `"health"` |
| `engine` | String | Search engine source | `"google"` |
| `rank` | Integer | Position in results (1-20) | `3` |
| `title` | String | Result title | `"COVID-19 Vaccine Safety Data"` |
| `snippet` | String | Result description | `"Latest safety data shows..."` |
| `url` | String | Full URL | `"https://cdc.gov/covid/vaccines/safety"` |
| `collected_at` | Timestamp | When result was scraped | `2025-01-15T14:30:00Z` |
| `content_hash` | String | SHA-256 hash for deduplication | `"a1b2c3d4..."` |

### Annotations Schema

```sql
CREATE TABLE annotations (
  -- Identifiers
  annotation_id UUID PRIMARY KEY,
  result_id UUID NOT NULL REFERENCES search_results(result_id),
  
  -- Classification Results
  domain_type VARCHAR(20) NOT NULL,
  factual_score DECIMAL(3,2) NOT NULL CHECK (factual_score >= 0 AND factual_score <= 1),
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Annotation Metadata
  model_version VARCHAR(50) NOT NULL,
  prompt_version VARCHAR(20) NOT NULL,
  reasoning TEXT,
  annotated_at TIMESTAMP NOT NULL,
  
  -- Quality Assurance
  human_validated BOOLEAN DEFAULT FALSE,
  validation_notes TEXT
);
```

### Bias Metrics Schema

```sql
CREATE TABLE bias_metrics (
  -- Identifiers
  metric_id UUID PRIMARY KEY,
  query_id UUID NOT NULL,
  engine VARCHAR(20) NOT NULL,
  
  -- Core Metrics
  domain_diversity_index DECIMAL(4,3) NOT NULL,
  engine_overlap_coefficient DECIMAL(4,3) NOT NULL,
  factual_alignment_score DECIMAL(4,3) NOT NULL,
  
  -- Metadata
  calculated_at TIMESTAMP NOT NULL,
  calculation_method VARCHAR(50) NOT NULL,
  
  -- Statistical Information
  confidence_interval_lower DECIMAL(4,3),
  confidence_interval_upper DECIMAL(4,3),
  sample_size INTEGER NOT NULL
);
```

## Usage Examples

### Basic Data Loading

#### Python with Pandas
```python
import pandas as pd
import pyarrow.parquet as pq

# Load search results
df_results = pd.read_parquet('truthlayer-dataset-v2025.01.parquet')

# Basic exploration
print(f"Total results: {len(df_results)}")
print(f"Date range: {df_results['collected_at'].min()} to {df_results['collected_at'].max()}")
print(f"Engines: {df_results['engine'].unique()}")
print(f"Categories: {df_results['query_category'].unique()}")

# Filter for specific analysis
health_google = df_results[
    (df_results['query_category'] == 'health') & 
    (df_results['engine'] == 'google')
]
```

#### R with dplyr
```r
library(dplyr)
library(arrow)

# Load dataset
df_results <- read_parquet("truthlayer-dataset-v2025.01.parquet")

# Basic summary
df_results %>%
  group_by(engine, query_category) %>%
  summarise(
    result_count = n(),
    unique_queries = n_distinct(query_id),
    date_range = paste(min(collected_at), "to", max(collected_at))
  )

# Filter and analyze
health_analysis <- df_results %>%
  filter(query_category == "health") %>%
  group_by(engine) %>%
  summarise(
    avg_rank = mean(rank),
    unique_domains = n_distinct(str_extract(url, "https?://([^/]+)")),
    total_results = n()
  )
```

### Domain Diversity Analysis

#### Calculate Domain Diversity by Engine
```python
import pandas as pd
from urllib.parse import urlparse

def extract_domain(url):
    """Extract domain from URL"""
    try:
        return urlparse(url).netloc.replace('www.', '')
    except:
        return 'invalid'

def calculate_domain_diversity(df):
    """Calculate domain diversity index for each query-engine combination"""
    results = []
    
    for (query_id, engine), group in df.groupby(['query_id', 'engine']):
        domains = group['url'].apply(extract_domain).unique()
        diversity_index = len(domains) / len(group)
        
        results.append({
            'query_id': query_id,
            'engine': engine,
            'total_results': len(group),
            'unique_domains': len(domains),
            'domain_diversity_index': diversity_index,
            'domains': list(domains)
        })
    
    return pd.DataFrame(results)

# Calculate diversity metrics
diversity_df = calculate_domain_diversity(df_results)

# Analyze by engine
engine_diversity = diversity_df.groupby('engine').agg({
    'domain_diversity_index': ['mean', 'std', 'min', 'max'],
    'unique_domains': 'mean'
}).round(3)

print(engine_diversity)
```

### Engine Overlap Analysis

#### Calculate Overlap Between Engines
```python
def calculate_engine_overlap(df, query_id):
    """Calculate URL overlap between engines for a specific query"""
    query_results = df[df['query_id'] == query_id]
    
    engines = query_results['engine'].unique()
    engine_urls = {}
    
    for engine in engines:
        urls = set(query_results[query_results['engine'] == engine]['url'])
        engine_urls[engine] = urls
    
    # Calculate pairwise overlaps
    overlaps = {}
    for i, engine1 in enumerate(engines):
        for engine2 in engines[i+1:]:
            intersection = len(engine_urls[engine1] & engine_urls[engine2])
            union = len(engine_urls[engine1] | engine_urls[engine2])
            overlap = intersection / union if union > 0 else 0
            overlaps[f"{engine1}-{engine2}"] = overlap
    
    return overlaps

# Calculate overlaps for all queries
all_overlaps = []
for query_id in df_results['query_id'].unique():
    overlaps = calculate_engine_overlap(df_results, query_id)
    for pair, overlap in overlaps.items():
        all_overlaps.append({
            'query_id': query_id,
            'engine_pair': pair,
            'overlap_coefficient': overlap
        })

overlap_df = pd.DataFrame(all_overlaps)

# Average overlap by engine pair
avg_overlaps = overlap_df.groupby('engine_pair')['overlap_coefficient'].mean().sort_values(ascending=False)
print(avg_overlaps)
```

### Temporal Trend Analysis

#### Analyze Bias Metrics Over Time
```python
import matplotlib.pyplot as plt
import seaborn as sns

# Load bias metrics dataset
df_metrics = pd.read_parquet('bias-metrics-v2025.01.parquet')
df_metrics['calculated_at'] = pd.to_datetime(df_metrics['calculated_at'])

# Plot domain diversity trends
plt.figure(figsize=(12, 8))

for engine in df_metrics['engine'].unique():
    engine_data = df_metrics[df_metrics['engine'] == engine]
    daily_avg = engine_data.groupby(engine_data['calculated_at'].dt.date)['domain_diversity_index'].mean()
    
    plt.plot(daily_avg.index, daily_avg.values, label=engine, marker='o')

plt.title('Domain Diversity Index Trends by Search Engine')
plt.xlabel('Date')
plt.ylabel('Domain Diversity Index')
plt.legend()
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()

# Statistical analysis of trends
from scipy import stats

for engine in df_metrics['engine'].unique():
    engine_data = df_metrics[df_metrics['engine'] == engine].sort_values('calculated_at')
    
    # Linear regression for trend
    x = range(len(engine_data))
    y = engine_data['domain_diversity_index'].values
    slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
    
    print(f"{engine}: slope={slope:.6f}, p-value={p_value:.4f}, R²={r_value**2:.4f}")
```

### Cross-Engine Comparison

#### Compare Bias Metrics Across Engines
```r
library(ggplot2)
library(dplyr)
library(tidyr)

# Load bias metrics
metrics <- read_parquet("bias-metrics-v2025.01.parquet")

# Reshape data for comparison
metrics_long <- metrics %>%
  select(engine, domain_diversity_index, engine_overlap_coefficient, factual_alignment_score) %>%
  pivot_longer(cols = -engine, names_to = "metric", values_to = "value")

# Create comparison plot
ggplot(metrics_long, aes(x = engine, y = value, fill = engine)) +
  geom_boxplot() +
  facet_wrap(~metric, scales = "free_y") +
  theme_minimal() +
  labs(
    title = "Bias Metrics Comparison Across Search Engines",
    x = "Search Engine",
    y = "Metric Value"
  ) +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

# Statistical tests
library(broom)

# ANOVA for each metric
anova_results <- metrics_long %>%
  group_by(metric) %>%
  do(tidy(aov(value ~ engine, data = .)))

print(anova_results)
```

## Analysis Tools and Libraries

### Python Libraries

#### TruthLayer Python SDK
```bash
pip install truthlayer-sdk
```

```python
import truthlayer as tl

# Load and analyze data
analyzer = tl.BiasAnalyzer()
results = analyzer.load_dataset('2025.01')

# Built-in analysis functions
diversity_analysis = analyzer.calculate_diversity_metrics()
overlap_analysis = analyzer.calculate_overlap_metrics()
trend_analysis = analyzer.analyze_trends(window_days=30)

# Generate report
report = analyzer.generate_report(
    include_visualizations=True,
    output_format='html'
)
```

#### Custom Analysis Functions
```python
# analysis_utils.py
import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, List, Tuple

class TruthLayerAnalyzer:
    def __init__(self, data_path: str):
        self.df = pd.read_parquet(data_path)
        self.prepare_data()
    
    def prepare_data(self):
        """Prepare data for analysis"""
        self.df['domain'] = self.df['url'].apply(self.extract_domain)
        self.df['collected_date'] = pd.to_datetime(self.df['collected_at']).dt.date
    
    @staticmethod
    def extract_domain(url: str) -> str:
        """Extract domain from URL"""
        from urllib.parse import urlparse
        try:
            return urlparse(url).netloc.replace('www.', '')
        except:
            return 'invalid'
    
    def calculate_bias_metrics(self, group_by: List[str] = ['query_id', 'engine']) -> pd.DataFrame:
        """Calculate all bias metrics"""
        results = []
        
        for group_keys, group_data in self.df.groupby(group_by):
            metrics = {
                'domain_diversity': self.calculate_domain_diversity(group_data),
                'factual_alignment': self.calculate_factual_alignment(group_data),
                'rank_bias': self.calculate_rank_bias(group_data)
            }
            
            result = dict(zip(group_by, group_keys))
            result.update(metrics)
            results.append(result)
        
        return pd.DataFrame(results)
    
    def calculate_domain_diversity(self, df: pd.DataFrame) -> float:
        """Calculate domain diversity index"""
        unique_domains = df['domain'].nunique()
        total_results = len(df)
        return unique_domains / total_results if total_results > 0 else 0
    
    def statistical_comparison(self, metric: str, group1: str, group2: str) -> Dict:
        """Perform statistical comparison between groups"""
        data1 = self.df[self.df['engine'] == group1][metric]
        data2 = self.df[self.df['engine'] == group2][metric]
        
        # Mann-Whitney U test
        statistic, p_value = stats.mannwhitneyu(data1, data2, alternative='two-sided')
        
        return {
            'statistic': statistic,
            'p_value': p_value,
            'significant': p_value < 0.05,
            'group1_mean': data1.mean(),
            'group2_mean': data2.mean(),
            'effect_size': (data1.mean() - data2.mean()) / np.sqrt((data1.var() + data2.var()) / 2)
        }
```

### R Libraries

#### TruthLayer R Package
```r
# Install from CRAN (when available)
install.packages("truthlayer")

# Or install development version
devtools::install_github("truthlayer/truthlayer-r")

library(truthlayer)

# Load and analyze data
data <- load_truthlayer_data("2025.01")
metrics <- calculate_bias_metrics(data)
trends <- analyze_temporal_trends(metrics, window = "30 days")

# Generate visualizations
plot_diversity_trends(trends)
plot_engine_comparison(metrics)
```

#### Custom R Functions
```r
# analysis_functions.R
library(dplyr)
library(ggplot2)
library(broom)

calculate_domain_diversity <- function(df) {
  df %>%
    group_by(query_id, engine) %>%
    summarise(
      total_results = n(),
      unique_domains = n_distinct(domain),
      diversity_index = unique_domains / total_results,
      .groups = "drop"
    )
}

perform_engine_comparison <- function(df, metric) {
  # ANOVA test
  anova_result <- aov(as.formula(paste(metric, "~ engine")), data = df)
  
  # Post-hoc tests
  tukey_result <- TukeyHSD(anova_result)
  
  list(
    anova = tidy(anova_result),
    tukey = tidy(tukey_result)
  )
}

plot_bias_trends <- function(df, metric) {
  ggplot(df, aes(x = date, y = !!sym(metric), color = engine)) +
    geom_line(size = 1) +
    geom_smooth(method = "loess", se = TRUE, alpha = 0.3) +
    facet_wrap(~query_category, scales = "free_y") +
    theme_minimal() +
    labs(
      title = paste("Temporal Trends in", str_to_title(gsub("_", " ", metric))),
      x = "Date",
      y = str_to_title(gsub("_", " ", metric)),
      color = "Search Engine"
    )
}
```

## Citation and Attribution

### Academic Citation

#### APA Format
```
TruthLayer Team. (2025). TruthLayer Search Transparency Dataset (Version 2025.01) [Data set]. 
Retrieved from https://data.truthlayer.org/v2025.01/
```

#### BibTeX Format
```bibtex
@dataset{truthlayer2025,
  title={TruthLayer Search Transparency Dataset},
  author={{TruthLayer Team}},
  year={2025},
  version={2025.01},
  url={https://data.truthlayer.org/v2025.01/},
  publisher={TruthLayer},
  note={Accessed: \today}
}
```

#### Chicago Format
```
TruthLayer Team. "TruthLayer Search Transparency Dataset." Version 2025.01. 
TruthLayer, 2025. https://data.truthlayer.org/v2025.01/.
```

### Attribution Requirements

#### Minimum Attribution
When using TruthLayer datasets, you must:

1. **Credit the source**: Clearly identify TruthLayer as the data source
2. **Include version**: Specify the exact dataset version used
3. **Provide access date**: Include when you accessed the data
4. **Link to methodology**: Reference our methodology documentation

#### Example Attribution Text
```
This analysis uses data from the TruthLayer Search Transparency Dataset (Version 2025.01), 
which provides systematic measurements of search engine bias across multiple platforms. 
The dataset and methodology are available at https://truthlayer.org/datasets.
```

### License Information

#### Creative Commons Attribution 4.0 International (CC BY 4.0)

**You are free to:**
- **Share**: Copy and redistribute the material in any medium or format
- **Adapt**: Remix, transform, and build upon the material for any purpose, even commercially

**Under the following terms:**
- **Attribution**: You must give appropriate credit, provide a link to the license, and indicate if changes were made

**Full license text**: https://creativecommons.org/licenses/by/4.0/

## Ethical Guidelines

### Responsible Use

#### Research Ethics
- **Transparency**: Clearly document your methodology and any modifications to the data
- **Reproducibility**: Provide sufficient detail for others to replicate your analysis
- **Limitations**: Acknowledge dataset limitations and potential biases in your analysis
- **Context**: Consider the temporal and cultural context of the data

#### Privacy Considerations
- **No Personal Data**: Our datasets do not contain personal information, but be mindful of any derived analyses
- **URL Sensitivity**: Some URLs may contain sensitive information; consider anonymization for public sharing
- **Aggregation**: When possible, report aggregated rather than individual-level results

### Prohibited Uses

#### Explicitly Prohibited
- **Manipulation**: Do not alter the data to support predetermined conclusions
- **Misrepresentation**: Do not misrepresent the methodology or findings
- **Commercial Exploitation**: Do not use the data for commercial purposes without proper attribution
- **Harmful Applications**: Do not use the data to harm individuals or organizations

#### Best Practices
- **Peer Review**: Subject your analysis to peer review when possible
- **Open Science**: Share your analysis code and derived datasets when feasible
- **Community Engagement**: Engage with the TruthLayer community for feedback and collaboration
- **Impact Consideration**: Consider the potential societal impact of your research

### Reporting Issues

#### Data Quality Issues
If you identify potential data quality issues:

1. **Document the issue**: Provide specific examples and context
2. **Contact us**: Email datasets@truthlayer.org with details
3. **Continue analysis**: Note the limitation in your work while we investigate

#### Ethical Concerns
For ethical concerns about data use:

1. **Review guidelines**: Ensure you understand our ethical guidelines
2. **Seek guidance**: Contact ethics@truthlayer.org for clarification
3. **Report violations**: Report any misuse you observe in the community

This comprehensive dataset usage guide ensures that researchers can effectively and ethically leverage TruthLayer data to advance understanding of search engine bias and information transparency.