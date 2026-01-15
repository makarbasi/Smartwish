"use client";

import { useState, useEffect, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  VideoCameraIcon,
  TrashIcon,
  EyeIcon,
  PlayIcon,
  CalendarIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface Recording {
  id: string;
  sessionId: string;
  kioskId: string;
  kioskName: string;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  fileSize: number | null;
  format: string;
  resolution: string;
  frameRate: number;
  status: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

interface RecordingsListResponse {
  recordings: Recording[];
  total: number;
  page: number;
  pageSize: number;
  totalSize: number;
}

export default function RecordingsManagementPage() {
  const { status } = useSession();
  const router = useRouter();

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecordingsListResponse | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filter state
  const [kioskFilter, setKioskFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Delete state
  const [selectedRecordings, setSelectedRecordings] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<Recording | null>(null);

  // Kiosk list for filter
  const [kiosks, setKiosks] = useState<{ id: string; name: string }[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Fetch kiosks for filter dropdown
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchKiosks = async () => {
      try {
        const response = await fetch("/api/admin/kiosks");
        if (response.ok) {
          const result = await response.json();
          setKiosks(result.kiosks?.map((k: { kiosk_id: string; name: string }) => ({
            id: k.kiosk_id,
            name: k.name,
          })) || []);
        }
      } catch (err) {
        console.error("Error fetching kiosks:", err);
      }
    };

    fetchKiosks();
  }, [status]);

  // Fetch recordings
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchRecordings = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
        });

        if (kioskFilter !== "all") {
          params.set("kioskId", kioskFilter);
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const response = await fetch(`/api/admin/recordings?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch recordings");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Error fetching recordings:", err);
        setError(err instanceof Error ? err.message : "Failed to load recordings");
      } finally {
        setLoading(false);
      }
    };

    fetchRecordings();
  }, [status, page, kioskFilter, statusFilter, startDate, endDate]);

  const handleDeleteSingle = (recording: Recording) => {
    setRecordingToDelete(recording);
    setShowDeleteModal(true);
  };

  const handleDeleteSelected = () => {
    if (selectedRecordings.size === 0) return;
    setRecordingToDelete(null);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const idsToDelete = recordingToDelete 
        ? [recordingToDelete.id]
        : Array.from(selectedRecordings);

      const response = await fetch("/api/admin/recordings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingIds: idsToDelete }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete recordings");
      }

      // Refresh the list
      setSelectedRecordings(new Set());
      setShowDeleteModal(false);
      setRecordingToDelete(null);
      
      // Refetch
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (kioskFilter !== "all") params.set("kioskId", kioskFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const refetchResponse = await fetch(`/api/admin/recordings?${params}`);
      if (refetchResponse.ok) {
        const result = await refetchResponse.json();
        setData(result);
      }
    } catch (err) {
      console.error("Error deleting recordings:", err);
      alert(err instanceof Error ? err.message : "Failed to delete recordings");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedRecordings);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRecordings(newSelection);
  };

  const toggleSelectAll = () => {
    if (!data?.recordings) return;
    if (selectedRecordings.size === data.recordings.length) {
      setSelectedRecordings(new Set());
    } else {
      setSelectedRecordings(new Set(data.recordings.map(r => r.id)));
    }
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading recordings...</p>
        </div>
      </div>
    );
  }

  const recordings = data?.recordings || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const totalStorageSize = data?.totalSize || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <VideoCameraIcon className="h-6 w-6 text-indigo-500" />
                <h1 className="text-2xl font-bold text-gray-900">
                  Session Recordings
                </h1>
              </div>
              <p className="text-gray-500 mt-1">
                Manage recorded kiosk sessions ({total} recordings, {formatFileSize(totalStorageSize)} total)
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <FunnelIcon className="h-5 w-5" />
              Filters
            </button>

            {selectedRecordings.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
              >
                <TrashIcon className="h-5 w-5" />
                Delete Selected ({selectedRecordings.size})
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kiosk
                </label>
                <select
                  value={kioskFilter}
                  onChange={(e) => {
                    setKioskFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="all">All Kiosks</option>
                  {kiosks.map((kiosk) => (
                    <option key={kiosk.id} value={kiosk.id}>
                      {kiosk.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="recording">Recording</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Recordings Table */}
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
          {recordings.length === 0 ? (
            <div className="text-center py-16">
              <VideoCameraIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No recordings found
              </h3>
              <p className="text-gray-500">
                {kioskFilter !== "all" || statusFilter !== "all" || startDate || endDate
                  ? "Try adjusting your filters"
                  : "Session recordings will appear here once kiosk sessions are recorded"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedRecordings.size === recordings.length && recordings.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Preview
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kiosk
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recordings.map((recording) => (
                      <tr
                        key={recording.id}
                        className={`hover:bg-gray-50 ${
                          selectedRecordings.has(recording.id) ? "bg-indigo-50" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedRecordings.has(recording.id)}
                            onChange={() => toggleSelection(recording.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-4">
                          {recording.thumbnailUrl ? (
                            <div className="relative w-24 h-14 bg-gray-900 rounded-lg overflow-hidden group">
                              <img
                                src={recording.thumbnailUrl}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <PlayIcon className="h-6 w-6 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-24 h-14 bg-gray-200 rounded-lg flex items-center justify-center">
                              <VideoCameraIcon className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {recording.kioskName || recording.kioskId}
                          </div>
                          <div className="text-xs text-gray-500">
                            Session: {recording.sessionId.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm text-gray-900">
                            <ClockIcon className="h-4 w-4 text-gray-400" />
                            {formatDuration(recording.duration)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatFileSize(recording.fileSize)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              recording.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : recording.status === "recording"
                                ? "bg-yellow-100 text-yellow-800"
                                : recording.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {recording.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <CalendarIcon className="h-4 w-4 text-gray-400" />
                            {formatDate(recording.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/kiosks/${recording.kioskId}/sessions/${recording.sessionId}`}
                              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View Session"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </Link>
                            {recording.storageUrl && (
                              <a
                                href={recording.storageUrl}
                                download
                                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Download"
                              >
                                <DocumentArrowDownIcon className="h-5 w-5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteSingle(recording)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Showing {(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)} of {total} recordings
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
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
                    Delete {recordingToDelete ? "Recording" : `${selectedRecordings.size} Recordings`}
                  </Dialog.Title>
                  <p className="mt-2 text-sm text-gray-500">
                    {recordingToDelete
                      ? "Are you sure you want to delete this recording? The video file will be permanently removed."
                      : `Are you sure you want to delete ${selectedRecordings.size} recordings? All video files will be permanently removed.`}
                    {" "}This action cannot be undone.
                  </p>
                  <div className="mt-6 flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setRecordingToDelete(null);
                      }}
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

