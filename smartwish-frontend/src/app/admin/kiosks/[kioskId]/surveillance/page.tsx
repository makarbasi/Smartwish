"use client";

import { useState, useEffect, Fragment, use, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeftIcon,
  FunnelIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  CalendarIcon,
  TrashIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  VideoCameraIcon,
  EyeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface Detection {
  id: string;
  kioskId: string;
  personTrackId: number;
  detectedAt: string;
  dwellSeconds: number | null;
  wasCounted: boolean;
  imagePath: string | null;
}

interface SummaryStats {
  today: { detected: number; counted: number };
  yesterday: { detected: number; counted: number };
  thisWeek: { detected: number; counted: number };
  thisMonth: { detected: number; counted: number };
  peakHourToday: number | null;
}

interface DailyStat {
  date: string;
  totalDetected: number;
  totalCounted: number;
  peakHour: number | null;
  hourlyCounts: Record<string, number>;
}

interface DetectionsResponse {
  detections: Detection[];
  total: number;
  page: number;
  limit: number;
}

// Use local backend for development, cloud for production
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? "http://localhost:3001" 
    : "https://smartwish.onrender.com");

export default function KioskSurveillancePage({
  params,
}: {
  params: Promise<{ kioskId: string }>;
}) {
  const resolvedParams = use(params);
  const kioskId = resolvedParams.kioskId;

  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kioskName, setKioskName] = useState<string | null>(null);
  
  // Data states
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [totalDetections, setTotalDetections] = useState(0);

  // Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [countedOnly, setCountedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Delete modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteRangeModal, setShowDeleteRangeModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStartDate, setDeleteStartDate] = useState("");
  const [deleteEndDate, setDeleteEndDate] = useState("");

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<Detection | null>(null);

  // Image server URL - use backend for live stream (works remotely), local for static images
  const [localImageServerUrl, setLocalImageServerUrl] = useState<string>("http://localhost:8765");
  
  // Live stream URL - served from backend (works remotely via frame relay)
  const liveStreamUrl = `${BACKEND_URL}/admin/surveillance/${kioskId}/stream`;
  const singleFrameUrl = `${BACKEND_URL}/admin/surveillance/${kioskId}/frame`;
  
  // Live preview state
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [liveStreamError, setLiveStreamError] = useState(false);
  const [streamStatus, setStreamStatus] = useState<{ isActive: boolean; lastFrameAt: string | null } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/kiosks");
    }
  }, [status, router]);

  // Fetch kiosk info
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchKiosk = async () => {
      try {
        const response = await fetch(`/api/admin/kiosks/${kioskId}`);
        if (response.ok) {
          const kiosk = await response.json();
          setKioskName(kiosk.name || kiosk.kioskId);
          
          // Get local image server URL from kiosk config if available (for static detection images)
          if (kiosk.config?.surveillance?.httpPort) {
            setLocalImageServerUrl(`http://localhost:${kiosk.config.surveillance.httpPort}`);
          }
        }
      } catch (err) {
        console.error("Error fetching kiosk:", err);
      }
    };

    fetchKiosk();
  }, [status, kioskId]);

  // Check stream status when showing live preview
  useEffect(() => {
    if (!showLivePreview || status !== "authenticated") return;

    const checkStatus = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/stream/status`, {
          headers: {
            Authorization: `Bearer ${session?.user?.access_token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setStreamStatus(data);
          if (!data.isActive) {
            setLiveStreamError(true);
          }
        }
      } catch (err) {
        console.error("Error checking stream status:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [showLivePreview, status, kioskId, session?.user?.access_token]);

  // Fetch summary stats
  const fetchSummaryStats = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/stats/summary`, {
        headers: {
          Authorization: `Bearer ${session?.user?.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSummaryStats(data);
        setError(null); // Clear error on success
      } else if (response.status === 404) {
        // Endpoint not deployed yet - this is expected during setup
        console.log("Surveillance API not available yet (404)");
      }
    } catch (err) {
      console.error("Error fetching summary stats:", err);
    }
  }, [kioskId, session?.user?.access_token]);

  // Fetch daily stats
  const fetchDailyStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      // Get last 7 days
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      params.set("startDate", weekAgo);

      const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/stats/daily?${params}`, {
        headers: {
          Authorization: `Bearer ${session?.user?.access_token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDailyStats(data);
      } else if (response.status === 404) {
        // Endpoint not deployed yet
        console.log("Surveillance daily stats API not available yet (404)");
      }
    } catch (err) {
      console.error("Error fetching daily stats:", err);
    }
  }, [kioskId, session?.user?.access_token]);

  // Fetch detections
  const fetchDetections = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (countedOnly) params.set("countedOnly", "true");

      const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/detections?${params}`, {
        headers: {
          Authorization: `Bearer ${session?.user?.access_token}`,
        },
      });

      if (response.status === 404) {
        // API not deployed yet
        setError("Surveillance API not available. Deploy the backend with surveillance module.");
        setDetections([]);
        setTotalDetections(0);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch detections");
      }

      const data: DetectionsResponse = await response.json();
      setDetections(data.detections);
      setTotalDetections(data.total);
      setError(null);
    } catch (err) {
      console.error("Error fetching detections:", err);
      setError(err instanceof Error ? err.message : "Failed to load detections");
    } finally {
      setLoading(false);
    }
  }, [kioskId, page, startDate, endDate, countedOnly, session?.user?.access_token]);

  // Load all data - only on initial mount when authenticated
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.access_token) return;

    // Only fetch once when authenticated
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      await Promise.all([
        fetchSummaryStats(),
        fetchDailyStats(),
        fetchDetections(),
      ]);
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.access_token, kioskId]); // Only re-fetch when auth state or kiosk changes

  // Re-fetch detections when filters/pagination change
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.access_token) return;
    
    // Skip initial load (handled above)
    const isInitialLoad = page === 1 && !startDate && !endDate && !countedOnly;
    if (isInitialLoad) return;
    
    fetchDetections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate, countedOnly]);

  // Refresh data periodically - using ref to avoid recreating interval
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.access_token) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/stats/summary`, {
          headers: {
            Authorization: `Bearer ${session?.user?.access_token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setSummaryStats(data);
        }
      } catch (err) {
        // Silent fail for periodic refresh
      }
    }, 30000); // Refresh summary every 30 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, kioskId]); // Only recreate interval when auth state or kiosk changes

  // Delete handlers
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setDeleting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/detections`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.user?.access_token}`,
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete detections");
      }

      setSelectedIds(new Set());
      setShowDeleteModal(false);
      fetchDetections();
      fetchSummaryStats();
      fetchDailyStats();
    } catch (err) {
      console.error("Error deleting detections:", err);
      alert(err instanceof Error ? err.message : "Failed to delete detections");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteByRange = async () => {
    setDeleting(true);
    try {
      const body: { startDate?: string; endDate?: string } = {};
      if (deleteStartDate) body.startDate = deleteStartDate;
      if (deleteEndDate) body.endDate = deleteEndDate;

      const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/detections`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.user?.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to delete detections");
      }

      setShowDeleteRangeModal(false);
      setDeleteStartDate("");
      setDeleteEndDate("");
      fetchDetections();
      fetchSummaryStats();
      fetchDailyStats();
    } catch (err) {
      console.error("Error deleting detections:", err);
      alert(err instanceof Error ? err.message : "Failed to delete detections");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/surveillance/${kioskId}/all`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session?.user?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete all detections");
      }

      setShowDeleteAllModal(false);
      setDetections([]);
      setTotalDetections(0);
      fetchSummaryStats();
      fetchDailyStats();
    } catch (err) {
      console.error("Error deleting all detections:", err);
      alert(err instanceof Error ? err.message : "Failed to delete all detections");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === detections.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(detections.map((d) => d.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatHour = (hour: number | null): string => {
    if (hour === null) return "-";
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h}:00 ${ampm}`;
  };

  const getImageUrl = (imagePath: string | null): string | null => {
    if (!imagePath) return null;
    // Detection images are served from the local print agent server
    // Note: These won't be accessible remotely unless you're on the same network as the kiosk
    return `${localImageServerUrl}/${imagePath}`;
  };

  // Calculate change percentage
  const getChangePercent = (current: number, previous: number): { value: number; positive: boolean } => {
    if (previous === 0) return { value: current > 0 ? 100 : 0, positive: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(Math.round(change)), positive: change >= 0 };
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading surveillance data...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const totalPages = Math.ceil(totalDetections / pageSize);
  const todayChange = summaryStats 
    ? getChangePercent(summaryStats.today.counted, summaryStats.yesterday.counted)
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/kiosks"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <VideoCameraIcon className="h-6 w-6 text-amber-500" />
                  <h1 className="text-2xl font-bold text-gray-900">
                    Surveillance
                  </h1>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {kioskName || kioskId}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                fetchSummaryStats();
                fetchDailyStats();
                fetchDetections();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-6">
            <div className="flex items-start gap-3">
              <VideoCameraIcon className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Surveillance Module Not Available</p>
                <p className="text-sm text-amber-700 mt-1">
                  The surveillance API endpoints are not responding. This could mean:
                </p>
                <ul className="text-sm text-amber-700 mt-2 list-disc list-inside space-y-1">
                  <li>The backend needs to be deployed with the surveillance module</li>
                  <li>The database migration hasn&apos;t been run yet</li>
                  <li>The local backend isn&apos;t running (for development)</li>
                </ul>
                <div className="mt-4 p-3 bg-amber-100 rounded-lg">
                  <p className="text-xs font-medium text-amber-800 mb-1">To enable surveillance:</p>
                  <ol className="text-xs text-amber-700 list-decimal list-inside space-y-1">
                    <li>Run the migration: <code className="bg-amber-200 px-1 rounded">008_create_surveillance_tables.sql</code></li>
                    <li>Deploy the backend with the surveillance module</li>
                    <li>Enable surveillance in the kiosk config</li>
                    <li>Start the print agent with surveillance enabled</li>
                  </ol>
                </div>
                <p className="text-xs text-amber-600 mt-3">
                  Backend URL: <code className="bg-amber-200 px-1 rounded">{BACKEND_URL}</code>
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Live Preview Section */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <VideoCameraIcon className="h-5 w-5 text-amber-500" />
                  <h3 className="text-lg font-semibold text-gray-900">Live Webcam Preview</h3>
                  {showLivePreview && !liveStreamError && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowLivePreview(!showLivePreview);
                    setLiveStreamError(false);
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    showLivePreview
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }`}
                >
                  {showLivePreview ? (
                    <>
                      <XMarkIcon className="h-4 w-4" />
                      Stop Preview
                    </>
                  ) : (
                    <>
                      <EyeIcon className="h-4 w-4" />
                      Start Preview
                    </>
                  )}
                </button>
              </div>

              {showLivePreview && (
                <div className="relative">
                  {liveStreamError ? (
                    <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <VideoCameraIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">Unable to connect to webcam</p>
                        <p className="text-sm mt-2">
                          Make sure the surveillance process is running on the kiosk
                        </p>
                        <p className="text-xs mt-4 text-gray-500">
                          The kiosk must be running and connected to the server
                        </p>
                        {streamStatus && !streamStatus.isActive && (
                          <p className="text-xs mt-2 text-amber-400">
                            Last frame: {streamStatus.lastFrameAt ? new Date(streamStatus.lastFrameAt).toLocaleTimeString() : 'Never'}
                          </p>
                        )}
                        <button
                          onClick={() => {
                            setLiveStreamError(false);
                            setStreamStatus(null);
                          }}
                          className="mt-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-500"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                      <img
                        src={liveStreamUrl}
                        alt="Live webcam feed"
                        className="w-full h-full object-contain"
                        onError={() => setLiveStreamError(true)}
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Live feed from kiosk webcam • Stream relayed through server
                    {streamStatus?.isActive && (
                      <span className="text-green-500 ml-2">• Connected</span>
                    )}
                  </p>
                </div>
              )}

              {!showLivePreview && (
                <p className="text-sm text-gray-500">
                  Click &quot;Start Preview&quot; to view the live webcam feed from the kiosk. 
                  Requires the surveillance process to be running on the kiosk computer.
                </p>
              )}
            </div>

            {/* Summary Cards */}
            {summaryStats && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <UserGroupIcon className="h-4 w-4" />
                    Today
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {summaryStats.today.counted}
                  </p>
                  {todayChange && summaryStats.yesterday.counted > 0 && (
                    <p className={`text-xs mt-1 ${todayChange.positive ? "text-green-600" : "text-red-600"}`}>
                      {todayChange.positive ? "↑" : "↓"} {todayChange.value}% vs yesterday
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <CalendarIcon className="h-4 w-4" />
                    Yesterday
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {summaryStats.yesterday.counted}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {summaryStats.yesterday.detected} detected
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <ChartBarIcon className="h-4 w-4" />
                    This Week
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {summaryStats.thisWeek.counted}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {summaryStats.thisWeek.detected} detected
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <ChartBarIcon className="h-4 w-4" />
                    This Month
                  </div>
                  <p className="text-2xl font-bold text-purple-600">
                    {summaryStats.thisMonth.counted}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {summaryStats.thisMonth.detected} detected
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <ClockIcon className="h-4 w-4" />
                    Peak Hour Today
                  </div>
                  <p className="text-2xl font-bold text-amber-600">
                    {formatHour(summaryStats.peakHourToday)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Busiest time
                  </p>
                </div>
              </div>
            )}

            {/* Hourly Chart (last 7 days) */}
            {dailyStats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Daily Traffic (Last 7 Days)
                </h3>
                <div className="flex items-end gap-2 h-32">
                  {dailyStats.slice(0, 7).reverse().map((stat) => {
                    const maxCount = Math.max(...dailyStats.map((d) => d.totalCounted), 1);
                    const height = (stat.totalCounted / maxCount) * 100;
                    return (
                      <div key={stat.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs text-gray-500">{stat.totalCounted}</div>
                        <div
                          className="w-full bg-amber-400 rounded-t transition-all"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${stat.totalCounted} counted on ${stat.date}`}
                        />
                        <div className="text-xs text-gray-400 truncate w-full text-center">
                          {new Date(stat.date).toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters & Actions */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-amber-600"
                  >
                    <FunnelIcon className="h-4 w-4" />
                    {showFilters ? "Hide Filters" : "Show Filters"}
                  </button>
                  <span className="text-sm text-gray-500">
                    {totalDetections} detection{totalDetections !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete Selected ({selectedIds.size})
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteRangeModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    Delete by Date
                  </button>
                  <button
                    onClick={() => setShowDeleteAllModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
                  >
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    Delete All
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-lg border-gray-300 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-lg border-gray-300 text-sm"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={countedOnly}
                        onChange={(e) => {
                          setCountedOnly(e.target.checked);
                          setPage(1);
                        }}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-gray-700">Counted only (&gt;8s)</span>
                    </label>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setCountedOnly(false);
                        setPage(1);
                      }}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Detection Gallery */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
              {/* Select All Header */}
              {detections.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === detections.length && detections.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-gray-700">
                      Select All ({detections.length})
                    </span>
                  </label>
                </div>
              )}

              {/* Gallery Grid */}
              {loading ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading detections...</p>
                </div>
              ) : detections.length === 0 ? (
                <div className="p-12 text-center">
                  <VideoCameraIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No detections found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {startDate || endDate || countedOnly
                      ? "Try adjusting your filters"
                      : "Surveillance data will appear here when people are detected"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
                  {detections.map((detection) => (
                    <div
                      key={detection.id}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                        selectedIds.has(detection.id)
                          ? "border-amber-500 ring-2 ring-amber-200"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {/* Selection checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(detection.id)}
                          onChange={() => toggleSelect(detection.id)}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 bg-white/90"
                        />
                      </div>

                      {/* Image */}
                      <div
                        className="aspect-square bg-gray-100 cursor-pointer"
                        onClick={() => setPreviewImage(detection)}
                      >
                        {detection.imagePath ? (
                          <img
                            src={getImageUrl(detection.imagePath) || ""}
                            alt={`Person ${detection.personTrackId}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder-person.png";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <UserGroupIcon className="h-12 w-12" />
                          </div>
                        )}

                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <EyeIcon className="h-8 w-8 text-white" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-2 bg-white">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-900">
                            ID: {detection.personTrackId}
                          </span>
                          {detection.wasCounted && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">
                              <CheckIcon className="h-3 w-3 mr-0.5" />
                              Counted
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatDate(detection.detectedAt)}
                        </p>
                        {detection.dwellSeconds && (
                          <p className="text-xs text-gray-400">
                            {detection.dwellSeconds.toFixed(1)}s dwell
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete Selected Modal */}
      <Transition appear show={showDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Delete {selectedIds.size} Detection{selectedIds.size !== 1 ? "s" : ""}
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    Are you sure you want to delete the selected detections? This action cannot be undone.
                  </p>
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete by Date Range Modal */}
      <Transition appear show={showDeleteRangeModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteRangeModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Delete Detections by Date
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    Delete all detections within the specified date range.
                  </p>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={deleteStartDate}
                        onChange={(e) => setDeleteStartDate(e.target.value)}
                        className="w-full rounded-lg border-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={deleteEndDate}
                        onChange={(e) => setDeleteEndDate(e.target.value)}
                        className="w-full rounded-lg border-gray-300"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteRangeModal(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteByRange}
                      disabled={deleting || (!deleteStartDate && !deleteEndDate)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete All Modal */}
      <Transition appear show={showDeleteAllModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowDeleteAllModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-95"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center gap-3 text-red-600 mb-4">
                    <ExclamationTriangleIcon className="h-8 w-8" />
                    <Dialog.Title className="text-lg font-semibold">
                      Delete All Detections
                    </Dialog.Title>
                  </div>
                  <p className="text-sm text-gray-500">
                    This will permanently delete ALL surveillance data for this kiosk, including all images and statistics. This action cannot be undone.
                  </p>
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteAllModal(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAll}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete Everything"}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Image Preview Modal */}
      <Transition appear show={!!previewImage} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPreviewImage(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative max-w-3xl w-full">
                  <button
                    onClick={() => setPreviewImage(null)}
                    className="absolute -top-12 right-0 text-white hover:text-gray-300"
                  >
                    <XMarkIcon className="h-8 w-8" />
                  </button>
                  
                  {previewImage?.imagePath && (
                    <img
                      src={getImageUrl(previewImage.imagePath) || ""}
                      alt={`Person ${previewImage.personTrackId}`}
                      className="w-full rounded-lg"
                    />
                  )}
                  
                  <div className="mt-4 text-white text-center">
                    <p className="text-lg font-medium">
                      Person ID: {previewImage?.personTrackId}
                    </p>
                    <p className="text-gray-300">
                      {previewImage && formatDate(previewImage.detectedAt)}
                      {previewImage?.dwellSeconds && ` • ${previewImage.dwellSeconds.toFixed(1)}s dwell time`}
                    </p>
                    {previewImage?.wasCounted && (
                      <span className="inline-flex items-center px-3 py-1 mt-2 rounded-full text-sm bg-green-500/20 text-green-300">
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Counted (stayed &gt;8s)
                      </span>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
