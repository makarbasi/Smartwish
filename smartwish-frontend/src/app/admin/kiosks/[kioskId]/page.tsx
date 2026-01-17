"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ComputerDesktopIcon,
  PrinterIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

// Types
type KioskPrinter = {
  id: string;
  name: string;
  printerName: string;
  ipAddress: string | null;
  printableType: "sticker" | "greeting-card";
  isEnabled: boolean;
  status: "online" | "offline" | "error" | "unknown";
  lastSeenAt: string | null;
  lastError: string | null;
  inkBlack: number | null;
  inkCyan: number | null;
  inkMagenta: number | null;
  inkYellow: number | null;
  paperStatus: string;
  paperTray1State: string | null;
  paperTray2State: string | null;
  fullStatus: Record<string, unknown>;
};

type Kiosk = {
  id: string;
  kioskId: string;
  storeId?: string;
  name?: string;
  apiKey?: string;
  config: Record<string, unknown>;
  version: string;
  isActive?: boolean;
  isOnline?: boolean;
  createdAt: string;
  updatedAt: string;
  printers?: KioskPrinter[];
};

type KioskAlert = {
  id: string;
  alertType: string;
  message: string;
  severity: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  printer?: { name: string } | null;
};

// Ink Level Bar Component
function InkLevelBar({
  color,
  level,
  label,
}: {
  color: string;
  level: number | null;
  label: string;
}) {
  const isLow = level !== null && level < 20;
  const isEmpty = level !== null && level === 0;
  const bgColor =
    color === "black"
      ? "#1a1a1a"
      : color === "cyan"
      ? "#00bcd4"
      : color === "magenta"
      ? "#e91e63"
      : "#ffeb3b";

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-sm text-gray-600">{label}</span>
      <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
        {level !== null && level >= 0 ? (
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${level}%`,
              backgroundColor: isEmpty || isLow ? "#ef4444" : bgColor,
            }}
          />
        ) : (
          <div className="h-full bg-gray-300 animate-pulse" />
        )}
      </div>
      <span
        className={`w-12 text-sm text-right ${
          isLow || isEmpty ? "text-red-500 font-medium" : "text-gray-600"
        }`}
      >
        {level !== null && level >= 0 ? `${level}%` : "?"}
      </span>
      {(isLow || isEmpty) && <span className="text-amber-500">⚠️</span>}
    </div>
  );
}

// Printer Card Component
function PrinterCard({
  printer,
  onEdit,
  onDelete,
}: {
  printer: KioskPrinter;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusColor =
    printer.status === "online"
      ? "bg-green-100 text-green-700"
      : printer.status === "offline"
      ? "bg-red-100 text-red-700"
      : printer.status === "error"
      ? "bg-red-100 text-red-700"
      : "bg-gray-100 text-gray-600";

  const statusDot =
    printer.status === "online"
      ? "bg-green-500"
      : printer.status === "offline"
      ? "bg-red-500"
      : printer.status === "error"
      ? "bg-red-500"
      : "bg-gray-400";

  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <PrinterIcon className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {printer.name}
            </h3>
            <p className="text-sm text-gray-500">
              {printer.printableType === "sticker"
                ? "🏷️ Stickers"
                : "💌 Greeting Cards"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusDot}`} />
            {printer.status === "online"
              ? "Online"
              : printer.status === "offline"
              ? "Offline"
              : printer.status === "error"
              ? "Error"
              : "Unknown"}
          </span>
        </div>
      </div>

      {/* Printer Details */}
      <div className="space-y-2 mb-4 text-sm text-gray-600">
        <p>
          <span className="text-gray-400">Windows Name:</span>{" "}
          {printer.printerName}
        </p>
        {printer.ipAddress && (
          <p>
            <span className="text-gray-400">IP:</span> {printer.ipAddress}
          </p>
        )}
        {printer.lastSeenAt && (
          <p>
            <span className="text-gray-400">Last Seen:</span>{" "}
            {new Date(printer.lastSeenAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Ink Levels */}
      {(printer.inkBlack !== null ||
        printer.inkCyan !== null ||
        printer.inkMagenta !== null ||
        printer.inkYellow !== null) && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Ink Levels</h4>
          <div className="space-y-2">
            <InkLevelBar color="black" level={printer.inkBlack} label="Black" />
            <InkLevelBar color="cyan" level={printer.inkCyan} label="Cyan" />
            <InkLevelBar
              color="magenta"
              level={printer.inkMagenta}
              label="Magenta"
            />
            <InkLevelBar
              color="yellow"
              level={printer.inkYellow}
              label="Yellow"
            />
          </div>
        </div>
      )}

      {/* Paper Status */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Paper Status</h4>
        <div className="flex flex-wrap gap-2">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              printer.paperStatus === "empty"
                ? "bg-red-100 text-red-800"
                : printer.paperStatus === "low"
                ? "bg-yellow-100 text-yellow-800"
                : printer.paperStatus === "ok"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {printer.paperStatus === "empty"
              ? "⚠️ Empty"
              : printer.paperStatus === "low"
              ? "⚠️ Low"
              : printer.paperStatus === "ok"
              ? "✓ OK"
              : "Unknown"}
          </span>
        </div>
      </div>

      {/* Error */}
      {printer.lastError && (
        <div className="mb-4 p-2 bg-red-50 rounded-lg">
          <p className="text-sm text-red-600">❌ {printer.lastError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// Add/Edit Printer Modal
function PrinterModal({
  isOpen,
  onClose,
  onSave,
  printer,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<KioskPrinter>) => void;
  printer: KioskPrinter | null;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [printableType, setPrintableType] = useState<"sticker" | "greeting-card">("greeting-card");
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (printer) {
      setName(printer.name);
      setPrinterName(printer.printerName);
      setIpAddress(printer.ipAddress || "");
      setPrintableType(printer.printableType);
      setIsEnabled(printer.isEnabled);
    } else {
      setName("");
      setPrinterName("");
      setIpAddress("");
      setPrintableType("greeting-card");
      setIsEnabled(true);
    }
  }, [printer, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div
          className="fixed inset-0 bg-black/30"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {printer ? "Edit Printer" : "Add Printer"}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., HP OfficeJet Pro 9130"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">Friendly name shown in portal</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Windows Printer Name *
              </label>
              <input
                type="text"
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                placeholder="e.g., HP OfficeJet Pro 9130 Series PCL-3 (V4)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">Exact name from Windows - used for printing</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IP Address (for monitoring)
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="e.g., 192.168.1.100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500">Optional - enables ink/paper level monitoring</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prints *
              </label>
              <select
                value={printableType}
                onChange={(e) => setPrintableType(e.target.value as "sticker" | "greeting-card")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="greeting-card">💌 Greeting Cards</option>
                <option value="sticker">🏷️ Stickers</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isEnabled"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="isEnabled" className="text-sm text-gray-700">
                This printer is enabled
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ name, printerName, ipAddress: ipAddress || undefined, printableType, isEnabled })}
              disabled={saving || !name || !printerName}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : printer ? "Save Changes" : "Add Printer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function KioskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kioskId = params.kioskId as string;

  const [loading, setLoading] = useState(true);
  const [kiosk, setKiosk] = useState<Kiosk | null>(null);
  const [printers, setPrinters] = useState<KioskPrinter[]>([]);
  const [alerts, setAlerts] = useState<KioskAlert[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);

  // Modal state
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<KioskPrinter | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchKiosk = useCallback(async () => {
    try {
      // Fetch kiosk details
      const kioskRes = await fetch(`/api/admin/kiosks`);
      if (!kioskRes.ok) throw new Error("Failed to fetch kiosks");
      const kiosksData = await kioskRes.json();
      const found = kiosksData.find((k: Kiosk) => k.kioskId === kioskId);
      if (!found) throw new Error("Kiosk not found");
      setKiosk(found);

      // Fetch printers
      const printersRes = await fetch(`/api/admin/kiosks/${kioskId}/printers`);
      if (printersRes.ok) {
        const printersData = await printersRes.json();
        setPrinters(printersData);
      }

      // Fetch alerts
      const alertsRes = await fetch(`/api/admin/kiosks/${kioskId}/alerts`);
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }
    } catch (error) {
      console.error("Error fetching kiosk:", error);
    } finally {
      setLoading(false);
    }
  }, [kioskId]);

  useEffect(() => {
    fetchKiosk();
    // Refresh every 30 seconds
    const interval = setInterval(fetchKiosk, 30000);
    return () => clearInterval(interval);
  }, [fetchKiosk]);

  const handleAddPrinter = () => {
    setEditingPrinter(null);
    setShowPrinterModal(true);
  };

  const handleEditPrinter = (printer: KioskPrinter) => {
    setEditingPrinter(printer);
    setShowPrinterModal(true);
  };

  const handleDeletePrinter = async (printer: KioskPrinter) => {
    if (!confirm(`Are you sure you want to delete "${printer.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/kiosks/${kioskId}/printers/${printer.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete printer");
      setPrinters(printers.filter((p) => p.id !== printer.id));
    } catch (error) {
      console.error("Error deleting printer:", error);
      alert("Failed to delete printer");
    }
  };

  const handleSavePrinter = async (data: Partial<KioskPrinter>) => {
    setSaving(true);
    try {
      if (editingPrinter) {
        // Update existing printer
        const res = await fetch(`/api/admin/kiosks/${kioskId}/printers/${editingPrinter.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update printer");
        const updated = await res.json();
        setPrinters(printers.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        // Add new printer
        const res = await fetch(`/api/admin/kiosks/${kioskId}/printers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to add printer");
        }
        const newPrinter = await res.json();
        setPrinters([...printers, newPrinter]);
      }
      setShowPrinterModal(false);
    } catch (error) {
      console.error("Error saving printer:", error);
      alert(error instanceof Error ? error.message : "Failed to save printer");
    } finally {
      setSaving(false);
    }
  };

  const copyApiKey = async () => {
    if (!kiosk?.apiKey) return;
    try {
      await navigator.clipboard.writeText(kiosk.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!kiosk) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-gray-900">Kiosk not found</h1>
        <Link href="/admin/kiosks" className="mt-4 text-indigo-600 hover:text-indigo-800">
          Back to Kiosks
        </Link>
      </div>
    );
  }

  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/kiosks"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <ComputerDesktopIcon className="h-7 w-7 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {kiosk.name || kiosk.kioskId}
                </h1>
                <p className="text-sm text-gray-500">
                  {kiosk.storeId || "No store assigned"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Alerts Banner */}
        {activeAlerts.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-red-800">
                {activeAlerts.length} Active Alert{activeAlerts.length > 1 ? "s" : ""}
              </h3>
            </div>
            <ul className="space-y-1">
              {activeAlerts.slice(0, 3).map((alert) => (
                <li key={alert.id} className="text-sm text-red-700">
                  • {alert.message}
                </li>
              ))}
              {activeAlerts.length > 3 && (
                <li className="text-sm text-red-600 font-medium">
                  + {activeAlerts.length - 3} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* General Info */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">General Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Name</p>
              <p className="font-medium text-gray-900">{kiosk.name || kiosk.kioskId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Store</p>
              <p className="font-medium text-gray-900">{kiosk.storeId || "Not assigned"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ID</p>
              <p className="font-mono text-sm text-gray-900">{kiosk.kioskId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  kiosk.isOnline
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    kiosk.isOnline ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {kiosk.isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 mb-1">API Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-800 truncate">
                  {kiosk.apiKey ? "••••••••••••••••" : "No key"}
                </code>
                <button
                  onClick={copyApiKey}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Copy API Key"
                >
                  {copiedKey ? (
                    <CheckIcon className="h-5 w-5 text-green-600" />
                  ) : (
                    <ClipboardDocumentIcon className="h-5 w-5 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Printers Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Printers</h2>
            <button
              onClick={handleAddPrinter}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <PlusIcon className="h-4 w-4" />
              Add Printer
            </button>
          </div>

          {printers.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-12 text-center">
              <PrinterIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No printers configured</h3>
              <p className="text-gray-500 mb-4">
                Add a printer to enable printing for this kiosk.
              </p>
              <button
                onClick={handleAddPrinter}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                <PlusIcon className="h-4 w-4" />
                Add First Printer
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {printers.map((printer) => (
                <PrinterCard
                  key={printer.id}
                  printer={printer}
                  onEdit={() => handleEditPrinter(printer)}
                  onDelete={() => handleDeletePrinter(printer)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href={`/admin/kiosks/${kioskId}/print-jobs`}
              className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <PrinterIcon className="h-8 w-8 text-indigo-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Print Jobs</span>
            </Link>
            <Link
              href={`/admin/kiosks/${kioskId}/sessions`}
              className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <ComputerDesktopIcon className="h-8 w-8 text-indigo-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Sessions</span>
            </Link>
            <Link
              href={`/admin/kiosks/${kioskId}/surveillance`}
              className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
            >
              <svg className="h-8 w-8 text-indigo-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">Surveillance</span>
            </Link>
            <Link
              href="/admin/kiosks"
              className="flex flex-col items-center p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeftIcon className="h-8 w-8 text-gray-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">Back to List</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Printer Modal */}
      <PrinterModal
        isOpen={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
        onSave={handleSavePrinter}
        printer={editingPrinter}
        saving={saving}
      />
    </div>
  );
}
