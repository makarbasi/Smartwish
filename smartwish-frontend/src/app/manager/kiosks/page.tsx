"use client";

import { useState, useEffect } from "react";
import {
  ComputerDesktopIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon,
  PrinterIcon,
  PlayIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

interface Kiosk {
  id: string;
  kioskId: string;
  name: string;
  location?: string;
  status?: string;
  isOnline?: boolean; // Device online (based on heartbeat)
  hasActiveSession?: boolean; // Active user session
  printerStatus?: string;
  lastPrintAt?: string;
  printCount?: number;
  lastHeartbeat?: string | null;
  createdAt: string;
}

export default function KiosksPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);

  useEffect(() => {
    loadKiosks();
  }, []);

  const loadKiosks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/manager/kiosks');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load kiosks");
      }
      
      const data = await response.json();
      setKiosks(data.kiosks || []);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching kiosks:", err);
      setError(err.message || "Failed to load kiosks");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Kiosks</h1>
          <p className="mt-2 text-sm text-gray-600">
            View and monitor the kiosks assigned to you.
          </p>
        </div>
        <button
          onClick={loadKiosks}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-teal-600" />
          <p className="mt-2 text-gray-500">Loading kiosks...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl p-6 text-center">
          <XCircleIcon className="h-12 w-12 mx-auto text-red-400 mb-3" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadKiosks}
            className="mt-4 text-sm text-red-600 hover:text-red-800"
          >
            Try again
          </button>
        </div>
      ) : kiosks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <ComputerDesktopIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Kiosks Assigned</h3>
          <p className="text-gray-500">
            You don&apos;t have any kiosks assigned to your account yet.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Contact your administrator to get kiosks assigned.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kiosks.map((kiosk) => (
            <div
              key={kiosk.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Kiosk Header */}
              <div className="bg-gradient-to-br from-teal-500 to-teal-600 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ComputerDesktopIcon className="h-8 w-8" />
                    <div>
                      <h3 className="font-semibold text-lg">{kiosk.name}</h3>
                      <p className="text-sm text-teal-100">{kiosk.kioskId}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {/* Device Online/Offline Status */}
                    <span
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        kiosk.isOnline
                          ? "bg-green-400/20 text-green-100"
                          : "bg-red-400/20 text-red-100"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          kiosk.isOnline ? "bg-green-400" : "bg-red-400"
                        }`}
                      />
                      {kiosk.isOnline ? "Device Online" : "Device Offline"}
                    </span>
                    
                    {/* Active Session Indicator - Always show */}
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        kiosk.hasActiveSession
                          ? "bg-blue-400/20 text-blue-100"
                          : "bg-gray-400/20 text-gray-300"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          kiosk.hasActiveSession ? "bg-blue-400 animate-pulse" : "bg-gray-400"
                        }`}
                      />
                      {kiosk.hasActiveSession ? "Active Session" : "No Session"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Kiosk Details */}
              <div className="p-5 space-y-4">
                {kiosk.location && (
                  <div className="flex items-start gap-3">
                    <MapPinIcon className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="text-sm font-medium text-gray-900">{kiosk.location}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <PrinterIcon className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Printer Status</p>
                    <div className="flex items-center gap-2">
                      {kiosk.printerStatus === "ready" ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium text-green-600">Ready</span>
                        </>
                      ) : kiosk.printerStatus === "error" ? (
                        <>
                          <XCircleIcon className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium text-red-600">Error</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-gray-600">
                          {kiosk.printerStatus || "Unknown"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Device Status */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Device Status</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${kiosk.isOnline ? "bg-green-500" : "bg-red-500"}`} />
                      <span className="text-sm font-medium text-gray-900">
                        {kiosk.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                  
                  {kiosk.lastHeartbeat ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Last Heartbeat</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(kiosk.lastHeartbeat).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {Math.floor((Date.now() - new Date(kiosk.lastHeartbeat).getTime()) / 1000 / 60)} minutes ago
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Last Heartbeat</p>
                      <p className="text-sm font-medium text-gray-500">Never</p>
                      <p className="text-xs text-gray-400 mt-1">Device has not sent heartbeat</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">User Session</p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          kiosk.hasActiveSession ? "bg-blue-500 animate-pulse" : "bg-gray-400"
                        }`}
                      />
                      <p className={`text-sm font-medium ${kiosk.hasActiveSession ? "text-blue-600" : "text-gray-500"}`}>
                        {kiosk.hasActiveSession ? "Active" : "None"}
                      </p>
                    </div>
                    {kiosk.hasActiveSession && (
                      <p className="text-xs text-gray-400 mt-1">Browser is open and responsive</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Prints</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {kiosk.printCount || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Last Print</p>
                    <p className="text-sm font-medium text-gray-900">
                      {kiosk.lastPrintAt
                        ? new Date(kiosk.lastPrintAt).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                </div>

                {/* Activate Kiosk Button */}
                <div className="pt-4 border-t border-gray-100">
                  <Link
                    href="/kiosk"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                  >
                    <PlayIcon className="h-5 w-5" />
                    Activate This Kiosk
                  </Link>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Select this kiosk on the hardware device
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      {kiosks.length > 0 && (
        <div className="mt-8 bg-teal-50 rounded-xl p-6 border border-teal-200">
          <div className="flex items-start gap-3">
            <LinkIcon className="h-6 w-6 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-teal-900 mb-2">
                How to Activate a Kiosk on Hardware
              </h3>
              <ol className="text-sm text-teal-800 space-y-2 list-decimal list-inside">
                <li>Click "Activate This Kiosk" on the kiosk you want to use</li>
                <li>You&apos;ll be taken to the kiosk activation page</li>
                <li>If you&apos;re on the hardware device, select the kiosk to activate it</li>
                <li>If you&apos;re not on the device, share the activation link with someone who has physical access</li>
              </ol>
              <p className="text-xs text-teal-700 mt-3">
                <strong>Note:</strong> The activation must be done directly on the hardware device where the kiosk will run.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
