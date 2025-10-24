// Export progress management utilities

// In-memory storage for export progress (in production, use Redis or database)
const exportProgress = new Map<string, {
    status: 'preparing' | 'processing' | 'completed' | 'failed';
    progress: number;
    totalRecords?: number;
    processedRecords?: number;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    downloadUrl?: string;
}>();

// Helper function to create a new export progress entry
export function createExportProgress(exportId: string) {
    const progress = {
        status: 'preparing' as const,
        progress: 0,
        startedAt: new Date(),
    };

    exportProgress.set(exportId, progress);
    return progress;
}

// Helper function to update export progress
export function updateExportProgress(
    exportId: string,
    updates: Partial<{
        status: 'preparing' | 'processing' | 'completed' | 'failed';
        progress: number;
        totalRecords: number;
        processedRecords: number;
        error: string;
        downloadUrl: string;
    }>
) {
    const existing = exportProgress.get(exportId);
    if (!existing) return null;

    const updated = {
        ...existing,
        ...updates,
        completedAt: (updates.status === 'completed' || updates.status === 'failed') ? new Date() : existing.completedAt,
    };

    exportProgress.set(exportId, updated);
    return updated;
}

// Helper function to get export progress
export function getExportProgress(exportId: string) {
    return exportProgress.get(exportId);
}

// Helper function to get all export progress entries
export function getAllExportProgress() {
    return exportProgress;
}

// Helper function to clean up old exports
export function cleanupOldExports() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const entriesToDelete: string[] = [];

    exportProgress.forEach((prog, id) => {
        if (prog.startedAt < oneHourAgo && (prog.status === 'completed' || prog.status === 'failed')) {
            entriesToDelete.push(id);
        }
    });

    entriesToDelete.forEach(id => exportProgress.delete(id));
}