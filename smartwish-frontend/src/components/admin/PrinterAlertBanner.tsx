"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExclamationTriangleIcon, XMarkIcon } from "@heroicons/react/24/outline";

type KioskAlert = {
  id: string;
  kioskId: string;
  alertType: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  createdAt: string;
  kiosk?: { kioskId: string; name?: string };
  printer?: { name: string } | null;
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

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch("/api/admin/alerts");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setAlerts(data.filter((a: KioskAlert) => !a.resolvedAt));
          }
        }
        // Silently fail for 500 errors - tables may not exist yet
      } catch (error) {
        // Tables may not exist yet, don't show error
        console.warn("Could not fetch alerts - migration may not be run yet");
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    // Refresh every 60 seconds
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className={`${bgColor} border-b px-4 py-3`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className={`h-5 w-5 ${iconColor} mt-0.5`} />
            <div>
              <h3 className={`font-semibold ${textColor}`}>
                {counts.total} Printer Alert{counts.total !== 1 ? "s" : ""}
                {counts.critical > 0 && (
                  <span className="ml-2 text-xs font-normal bg-red-600 text-white px-1.5 py-0.5 rounded">
                    {counts.critical} Critical
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
                        {alert.kiosk?.name || alert.kiosk?.kioskId || "Kiosk"}
                      </span>
                      {alert.printer && ` - ${alert.printer.name}`}: {alert.message}
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
