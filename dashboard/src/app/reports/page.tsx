'use client';

import React, { useState, useEffect } from 'react';

interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    defaultConfig: any;
}

interface GeneratedReport {
    id: string;
    title: string;
    generatedAt: string;
    config: any;
}

interface ReportConfig {
    title: string;
    subtitle?: string;
    timePeriod: '1d' | '7d' | '30d' | '90d' | '1y';
    engines: string[];
    categories?: string[];
    includeVisualization: boolean;
    includeRawData: boolean;
    format: 'html' | 'markdown' | 'json';
    templateId: string;
    branding?: {
        organizationName?: string;
        contactInfo?: string;
    };
}

export default function ReportsPage() {
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [reports, setReports] = useState<GeneratedReport[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [config, setConfig] = useState<ReportConfig>({
        title: 'Search Transparency Report 2025',
        timePeriod: '30d',
        engines: ['google', 'bing', 'perplexity', 'brave'],
        includeVisualization: true,
        includeRawData: false,
        format: 'html',
        templateId: 'transparency_standard'
    });

    const availableEngines = ['google', 'bing', 'perplexity', 'brave'];
    const availableCategories = ['health', 'politics', 'technology', 'science'];

    useEffect(() => {
        fetchTemplates();
        fetchReports();
    }, []);

    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/reports/templates');
            const data = await response.json();
            if (data.success) {
                setTemplates(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        }
    };

    const fetchReports = async () => {
        try {
            const response = await fetch('/api/reports');
            const data = await response.json();
            if (data.success) {
                setReports(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        }
    };

    const handleTemplateChange = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setConfig(prev => ({
                ...prev,
                ...template.defaultConfig,
                templateId
            }));
        }
    };

    const handleEngineToggle = (engine: string) => {
        setConfig(prev => ({
            ...prev,
            engines: prev.engines.includes(engine)
                ? prev.engines.filter(e => e !== engine)
                : [...prev.engines, engine]
        }));
    };

    const handleCategoryToggle = (category: string) => {
        const categories = config.categories || [];
        setConfig(prev => ({
            ...prev,
            categories: categories.includes(category)
                ? categories.filter(c => c !== category)
                : [...categories, category]
        }));
    };

    const generateReport = async () => {
        setIsGenerating(true);
        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const data = await response.json();
            if (data.success) {
                await fetchReports();
                setShowForm(false);
                alert('Report generated successfully!');
            } else {
                alert(`Failed to generate report: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to generate report:', error);
            alert('Failed to generate report');
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadReport = async (reportId: string, title: string) => {
        try {
            const response = await fetch(`/api/reports/${reportId}?format=download`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${title}.html`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Failed to download report:', error);
            alert('Failed to download report');
        }
    };

    const viewReport = (reportId: string) => {
        window.open(`/api/reports/${reportId}?format=html`, '_blank');
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Transparency Reports</h1>
                    <p className="mt-2 text-gray-600">
                        Generate comprehensive transparency reports with bias metrics and trend analysis
                    </p>
                </div>

                <div className="mb-6">
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {showForm ? 'Cancel' : 'Generate New Report'}
                    </button>
                </div>

                {showForm && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                        <h2 className="text-xl font-semibold mb-4">Generate Report</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Report Title
                                </label>
                                <input
                                    type="text"
                                    value={config.title}
                                    onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Subtitle (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={config.subtitle || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, subtitle: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Template
                                </label>
                                <select
                                    value={config.templateId}
                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {templates.map(template => (
                                        <option key={template.id} value={template.id}>
                                            {template.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Time Period
                                </label>
                                <select
                                    value={config.timePeriod}
                                    onChange={(e) => setConfig(prev => ({ ...prev, timePeriod: e.target.value as any }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="1d">Last Day</option>
                                    <option value="7d">Last 7 Days</option>
                                    <option value="30d">Last 30 Days</option>
                                    <option value="90d">Last 90 Days</option>
                                    <option value="1y">Last Year</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Format
                                </label>
                                <select
                                    value={config.format}
                                    onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value as any }))}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="html">HTML</option>
                                    <option value="markdown">Markdown</option>
                                    <option value="json">JSON</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Search Engines
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {availableEngines.map(engine => (
                                    <label key={engine} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={config.engines.includes(engine)}
                                            onChange={() => handleEngineToggle(engine)}
                                            className="mr-2"
                                        />
                                        <span className="capitalize">{engine}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Categories (Optional)
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {availableCategories.map(category => (
                                    <label key={category} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={(config.categories || []).includes(category)}
                                            onChange={() => handleCategoryToggle(category)}
                                            className="mr-2"
                                        />
                                        <span className="capitalize">{category}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-4">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={config.includeVisualization}
                                    onChange={(e) => setConfig(prev => ({ ...prev, includeVisualization: e.target.checked }))}
                                    className="mr-2"
                                />
                                Include Visualizations
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={config.includeRawData}
                                    onChange={(e) => setConfig(prev => ({ ...prev, includeRawData: e.target.checked }))}
                                    className="mr-2"
                                />
                                Include Raw Data
                            </label>
                        </div>

                        <div className="mt-6 flex gap-4">
                            <button
                                onClick={generateReport}
                                disabled={isGenerating || !config.title || config.engines.length === 0}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {isGenerating ? 'Generating...' : 'Generate Report'}
                            </button>
                            <button
                                onClick={() => setShowForm(false)}
                                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-md">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-xl font-semibold">Generated Reports</h2>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Title
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Generated
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Time Period
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Format
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {reports.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {report.title}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(report.generatedAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {report.config.timePeriod}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {report.config.format.toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => viewReport(report.id)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => downloadReport(report.id, report.title)}
                                                    className="text-green-600 hover:text-green-900"
                                                >
                                                    Download
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {reports.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                No reports generated yet. Click "Generate New Report" to create your first report.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}