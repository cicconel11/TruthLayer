#!/usr/bin/env node
/**
 * Bias report computation script
 * 
 * Queries v_bias_domain_scores and generates a structured JSON report
 * showing domain distribution variance across search engines per topic.
 * 
 * Usage:
 *   DATABASE_URL=postgres://... tsx scripts/compute-bias-report.ts
 */

import { pool } from "@truthlayer/core";
import { loadBiasTopics } from "@truthlayer/core";

interface DomainScore {
  domain: string;
  maxVariance: number;
  perEngine: Record<string, number>;
}

interface TopicReport {
  topicId: string;
  label: string;
  numDomains: number;
  numHighVarianceDomains: number;
  maxVarianceDomain: string | null;
  domains: DomainScore[];
}

interface BiasReport {
  generatedAt: string;
  topics: TopicReport[];
}

async function computeBiasReport() {
  try {
    // Load topic labels
    const topics = await loadBiasTopics();
    const topicLabelMap = new Map(topics.map(t => [t.id, t.label]));

    // Query bias domain scores
    // Note: Since topic_id is currently BIGINT and we use string IDs,
    // we'll need to match by query text or enhance the schema later
    // For now, we'll query all results and group by query patterns
    
    // Get all unique topics from search_runs (matching by query patterns)
    const topicQueries = await pool.query(`
      SELECT DISTINCT query, engine
      FROM search_runs
      WHERE query IS NOT NULL
      ORDER BY query, engine
    `);

    // For each topic in config, find matching queries
    const report: BiasReport = {
      generatedAt: new Date().toISOString(),
      topics: []
    };

    for (const topic of topics) {
      // Find search runs that match this topic's queries
      const queryPlaceholders = topic.queries.map((_, i) => `$${i + 1}`).join(',');
      const matchingRuns = await pool.query(`
        SELECT id, query, engine
        FROM search_runs
        WHERE query = ANY(ARRAY[${queryPlaceholders}])
          AND engine = ANY(ARRAY[${topic.engines.map((_, i) => `$${topic.queries.length + i + 1}`).join(',')}])
      `, [...topic.queries, ...topic.engines]);

      if (matchingRuns.rows.length === 0) {
        // No data for this topic yet
        report.topics.push({
          topicId: topic.id,
          label: topic.label,
          numDomains: 0,
          numHighVarianceDomains: 0,
          maxVarianceDomain: null,
          domains: []
        });
        continue;
      }

      const runIds = matchingRuns.rows.map(r => r.id);

      // Get domain distribution for these runs
      const domainData = await pool.query(`
        SELECT
          LOWER(SPLIT_PART(s.url, '/', 3)) AS domain,
          r.engine,
          COUNT(*) AS result_count
        FROM serp_results s
        JOIN search_runs r ON s.run_id = r.id
        WHERE r.id = ANY($1::bigint[])
        GROUP BY LOWER(SPLIT_PART(s.url, '/', 3)), r.engine
        ORDER BY domain, engine
      `, [runIds]);

      // Calculate shares and variance
      const domainMap = new Map<string, Map<string, number>>();
      const domainTotals = new Map<string, number>();

      for (const row of domainData.rows) {
        const domain = row.domain;
        const engine = row.engine;
        const count = parseInt(row.result_count, 10);

        if (!domainMap.has(domain)) {
          domainMap.set(domain, new Map());
          domainTotals.set(domain, 0);
        }
        domainMap.get(domain)!.set(engine, count);
        domainTotals.set(domain, domainTotals.get(domain)! + count);
      }

      // Calculate shares and variance
      const domainScores: DomainScore[] = [];
      let numHighVariance = 0;
      let maxVariance = 0;
      let maxVarianceDomain: string | null = null;

      for (const [domain, engineCounts] of domainMap.entries()) {
        const total = domainTotals.get(domain)!;
        const shares: number[] = [];
        const perEngine: Record<string, number> = {};

        for (const engine of topic.engines) {
          const count = engineCounts.get(engine) || 0;
          const share = total > 0 ? count / total : 0;
          shares.push(share);
          perEngine[engine] = share;
        }

        // Calculate variance
        const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
        const variance = shares.reduce((sum, share) => sum + Math.pow(share - mean, 2), 0) / shares.length;

        if (variance > maxVariance) {
          maxVariance = variance;
          maxVarianceDomain = domain;
        }

        if (variance > 0.02) {
          numHighVariance++;
        }

        domainScores.push({
          domain,
          maxVariance: variance,
          perEngine
        });
      }

      // Sort by variance descending and take top 10
      domainScores.sort((a, b) => b.maxVariance - a.maxVariance);
      const topDomains = domainScores.slice(0, 10);

      report.topics.push({
        topicId: topic.id,
        label: topic.label,
        numDomains: domainMap.size,
        numHighVarianceDomains: numHighVariance,
        maxVarianceDomain,
        domains: topDomains
      });
    }

    // Output JSON to stdout
    console.log(JSON.stringify(report, null, 2));

  } catch (error) {
    console.error("Error computing bias report:", error);
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
      if (error.stack) {
        console.error(`  ${error.stack}`);
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

computeBiasReport().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

