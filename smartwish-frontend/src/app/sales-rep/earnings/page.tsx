"use client";

import { useState, useEffect } from "react";
import {
  CurrencyDollarIcon,
  CalendarIcon,
  ArrowPathIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";

interface Transaction {
  id: string;
  date: string;
  kioskName: string;
  kioskId: string;
  productType: string;
  productName: string;
  yourEarnings: number;
}

interface EarningsData {
  transactions: Transaction[];
  totalEarnings: number;
  earningsByKiosk: Array<{
    kioskId: string;
    kioskName: string;
    total: number;
    count: number;
  }>;
  total: number;
}

export default function SalesRepEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadEarnings();
  }, [days]);

  const loadEarnings = async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem("salesRepUser");
      if (!storedUser) {
        throw new Error("Not authenticated");
      }

      const user = JSON.parse(storedUser);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const response = await fetch(
        `/api/sales-rep/earnings?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load earnings");
      }

      const data = await response.json();
      setEarnings(data);
    } catch (err: any) {
      console.error("Error loading earnings:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatProductType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Earnings</h1>
          <p className="mt-1 text-gray-600">
            Your commission history and breakdown
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:ring-0 pr-8"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
          <button
            onClick={loadEarnings}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadEarnings}
            className="mt-4 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Earnings Summary</h2>
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                Last {days} days
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-emerald-100 text-sm">Total Earned</p>
                <p className="text-4xl font-bold">
                  ${earnings?.totalEarnings?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Total Sales</p>
                <p className="text-4xl font-bold">
                  {earnings?.total || 0}
                </p>
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Avg. per Sale</p>
                <p className="text-4xl font-bold">
                  ${earnings && earnings.total > 0
                    ? (earnings.totalEarnings / earnings.total).toFixed(2)
                    : "0.00"}
                </p>
              </div>
            </div>
          </div>

          {/* Earnings by Kiosk */}
          {earnings?.earningsByKiosk && earnings.earningsByKiosk.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FunnelIcon className="h-5 w-5 text-gray-400" />
                  By Kiosk
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Kiosk
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Sales Count
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Your Earnings
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {earnings.earningsByKiosk.map((kiosk) => (
                      <tr key={kiosk.kioskId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {kiosk.kioskName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">
                          {kiosk.count}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-emerald-600 text-right">
                          ${kiosk.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                Transaction History
              </h2>
            </div>
            {earnings?.transactions && earnings.transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Kiosk
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Commission
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {earnings.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {tx.kioskName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {formatProductType(tx.productType)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {tx.productName || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                          ${tx.yourEarnings.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <CurrencyDollarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No transactions in this period</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
