'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

interface UpdateEvent {
  id: string;
  type: 'collection' | 'annotation' | 'metrics' | 'error';
  message: string;
  timestamp: Date;
  data?: any;
}

interface RealTimeUpdatesProps {
  onDataUpdate?: () => void;
  showNotifications?: boolean;
}

export default function RealTimeUpdates({ 
  onDataUpdate, 
  showNotifications = true 
}: RealTimeUpdatesProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<UpdateEvent[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  // Polling-based updates (fallback for real-time)
  const pollForUpdates = useCallback(async () => {
    try {
      const response = await fetch('/api/updates/status');
      const result = await response.json();
      
      if (result.success && result.data) {
        const newUpdate = result.data.lastUpdate;
        const updateTime = new Date(newUpdate);
        
        if (!lastUpdate || updateTime > lastUpdate) {
          setLastUpdate(updateTime);
          
          // Add to recent updates
          const updateEvent: UpdateEvent = {
            id: `update-${Date.now()}`,
            type: result.data.type || 'metrics',
            message: result.data.message || 'Data updated',
            timestamp: updateTime,
            data: result.data,
          };
          
          setRecentUpdates(prev => [updateEvent, ...prev.slice(0, 9)]); // Keep last 10
          
          // Trigger callback for parent components
          if (onDataUpdate) {
            onDataUpdate();
          }
        }
      }
    } catch (error) {
      console.error('Error polling for updates:', error);
    }
  }, [lastUpdate, onDataUpdate]);

  // Set up polling
  useEffect(() => {
    if (isPolling) {
      const interval = setInterval(pollForUpdates, 30000); // Poll every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isPolling, pollForUpdates]);

  // Initialize
  useEffect(() => {
    setIsPolling(true);
    pollForUpdates(); // Initial poll
    
    return () => setIsPolling(false);
  }, [pollForUpdates]);

  // Simulate connection status
  useEffect(() => {
    setIsConnected(true);
  }, []);

  const getUpdateIcon = (type: UpdateEvent['type']) => {
    switch (type) {
      case 'collection': return '📊';
      case 'annotation': return '🤖';
      case 'metrics': return '📈';
      case 'error': return '⚠️';
      default: return '📋';
    }
  };

  const getUpdateColor = (type: UpdateEvent['type']) => {
    switch (type) {
      case 'collection': return 'text-blue-600';
      case 'annotation': return 'text-purple-600';
      case 'metrics': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (!showNotifications) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-500">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span>{isConnected ? 'Live' : 'Offline'}</span>
        {lastUpdate && (
          <span>• Updated {format(lastUpdate, 'HH:mm')}</span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Real-time Updates</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Updates List */}
      <div className="max-h-64 overflow-y-auto">
        {recentUpdates.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {recentUpdates.map((update) => (
              <div key={update.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-start space-x-3">
                  <span className="text-lg">{getUpdateIcon(update.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{update.message}</p>
                    <p className={`text-xs ${getUpdateColor(update.type)}`}>
                      {format(update.timestamp, 'MMM dd, HH:mm:ss')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No recent updates</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Auto-refresh every 30s</span>
          {lastUpdate && (
            <span>Last update: {format(lastUpdate, 'HH:mm:ss')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for using real-time updates in components
export function useRealTimeUpdates(callback?: () => void) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const pollForUpdates = useCallback(async () => {
    try {
      const response = await fetch('/api/updates/status');
      const result = await response.json();
      
      if (result.success && result.data) {
        const updateTime = new Date(result.data.lastUpdate);
        
        if (!lastUpdate || updateTime > lastUpdate) {
          setLastUpdate(updateTime);
          if (callback) {
            callback();
          }
        }
      }
      setIsConnected(true);
    } catch (error) {
      console.error('Error polling for updates:', error);
      setIsConnected(false);
    }
  }, [lastUpdate, callback]);

  useEffect(() => {
    // Initial poll
    pollForUpdates();
    
    // Set up polling interval
    const interval = setInterval(pollForUpdates, 30000);
    
    return () => clearInterval(interval);
  }, [pollForUpdates]);

  return {
    lastUpdate,
    isConnected,
    refresh: pollForUpdates,
  };
}