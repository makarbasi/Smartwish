'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useKiosk } from './KioskContext';
import { cachedFetch, resetBackoff } from '@/utils/requestUtils';

// =============================================================================
// Types
// =============================================================================

export interface InkLevel {
  level: number; // Percentage 0-100
  state: 'ok' | 'low' | 'critical';
}

export interface PaperTray {
  level: number; // Percentage 0-100
  description: string;
  state: 'ok' | 'low' | 'empty';
}

export interface PrinterError {
  code: string;
  message: string;
  color?: string;
  tray?: string;
  level?: number;
}

export interface PrinterWarning {
  code: string;
  message: string;
  color?: string;
  tray?: string;
  level?: number;
}

export interface PrintQueueInfo {
  jobCount: number;
  jobs: Array<{
    id: number;
    status: string;
    name?: string;
  }>;
  hasErrors?: boolean;
}

export interface PrinterFlags {
  lowPaper: boolean;
  noPaper: boolean;
  doorOpen: boolean;
  jam: boolean;
  offline: boolean;
  service: boolean;
}

export interface PrinterStatus {
  timestamp: string;
  lastUpdated?: string;
  online: boolean;
  printerState: 'unknown' | 'idle' | 'printing' | 'warmup' | 'other';
  /** Human-readable display status like "IDLE", "PAUSED (Load Paper)", etc. */
  displayStatus?: string;
  /** Error flags parsed from SNMP with "fake door open" fix applied */
  flags?: PrinterFlags;
  printerIP?: string;
  printerName?: string;
  ink: Record<string, InkLevel>;
  paper: Record<string, PaperTray>;
  errors: PrinterError[];
  warnings: PrinterWarning[];
  /** Raw SNMP alerts (filtered to remove genuineHP messages) */
  alerts?: string[];
  printQueue: PrintQueueInfo;
}

interface PrinterStatusContextType {
  // Status
  status: PrinterStatus | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  
  // Computed states
  isOnline: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  hasCriticalErrors: boolean;
  
  // Categorized issues
  criticalErrors: PrinterError[];
  allErrors: PrinterError[];
  allWarnings: PrinterWarning[];
  
  // Actions
  refresh: () => Promise<void>;
  dismissAlert: (code: string) => void;
  
  // Dismissed alerts (persisted for this session)
  dismissedAlerts: Set<string>;
}

// =============================================================================
// Default Values
// =============================================================================

const defaultStatus: PrinterStatus = {
  timestamp: new Date().toISOString(),
  online: false,
  printerState: 'unknown',
  ink: {},
  paper: {},
  errors: [],
  warnings: [],
  printQueue: {
    jobCount: 0,
    jobs: [],
  },
};

// Critical error codes that should always be shown prominently
const CRITICAL_ERROR_CODES = [
  'no_paper',
  'paper_jam',
  'no_ink',
  'ink_critical',
  'door_open',
  'offline',
  'device_down',
  'paper_empty',
  'tray_empty',
];

// =============================================================================
// Context
// =============================================================================

const PrinterStatusContext = createContext<PrinterStatusContextType | undefined>(
  undefined
);

export const usePrinterStatus = () => {
  const context = useContext(PrinterStatusContext);
  if (!context) {
    throw new Error('usePrinterStatus must be used within a PrinterStatusProvider');
  }
  return context;
};

// Safe version for components that may render outside the provider
export const usePrinterStatusSafe = () => {
  return useContext(PrinterStatusContext) ?? null;
};

// =============================================================================
// Provider
// =============================================================================

// Increased from 10s to 30s to reduce rate limit issues
// Printer status doesn't change frequently enough to justify 10s polling
const POLL_INTERVAL = 30000; // Poll every 30 seconds (was 10s - too aggressive)
const STORAGE_KEY = 'smartwish_dismissed_printer_alerts';

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';
}

export const PrinterStatusProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { kioskInfo, isActivated } = useKiosk();
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedKioskIdRef = useRef<string | null>(null);

  // Load dismissed alerts from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          setDismissedAlerts(new Set(JSON.parse(stored)));
        }
      } catch {
        // Ignore errors
      }
    }
  }, []);

  // Fetch printer status from backend with caching and deduplication
  const fetchStatus = useCallback(async () => {
    if (!kioskInfo?.id) return;

    // Only show loading on first fetch for this kiosk
    const isFirstFetch = fetchedKioskIdRef.current !== kioskInfo.id;
    if (isFirstFetch) {
      setIsLoading(true);
      fetchedKioskIdRef.current = kioskInfo.id;
    }

    const url = `${getApiBase()}/kiosk/printer-status/${kioskInfo.id}`;
    const cacheKey = `printer-status:${kioskInfo.id}`;

    try {
      // Use cached fetch with 20-second TTL (shorter than poll interval to allow manual refresh)
      const data = await cachedFetch(
        cacheKey,
        async () => {
          const response = await fetch(url);
          if (!response.ok) {
            if (response.status === 429) {
              console.warn('[PrinterStatus] Rate limited, will retry later');
              return null;
            }
            throw new Error(`HTTP ${response.status}`);
          }
          return response.json();
        },
        20000 // 20 second cache TTL
      );

      if (data?.status) {
        setStatus({
          ...defaultStatus,
          ...data.status,
        });
        setLastUpdated(new Date());
        resetBackoff(cacheKey);
      } else if (data === null) {
        // Rate limited or error - keep existing status
        console.log('[PrinterStatus] Using cached status due to rate limit');
      } else {
        // No status yet - printer agent may not have reported
        setStatus(null);
      }
    } catch (error) {
      console.error('[PrinterStatus] Failed to fetch status:', error);
    } finally {
      if (isFirstFetch) {
        setIsLoading(false);
      }
    }
  }, [kioskInfo?.id]); // Removed 'status' from dependencies to prevent infinite loop

  // Start/stop polling based on kiosk activation
  useEffect(() => {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Start polling if kiosk is activated
    if (isActivated && kioskInfo?.id) {
      // Initial fetch
      fetchStatus();

      // Start polling
      pollIntervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isActivated, kioskInfo?.id, fetchStatus]);

  // Dismiss an alert for this session
  const dismissAlert = useCallback((code: string) => {
    setDismissedAlerts((prev) => {
      const updated = new Set(prev);
      updated.add(code);
      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...updated]));
        } catch {
          // Ignore errors
        }
      }
      return updated;
    });
  }, []);

  // Refresh status manually
  const refresh = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  // Computed values
  const isOnline = status?.online ?? false;
  
  const allErrors = status?.errors ?? [];
  const allWarnings = status?.warnings ?? [];
  
  const hasErrors = allErrors.length > 0;
  const hasWarnings = allWarnings.length > 0;
  
  const criticalErrors = allErrors.filter((e) =>
    CRITICAL_ERROR_CODES.includes(e.code)
  );
  const hasCriticalErrors = criticalErrors.length > 0 || !isOnline;

  return (
    <PrinterStatusContext.Provider
      value={{
        status,
        isLoading,
        lastUpdated,
        isOnline,
        hasErrors,
        hasWarnings,
        hasCriticalErrors,
        criticalErrors,
        allErrors,
        allWarnings,
        refresh,
        dismissAlert,
        dismissedAlerts,
      }}
    >
      {children}
    </PrinterStatusContext.Provider>
  );
};

export default PrinterStatusProvider;
