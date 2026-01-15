"use client";

import { useState, useEffect, Fragment, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  FunnelIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  PaintBrushIcon,
  PrinterIcon,
  PaperAirplaneIcon,
  TrashIcon,
  EyeIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  VideoCameraIcon,
  PlayIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import type { KioskSession, SessionSummary, SessionOutcome } from "@/types/kioskSession";

interface SessionRecording {
  id: string;
  sessionId: string;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  status: string;
}

interface SessionsResponse {
  sessions: KioskSession[];
  total: number;
  page: number;
  pageSize: number;
  summary: SessionSummary;
  kiosk: {
    kioskId: string;
    name: string | null;
  };
  notice?: string; // Migration not run notice
}

const OUTCOME_LABELS: Record<SessionOutcome, string> = {
  printed_card: "Printed Card",
  printed_sticker: "Printed Sticker",
  sent_digital: "Sent Digital",
  abandoned: "Abandoned",
  in_progress: "In Progress",
};

const OUTCOME_COLORS: Record<SessionOutcome, string> = {
  printed_card: "bg-green-100 text-green-800",
  printed_sticker: "bg-blue-100 text-blue-800",
  sent_digital: "bg-purple-100 text-purple-800",
  abandoned: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
};

export default function KioskSessionsPage({
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
  const [data, setData] = useState<SessionsResponse | null>(null);

  // Filter state
  const [outcomeFilter, setOutcomeFilter] = useState<SessionOutcome | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hasSearch, setHasSearch] = useState(false);
  const [hasUpload, setHasUpload] = useState(false);
  const [hasEditor, setHasEditor] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<KioskSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Video modal
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<SessionRecording | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingsCache, setRecordingsCache] = useState<Record<string, SessionRecording>>({});

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/kiosks");
    }
  }, [status, router]);

  // Fetch sessions
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchSessions = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
        });

        if (outcomeFilter !== "all") {
          params.set("outcome", outcomeFilter);
        }
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (hasSearch) params.set("hasSearch", "true");
        if (hasUpload) params.set("hasUpload", "true");
        if (hasEditor) params.set("hasEditor", "true");
        if (hasRecording) params.set("hasRecording", "true");

        const response = await fetch(`/api/admin/kiosks/${kioskId}/sessions?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch sessions");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching sessions:", err);
        setError(err instanceof Error ? err.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [status, kioskId, page, outcomeFilter, startDate, endDate, hasSearch, hasUpload, hasEditor, hasRecording]);

  const handleDelete = async () => {
    if (!sessionToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/kiosks/${kioskId}/sessions/${sessionToDelete.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      // Refresh data
      setData((prev) =>
        prev
          ? {
              ...prev,
              sessions: prev.sessions.filter((s) => s.id !== sessionToDelete.id),
              total: prev.total - 1,
            }
          : null
      );
      setShowDeleteModal(false);
      setSessionToDelete(null);
    } catch (err) {
      console.error("Error deleting session:", err);
      alert(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenRecording = async (sessionId: string) => {
    // Check if we have it cached
    if (recordingsCache[sessionId]) {
      setSelectedRecording(recordingsCache[sessionId]);
      setShowVideoModal(true);
      return;
    }

    setRecordingLoading(true);
    setShowVideoModal(true);
    
    try {
      const response = await fetch(`/api/admin/kiosks/${kioskId}/sessions/${sessionId}/recording`);
      if (!response.ok) {
        throw new Error("Failed to fetch recording");
      }
      
      const data = await response.json();
      
      // Check if recording exists
      if (!data.recording) {
        setShowVideoModal(false);
        alert("No recording found for this session");
        return;
      }
      
      const recording: SessionRecording = {
        id: data.recording.id,
        sessionId: sessionId,
        storageUrl: data.recording.storageUrl,
        thumbnailUrl: data.recording.thumbnailUrl,
        duration: data.recording.duration,
        status: data.recording.status,
      };
      
      setRecordingsCache(prev => ({ ...prev, [sessionId]: recording }));
      setSelectedRecording(recording);
    } catch (err) {
      console.error("Error fetching recording:", err);
      setShowVideoModal(false);
      alert("Failed to load recording");
    } finally {
      setRecordingLoading(false);
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/kiosks"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Session Analytics
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {data?.kiosk?.name || kioskId}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error loading sessions</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : (
          <>
            {/* Migration Notice */}
            {data?.notice && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-amber-500 text-xl">⚠️</span>
                  <div>
                    <p className="font-medium text-amber-800">Database Migration Required</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Session tracking tables have not been created yet. Run this migration in your Supabase SQL editor:
                    </p>
                    <code className="block mt-2 text-xs bg-amber-100 text-amber-900 px-3 py-2 rounded font-mono overflow-x-auto">
                      supabase/migrations/003_create_kiosk_sessions.sql
                    </code>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            {data?.summary && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <ChartBarIcon className="h-4 w-4" />
                    Total Sessions
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.summary.totalSessions}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <ClockIcon className="h-4 w-4" />
                    Avg Duration
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDuration(data.summary.averageDuration)}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <CheckCircleIcon className="h-4 w-4" />
                    Conversion Rate
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {data.summary.conversionRate}%
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <PrinterIcon className="h-4 w-4" />
                    Printed
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {data.summary.outcomeBreakdown.printed_card +
                      data.summary.outcomeBreakdown.printed_sticker}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <XCircleIcon className="h-4 w-4" />
                    Abandoned
                  </div>
                  <p className="text-2xl font-bold text-red-600">
                    {data.summary.outcomeBreakdown.abandoned}
                  </p>
                </div>
              </div>
            )}

            {/* Feature Usage */}
            {data?.summary && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Feature Usage
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
                  {[
                    { label: "Greeting Cards", value: data.summary.featureUsage.greetingCards, icon: "🎴" },
                    { label: "Stickers", value: data.summary.featureUsage.stickers, icon: "✨" },
                    { label: "Gift Cards", value: data.summary.featureUsage.giftCards, icon: "🎁" },
                    { label: "Search", value: data.summary.featureUsage.search, icon: "🔍" },
                    { label: "Image Upload", value: data.summary.featureUsage.imageUpload, icon: "📷" },
                    { label: "Editor", value: data.summary.featureUsage.editor, icon: "🎨" },
                    { label: "Checkout", value: data.summary.featureUsage.checkout, icon: "🛒" },
                    { label: "Payment", value: data.summary.featureUsage.payment, icon: "💳" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <div className="text-xl font-bold text-gray-900">{item.value}</div>
                      <div className="text-xs text-gray-500">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600"
                >
                  <FunnelIcon className="h-4 w-4" />
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </button>
                <p className="text-sm text-gray-500">
                  {data?.total || 0} sessions
                </p>
              </div>

              {showFilters && (
                <div className="mt-4 grid grid-cols-2 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Outcome
                    </label>
                    <select
                      value={outcomeFilter}
                      onChange={(e) => {
                        setOutcomeFilter(e.target.value as SessionOutcome | "all");
                        setPage(1);
                      }}
                      className="w-full rounded-lg border-gray-300 text-sm"
                    >
                      <option value="all">All</option>
                      <option value="printed_card">Printed Card</option>
                      <option value="printed_sticker">Printed Sticker</option>
                      <option value="sent_digital">Sent Digital</option>
                      <option value="abandoned">Abandoned</option>
                      <option value="in_progress">In Progress</option>
                    </select>
                  </div>

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

                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hasSearch}
                        onChange={(e) => {
                          setHasSearch(e.target.checked);
                          setPage(1);
                        }}
                        className="rounded border-gray-300"
                      />
                      <MagnifyingGlassIcon className="h-4 w-4 text-gray-500" />
                      Used Search
                    </label>
                  </div>

                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hasUpload}
                        onChange={(e) => {
                          setHasUpload(e.target.checked);
                          setPage(1);
                        }}
                        className="rounded border-gray-300"
                      />
                      <PhotoIcon className="h-4 w-4 text-gray-500" />
                      Uploaded Image
                    </label>
                  </div>

                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hasEditor}
                        onChange={(e) => {
                          setHasEditor(e.target.checked);
                          setPage(1);
                        }}
                        className="rounded border-gray-300"
                      />
                      <PaintBrushIcon className="h-4 w-4 text-gray-500" />
                      Used Editor
                    </label>
                  </div>

                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hasRecording}
                        onChange={(e) => {
                          setHasRecording(e.target.checked);
                          setPage(1);
                        }}
                        className="rounded border-gray-300"
                      />
                      <VideoCameraIcon className="h-4 w-4 text-gray-500" />
                      Has Recording
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Sessions Table */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date/Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Features Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Outcome
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data?.sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No sessions found
                        </td>
                      </tr>
                    ) : (
                      data?.sessions.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {formatDate(session.startedAt)}
                              </span>
                              {session.hasRecording && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleOpenRecording(session.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
                                  title="Watch recording"
                                >
                                  <PlayIcon className="h-3 w-3" />
                                  <span className="text-xs font-medium">Watch</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {formatDuration(session.durationSeconds)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {session.pagesVisited?.length || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {session.browsedGreetingCards && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  🎴 Cards
                                </span>
                              )}
                              {session.browsedStickers && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  ✨ Stickers
                                </span>
                              )}
                              {session.browsedGiftCards && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                                  🎁 Gift Cards
                                </span>
                              )}
                              {session.usedSearch && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  🔍 Search
                                </span>
                              )}
                              {session.uploadedImage && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  📷 Upload
                                </span>
                              )}
                              {session.usedPinturaEditor && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  🎨 Editor
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                OUTCOME_COLORS[session.outcome]
                              }`}
                            >
                              {OUTCOME_LABELS[session.outcome]}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin/kiosks/${kioskId}/sessions/${session.id}`}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-indigo-600"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => {
                                  setSessionToDelete(session);
                                  setShowDeleteModal(true);
                                }}
                                className="p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-600"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

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

      {/* Delete Confirmation Modal */}
      <Transition appear show={showDeleteModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowDeleteModal(false)}
        >
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
                    Delete Session
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    Are you sure you want to delete this session? This will also
                    delete all associated events. This action cannot be undone.
                  </p>
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
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

      {/* Video Recording Modal */}
      <Transition appear show={showVideoModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setShowVideoModal(false);
            setSelectedRecording(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-900 shadow-2xl transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                      <VideoCameraIcon className="h-6 w-6 text-indigo-400" />
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Session Recording
                      </Dialog.Title>
                      {selectedRecording?.duration && (
                        <span className="text-sm text-gray-400">
                          ({formatDuration(selectedRecording.duration)})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowVideoModal(false);
                        setSelectedRecording(null);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Video Player */}
                  <div className="relative bg-black aspect-video">
                    {recordingLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : selectedRecording?.storageUrl ? (
                      <video
                        controls
                        autoPlay
                        className="w-full h-full"
                        src={selectedRecording.storageUrl}
                        poster={selectedRecording.thumbnailUrl || undefined}
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                        <VideoCameraIcon className="h-16 w-16 mb-4" />
                        <p className="text-lg">Recording not available</p>
                        <p className="text-sm">
                          {selectedRecording?.status === "pending"
                            ? "Recording is still being processed"
                            : "Recording file could not be loaded"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer with actions */}
                  {selectedRecording?.storageUrl && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
                      <p className="text-sm text-gray-400">
                        Captured at 1 FPS
                      </p>
                      <a
                        href={selectedRecording.storageUrl}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                      >
                        Download Recording
                      </a>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
