"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCardIcon,
  MinusCircleIcon,
  PrinterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ComputerDesktopIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

interface PrintStats {
  totalPrints: number;
  completedPrints: number;
  failedPrints: number;
  totalSales: number;
  transactionFees: number;
  netProfit: number;
  storeOwnerShare: number;
}

const quickActions = [
  {
    name: "Redeem Gift Card",
    description: "Scan QR code, check balance, and redeem from gift card",
    href: "/manager/gift-cards",
    icon: MinusCircleIcon,
    color: "bg-teal-500",
  },
];

export default function ManagerDashboard() {
  const [stats, setStats] = useState<PrintStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/manager/print-logs/stats?days=30');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Manager Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome to the SmartWish Manager Portal. Manage gift cards, view earnings, and monitor your kiosks.
        </p>
      </div>

      {/* Earnings Summary */}
      {!loading && stats && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BanknotesIcon className="h-6 w-6" />
              Your Earnings (Last 30 Days)
            </h2>
            <Link 
              href="/manager/earnings"
              className="text-sm bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 transition-colors"
            >
              View Details →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm opacity-80">Total Sales</p>
              <p className="text-2xl font-bold">${stats.totalSales?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Transaction Fees</p>
              <p className="text-2xl font-bold">-${stats.transactionFees?.toFixed(2) || '0.00'}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Net Profit</p>
              <p className="text-2xl font-bold">${stats.netProfit?.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <p className="text-sm opacity-90">Your Share</p>
              <p className="text-3xl font-bold">${stats.storeOwnerShare?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Print Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-full">
                <PrinterIcon className="h-6 w-6 text-indigo-600" />
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
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedPrints}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
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

      {loading && (
        <div className="flex items-center justify-center py-12 mb-8">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="relative flex items-center space-x-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-teal-300 transition-all"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${action.color}`}
              >
                <action.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{action.name}</p>
                <p className="text-sm text-gray-500 truncate">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/manager/kiosks"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-teal-300 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-100 rounded-full">
              <ComputerDesktopIcon className="h-6 w-6 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">My Kiosks</p>
              <p className="text-sm text-gray-500">View and manage your kiosks</p>
            </div>
          </div>
        </Link>

        <Link
          href="/manager/print-logs"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-teal-300 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-full">
              <PrinterIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Print Logs</p>
              <p className="text-sm text-gray-500">View print history and reprint</p>
            </div>
          </div>
        </Link>

        <Link
          href="/manager/earnings"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-teal-300 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Earnings</p>
              <p className="text-sm text-gray-500">View revenue breakdown</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Gift Card Management Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100">
              <CreditCardIcon className="h-6 w-6 text-teal-600" aria-hidden="true" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Gift Card Management</h3>
              <p className="text-sm text-gray-500">
                Check balances, process redemptions, and view transaction history
              </p>
            </div>
          </div>
          
          <div className="mt-6 border-t border-gray-100 pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">How it works:</h4>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 text-xs font-medium mr-3">1</span>
                <span><strong>Scan QR Code:</strong> Use the camera to scan the gift card QR code, or enter the card number manually.</span>
              </li>
              <li className="flex items-start">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 text-xs font-medium mr-3">2</span>
                <span><strong>Enter PIN:</strong> Enter the 4-digit PIN to verify and automatically load the balance.</span>
              </li>
              <li className="flex items-start">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600 text-xs font-medium mr-3">3</span>
                <span><strong>Redeem:</strong> View the balance and enter the amount to deduct from the card.</span>
              </li>
            </ol>
          </div>

          <div className="mt-6">
            <Link
              href="/manager/gift-cards"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
            >
              <CreditCardIcon className="h-5 w-5 mr-2" />
              Open Gift Card Manager
            </Link>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-8 rounded-lg bg-teal-50 p-4 border border-teal-200">
        <h3 className="text-sm font-medium text-teal-800">Tips for Managers</h3>
        <ul className="mt-2 text-sm text-teal-700 list-disc list-inside space-y-1">
          <li>Always verify the customer&apos;s PIN before processing any transaction</li>
          <li>Check the card balance before attempting to redeem</li>
          <li>Gift cards cannot be redeemed for more than their current balance</li>
          <li>Partial redemptions are allowed - the remaining balance stays on the card</li>
          <li>You can reprint failed print jobs up to 3 times from the Print Logs page</li>
        </ul>
      </div>
    </div>
  );
}
