"use client";

import { useState, useEffect, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  GiftIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";

interface GiftCard {
  id: string;
  cardNumber: string;
  pin?: string; // PIN if available (may not be returned for security)
  initialBalance: number;
  currentBalance: number;
  status: string;
  issuedAt: string;
  activatedAt: string | null;
  expiresAt: string;
  purchaseOrderId: string | null;
  kioskId: string | null;
  brand: {
    id: string;
    name: string;
    slug: string;
    logo: string;
  } | null;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  timestamp: string;
}

interface BrandStats {
  id: string;
  name: string;
  slug: string;
  logo: string;
  isActive: boolean;
  totalCardsIssued: number;
  activeCards: number;
  depletedCards: number;
  totalValueIssued: number;
  outstandingBalance: number;
  totalRedeemed: number;
}

interface ReportData {
  summary: {
    totalIssued: number;
    totalInitialValue: number;
    totalOutstandingBalance: number;
    totalRedeemed: number;
    statusCounts: {
      active: number;
      depleted: number;
      expired: number;
      voided: number;
      suspended: number;
    };
  };
  period: {
    days: number;
    purchases: { count: number; total: number };
    redemptions: { count: number; total: number };
  };
  brandStats: BrandStats[];
  recentTransactions: any[];
}

export default function AdminGiftCardsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  // Card detail modal
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null);
  const [cardTransactions, setCardTransactions] = useState<Transaction[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Void modal
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<"cards" | "analytics">("analytics");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/sign-in?callbackUrl=/admin/gift-cards");
    }
  }, [status, router]);

  // Fetch data
  useEffect(() => {
    if (status === "authenticated") {
      fetchReport();
      fetchCards();
    }
  }, [status, page, search, statusFilter, brandFilter]);

  const fetchReport = async () => {
    try {
      const response = await fetch("/api/admin/gift-cards/reports?days=30");
      if (response.ok) {
        const data = await response.json();
        setReportData(data);
      }
    } catch (err) {
      console.error("Failed to fetch report:", err);
    }
  };

  const fetchCards = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (brandFilter) params.append("brandId", brandFilter);

      const response = await fetch(`/api/admin/gift-cards?${params}`);
      if (!response.ok) throw new Error("Failed to fetch cards");

      const data = await response.json();
      setCards(data.cards || []);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const fetchCardDetail = async (card: GiftCard) => {
    setSelectedCard(card);
    setShowDetailModal(true);
    setLoadingDetail(true);

    try {
      const response = await fetch(`/api/admin/gift-cards/${card.id}`);
      if (response.ok) {
        const data = await response.json();
        setCardTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to fetch card detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleVoidCard = async () => {
    if (!selectedCard) return;

    setVoiding(true);
    try {
      const response = await fetch(`/api/admin/gift-cards/${selectedCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "voided",
          reason: voidReason || "Voided by admin",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to void card");
      }

      // Refresh data
      fetchCards();
      fetchReport();
      setShowVoidModal(false);
      setShowDetailModal(false);
      setVoidReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to void card");
    } finally {
      setVoiding(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "depleted":
        return "bg-gray-100 text-gray-800";
      case "expired":
        return "bg-orange-100 text-orange-800";
      case "voided":
        return "bg-red-100 text-red-800";
      case "suspended":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Format card number as 16 digits with spaces (e.g., "1234 5678 9012 3456")
  const formatCardNumber = (cardNumber: string) => {
    // Remove any existing spaces and format as 16 digits
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.length === 16) {
      return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)} ${cleaned.slice(12, 16)}`;
    }
    // If not 16 digits, return as-is
    return cardNumber;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  if (status === "loading" || (loading && !reportData)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gift Cards</h1>
              <p className="mt-1 text-sm text-gray-500">
                View issued gift cards and analytics
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("analytics")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === "analytics"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <ChartBarIcon className="w-4 h-4 inline mr-1" />
                  Analytics
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === "cards"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <GiftIcon className="w-4 h-4 inline mr-1" />
                  Cards
                </button>
              </div>
              <button
                onClick={() => router.push("/admin/gift-card-brands")}
                className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
              >
                Manage Brands →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analytics View */}
        {viewMode === "analytics" && reportData && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <GiftIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Issued</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {reportData.summary.totalIssued}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CurrencyDollarIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Value Issued</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.summary.totalInitialValue)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <ClockIcon className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.summary.totalOutstandingBalance)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CheckCircleIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Redeemed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.summary.totalRedeemed)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Breakdown & Period Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Breakdown */}
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Card Status Breakdown
                </h3>
                <div className="space-y-3">
                  {Object.entries(reportData.summary.statusCounts).map(
                    ([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded-full ${
                              status === "active"
                                ? "bg-green-500"
                                : status === "depleted"
                                ? "bg-gray-400"
                                : status === "expired"
                                ? "bg-orange-500"
                                : status === "voided"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                          />
                          <span className="text-sm text-gray-600 capitalize">
                            {status}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {count}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Last 30 Days */}
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Last {reportData.period.days} Days
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Purchases</p>
                    <p className="text-2xl font-bold text-green-700">
                      {reportData.period.purchases.count}
                    </p>
                    <p className="text-sm text-green-600">
                      {formatCurrency(reportData.period.purchases.total)}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">Redemptions</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {reportData.period.redemptions.count}
                    </p>
                    <p className="text-sm text-purple-600">
                      {formatCurrency(reportData.period.redemptions.total)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Brand Stats Table */}
            {reportData.brandStats.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Performance by Brand
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Brand
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Issued
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Active
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Value
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Outstanding
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Redeemed
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.brandStats.map((brand) => (
                        <tr key={brand.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {brand.logo ? (
                                <img
                                  src={brand.logo}
                                  alt={brand.name}
                                  className="w-8 h-8 rounded object-contain bg-gray-100"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                                  <GiftIcon className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                              <span className="font-medium text-gray-900">
                                {brand.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                            {brand.totalCardsIssued}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                            {brand.activeCards}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                            {formatCurrency(brand.totalValueIssued)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                            {formatCurrency(brand.outstandingBalance)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                            {formatCurrency(brand.totalRedeemed)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cards View */}
        {viewMode === "cards" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                      }}
                      placeholder="Search by card number..."
                      className="w-full pl-10 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                  }}
                  className="rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="depleted">Depleted</option>
                  <option value="expired">Expired</option>
                  <option value="voided">Voided</option>
                </select>
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setBrandFilter("");
                    setPage(0);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>

            {/* Cards Table */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
              {cards.length === 0 ? (
                <div className="text-center py-12">
                  <GiftIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">
                    No gift cards found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {search || statusFilter
                      ? "Try adjusting your filters"
                      : "Gift cards will appear here after purchase"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Card Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            PIN
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Brand
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Balance
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Issued
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Expires
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {cards.map((card) => (
                          <tr key={card.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-mono text-sm text-gray-900">
                                {formatCardNumber(card.cardNumber)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {card.pin ? (
                                <span className="font-mono text-sm text-gray-900">
                                  {card.pin}
                                </span>
                              ) : (
                                <div>
                                  <span className="font-mono text-sm text-gray-500">
                                    N/A
                                  </span>
                                  <span className="text-xs text-gray-400 block">
                                    (Not stored)
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {card.brand?.logo ? (
                                  <img
                                    src={card.brand.logo}
                                    alt={card.brand.name}
                                    className="w-6 h-6 rounded object-contain bg-gray-100"
                                  />
                                ) : (
                                  <GiftIcon className="w-6 h-6 text-gray-400" />
                                )}
                                <span className="text-sm text-gray-600">
                                  {card.brand?.name || "Unknown"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(card.currentBalance)}
                              </span>
                              <span className="text-xs text-gray-500 block">
                                of {formatCurrency(card.initialBalance)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                  card.status
                                )}`}
                              >
                                {card.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(card.issuedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {new Date(card.expiresAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                onClick={() => fetchCardDetail(card)}
                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                              >
                                <EyeIcon className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                      <button
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        ← Previous
                      </button>
                      <span className="text-sm text-gray-600">
                        Page {page + 1} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Detail Modal */}
      <Transition appear show={showDetailModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowDetailModal(false)}
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  {selectedCard && (
                    <>
                      <div className="px-6 py-4 border-b border-gray-200">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Card Details
                        </Dialog.Title>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-500">Card Number</p>
                          <p className="text-sm font-mono text-gray-900">
                            {formatCardNumber(selectedCard.cardNumber)}
                          </p>
                          <p className="text-sm text-gray-500 mt-2">PIN</p>
                          <p className="text-sm font-mono text-gray-900">
                            {selectedCard.pin || "Not available (hashed for security)"}
                          </p>
                        </div>
                      </div>

                      <div className="p-6 space-y-4">
                        {/* Card Info */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Card Number</p>
                            <p className="font-mono font-medium">
                              {formatCardNumber(selectedCard.cardNumber)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">PIN</p>
                            {selectedCard.pin ? (
                              <p className="font-mono font-medium text-gray-900">
                                {selectedCard.pin}
                              </p>
                            ) : (
                              <div>
                                <p className="font-mono font-medium text-gray-500">
                                  N/A
                                </p>
                                <p className="text-xs text-gray-400">
                                  (Not stored for this card)
                                </p>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Brand</p>
                            <p className="font-medium">
                              {selectedCard.brand?.name || "Unknown"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                selectedCard.status
                              )}`}
                            >
                              {selectedCard.status}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Initial Balance</p>
                            <p className="font-medium">
                              {formatCurrency(selectedCard.initialBalance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Current Balance</p>
                            <p className="font-medium text-lg">
                              {formatCurrency(selectedCard.currentBalance)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Issued</p>
                            <p className="font-medium">
                              {new Date(selectedCard.issuedAt).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Expires</p>
                            <p className="font-medium">
                              {new Date(selectedCard.expiresAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Transactions */}
                        <div className="border-t pt-4">
                          <h4 className="font-medium text-gray-900 mb-3">
                            Transaction History
                          </h4>
                          {loadingDetail ? (
                            <div className="text-center py-4">
                              <ArrowPathIcon className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                            </div>
                          ) : cardTransactions.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              No transactions yet
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {cardTransactions.map((tx) => (
                                <div
                                  key={tx.id}
                                  className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                                >
                                  <div>
                                    <p className="font-medium capitalize">
                                      {tx.type}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(tx.timestamp).toLocaleString()}
                                    </p>
                                  </div>
                                  <span
                                    className={
                                      tx.amount >= 0
                                        ? "text-green-600 font-semibold"
                                        : "text-red-600 font-semibold"
                                    }
                                  >
                                    {tx.amount >= 0 ? "+" : ""}
                                    {formatCurrency(Math.abs(tx.amount))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-6 py-4 bg-gray-50 flex justify-between">
                        {selectedCard.status === "active" && (
                          <button
                            onClick={() => setShowVoidModal(true)}
                            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            <NoSymbolIcon className="h-4 w-4" />
                            Void Card
                          </button>
                        )}
                        <button
                          onClick={() => setShowDetailModal(false)}
                          className="ml-auto px-4 py-2 bg-white text-gray-700 rounded-lg ring-1 ring-gray-300 hover:bg-gray-50"
                        >
                          Close
                        </button>
                      </div>
                    </>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Void Confirmation Modal */}
      <Transition appear show={showVoidModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => !voiding && setShowVoidModal(false)}
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
                  <div className="flex items-center gap-3 text-red-600 mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6" />
                    <Dialog.Title className="text-lg font-semibold">
                      Void Gift Card
                    </Dialog.Title>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    This will permanently void the gift card and forfeit any remaining
                    balance ({formatCurrency(selectedCard?.currentBalance || 0)}). This
                    action cannot be undone.
                  </p>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason (optional)
                    </label>
                    <input
                      type="text"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="e.g., Fraud suspected"
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowVoidModal(false)}
                      disabled={voiding}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVoidCard}
                      disabled={voiding}
                      className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg disabled:opacity-50"
                    >
                      {voiding ? "Voiding..." : "Void Card"}
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
