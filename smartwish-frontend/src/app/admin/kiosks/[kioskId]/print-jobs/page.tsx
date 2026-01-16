"use client";

import { useState, useEffect, use, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PrinterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  GiftIcon,
  TrashIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface PrintLog {
  id: string;
  kioskConfigId: string;
  kiosk?: {
    name: string;
    kioskId: string;
  };
  productType: string;
  productId?: string;
  productName?: string;
  pdfUrl?: string;
  price?: number;
  paperType?: string;
  paperSize?: string;
  copies: number;
  status: string;
  errorMessage?: string;
  reprintCount?: number;
  refundStatus?: string;
  giftCardBrand?: string;
  giftCardAmount?: number;
  createdAt: string;
  completedAt?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? "http://localhost:3001" 
    : "https://smartwish.onrender.com");

export default function KioskPrintJobsPage({
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
  const [logs, setLogs] = useState<PrintLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [kioskName, setKioskName] = useState<string | null>(null);
  
  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDeleteRangeModal, setShowDeleteRangeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editTargetLog, setEditTargetLog] = useState<PrintLog | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [editError, setEditError] = useState<string>("");
  const [deleteRangeStart, setDeleteRangeStart] = useState<string>("");
  const [deleteRangeEnd, setDeleteRangeEnd] = useState<string>("");

  // Reprint state
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/sign-in?callbackUrl=/admin/kiosks/${kioskId}/print-jobs`);
    }
  }, [status, router, kioskId]);

  // Load print logs
  useEffect(() => {
    if (status !== "authenticated") return;
    loadLogs();
  }, [status, kioskId, selectedStatus, selectedProductType, startDate, endDate, page]);

  const loadLogs = async () => {
    if (!session?.user?.access_token) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      });
      
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedProductType) params.set("productType", selectedProductType);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await fetch(`${BACKEND_URL}/admin/print-logs/kiosk/${kioskId}?${params}`, {
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Kiosk not found or no print logs available");
          return;
        }
        throw new Error("Failed to load print logs");
      }
      
      const data = await response.json();
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
      
      // Get kiosk name from first log if available
      if (data.logs?.length > 0 && data.logs[0].kiosk?.name) {
        setKioskName(data.logs[0].kiosk.name);
      }
      
      setError(null);
    } catch (err: any) {
      console.error("Error fetching print logs:", err);
      setError(err.message || "Failed to load print logs");
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async (logId: string) => {
    if (!session?.user?.access_token) return;
    if (!confirm("Are you sure you want to reprint this job?")) return;
    
    setReprintingId(logId);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/print-logs/${logId}/reprint`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reprint');
      }
      
      alert(`Reprint job sent! This is reprint #${data.printLog?.reprintCount || 1}`);
      loadLogs();
    } catch (err) {
      alert(`Reprint failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setReprintingId(null);
    }
  };

  const handleDelete = async () => {
    if (!session?.user?.access_token || !deleteTargetId) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/print-logs/${deleteTargetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
        },
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete');
      }
      
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      loadLogs();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!session?.user?.access_token || selectedIds.size === 0) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/print-logs/bulk/delete`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete');
      }
      
      const result = await response.json();
      alert(`Deleted ${result.deleted} print logs`);
      setShowBulkDeleteModal(false);
      setSelectedIds(new Set());
      loadLogs();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRange = async () => {
    if (!session?.user?.access_token) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/print-logs/kiosk/${kioskId}/range`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          startDate: deleteRangeStart || undefined, 
          endDate: deleteRangeEnd || undefined,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete');
      }
      
      const result = await response.json();
      alert(`Deleted ${result.deleted} print logs`);
      setShowDeleteRangeModal(false);
      setDeleteRangeStart("");
      setDeleteRangeEnd("");
      loadLogs();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async () => {
    if (!session?.user?.access_token || !editTargetLog) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/print-logs/${editTargetLog.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.user.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: editStatus, 
          errorMessage: editError || undefined,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update');
      }
      
      setShowEditModal(false);
      setEditTargetLog(null);
      loadLogs();
    } catch (err) {
      alert(`Update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (log: PrintLog) => {
    setEditTargetLog(log);
    setEditStatus(log.status);
    setEditError(log.errorMessage || "");
    setShowEditModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-3 w-3" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-3 w-3" />
            Failed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <ArrowPathIcon className="h-3 w-3 animate-spin" />
            Processing
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <ClockIcon className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map(l => l.id)));
    }
  };

  const totalPages = Math.ceil(totalLogs / pageSize);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/admin/kiosks" 
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Kiosks
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Print Jobs: {kioskName || kioskId}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          View, manage, and delete print history for this kiosk.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
            className="rounded-lg border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          
          <select
            value={selectedProductType}
            onChange={(e) => { setSelectedProductType(e.target.value); setPage(0); }}
            className="rounded-lg border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="greeting-card">Greeting Card</option>
            <option value="sticker">Sticker</option>
            <option value="photo">Photo</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
            className="rounded-lg border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
            className="rounded-lg border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="End Date"
          />
          
          <button
            onClick={loadLogs}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="text-sm text-indigo-700 font-medium">
            {selectedIds.size} item(s) selected
          </span>
          <button
            onClick={() => setShowBulkDeleteModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      )}

      {/* Delete Range Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowDeleteRangeModal(true)}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
        >
          <TrashIcon className="h-4 w-4" />
          Delete by Date Range
        </button>
      </div>

      {/* Print Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Print History</h2>
          <p className="text-sm text-gray-500">{totalLogs} total records</p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
            <p className="mt-2 text-gray-500">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <PrinterIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No print logs found.</p>
            <p className="text-sm text-gray-400">Prints from this kiosk will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === logs.length && logs.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gift Card
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reprints
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className={`hover:bg-gray-50 ${selectedIds.has(log.id) ? 'bg-indigo-50' : ''}`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(log.id)}
                          onChange={() => toggleSelect(log.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{log.productName || log.productId?.substring(0, 12) || "-"}</div>
                        <div className="text-xs text-gray-400">{log.productType}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        ${parseFloat(String(log.price || 0)).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {log.giftCardBrand ? (
                          <div className="flex items-center gap-1">
                            <GiftIcon className="h-4 w-4 text-purple-500" />
                            <span className="text-purple-700">{log.giftCardBrand}</span>
                            <span className="text-gray-500">${parseFloat(String(log.giftCardAmount || 0)).toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                        {log.refundStatus && (
                          <span className="ml-1 text-xs text-orange-600">({log.refundStatus})</span>
                        )}
                        {log.errorMessage && (
                          <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                        {log.reprintCount || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Edit button */}
                          <button
                            onClick={() => openEditModal(log)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>

                          {/* Reprint button */}
                          {log.status === 'completed' && !log.refundStatus && log.pdfUrl && (
                            <button
                              onClick={() => handleReprint(log.id)}
                              disabled={reprintingId === log.id}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                              title="Reprint"
                            >
                              {reprintingId === log.id ? (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                              ) : (
                                <DocumentDuplicateIcon className="h-4 w-4" />
                              )}
                            </button>
                          )}

                          {/* Delete button */}
                          <button
                            onClick={() => { setDeleteTargetId(log.id); setShowDeleteModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
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
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalLogs)} of {totalLogs}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Single Modal */}
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
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Delete Print Log
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">This action cannot be undone.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
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

      {/* Bulk Delete Modal */}
      <Transition appear show={showBulkDeleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowBulkDeleteModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900">
                        Delete {selectedIds.size} Print Logs
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">This action cannot be undone.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      onClick={() => setShowBulkDeleteModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={deleting}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? "Deleting..." : `Delete ${selectedIds.size} Items`}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Range Modal */}
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
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                    Delete Print Logs by Date Range
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date (optional)
                      </label>
                      <input
                        type="date"
                        value={deleteRangeStart}
                        onChange={(e) => setDeleteRangeStart(e.target.value)}
                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date (optional)
                      </label>
                      <input
                        type="date"
                        value={deleteRangeEnd}
                        onChange={(e) => setDeleteRangeEnd(e.target.value)}
                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-sm text-amber-600">
                      ⚠️ Warning: If no dates are specified, ALL print logs for this kiosk will be deleted.
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      onClick={() => setShowDeleteRangeModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteRange}
                      disabled={deleting}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
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

      {/* Edit Modal */}
      <Transition appear show={showEditModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowEditModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                    Edit Print Log
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Error Message
                      </label>
                      <textarea
                        value={editError}
                        onChange={(e) => setEditError(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="Optional error message..."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      onClick={() => setShowEditModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditSave}
                      disabled={deleting}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? "Saving..." : "Save Changes"}
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
