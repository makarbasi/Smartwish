"use client";

import { useState, useEffect } from "react";
import {
  PrinterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  GiftIcon,
} from "@heroicons/react/24/outline";

interface PrintLog {
  id: string;
  kioskId: string;
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

interface Kiosk {
  id: string;
  kioskId: string;
  name: string;
}

export default function PrintLogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<PrintLog[]>([]);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  
  // Reprint state
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  
  // Filters
  const [selectedKiosk, setSelectedKiosk] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadLogs();
  }, [selectedKiosk, selectedStatus, selectedProductType, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      });
      
      if (selectedKiosk) params.set("kioskId", selectedKiosk);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedProductType) params.set("productType", selectedProductType);

      const response = await fetch(`/api/manager/print-logs?${params}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load print logs");
      }
      
      const data = await response.json();
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
      setKiosks(data.kiosks || []);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching print logs:", err);
      setError(err.message || "Failed to load print logs");
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async (logId: string) => {
    if (!confirm("Are you sure you want to reprint this job?")) return;
    
    setReprintingId(logId);
    try {
      const response = await fetch(`/api/manager/print-logs/${logId}/reprint`, {
        method: 'POST',
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

  const totalPages = Math.ceil(totalLogs / pageSize);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Print Logs</h1>
        <p className="mt-2 text-sm text-gray-600">
          View print history, monitor status, and reprint completed jobs.
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
            value={selectedKiosk}
            onChange={(e) => { setSelectedKiosk(e.target.value); setPage(0); }}
            className="rounded-lg border-gray-300 text-sm focus:border-teal-500 focus:ring-teal-500"
          >
            <option value="">All Kiosks</option>
            {kiosks.map((kiosk) => (
              <option key={kiosk.id} value={kiosk.id}>
                {kiosk.name || kiosk.kioskId}
              </option>
            ))}
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
            className="rounded-lg border-gray-300 text-sm focus:border-teal-500 focus:ring-teal-500"
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
            className="rounded-lg border-gray-300 text-sm focus:border-teal-500 focus:ring-teal-500"
          >
            <option value="">All Types</option>
            <option value="greeting-card">Greeting Card</option>
            <option value="sticker">Sticker</option>
            <option value="photo">Photo</option>
          </select>
          
          <button
            onClick={loadLogs}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Print Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Print History</h2>
          <p className="text-sm text-gray-500">{totalLogs} total records</p>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-teal-600" />
            <p className="mt-2 text-gray-500">Loading...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <PrinterIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No print logs found.</p>
            <p className="text-sm text-gray-400">Prints from your kiosks will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kiosk
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
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.kiosk?.name || log.kioskId?.substring(0, 8)}
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
                          <p className="text-xs text-red-500 mt-1 max-w-xs truncate">{log.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">
                        {log.reprintCount || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {log.status === 'completed' && !log.refundStatus && log.pdfUrl ? (
                          <button
                            onClick={() => handleReprint(log.id)}
                            disabled={reprintingId === log.id || (log.reprintCount || 0) >= 3}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={(log.reprintCount || 0) >= 3 ? "Max reprints (3) reached" : "Reprint this job"}
                          >
                            {reprintingId === log.id ? (
                              <ArrowPathIcon className="h-3 w-3 animate-spin" />
                            ) : (
                              <DocumentDuplicateIcon className="h-3 w-3" />
                            )}
                            Reprint
                          </button>
                        ) : log.refundStatus ? (
                          <span className="text-xs text-orange-500">Refunded</span>
                        ) : !log.pdfUrl ? (
                          <span className="text-xs text-gray-400">No PDF</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
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
    </div>
  );
}
