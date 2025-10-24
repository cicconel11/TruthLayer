'use client';

import { useState, useEffect } from 'react';

interface DatasetVersion {
    version: string;
    createdAt: string;
    description: string;
    recordCount: number;
    dataHash: string;
    filePath: string;
    statistics: {
        totalQueries: number;
        totalResults: number;
        totalAnnotations: number;
        dateRange: {
            start: string;
            end: string;
        };
        engineDistribution: Record<string, number>;
        categoryDistribution: Record<string, number>;
    };
}

interface ExportOptions {
    format: 'parquet' | 'csv' | 'json';
    engines: string[];
    categories: string[];
    includeAnnotations: boolean;
    includeRawData: boolean;
    dateRange?: {
        start: string;
        end: string;
    };
    version?: string;
}

export default function DatasetsPage() {
    const [versions, setVersions] = useState<DatasetVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<DatasetVersion | null>(null);
    const [showExportForm, setShowExportForm] = useState(false);
    const [exportOptions, setExportOptions] = useState<ExportOptions>({
        format: 'parquet',
        engines: ['google', 'bing', 'perplexity', 'brave'],
        categories: [],
        includeAnnotations: true,
        includeRawData: false
    });

    useEffect(() => {
        loadVersions();
    }, []);

    const loadVersions = async () => {
        try {
            const response = await fetch('/api/datasets?action=list');
            const data = await response.json();
            
            if (data.success) {
                setVersions(data.versions);
            }
        } catch (error) {
            console.error('Failed to load versions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const response = await fetch('/api/datasets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'export',
                    ...exportOptions
                })
            });

            const data = await response.json();
            
            if (data.success) {
                alert(`Export completed successfully!\nVersion: ${data.version}\nRecords: ${data.recordCount.toLocaleString()}`);
                setShowExportForm(false);
                loadVersions(); // Refresh the list
            } else {
                alert('Export failed: ' + data.error);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed: ' + error.message);
        } finally {
            setExporting(false);
        }
    };

    const handleDownload = (version: string, type: 'dataset' | 'metadata' | 'readme') => {
        const url = `/api/datasets/download/${version}?type=${type}`;
        window.open(url, '_blank');
    };

    const handleDelete = async (version: string) => {
        if (!confirm(`Are you sure you want to delete version ${version}? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch('/api/datasets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete',
                    version
                })
            });

            const data = await response.json();
            
            if (data.success) {
                alert('Version deleted successfully');
                loadVersions(); // Refresh the list
            } else {
                alert('Delete failed: ' + data.error);
            }
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Delete failed: ' + error.message);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const formatFileSize = (filePath: string) => {
        // This is a placeholder - in a real implementation, you'd get the actual file size
        return 'N/A';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center">Loading datasets...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Dataset Management</h1>
                    <p className="text-gray-600 mb-6">
                        Manage and download TruthLayer datasets with comprehensive search engine bias analysis.
                    </p>
                    
                    <button
                        onClick={() => setShowExportForm(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Create New Export
                    </button>
                </div>

                {/* Export Form Modal */}
                {showExportForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold mb-4">Create Dataset Export</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Export Format
                                    </label>
                                    <select
                                        value={exportOptions.format}
                                        onChange={(e) => setExportOptions({
                                            ...exportOptions,
                                            format: e.target.value as 'parquet' | 'csv' | 'json'
                                        })}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                                    >
                                        <option value="parquet">Parquet (Recommended for Analytics)</option>
                                        <option value="csv">CSV (Human Readable)</option>
                                        <option value="json">JSON (Structured Data)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Search Engines
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['google', 'bing', 'perplexity', 'brave'].map(engine => (
                                            <label key={engine} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={exportOptions.engines.includes(engine)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setExportOptions({
                                                                ...exportOptions,
                                                                engines: [...exportOptions.engines, engine]
                                                            });
                                                        } else {
                                                            setExportOptions({
                                                                ...exportOptions,
                                                                engines: exportOptions.engines.filter(e => e !== engine)
                                                            });
                                                        }
                                                    }}
                                                    className="mr-2"
                                                />
                                                {engine.charAt(0).toUpperCase() + engine.slice(1)}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date Range (Optional)
                                    </label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            type="date"
                                            placeholder="Start Date"
                                            value={exportOptions.dateRange?.start || ''}
                                            onChange={(e) => setExportOptions({
                                                ...exportOptions,
                                                dateRange: {
                                                    start: e.target.value,
                                                    end: exportOptions.dateRange?.end || ''
                                                }
                                            })}
                                            className="border border-gray-300 rounded-md px-3 py-2"
                                        />
                                        <input
                                            type="date"
                                            placeholder="End Date"
                                            value={exportOptions.dateRange?.end || ''}
                                            onChange={(e) => setExportOptions({
                                                ...exportOptions,
                                                dateRange: {
                                                    start: exportOptions.dateRange?.start || '',
                                                    end: e.target.value
                                                }
                                            })}
                                            className="border border-gray-300 rounded-md px-3 py-2"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.includeAnnotations}
                                            onChange={(e) => setExportOptions({
                                                ...exportOptions,
                                                includeAnnotations: e.target.checked
                                            })}
                                            className="mr-2"
                                        />
                                        Include LLM Annotations
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={exportOptions.includeRawData}
                                            onChange={(e) => setExportOptions({
                                                ...exportOptions,
                                                includeRawData: e.target.checked
                                            })}
                                            className="mr-2"
                                        />
                                        Include Raw HTML Data
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Custom Version (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g., 2025.01.15.custom"
                                        value={exportOptions.version || ''}
                                        onChange={(e) => setExportOptions({
                                            ...exportOptions,
                                            version: e.target.value
                                        })}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-4 mt-6">
                                <button
                                    onClick={() => setShowExportForm(false)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                    disabled={exporting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExport}
                                    disabled={exporting || exportOptions.engines.length === 0}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {exporting ? 'Exporting...' : 'Create Export'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Versions List */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-900">Dataset Versions</h2>
                    </div>
                    
                    {versions.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            No dataset versions found. Create your first export to get started.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {versions.map((version) => (
                                <div key={version.version} className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                                Version {version.version}
                                            </h3>
                                            <p className="text-gray-600 mb-3">{version.description}</p>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="font-medium text-gray-700">Created:</span>
                                                    <br />
                                                    {formatDate(version.createdAt)}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">Records:</span>
                                                    <br />
                                                    {version.recordCount.toLocaleString()}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">Date Range:</span>
                                                    <br />
                                                    {new Date(version.statistics.dateRange.start).toLocaleDateString()} - {new Date(version.statistics.dateRange.end).toLocaleDateString()}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-700">Engines:</span>
                                                    <br />
                                                    {Object.keys(version.statistics.engineDistribution).join(', ')}
                                                </div>
                                            </div>

                                            <div className="mt-4 text-xs text-gray-500">
                                                <span className="font-medium">Hash:</span> {version.dataHash}
                                            </div>
                                        </div>
                                        
                                        <div className="ml-6 flex flex-col space-y-2">
                                            <button
                                                onClick={() => handleDownload(version.version, 'dataset')}
                                                className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
                                            >
                                                Download Dataset
                                            </button>
                                            <button
                                                onClick={() => handleDownload(version.version, 'metadata')}
                                                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                                            >
                                                Download Metadata
                                            </button>
                                            <button
                                                onClick={() => handleDownload(version.version, 'readme')}
                                                className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 transition-colors"
                                            >
                                                Download README
                                            </button>
                                            <button
                                                onClick={() => setSelectedVersion(version)}
                                                className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 transition-colors"
                                            >
                                                View Details
                                            </button>
                                            <button
                                                onClick={() => handleDelete(version.version)}
                                                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Version Details Modal */}
                {selectedVersion && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold mb-4">Dataset Version {selectedVersion.version}</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">Statistics</h3>
                                    <div className="space-y-2 text-sm">
                                        <div><span className="font-medium">Total Queries:</span> {selectedVersion.statistics.totalQueries.toLocaleString()}</div>
                                        <div><span className="font-medium">Total Results:</span> {selectedVersion.statistics.totalResults.toLocaleString()}</div>
                                        <div><span className="font-medium">Total Annotations:</span> {selectedVersion.statistics.totalAnnotations.toLocaleString()}</div>
                                        <div><span className="font-medium">Date Range:</span> {selectedVersion.statistics.dateRange.start} to {selectedVersion.statistics.dateRange.end}</div>
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">Engine Distribution</h3>
                                    <div className="space-y-2 text-sm">
                                        {Object.entries(selectedVersion.statistics.engineDistribution).map(([engine, count]) => (
                                            <div key={engine}>
                                                <span className="font-medium">{engine}:</span> {count.toLocaleString()} results
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">Category Distribution</h3>
                                    <div className="space-y-2 text-sm">
                                        {Object.entries(selectedVersion.statistics.categoryDistribution).map(([category, count]) => (
                                            <div key={category}>
                                                <span className="font-medium">{category}:</span> {count.toLocaleString()} queries
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">File Information</h3>
                                    <div className="space-y-2 text-sm">
                                        <div><span className="font-medium">Created:</span> {formatDate(selectedVersion.createdAt)}</div>
                                        <div><span className="font-medium">Records:</span> {selectedVersion.recordCount.toLocaleString()}</div>
                                        <div><span className="font-medium">File Path:</span> {selectedVersion.filePath}</div>
                                        <div className="break-all"><span className="font-medium">Hash:</span> {selectedVersion.dataHash}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-6">
                                <button
                                    onClick={() => setSelectedVersion(null)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}