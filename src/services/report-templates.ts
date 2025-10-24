/**
 * Report templates for consistent formatting and branding
 */

export interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    defaultConfig: Partial<any>; // ReportConfig
    htmlTemplate: string;
    markdownTemplate: string;
    cssStyles: string;
}

/**
 * Standard TruthLayer transparency report template
 */
export const TRANSPARENCY_REPORT_TEMPLATE: ReportTemplate = {
    id: 'transparency_standard',
    name: 'Standard Transparency Report',
    description: 'Comprehensive transparency report with bias metrics, engine comparison, and trend analysis',
    defaultConfig: {
        title: 'Search Transparency Report 2025',
        subtitle: 'Algorithmic Bias Analysis Across Search Engines',
        timePeriod: '30d',
        engines: ['google', 'bing', 'perplexity', 'brave'],
        includeVisualization: true,
        includeRawData: false,
        format: 'html',
        branding: {
            organizationName: 'TruthLayer',
            contactInfo: 'For questions about this report, visit truthlayer.org'
        }
    },
    htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{styles}}</style>
</head>
<body>
    <div class="report-container">
        {{header}}
        {{executiveSummary}}
        {{biasMetrics}}
        {{engineComparison}}
        {{trendAnalysis}}
        {{keyInsights}}
        {{methodology}}
        {{visualizations}}
        {{footer}}
    </div>
</body>
</html>
    `,
    markdownTemplate: `
# {{title}}

{{subtitle}}

{{metadata}}

## Executive Summary

{{executiveSummary}}

## Bias Metrics Overview

{{biasMetrics}}

## Engine Comparison

{{engineComparison}}

## Trend Analysis

{{trendAnalysis}}

## Key Insights

{{keyInsights}}

## Methodology

{{methodology}}

{{footer}}
    `,
    cssStyles: `
        :root {
            --primary-color: #2563eb;
            --secondary-color: #64748b;
            --success-color: #059669;
            --warning-color: #d97706;
            --danger-color: #dc2626;
            --background-color: #ffffff;
            --surface-color: #f8fafc;
            --border-color: #e2e8f0;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background-color: var(--background-color);
        }

        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            text-align: center;
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 2rem;
            margin-bottom: 3rem;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--primary-color);
            margin-bottom: 0.5rem;
        }

        .header h2 {
            font-size: 1.5rem;
            font-weight: 400;
            color: var(--text-secondary);
            margin-bottom: 1rem;
        }

        .metadata {
            font-size: 0.9rem;
            color: var(--text-secondary);
            display: flex;
            justify-content: center;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .section {
            margin-bottom: 3rem;
        }

        .section h2 {
            font-size: 1.875rem;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 1rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.5rem;
        }

        .section h3 {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
            margin: 1.5rem 0 1rem 0;
        }

        .section h4 {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
            margin: 1rem 0 0.5rem 0;
        }

        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin: 1.5rem 0;
        }

        .metric-card {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 1.5rem;
            transition: box-shadow 0.2s ease;
        }

        .metric-card:hover {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .metric-card h4 {
            font-size: 1rem;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }

        .metric-value {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }

        .metric-value.primary { color: var(--primary-color); }
        .metric-value.success { color: var(--success-color); }
        .metric-value.warning { color: var(--warning-color); }

        .insight {
            background: #eff6ff;
            border-left: 4px solid var(--primary-color);
            padding: 1rem 1.5rem;
            margin: 1rem 0;
            border-radius: 0 0.5rem 0.5rem 0;
        }

        .recommendation {
            background: #f0fdf4;
            border-left: 4px solid var(--success-color);
            padding: 1rem 1.5rem;
            margin: 1rem 0;
            border-radius: 0 0.5rem 0.5rem 0;
        }

        .warning {
            background: #fffbeb;
            border-left: 4px solid var(--warning-color);
            padding: 1rem 1.5rem;
            margin: 1rem 0;
            border-radius: 0 0.5rem 0.5rem 0;
        }

        .table-container {
            overflow-x: auto;
            margin: 1.5rem 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--background-color);
            border-radius: 0.5rem;
            overflow: hidden;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        th, td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            background: var(--surface-color);
            font-weight: 600;
            color: var(--text-primary);
        }

        tr:hover {
            background: var(--surface-color);
        }

        .chart-container {
            background: var(--background-color);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin: 1.5rem 0;
            text-align: center;
        }

        .chart-placeholder {
            background: var(--surface-color);
            border: 2px dashed var(--border-color);
            border-radius: 0.5rem;
            padding: 3rem 2rem;
            color: var(--text-secondary);
        }

        .trend-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin: 1.5rem 0;
        }

        .trend-card {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1.5rem;
        }

        .trend-direction {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        .trend-direction.improving { color: var(--success-color); }
        .trend-direction.declining { color: var(--danger-color); }
        .trend-direction.stable { color: var(--text-secondary); }
        .trend-direction.increasing { color: var(--primary-color); }
        .trend-direction.decreasing { color: var(--warning-color); }

        .impact-badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .impact-badge.high {
            background: #fef2f2;
            color: var(--danger-color);
        }

        .impact-badge.medium {
            background: #fffbeb;
            color: var(--warning-color);
        }

        .impact-badge.low {
            background: #f0f9ff;
            color: var(--primary-color);
        }

        .footer {
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid var(--border-color);
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.9rem;
        }

        .logo {
            max-height: 60px;
            margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
            .report-container {
                padding: 1rem;
            }

            .header h1 {
                font-size: 2rem;
            }

            .header h2 {
                font-size: 1.25rem;
            }

            .metric-grid {
                grid-template-columns: 1fr;
            }

            .metadata {
                flex-direction: column;
                gap: 0.5rem;
            }
        }

        @media print {
            .report-container {
                max-width: none;
                padding: 1rem;
            }

            .chart-placeholder {
                display: none;
            }

            .section {
                break-inside: avoid;
                margin-bottom: 2rem;
            }
        }
    `
};

/**
 * Executive summary report template
 */
export const EXECUTIVE_SUMMARY_TEMPLATE: ReportTemplate = {
    id: 'executive_summary',
    name: 'Executive Summary Report',
    description: 'Concise executive summary focusing on key findings and recommendations',
    defaultConfig: {
        title: 'Search Engine Bias - Executive Summary',
        timePeriod: '30d',
        engines: ['google', 'bing', 'perplexity', 'brave'],
        includeVisualization: true,
        includeRawData: false,
        format: 'html'
    },
    htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{styles}}</style>
</head>
<body>
    <div class="report-container executive-summary">
        {{header}}
        {{executiveSummary}}
        {{keyMetrics}}
        {{recommendations}}
        {{footer}}
    </div>
</body>
</html>
    `,
    markdownTemplate: `
# {{title}}

{{metadata}}

## Executive Summary

{{executiveSummary}}

## Key Metrics

{{keyMetrics}}

## Recommendations

{{recommendations}}

{{footer}}
    `,
    cssStyles: TRANSPARENCY_REPORT_TEMPLATE.cssStyles + `
        .executive-summary {
            max-width: 800px;
        }

        .executive-summary .section {
            margin-bottom: 2rem;
        }

        .key-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1.5rem 0;
        }

        .key-metric {
            text-align: center;
            padding: 1.5rem;
            background: var(--surface-color);
            border-radius: 0.75rem;
            border: 1px solid var(--border-color);
        }

        .key-metric .value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary-color);
            display: block;
        }

        .key-metric .label {
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-top: 0.5rem;
        }
    `
};

