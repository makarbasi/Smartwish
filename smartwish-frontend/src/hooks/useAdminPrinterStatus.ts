'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

// =============================================================================
// Types
// =============================================================================

export interface PrinterInfo {
  id: string;
  name: string;
  printableType: string;
  status: 'online' | 'offline' | 'unknown';
  paperStatus: 'ok' | 'low' | 'empty' | 'unknown';
  inkBlack: number | null;
  inkCyan: number | null;
  inkMagenta: number | null;
  inkYellow: number | null;
  lastSeenAt: string | null;
  lastError: string | null;
}

export interface AlertInfo {
  id: string;
  alertType: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  createdAt: string;
}

export interface KioskPrinterStatus {
  kioskId: string;
  kioskName: string;
  storeId: string | null;
  printers: PrinterInfo[];
  alerts: AlertInfo[];
  alertCount: number;
  hasErrors: boolean;
}

interface UseAdminPrinterStatusOptions {
  /** Polling interval in milliseconds (default: 10000 = 10 seconds) */
  pollInterval?: number;
  /** Whether to enable SSE for real-time updates (default: true) */
  enableSSE?: boolean;
  /** Session token for authenticated requests */
  token?: string;
}

interface UseAdminPrinterStatusReturn {
  /** All kiosk printer statuses */
  kiosks: KioskPrinterStatus[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** When the data was last updated */
  lastUpdated: Date | null;
  /** Total number of active alerts across all kiosks */
  totalAlerts: number;
  /** Total number of critical/error alerts */
  criticalAlerts: number;
  /** Whether any kiosk has critical errors */
  hasCriticalErrors: boolean;
  /** Manually refresh the data */
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useAdminPrinterStatus(
  options: UseAdminPrinterStatusOptions = {}
): UseAdminPrinterStatusReturn {
  const {
    pollInterval = 10000, // Default 10 seconds
    enableSSE = true,
    token,
  } = options;

  const [kiosks, setKiosks] = useState<KioskPrinterStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstFetchRef = useRef(true);

  // Fetch all printer statuses
  const fetchStatuses = useCallback(async () => {
    // Only show loading on first fetch
    if (isFirstFetchRef.current) {
      setIsLoading(true);
    }

    try {
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/admin/kiosks/all-printer-statuses`, {
        headers,
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setKiosks(data);
          setLastUpdated(new Date());
          setError(null);
        }
      } else if (response.status === 401) {
        setError('Authentication required');
      } else {
        setError(`Failed to fetch: ${response.status}`);
      }
    } catch (err) {
      setError('Network error');
      console.error('[useAdminPrinterStatus] Fetch error:', err);
    } finally {
      if (isFirstFetchRef.current) {
        setIsLoading(false);
        isFirstFetchRef.current = false;
      }
    }
  }, [token]);

  // Set up polling
  useEffect(() => {
    // Initial fetch
    fetchStatuses();

    // Set up polling interval
    pollIntervalRef.current = setInterval(fetchStatuses, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchStatuses, pollInterval]);

  // Set up SSE for real-time updates
  useEffect(() => {
    if (!enableSSE || API_BASE.includes('localhost')) {
      return; // Skip SSE for local development
    }

    const connectSSE = () => {
      try {
        const eventSource = new EventSource(`${API_BASE}/admin/printer-status/stream`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'critical-alerts' && data.alerts?.length > 0) {
              // New critical alerts detected - refresh full data
              fetchStatuses();
            }
          } catch {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          eventSourceRef.current = null;
          // Reconnect after 30 seconds
          setTimeout(connectSSE, 30000);
        };
      } catch {
        console.warn('[useAdminPrinterStatus] SSE not available');
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enableSSE, fetchStatuses]);

  // Computed values
  const totalAlerts = kiosks.reduce((sum, k) => sum + k.alertCount, 0);
  const criticalAlerts = kiosks.reduce(
    (sum, k) => sum + k.alerts.filter(a => a.severity === 'critical' || a.severity === 'error').length,
    0
  );
  const hasCriticalErrors = kiosks.some(k => k.hasErrors);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchStatuses();
  }, [fetchStatuses]);

  return {
    kiosks,
    isLoading,
    error,
    lastUpdated,
    totalAlerts,
    criticalAlerts,
    hasCriticalErrors,
    refresh,
  };
}

export default useAdminPrinterStatus;
