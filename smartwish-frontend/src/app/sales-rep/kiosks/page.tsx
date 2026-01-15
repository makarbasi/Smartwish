"use client";

import { useState, useEffect } from "react";
import {
  ComputerDesktopIcon,
  MapPinIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

interface Kiosk {
  id: string;
  kioskId: string;
  name: string | null;
  storeId: string | null;
  isActive: boolean;
}

export default function SalesRepKiosksPage() {
  const [loading, setLoading] = useState(true);
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("salesRepUser");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    loadKiosks();
  }, []);

  const loadKiosks = async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem("salesRepUser");
      if (!storedUser) {
        throw new Error("Not authenticated");
      }

      const user = JSON.parse(storedUser);
      
      const response = await fetch("/api/sales-rep/kiosks", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        // API might not exist yet, show empty state
        setKiosks([]);
        return;
      }

      const data = await response.json();
      setKiosks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error loading kiosks:", err);
      setKiosks([]);
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Kiosks</h1>
        <p className="mt-1 text-gray-600">
          Kiosks assigned to you for commission earning
        </p>
      </div>

      {/* Commission Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <CurrencyDollarIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-800">
              Your commission rate: <span className="font-bold">{user?.commissionPercent || 10}%</span>
            </p>
            <p className="text-xs text-emerald-600">
              You earn this percentage on all eligible sales from your assigned kiosks
            </p>
          </div>
        </div>
      </div>

      {/* Kiosks Grid */}
      {kiosks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kiosks.map((kiosk) => (
            <div
              key={kiosk.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <ComputerDesktopIcon className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {kiosk.name || kiosk.kioskId}
                    </h3>
                    {kiosk.storeId && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <MapPinIcon className="h-4 w-4" />
                        {kiosk.storeId}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      kiosk.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {kiosk.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Kiosk ID: <code className="bg-gray-100 px-1 rounded">{kiosk.kioskId}</code>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ComputerDesktopIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No kiosks assigned</h3>
          <p className="text-gray-500 mt-1">
            Contact your admin to get kiosks assigned to your account.
          </p>
        </div>
      )}
    </div>
  );
}
