'use client';

import { useState } from 'react';
import { format, subDays } from 'date-fns';

export default function ExportPage() {
  const [exportConfig, setExportConfig] = useState({
    format: 'csv' as 'csv' | 'json',
    dateRange: {
      start: subDays(new Date(), 30),
      end: new Date(),
    },
    engines: ['google', 'bing', 'perplexity', 'brave'],
    categories: [] as string[],
    includeAnnotations: true,
    includeRawData: false,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{
    exportId?: string;
    status?: string;
    progress?: number;
    totalRecords?: number;
    processedRecords?: number;
    downloadUrl?: string;
  } | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus('Preparing export...');
      setExportProgress(null);

      // Estimate if this will be a large export (>10k estimated rows)
      const estimatedRows = exportConfig.engines.length * 20 * 
        Math.ceil((exportConfig.dateRange.end.getTime() - exportConfig.dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
      
      const isLargeExport = estimatedRows > 10000;

      if (isLargeExport) {
        // Use async export for large datasets
        const response = await fetch('/api/export/async', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(exportConfig),
        });

        if (!response.ok) {
          throw new Error('Failed to start export');
        }

        const result = await response.json();
        const exportId = result.data.exportId;

        setExportProgress({ exportId, status: 'preparing', progress: 0 });
        setExportStatus('Large dataset detected. Starting background export...');

        // Poll for progress
        const pollProgress = async () => {
          try {
            const progressResponse = await fetch(`/api/export/progress?id=${exportId}`);
            if (progressResponse.ok) {
              const progressResult = await progressResponse.json();
              const progressData = progressResult.data;
              
              setExportProgress(progressData);
              
              if (progressData.status === 'completed') {
                setExportStatus('Export completed! Download ready.');
                setIsExporting(false);
              } else if (progressData.status === 'failed') {
                setExportStatus(`Export failed: ${progressData.error || 'Unknown error'}`);
                setIsExporting(false);
              } else {
                // Continue polling
                setTimeout(pollProgress, 2000);
              }
            }
          } catch (error) {
            console.error('Error polling progress:', error);
            setTimeout(pollProgress, 5000); // Retry after 5 seconds
          }
        };

        // Start polling after a short delay
        setTimeout(pollProgress, 1000);

      } else {
        // Use direct export for smaller datasets
        const params = new URLSearchParams({
          format: exportConfig.format,
          start: exportConfig.dateRange.start.toISOString(),
          end: exportConfig.dateRange.end.toISOString(),
          engines: exportConfig.engines.join(','),
          includeAnnotations: exportConfig.includeAnnotations.toString(),
          includeRawData: exportConfig.includeRawData.toString(),
        });

        if (exportConfig.categories.length > 0) {
          params.append('categories', exportConfig.categories.join(','));
        }

        setExportStatus('Generating file...');
        
        const response = await fetch(`/api/export?${params}`);
        
        if (!response.ok) {
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `truthlayer-export-${format(new Date(), 'yyyy-MM-dd')}.${exportConfig.format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setExportStatus('Export completed successfully!');
        setTimeout(() => {
          setExportStatus(null);
          setIsExporting(false);
        }, 3000);
      }

    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('Export failed. Please try again.');
      setTimeout(() => {
        setExportStatus(null);
        setIsExporting(false);
      }, 3000);
    }
  };

  const handleDownload = async () => {
    if (exportProgress?.downloadUrl) {
      try {
        const response = await fetch(exportProgress.downloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `truthlayer-export-${format(new Date(), 'yyyy-MM-dd')}.${exportConfig.format}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } catch (error) {
        console.error('Download error:', error);
        setExportStatus('Download failed. Please try again.');
      }
    }
  };

  const estimatedRows = exportConfig.engines.length * 20 * 30; // Rough estimate

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Export Data</h2>
        <p className="mt-2 text-gray-600">
          Download search results, annotations, and bias metrics for analysis
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Configuration */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Configuration</h3>
            
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="format"
                      value="csv"
                      checked={exportConfig.format === 'csv'}
                      onChange={(e) => setExportConfig({...exportConfig, format: e.target.value as 'csv'})}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">CSV</div>
                      <div className="text-sm text-gray-500">Comma-separated values</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="format"
                      value="json"
                      checked={exportConfig.format === 'json'}
                      onChange={(e) => setExportConfig({...exportConfig, format: e.target.value as 'json'})}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">JSON</div>
                      <div className="text-sm text-gray-500">JavaScript Object Notation</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={format(exportConfig.dateRange.start, 'yyyy-MM-dd')}
                      onChange={(e) => setExportConfig({
                        ...exportConfig,
                        dateRange: {
                          ...exportConfig.dateRange,
                          start: new Date(e.target.value)
                        }
                      })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Date</label>
                    <input
                      type="date"
                      value={format(exportConfig.dateRange.end, 'yyyy-MM-dd')}
                      onChange={(e) => setExportConfig({
                        ...exportConfig,
                        dateRange: {
                          ...exportConfig.dateRange,
                          end: new Date(e.target.value)
                        }
                      })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Engine Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Engines
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['google', 'bing', 'perplexity', 'brave'].map(engine => (
                    <label key={engine} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportConfig.engines.includes(engine)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportConfig({
                              ...exportConfig,
                              engines: [...exportConfig.engines, engine]
                            });
                          } else {
                            setExportConfig({
                              ...exportConfig,
                              engines: exportConfig.engines.filter(e => e !== engine)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{engine}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['health', 'politics', 'technology', 'science'].map(category => (
                    <label key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportConfig.categories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setExportConfig({
                              ...exportConfig,
                              categories: [...exportConfig.categories, category]
                            });
                          } else {
                            setExportConfig({
                              ...exportConfig,
                              categories: exportConfig.categories.filter(c => c !== category)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{category}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to include all categories
                </p>
              </div>

              {/* Additional Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Data
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportConfig.includeAnnotations}
                      onChange={(e) => setExportConfig({
                        ...exportConfig,
                        includeAnnotations: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Include LLM annotations</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={exportConfig.includeRawData}
                      onChange={(e) => setExportConfig({
                        ...exportConfig,
                        includeRawData: e.target.checked
                      })}
                      className="mr-2"
                    />
                    <span className="text-sm">Include raw HTML snapshots</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Export Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Summary</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Format:</span>
                <span className="font-medium uppercase">{exportConfig.format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date Range:</span>
                <span className="font-medium">
                  {Math.ceil((exportConfig.dateRange.end.getTime() - exportConfig.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Engines:</span>
                <span className="font-medium">{exportConfig.engines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Categories:</span>
                <span className="font-medium">
                  {exportConfig.categories.length === 0 ? 'All' : exportConfig.categories.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Est. Rows:</span>
                <span className="font-medium">{estimatedRows.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleExport}
                disabled={isExporting || exportConfig.engines.length === 0}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-md font-medium hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isExporting ? 'Exporting...' : 'Export Data'}
              </button>
            </div>

            {exportStatus && (
              <div className={`mt-4 p-3 rounded-md text-sm ${
                exportStatus.includes('failed') 
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : exportStatus.includes('completed')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                {exportStatus}
              </div>
            )}

            {exportProgress && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Export Progress</span>
                  <span className="text-sm text-gray-500">
                    {exportProgress.status === 'completed' ? 'Completed' : 
                     exportProgress.status === 'failed' ? 'Failed' :
                     exportProgress.status === 'processing' ? 'Processing' : 'Preparing'}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      exportProgress.status === 'completed' ? 'bg-green-500' :
                      exportProgress.status === 'failed' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${exportProgress.progress || 0}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{exportProgress.progress || 0}%</span>
                  {exportProgress.totalRecords && (
                    <span>
                      {exportProgress.processedRecords || 0} / {exportProgress.totalRecords} records
                    </span>
                  )}
                </div>

                {exportProgress.status === 'completed' && exportProgress.downloadUrl && (
                  <button
                    onClick={handleDownload}
                    className="mt-3 w-full bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700"
                  >
                    Download Export
                  </button>
                )}

                {exportProgress.exportId && (
                  <div className="mt-2 text-xs text-gray-400">
                    Export ID: {exportProgress.exportId}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export Guidelines */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Guidelines</h3>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900">Data Usage</h4>
                <p>Exported data is provided for research and analysis purposes. Please cite TruthLayer when using this data in publications.</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900">File Size</h4>
                <p>Large exports may take several minutes to generate. Files over 100MB will be compressed automatically.</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900">Data Freshness</h4>
                <p>Exported data reflects the most recent collection cycle. Metrics are updated daily.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}