/**
 * Technical report template for detailed analysis
 */
export const TECHNICAL_REPORT_TEMPLATE: ReportTemplate = {
    id: 'technical_detailed',
    name: 'Technical Analysis Report',
    description: 'Detailed technical report with comprehensive metrics and statistical analysis',
    defaultConfig: {
        title: 'Technical Analysis: Search Engine Algorithmic Bias',
        timePeriod: '90d',
        engines: ['google', 'bing', 'perplexity', 'brave'],
        includeVisualization: true,
        includeRawData: true,
        format: 'html'
    },
    htmlTemplate: TRANSPARENCY_REPORT_TEMPLATE.htmlTemplate,
    markdownTemplate: TRANSPARENCY_REPORT_TEMPLATE.markdownTemplate,
    cssStyles: TRANSPARENCY_REPORT_TEMPLATE.cssStyles + `
        .technical-details {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            padding: 1.5rem;
            margin: 1rem 0;
        }

        .statistical-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin: 1rem 0;
        }

        .stat-item {
            text-align: center;
            padding: 1rem;
            background: var(--background-color);
            border-radius: 0.5rem;
            border: 1px solid var(--border-color);
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--primary-color);
        }

        .stat-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }

        .code-block {
            background: #1e293b;
            color: #e2e8f0;
            padding: 1rem;
            border-radius: 0.5rem;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            overflow-x: auto;
            margin: 1rem 0;
        }
    `
};

/**
 * Available report templates
 */
export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
    [TRANSPARENCY_REPORT_TEMPLATE.id]: TRANSPARENCY_REPORT_TEMPLATE,
    [EXECUTIVE_SUMMARY_TEMPLATE.id]: EXECUTIVE_SUMMARY_TEMPLATE,
    [TECHNICAL_REPORT_TEMPLATE.id]: TECHNICAL_REPORT_TEMPLATE
};

/**
 * Get a report template by ID
 */
export function getReportTemplate(templateId: string): ReportTemplate | null {
    return REPORT_TEMPLATES[templateId] || null;
}

/**
 * Get all available report templates
 */
export function getAvailableTemplates(): ReportTemplate[] {
    return Object.values(REPORT_TEMPLATES);
}

/**
 * Template rendering utilities
 */
export class TemplateRenderer {
    /**
     * Render template with data substitution
     */
    static render(template: string, data: Record<string, any>): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || match;
        });
    }

    /**
     * Render HTML template with sections
     */
    static renderHTML(
        template: ReportTemplate,
        data: {
            title: string;
            subtitle?: string;
            metadata: string;
            header: string;
            executiveSummary: string;
            biasMetrics: string;
            engineComparison: string;
            trendAnalysis: string;
            keyInsights: string;
            methodology: string;
            visualizations: string;
            footer: string;
        }
    ): string {
        const templateData = {
            ...data,
            styles: template.cssStyles
        };

        return this.render(template.htmlTemplate, templateData);
    }

    /**
     * Render Markdown template with sections
     */
    static renderMarkdown(
        template: ReportTemplate,
        data: {
            title: string;
            subtitle?: string;
            metadata: string;
            executiveSummary: string;
            biasMetrics: string;
            engineComparison: string;
            trendAnalysis: string;
            keyInsights: string;
            methodology: string;
            footer: string;
        }
    ): string {
        return this.render(template.markdownTemplate, data);
    }
}