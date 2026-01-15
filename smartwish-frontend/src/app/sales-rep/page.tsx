"use client";

import { useState, useEffect } from "react";
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  ComputerDesktopIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

interface EarningsData {
  transactions: Array<{
    id: string;
    date: string;
    kioskName: string;
    kioskId: string;
    productType: string;
    productName: string;
    yourEarnings: number;
  }>;
  totalEarnings: number;
  earningsByKiosk: Array<{
    kioskId: string;
    kioskName: string;
    total: number;
    count: number;
  }>;
  total: number;
}

export default function SalesRepDashboard() {
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("salesRepUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem("salesRepUser");
      if (!storedUser) {
        throw new Error("Not authenticated");
      }

      const user = JSON.parse(storedUser);
      
      const response = await fetch("/api/sales-rep/earnings", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here&apos;s your earnings overview
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Earnings */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <CurrencyDollarIcon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-emerald-100 text-sm">Total Earnings</p>
              <p className="text-3xl font-bold">
                ${earnings?.totalEarnings?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>
        </div>

        {/* Commission Rate */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <ArrowTrendingUpIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Commission Rate</p>
              <p className="text-3xl font-bold text-gray-900">
                {user?.commissionPercent || 10}%
              </p>
            </div>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Transactions</p>
              <p className="text-3xl font-bold text-gray-900">
                {earnings?.total || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings by Kiosk */}
      {earnings?.earningsByKiosk && earnings.earningsByKiosk.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ComputerDesktopIcon className="h-5 w-5 text-gray-400" />
              Earnings by Kiosk
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {earnings.earningsByKiosk.map((kiosk) => (
                <div
                  key={kiosk.kioskId}
                  className="p-4 bg-gray-50 rounded-lg"
                >
                  <p className="font-medium text-gray-900">{kiosk.kioskName}</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <p className="text-2xl font-bold text-emerald-600">
                      ${kiosk.total.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {kiosk.count} sales
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {earnings?.transactions && earnings.transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              Recent Transactions
            </h2>
          </div>
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
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Your Commission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {earnings.transactions.slice(0, 10).map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {tx.kioskName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <span className="capitalize">
                        {tx.productType?.replace(/_/g, " ")}
                      </span>
                      {tx.productName && (
                        <span className="block text-xs text-gray-400">
                          {tx.productName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                      ${tx.yourEarnings.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!earnings?.transactions || earnings.transactions.length === 0) && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <CurrencyDollarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No earnings yet</h3>
          <p className="text-gray-500 mt-1">
            Your commissions will appear here once sales are made at your assigned kiosks.
          </p>
        </div>
      )}
    </div>
  );
}
