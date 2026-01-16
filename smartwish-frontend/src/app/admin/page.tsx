"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ComputerDesktopIcon,
  UserGroupIcon,
  GiftIcon,
  CreditCardIcon,
  ChartBarIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  BuildingStorefrontIcon,
  TicketIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

interface DashboardStats {
  kiosks: {
    total: number;
    active: number;
    loading: boolean;
    error: string | null;
  };
  managers: {
    total: number;
    active: number;
    pending: number;
    loading: boolean;
    error: string | null;
  };
  giftCardBrands: {
    total: number;
    active: number;
    loading: boolean;
    error: string | null;
  };
  giftCards: {
    total: number;
    activeCards: number;
    totalValue: number;
    outstandingBalance: number;
    loading: boolean;
    error: string | null;
  };
}

const quickActions = [
  {
    name: "Manage Kiosks",
    description: "Configure kiosk settings, themes, features, and printer profiles",
    href: "/admin/kiosks",
    icon: ComputerDesktopIcon,
    iconBg: "bg-blue-500",
    iconColor: "text-white",
  },
  {
    name: "Manage Managers",
    description: "Invite store managers and assign them to kiosks",
    href: "/admin/managers",
    icon: UserGroupIcon,
    iconBg: "bg-emerald-500",
    iconColor: "text-white",
  },
  {
    name: "Gift Card Brands",
    description: "Create and manage gift card products for the marketplace",
    href: "/admin/gift-card-brands",
    icon: GiftIcon,
    iconBg: "bg-purple-500",
    iconColor: "text-white",
  },
  {
    name: "Gift Cards",
    description: "View issued cards, transaction history, and reports",
    href: "/admin/gift-cards",
    icon: CreditCardIcon,
    iconBg: "bg-amber-500",
    iconColor: "text-white",
  },
  {
    name: "Kiosk Chat",
    description: "Chat with kiosk users in real-time and provide support",
    href: "/admin/chat",
    icon: ChatBubbleLeftRightIcon,
    iconBg: "bg-indigo-500",
    iconColor: "text-white",
  },
];

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    kiosks: { total: 0, active: 0, loading: true, error: null },
    managers: { total: 0, active: 0, pending: 0, loading: true, error: null },
    giftCardBrands: { total: 0, active: 0, loading: true, error: null },
    giftCards: {
      total: 0,
      activeCards: 0,
      totalValue: 0,
      outstandingBalance: 0,
      loading: true,
      error: null,
    },
  });
  
  // Ref to prevent duplicate API calls (React Strict Mode runs effects twice)
  const hasLoadedStats = useRef(false);

  useEffect(() => {
    // Only fetch once to prevent duplicate calls from React Strict Mode
    if (hasLoadedStats.current) return;
    hasLoadedStats.current = true;
    
    // Fetch all stats in parallel
    fetchKioskStats();
    fetchManagerStats();
    fetchGiftCardBrandStats();
    fetchGiftCardStats();
  }, []);

  const fetchKioskStats = async () => {
    try {
      const response = await fetch("/api/admin/kiosks");
      if (response.ok) {
        const data = await response.json();
        const kiosks = Array.isArray(data) ? data : data.data || [];
        setStats((prev) => ({
          ...prev,
          kiosks: {
            total: kiosks.length,
            active: kiosks.filter((k: any) => k.status === "active").length,
            loading: false,
            error: null,
          },
        }));
      } else {
        throw new Error("Failed to fetch");
      }
    } catch {
      setStats((prev) => ({
        ...prev,
        kiosks: { ...prev.kiosks, loading: false, error: "Failed to load" },
      }));
    }
  };

  const fetchManagerStats = async () => {
    try {
      const response = await fetch("/api/admin/managers");
      if (response.ok) {
        const data = await response.json();
        const managers = Array.isArray(data) ? data : data.data || [];
        setStats((prev) => ({
          ...prev,
          managers: {
            total: managers.length,
            active: managers.filter((m: any) => m.status === "active").length,
            pending: managers.filter((m: any) => m.status === "pending").length,
            loading: false,
            error: null,
          },
        }));
      } else {
        throw new Error("Failed to fetch");
      }
    } catch {
      setStats((prev) => ({
        ...prev,
        managers: { ...prev.managers, loading: false, error: "Failed to load" },
      }));
    }
  };

  const fetchGiftCardBrandStats = async () => {
    try {
      const response = await fetch("/api/admin/gift-card-brands?includeInactive=true");
      if (response.ok) {
        const data = await response.json();
        const brands = data.data || [];
        setStats((prev) => ({
          ...prev,
          giftCardBrands: {
            total: brands.length,
            active: brands.filter((b: any) => b.is_active).length,
            loading: false,
            error: null,
          },
        }));
      } else {
        throw new Error("Failed to fetch");
      }
    } catch {
      setStats((prev) => ({
        ...prev,
        giftCardBrands: {
          ...prev.giftCardBrands,
          loading: false,
          error: "Failed to load",
        },
      }));
    }
  };

  const fetchGiftCardStats = async () => {
    try {
      const response = await fetch("/api/admin/gift-cards/reports?days=30");
      if (response.ok) {
        const data = await response.json();
        setStats((prev) => ({
          ...prev,
          giftCards: {
            total: data.summary?.totalIssued || 0,
            activeCards: data.summary?.statusCounts?.active || 0,
            totalValue: data.summary?.totalInitialValue || 0,
            outstandingBalance: data.summary?.totalOutstandingBalance || 0,
            loading: false,
            error: null,
          },
        }));
      } else {
        throw new Error("Failed to fetch");
      }
    } catch {
      setStats((prev) => ({
        ...prev,
        giftCards: {
          ...prev.giftCards,
          loading: false,
          error: "Failed to load",
        },
      }));
    }
  };

  const StatCard = ({
    title,
    value,
    subValue,
    icon: Icon,
    loading,
    error,
    color,
    href,
  }: {
    title: string;
    value: number | string;
    subValue?: string;
    icon: any;
    loading: boolean;
    error: string | null;
    color: string;
    href: string;
  }) => (
    <Link
      href={href}
      className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-indigo-200 transition-all group"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
          ) : error ? (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
              {subValue && (
                <p className="mt-1 text-sm text-gray-500">{subValue}</p>
              )}
            </>
          )}
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} transition-transform group-hover:scale-110`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRightIcon className="h-5 w-5 text-indigo-500" />
      </div>
    </Link>
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Welcome header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
            <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}!
            </h1>
            <p className="text-sm text-gray-500">
              Here&apos;s what&apos;s happening with SmartWish today
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Active Kiosks"
          value={stats.kiosks.active}
          subValue={`${stats.kiosks.total} total`}
          icon={ComputerDesktopIcon}
          loading={stats.kiosks.loading}
          error={stats.kiosks.error}
          color="bg-blue-500"
          href="/admin/kiosks"
        />
        <StatCard
          title="Managers"
          value={stats.managers.active}
          subValue={
            stats.managers.pending > 0
              ? `${stats.managers.pending} pending`
              : `${stats.managers.total} total`
          }
          icon={UserGroupIcon}
          loading={stats.managers.loading}
          error={stats.managers.error}
          color="bg-emerald-500"
          href="/admin/managers"
        />
        <StatCard
          title="Gift Card Brands"
          value={stats.giftCardBrands.active}
          subValue={`${stats.giftCardBrands.total} total`}
          icon={GiftIcon}
          loading={stats.giftCardBrands.loading}
          error={stats.giftCardBrands.error}
          color="bg-purple-500"
          href="/admin/gift-card-brands"
        />
        <StatCard
          title="Gift Cards Issued"
          value={stats.giftCards.total}
          subValue={`$${stats.giftCards.outstandingBalance.toLocaleString()} outstanding`}
          icon={CreditCardIcon}
          loading={stats.giftCards.loading}
          error={stats.giftCards.error}
          color="bg-amber-500"
          href="/admin/gift-cards"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="relative flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-indigo-200 transition-all group"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${action.iconBg}`}
              >
                <action.icon className={`h-6 w-6 ${action.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {action.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {action.description}
                </p>
              </div>
              <ArrowRightIcon className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:text-indigo-500 transition-all absolute right-4 top-1/2 -translate-y-1/2" />
            </Link>
          ))}
        </div>
      </div>

      {/* Feature overview */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 lg:p-8 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Admin Capabilities</h2>
            <p className="text-indigo-100 max-w-2xl">
              As an administrator, you have full control over the SmartWish
              platform. Manage kiosks, configure settings, invite managers, and
              oversee the gift card system.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm">
              <BuildingStorefrontIcon className="h-5 w-5" />
              <span>Kiosk Management</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm">
              <UserGroupIcon className="h-5 w-5" />
              <span>Team Management</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm">
              <TicketIcon className="h-5 w-5" />
              <span>Gift Cards</span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm">
              <ChartBarIcon className="h-5 w-5" />
              <span>Analytics</span>
            </div>
          </div>
        </div>

        {/* Detailed capabilities */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white/10 rounded-xl p-4">
            <ComputerDesktopIcon className="h-8 w-8 mb-3" />
            <h3 className="font-semibold mb-1">Kiosk Configuration</h3>
            <ul className="text-sm text-indigo-100 space-y-1">
              <li>• Configure themes & features</li>
              <li>• Setup printer profiles</li>
              <li>• Manage API keys</li>
              <li>• View session history</li>
              <li>• Assign managers</li>
            </ul>
          </div>

          <div className="bg-white/10 rounded-xl p-4">
            <UserGroupIcon className="h-8 w-8 mb-3" />
            <h3 className="font-semibold mb-1">Manager Control</h3>
            <ul className="text-sm text-indigo-100 space-y-1">
              <li>• Invite new managers</li>
              <li>• Generate access tokens</li>
              <li>• Assign to kiosks</li>
              <li>• Monitor activity</li>
              <li>• Revoke access</li>
            </ul>
          </div>

          <div className="bg-white/10 rounded-xl p-4">
            <GiftIcon className="h-8 w-8 mb-3" />
            <h3 className="font-semibold mb-1">Gift Card Brands</h3>
            <ul className="text-sm text-indigo-100 space-y-1">
              <li>• Create brand products</li>
              <li>• Set amount limits</li>
              <li>• Configure expiration</li>
              <li>• Toggle promotions</li>
              <li>• Manage logos</li>
            </ul>
          </div>

          <div className="bg-white/10 rounded-xl p-4">
            <CreditCardIcon className="h-8 w-8 mb-3" />
            <h3 className="font-semibold mb-1">Gift Card Operations</h3>
            <ul className="text-sm text-indigo-100 space-y-1">
              <li>• View all issued cards</li>
              <li>• Check transaction history</li>
              <li>• Void/suspend cards</li>
              <li>• Generate reports</li>
              <li>• Track redemptions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>
          Need help? Check out the{" "}
          <a href="#" className="text-indigo-600 hover:underline">
            Admin Documentation
          </a>{" "}
          or contact support.
        </p>
      </div>
    </div>
  );
}
