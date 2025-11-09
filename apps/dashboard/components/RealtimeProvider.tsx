"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

interface MetricsUpdateEvent {
  type: "metricsUpdated" | "runStatus" | "heartbeat" | "connected";
  data?: unknown;
  timestamp: string;
}

interface RealtimeContextValue {
  connected: boolean;
  lastUpdate: Date | null;
  lastEvent: MetricsUpdateEvent | null;
  error: string | null;
  subscribe: (callback: (event: MetricsUpdateEvent) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtimeMetrics() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtimeMetrics must be used within RealtimeProvider");
  }
  return context;
}

interface RealtimeProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  fallbackToPolling?: boolean;
  pollingIntervalMs?: number;
}

export function RealtimeProvider({
  children,
  enabled = true,
  fallbackToPolling = true,
  pollingIntervalMs = 60000
}: RealtimeProviderProps) {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastEvent, setLastEvent] = useState<MetricsUpdateEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<Set<(event: MetricsUpdateEvent) => void>>(
    new Set()
  );

  const subscribe = useCallback((callback: (event: MetricsUpdateEvent) => void) => {
    setSubscribers((prev) => new Set([...prev, callback]));
    
    return () => {
      setSubscribers((prev) => {
        const next = new Set(prev);
        next.delete(callback);
        return next;
      });
    };
  }, []);

  const notifySubscribers = useCallback((event: MetricsUpdateEvent) => {
    subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.error("Error in metrics subscriber:", err);
      }
    });
  }, [subscribers]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      try {
        eventSource = new EventSource("/api/metrics/stream");

        eventSource.onopen = () => {
          if (mounted) {
            setConnected(true);
            setError(null);
            console.log("✅ SSE connection established");
          }
        };

        eventSource.onmessage = (event) => {
          if (!mounted) return;

          try {
            const parsed = JSON.parse(event.data) as MetricsUpdateEvent;
            setLastUpdate(new Date());
            setLastEvent(parsed);
            notifySubscribers(parsed);
          } catch (err) {
            console.error("Failed to parse SSE message:", err);
          }
        };

        eventSource.onerror = (err) => {
          console.error("SSE error:", err);
          
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          if (mounted) {
            setConnected(false);
            setError("Connection lost. Attempting to reconnect...");

            if (fallbackToPolling && !pollingInterval) {
              console.log("⚠️  Falling back to polling");
              pollingInterval = setInterval(() => {
                const event: MetricsUpdateEvent = {
                  type: "metricsUpdated",
                  timestamp: new Date().toISOString()
                };
                setLastUpdate(new Date());
                setLastEvent(event);
                notifySubscribers(event);
              }, pollingIntervalMs);
            }

            reconnectTimeout = setTimeout(() => {
              if (mounted) {
                console.log("Attempting to reconnect...");
                connect();
              }
            }, 5000);
          }
        };
      } catch (err) {
        console.error("Failed to create EventSource:", err);
        if (mounted) {
          setError("Failed to connect to realtime updates");
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      
      if (eventSource) {
        eventSource.close();
      }
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [enabled, fallbackToPolling, pollingIntervalMs, notifySubscribers]);

  const value: RealtimeContextValue = {
    connected,
    lastUpdate,
    lastEvent,
    error,
    subscribe
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
