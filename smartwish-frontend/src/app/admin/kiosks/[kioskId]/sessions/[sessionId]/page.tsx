"use client";

import { useState, useEffect, Fragment, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ClockIcon,
  CalendarIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  PrinterIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import type {
  KioskSession,
  KioskSessionEvent,
  SessionJourneyStep,
  SessionOutcome,
} from "@/types/kioskSession";

interface SessionDetailResponse {
  session: KioskSession;
  events: KioskSessionEvent[];
  journey: SessionJourneyStep[];
  behaviorSummary: string;
}

const OUTCOME_LABELS: Record<SessionOutcome, string> = {
  printed_card: "Printed Card",
  printed_sticker: "Printed Sticker",
  sent_digital: "Sent Digital",
  abandoned: "Abandoned",
  in_progress: "In Progress",
};

const OUTCOME_ICONS: Record<SessionOutcome, React.ReactNode> = {
  printed_card: <PrinterIcon className="h-5 w-5" />,
  printed_sticker: <PrinterIcon className="h-5 w-5" />,
  sent_digital: <PaperAirplaneIcon className="h-5 w-5" />,
  abandoned: <XCircleIcon className="h-5 w-5" />,
  in_progress: <ClockIcon className="h-5 w-5" />,
};

const OUTCOME_COLORS: Record<SessionOutcome, string> = {
  printed_card: "bg-green-100 text-green-800 border-green-200",
  printed_sticker: "bg-blue-100 text-blue-800 border-blue-200",
  sent_digital: "bg-purple-100 text-purple-800 border-purple-200",
  abandoned: "bg-red-100 text-red-800 border-red-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  page_view: "Viewed page",
  page_exit: "Left page",
  click: "Clicked",
  scroll: "Scrolled",
  search: "Searched",
  sticker_browse: "Browsed stickers",
  sticker_select: "Selected sticker",
  sticker_search: "Searched stickers",
  sticker_upload_start: "Started upload",
  sticker_upload_complete: "Completed upload",
  card_browse: "Browsed cards",
  card_select: "Selected card",
  card_search: "Searched cards",
  card_customize: "Customized card",
  editor_open: "Opened editor",
  editor_tool_use: "Used editor tool",
  editor_save: "Saved in editor",
  editor_close: "Closed editor",
  checkout_start: "Started checkout",
  payment_attempt: "Attempted payment",
  payment_success: "Payment successful",
  payment_failure: "Payment failed",
  print_start: "Started printing",
  print_complete: "Completed printing",
  send_digital: "Sent digitally",
  session_start: "Session started",
  session_timeout: "Session timed out",
  session_end: "Session ended",
};

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ kioskId: string; sessionId: string }>;
}) {
  const resolvedParams = use(params);
  const { kioskId, sessionId } = resolvedParams;

  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [showRawEvents, setShowRawEvents] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/kiosks");
    }
  }, [status, router]);

  // Fetch session detail
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchSession = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/admin/kiosks/${kioskId}/sessions/${sessionId}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch session");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching session:", err);
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [status, kioskId, sessionId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/kiosks/${kioskId}/sessions/${sessionId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete session");
      }

      router.push(`/admin/kiosks/${kioskId}/sessions`);
    } catch (err) {
      console.error("Error deleting session:", err);
      alert(err instanceof Error ? err.message : "Failed to delete session");
    } finally {
      setDeleting(false);
    }
  };

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDurationMs = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    return formatDuration(seconds);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getPageName = (path: string): string => {
    const names: Record<string, string> = {
      "/kiosk/home": "Kiosk Home",
      "/templates": "Greeting Cards",
      "/stickers": "Stickers",
      "/payment": "Checkout",
      "/my-cards": "My Cards",
      "/marketplace": "Gift Card Marketplace",
    };
    return names[path] || path;
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading session details...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-lg bg-red-50 p-6 text-red-700">
            <p className="font-medium">Error loading session</p>
            <p className="text-sm mt-1">{error}</p>
            <Link
              href={`/admin/kiosks/${kioskId}/sessions`}
              className="mt-4 inline-block text-indigo-600 hover:underline"
            >
              Back to sessions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { session: kioskSession, events, journey, behaviorSummary } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/admin/kiosks/${kioskId}/sessions`}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Session Details
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {formatDate(kioskSession.startedAt)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <TrashIcon className="h-4 w-4" />
              Delete Session
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Session Overview */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Outcome Card */}
          <div
            className={`rounded-xl p-6 border-2 ${
              OUTCOME_COLORS[kioskSession.outcome]
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {OUTCOME_ICONS[kioskSession.outcome]}
              <span className="text-lg font-semibold">
                {OUTCOME_LABELS[kioskSession.outcome]}
              </span>
            </div>
            <p className="text-sm opacity-80">
              {kioskSession.outcome === "abandoned"
                ? kioskSession.reachedCheckout
                  ? "User reached checkout but did not complete"
                  : "User left without completing an action"
                : kioskSession.outcome === "in_progress"
                ? "Session is still active"
                : "Session completed successfully"}
            </p>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Session Stats
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                  <ClockIcon className="h-3 w-3" />
                  Duration
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {formatDuration(kioskSession.durationSeconds)}
                </p>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Pages Visited</div>
                <p className="text-lg font-bold text-gray-900">
                  {kioskSession.pagesVisited?.length || 0}
                </p>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Total Events</div>
                <p className="text-lg font-bold text-gray-900">
                  {kioskSession.totalEvents}
                </p>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Total Clicks</div>
                <p className="text-lg font-bold text-gray-900">
                  {kioskSession.totalClicks}
                </p>
              </div>
            </div>
          </div>

          {/* Features Used Card */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Features Used
            </h3>
            <div className="flex flex-wrap gap-2">
              {kioskSession.browsedGreetingCards && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-50 text-indigo-700">
                  🎴 Greeting Cards
                </span>
              )}
              {kioskSession.browsedStickers && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-pink-50 text-pink-700">
                  ✨ Stickers
                </span>
              )}
              {kioskSession.usedSearch && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                  🔍 Search
                </span>
              )}
              {kioskSession.uploadedImage && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-50 text-green-700">
                  📷 Image Upload
                </span>
              )}
              {kioskSession.usedPinturaEditor && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-50 text-purple-700">
                  🎨 Editor
                </span>
              )}
              {kioskSession.reachedCheckout && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-50 text-yellow-700">
                  🛒 Checkout
                </span>
              )}
              {kioskSession.completedPayment && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-50 text-green-700">
                  💳 Payment
                </span>
              )}
              {!kioskSession.browsedGreetingCards &&
                !kioskSession.browsedStickers &&
                !kioskSession.usedSearch && (
                  <span className="text-gray-400 text-sm">
                    No features tracked
                  </span>
                )}
            </div>
          </div>
        </div>

        {/* Behavior Summary */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Behavior Summary
          </h3>
          <p className="text-gray-700 leading-relaxed">{behaviorSummary}</p>
        </div>

        {/* User Journey */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            User Journey
          </h3>

          {journey.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No journey data available
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

              {/* Journey steps */}
              <div className="space-y-4">
                {journey.map((step, index) => (
                  <div key={index} className="relative pl-12">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2.5 w-4 h-4 rounded-full border-2 ${
                        index === journey.length - 1
                          ? "bg-indigo-600 border-indigo-600"
                          : "bg-white border-gray-300"
                      }`}
                    />

                    {/* Step card */}
                    <div
                      className={`rounded-lg border ${
                        expandedSteps.has(index)
                          ? "border-indigo-200 bg-indigo-50/50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <button
                        onClick={() => toggleStep(index)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {getPageName(step.page)}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {formatTime(step.enteredAt)} •{" "}
                              {formatDurationMs(step.durationMs)} •{" "}
                              {step.eventCount} events
                            </p>
                          </div>
                        </div>
                        <ChevronDownIcon
                          className={`h-5 w-5 text-gray-400 transition-transform ${
                            expandedSteps.has(index) ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {expandedSteps.has(index) && (
                        <div className="px-4 pb-4 border-t border-gray-200">
                          {/* Highlights */}
                          {step.highlights.length > 0 && (
                            <div className="mt-3 mb-4">
                              <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                                Key Actions
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {step.highlights.map((highlight, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-white border border-gray-200 text-gray-700"
                                  >
                                    {highlight}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Events on this page */}
                          <div className="text-xs text-gray-500">
                            <p className="font-medium uppercase mb-2">
                              Events on this page
                            </p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {events
                                .filter((e) => e.page === step.page)
                                .slice(0, 20)
                                .map((event, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 text-gray-600"
                                  >
                                    <span className="text-gray-400">
                                      {formatTime(event.timestamp)}
                                    </span>
                                    <span>
                                      {EVENT_TYPE_LABELS[event.eventType] ||
                                        event.eventType}
                                    </span>
                                    {event.zone && (
                                      <span className="text-gray-400">
                                        in {event.zone}
                                      </span>
                                    )}
                                    {event.details?.searchQuery && (
                                      <span className="text-indigo-600">
                                        &quot;{event.details.searchQuery}&quot;
                                      </span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Raw Events Log */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
          <button
            onClick={() => setShowRawEvents(!showRawEvents)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50"
          >
            <h3 className="text-lg font-semibold text-gray-900">
              Raw Event Log ({events.length} events)
            </h3>
            <ChevronRightIcon
              className={`h-5 w-5 text-gray-400 transition-transform ${
                showRawEvents ? "rotate-90" : ""
              }`}
            />
          </button>

          {showRawEvents && (
            <div className="border-t border-gray-200 max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Time
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Event
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Page
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Zone
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {events.map((event, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                        {formatTime(event.timestamp)}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {getPageName(event.page)}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {event.zone || "-"}
                      </td>
                      <td className="px-4 py-2 text-gray-500 max-w-xs truncate">
                        {Object.keys(event.details || {}).length > 0
                          ? JSON.stringify(event.details)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
    </div>
  );
}
