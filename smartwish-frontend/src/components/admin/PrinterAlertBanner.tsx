"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ExclamationTriangleIcon, XMarkIcon, BellAlertIcon } from "@heroicons/react/24/outline";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

type KioskAlert = {
  id: string;
  kioskId: string;
  alertType: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  createdAt: string;
  kiosk?: { kioskId: string; name?: string };
  printer?: { name: string } | null;
  kioskName?: string;
  printerName?: string;
};

type AlertCounts = {
  critical: number;
  error: number;
  warning: number;
  total: number;
};

export function PrinterAlertBanner() {
  const [alerts, setAlerts] = useState<KioskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newAlertFlash, setNewAlertFlash] = useState(false);
  const lastAlertIdsRef = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  // Track consecutive failures for backoff
  const failureCountRef = useRef(0);
  const backoffDelayRef = useRef(30000); // Start with 30s, increase on failures
  
  // Fetch alerts via REST API (primary method)
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/alerts", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      
      if (response.status === 429) {
        // Rate limited - increase backoff and skip
        failureCountRef.current++;
        backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 300000); // Max 5 min
        console.warn(`[PrinterAlertBanner] Rate limited, backing off to ${backoffDelayRef.current/1000}s`);
        return;
      }
      
      if (response.ok) {
        // Reset backoff on success
        failureCountRef.current = 0;
        backoffDelayRef.current = 30000;
        
        const data = await response.json();
        if (Array.isArray(data)) {
          const activeAlerts = data.filter((a: KioskAlert) => !a.resolvedAt);
          
          // Check for new alerts
          const currentIds = new Set(activeAlerts.map((a: KioskAlert) => a.id));
          const hasNewAlerts = activeAlerts.some(
            (a: KioskAlert) => !lastAlertIdsRef.current.has(a.id)
          );
          
          if (hasNewAlerts && lastAlertIdsRef.current.size > 0) {
            // Flash the banner for new alerts
            setNewAlertFlash(true);
            setTimeout(() => setNewAlertFlash(false), 2000);
            // Auto-expand if we were dismissed
            if (dismissed) {
              setDismissed(false);
            }
          }
          
          lastAlertIdsRef.current = currentIds;
          setAlerts(activeAlerts);
        }
      }
    } catch (error) {
      console.warn("Could not fetch alerts");
    } finally {
      setLoading(false);
    }
  }, [dismissed]);

  // Polling effect - 60 seconds (increased from 30s to reduce rate limit issues)
  // SSE provides real-time updates for critical alerts, polling is just a fallback
  useEffect(() => {
    fetchAlerts();
    // Use dynamic interval based on backoff state
    const intervalId = setInterval(() => {
      fetchAlerts();
    }, 60000); // 60 seconds baseline
    
    return () => clearInterval(intervalId);
  }, [fetchAlerts]);

  // SSE reconnection backoff state
  const sseReconnectDelayRef = useRef(30000); // Start with 30s
  const sseReconnectAttemptsRef = useRef(0);
  const maxSseReconnectAttempts = 5; // Stop trying after 5 failures
  
  // SSE for real-time critical alerts (backup/supplement to polling)
  // OPTIMIZATION: Disabled by default since polling already handles alerts
  // SSE was causing repeated 429 errors due to reconnection loops
  useEffect(() => {
    // DISABLED: SSE causes too many connection attempts when rate limited
    // Polling every 60s is sufficient for admin alerts
    // Uncomment below to re-enable SSE when rate limits are resolved
    return;
    
    /*
    // Only connect SSE if we have a valid API_BASE
    if (!API_BASE || API_BASE.includes('localhost')) {
      return; // Skip SSE for local development
    }

    const connectSSE = () => {
      // Stop trying after too many failures
      if (sseReconnectAttemptsRef.current >= maxSseReconnectAttempts) {
        console.warn('[PrinterAlertBanner] SSE disabled after too many failures, using polling only');
        return;
      }
      
      try {
        // Connect to the SSE endpoint
        const eventSource = new EventSource(`${API_BASE}/admin/printer-status/stream`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          // Reset backoff on successful message
          sseReconnectDelayRef.current = 30000;
          sseReconnectAttemptsRef.current = 0;
          
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'critical-alerts' && Array.isArray(data.alerts)) {
              // Check if there are new critical alerts
              const criticalAlerts = data.alerts;
              const hasNewCritical = criticalAlerts.some(
                (a: KioskAlert) => !lastAlertIdsRef.current.has(a.id)
              );
              
              if (hasNewCritical && criticalAlerts.length > 0) {
                // Trigger a fetch to get full alert data
                fetchAlerts();
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        eventSource.onerror = () => {
          // Exponential backoff on error
          sseReconnectAttemptsRef.current++;
          const delay = sseReconnectDelayRef.current;
          sseReconnectDelayRef.current = Math.min(delay * 2, 300000); // Max 5 minutes
          
          console.warn(`[PrinterAlertBanner] SSE error, reconnecting in ${delay/1000}s (attempt ${sseReconnectAttemptsRef.current})`);
          eventSource.close();
          setTimeout(connectSSE, delay);
        };
      } catch (e) {
        // SSE not supported or connection failed
        console.warn("SSE connection failed, using polling only");
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    */
  }, [fetchAlerts]);

  if (loading || dismissed || alerts.length === 0) {
    return null;
  }

  const counts: AlertCounts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    error: alerts.filter((a) => a.severity === "error").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    total: alerts.length,
  };

  const hasErrors = counts.critical > 0 || counts.error > 0;
  const bgColor = hasErrors
    ? "bg-red-50 border-red-200"
    : "bg-yellow-50 border-yellow-200";
  const textColor = hasErrors ? "text-red-800" : "text-yellow-800";
  const iconColor = hasErrors ? "text-red-600" : "text-yellow-600";

  const displayAlerts = expanded ? alerts : alerts.slice(0, 3);

  // Flash animation classes
  const flashClass = newAlertFlash 
    ? "animate-pulse ring-2 ring-red-500 ring-offset-2" 
    : "";

  return (
    <div className={`${bgColor} border-b px-4 py-3 transition-all duration-300 ${flashClass}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {newAlertFlash ? (
              <BellAlertIcon className={`h-5 w-5 ${iconColor} mt-0.5 animate-bounce`} />
            ) : (
              <ExclamationTriangleIcon className={`h-5 w-5 ${iconColor} mt-0.5`} />
            )}
            <div>
              <h3 className={`font-semibold ${textColor}`}>
                {counts.total} Printer Alert{counts.total !== 1 ? "s" : ""}
                {counts.critical > 0 && (
                  <span className="ml-2 text-xs font-normal bg-red-600 text-white px-1.5 py-0.5 rounded animate-pulse">
                    {counts.critical} Critical
                  </span>
                )}
                {newAlertFlash && (
                  <span className="ml-2 text-xs font-normal bg-orange-500 text-white px-1.5 py-0.5 rounded">
                    NEW
                  </span>
                )}
              </h3>
              <ul className="mt-1 space-y-0.5">
                {displayAlerts.map((alert) => (
                  <li key={alert.id} className={`text-sm ${textColor}`}>
                    <Link
                      href={`/admin/kiosks/${alert.kiosk?.kioskId || alert.kioskId}`}
                      className="hover:underline"
                    >
                      <span className="font-medium">
                        {alert.kioskName || alert.kiosk?.name || alert.kiosk?.kioskId || "Kiosk"}
                      </span>
                      {(alert.printerName || alert.printer?.name) && ` - ${alert.printerName || alert.printer?.name}`}: {alert.message}
                    </Link>
                  </li>
                ))}
              </ul>
              {alerts.length > 3 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className={`mt-1 text-sm font-medium ${textColor} hover:underline`}
                >
                  {expanded ? "Show less" : `+ ${alerts.length - 3} more...`}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className={`${textColor} hover:opacity-70`}
            title="Dismiss for now"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PrinterAlertBanner;
