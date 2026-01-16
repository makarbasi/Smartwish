"use client";

import { useState, useEffect } from "react";
import {
  BanknotesIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

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
  totalSales: number;
  transactionFees: number;
  netProfit: number;
  storeOwnerShare: number;
  revenueByKiosk: RevenueByKiosk[];
}

export default function EarningsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PrintStats | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadStats();
  }, [days]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/manager/print-logs/stats?days=${days}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load stats");
      }
      
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      setError(err.message || "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Earnings</h1>
          <p className="mt-2 text-sm text-gray-600">
            View your revenue breakdown and earnings by kiosk.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:ring-0"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
          <button
            onClick={loadStats}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-teal-600" />
          <p className="mt-2 text-gray-500">Loading earnings...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadStats}
            className="mt-4 text-sm text-red-600 hover:text-red-800"
          >
            Try again
          </button>
        </div>
      ) : stats ? (
        <div className="space-y-8">
          {/* Revenue Summary */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BanknotesIcon className="h-6 w-6" />
                Earnings Summary
              </h2>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                Last {days} days
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
              <div className="bg-white/20 rounded-lg p-4">
                <p className="text-sm opacity-90">Your Share</p>
                <p className="text-4xl font-bold">${stats.storeOwnerShare?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          </div>

          {/* Print Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-100 rounded-full">
                  <ChartBarIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Prints</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPrints}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. per Print</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${stats.totalPrints > 0 ? (stats.totalSales / stats.totalPrints).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <BanknotesIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg. Share per Print</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${stats.totalPrints > 0 ? (stats.storeOwnerShare / stats.totalPrints).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue by Kiosk */}
          {stats.revenueByKiosk && stats.revenueByKiosk.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CurrencyDollarIcon className="h-5 w-5 text-gray-400" />
                  Revenue by Kiosk
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kiosk</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prints</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sales</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fees</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Share %</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Your Share</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.revenueByKiosk.map((kiosk) => (
                      <tr key={kiosk.kioskId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {kiosk.kioskName || kiosk.kioskId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">{kiosk.printCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">${kiosk.totalSales.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-red-600 text-right">-${kiosk.transactionFees.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">${kiosk.netProfit.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 text-right">{kiosk.revenueSharePercent}%</td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600 text-right">
                          ${kiosk.storeOwnerShare.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Prints by Product Type */}
          {stats.printsByProductType && stats.printsByProductType.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-gray-400" />
                Prints by Product Type
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.printsByProductType.map((item) => (
                  <div key={item.productType} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 capitalize">{item.productType.replace('-', ' ')}</p>
                    <p className="text-xl font-bold text-gray-900">{item.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
