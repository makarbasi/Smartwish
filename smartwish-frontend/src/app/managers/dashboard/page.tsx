"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PrinterIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
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
  paperType?: string;
  paperSize?: string;
  trayNumber?: number;
  copies: number;
  status: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface RevenueByKiosk {
  kioskId: string;
  kioskName: string;
  printCount: number;
  totalSales: number;
  transactionFees: number;
  netProfit: number;
  revenueSharePercent: number;
  storeOwnerShare: number;
}

interface PrintStats {
  totalPrints: number;
  completedPrints: number;
  failedPrints: number;
  printsByKiosk: Array<{ kioskId: string; kioskName: string; count: string }>;
  printsByProductType: Array<{ productType: string; count: string }>;
  recentActivity: PrintLog[];
  // Revenue data
  totalSales: number;
  transactionFees: number;
  netProfit: number;
  storeOwnerShare: number;
  revenueByKiosk: RevenueByKiosk[];
}

interface Kiosk {
  id: string;
  kioskId: string;
  name: string;
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PrintStats | null>(null);
  const [logs, setLogs] = useState<PrintLog[]>([]);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  
  // Filters
  const [selectedKiosk, setSelectedKiosk] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Check if manager is logged in
  useEffect(() => {
    const managerSession = localStorage.getItem("smartwish_manager_session");
    if (!managerSession) {
      router.push("/managers/login");
      return;
    }
    
    // Load data
    loadStats();
    loadLogs();
  }, [router]);

  // Reload logs when filters change
  useEffect(() => {
    loadLogs();
  }, [selectedKiosk, selectedStatus, selectedProductType, page]);

  const getAuthHeaders = () => {
    const session = localStorage.getItem("smartwish_manager_session");
    if (!session) return {};
    const { token } = JSON.parse(session);
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `/api/managers/print-logs/stats?days=30`,
        { headers: getAuthHeaders() }
      );
      
      if (!response.ok) throw new Error("Failed to load stats");
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

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

      const response = await fetch(
        `/api/managers/print-logs?${params}`,
        { headers: getAuthHeaders() }
      );
      
      if (!response.ok) throw new Error("Failed to load print logs");
      
      const data = await response.json();
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
      setKiosks(data.kiosks || []);
      setError(null);
    } catch (err) {
      console.error("Error loading logs:", err);
      setError("Failed to load print logs");
    } finally {
      setLoading(false);
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

  const handleLogout = () => {
    localStorage.removeItem("smartwish_manager_session");
    router.push("/managers/login");
  };

  const totalPages = Math.ceil(totalLogs / pageSize);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PrinterIcon className="h-8 w-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Revenue Summary - Highlighted */}
        {stats && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 mb-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BanknotesIcon className="h-6 w-6" />
                Your Earnings (Last 30 Days)
              </h2>
              <span className="text-sm opacity-80">Revenue share calculated after transaction fees</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm opacity-80">Total Sales</p>
                <p className="text-3xl font-bold">${stats.totalSales?.toFixed(2) || '0.00'}</p>
              </div>
              <div>
                <p className="text-sm opacity-80">Transaction Fees</p>
                <p className="text-3xl font-bold">-${stats.transactionFees?.toFixed(2) || '0.00'}</p>
                <p className="text-xs opacity-70">$0.50 + 3% per sale</p>
              </div>
              <div>
                <p className="text-sm opacity-80">Net Profit</p>
                <p className="text-3xl font-bold">${stats.netProfit?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-3">
                <p className="text-sm opacity-90">Your Share</p>
                <p className="text-4xl font-bold">${stats.storeOwnerShare?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Print Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 rounded-full">
                  <PrinterIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Prints (30 days)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPrints}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedPrints}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Failed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.failedPrints}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Revenue by Kiosk */}
        {stats && stats.revenueByKiosk && stats.revenueByKiosk.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
              Revenue by Kiosk
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kiosk</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Prints</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fees</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Share %</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Your Share</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.revenueByKiosk.map((kiosk) => (
                    <tr key={kiosk.kioskId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{kiosk.kioskName || kiosk.kioskId}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">{kiosk.printCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">${kiosk.totalSales.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right">-${kiosk.transactionFees.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">${kiosk.netProfit.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">{kiosk.revenueSharePercent}%</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600 text-right">${kiosk.storeOwnerShare.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Prints by Kiosk (count) */}
        {stats && stats.printsByKiosk.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5 text-gray-400" />
              Prints by Kiosk
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.printsByKiosk.map((item) => (
                <div key={item.kioskId} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 truncate">{item.kioskName || item.kioskId}</p>
                  <p className="text-xl font-bold text-gray-900">{item.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <select
              value={selectedKiosk}
              onChange={(e) => { setSelectedKiosk(e.target.value); setPage(0); }}
              className="rounded-md border-gray-300 text-sm"
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
              className="rounded-md border-gray-300 text-sm"
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
              className="rounded-md border-gray-300 text-sm"
            >
              <option value="">All Types</option>
              <option value="greeting-card">Greeting Card</option>
              <option value="sticker">Sticker</option>
              <option value="photo">Photo</option>
              <option value="label">Label</option>
            </select>
            
            <button
              onClick={() => { loadStats(); loadLogs(); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Print Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Print History</h2>
            <p className="text-sm text-gray-500">{totalLogs} total records</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Loading...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No print logs found. Prints from your kiosks will appear here.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kiosk
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paper
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.kiosk?.name || log.kioskId?.substring(0, 8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.productName || log.productId?.substring(0, 12) || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.productType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.paperSize || "-"} {log.trayNumber ? `(Tray ${log.trayNumber})` : ""}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(log.status)}
                          {log.errorMessage && (
                            <p className="text-xs text-red-500 mt-1">{log.errorMessage}</p>
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
                      className="px-3 py-1 rounded border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1 rounded border text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
