"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useKiosk } from "@/contexts/KioskContext";
import {
  ComputerDesktopIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface AssignedKiosk {
  id: string;
  kioskId: string;
  name: string | null;
  storeId: string | null;
  config: Record<string, unknown>;
  assignedAt: string;
}

export default function KioskActivationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isActivated, kioskInfo, activateKiosk, deactivateKiosk, loading: kioskLoading } = useKiosk();

  const [kiosks, setKiosks] = useState<AssignedKiosk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Fetch assigned kiosks when logged in
  useEffect(() => {
    if (status === "authenticated") {
      fetchAssignedKiosks();
    }
  }, [status]);

  const fetchAssignedKiosks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/manager/kiosks");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch kiosks");
      }
      const data = await response.json();
      setKiosks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching kiosks:", err);
      setError(err instanceof Error ? err.message : "Failed to load kiosks");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setLoginError("Invalid email or password");
      }
    } catch (err) {
      setLoginError("An error occurred during login");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleActivateKiosk = async (kiosk: AssignedKiosk) => {
    setActivating(kiosk.id);
    try {
      await activateKiosk(kiosk.id);
      // Redirect to home page after activation
      router.push("/");
    } catch (err) {
      console.error("Failed to activate kiosk:", err);
      setError("Failed to activate kiosk. Please try again.");
    } finally {
      setActivating(null);
    }
  };

  const handleChangeKiosk = () => {
    deactivateKiosk();
  };

  // Loading state
  if (status === "loading" || kioskLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                <ComputerDesktopIcon className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Kiosk Setup</h1>
              <p className="mt-2 text-gray-600">
                Sign in with your manager credentials to activate this kiosk
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {loginError && (
                <div className="p-4 bg-red-50 rounded-lg flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{loginError}</p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="manager@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loggingIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <ArrowRightOnRectangleIcon className="w-5 h-5" />
                    Sign In
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Show current activation status if already activated
  if (isActivated && kioskInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Kiosk Active</h1>
              <p className="mt-2 text-gray-600">
                This device is currently configured as:
              </p>
            </div>

            {/* Current Kiosk Info */}
            <div className="bg-gray-50 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ComputerDesktopIcon className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {kioskInfo.name || kioskInfo.kioskId}
                  </h3>
                  {kioskInfo.storeId && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <BuildingStorefrontIcon className="w-4 h-4" />
                      {kioskInfo.storeId}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Version {kioskInfo.version}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => router.push("/")}
                className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
              >
                Continue to App
              </button>
              <button
                onClick={handleChangeKiosk}
                className="w-full py-3 px-4 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Change Kiosk
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show kiosk selection
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
            <ComputerDesktopIcon className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Select a Kiosk</h1>
          <p className="mt-2 text-gray-600">
            Choose which kiosk to activate on this device
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Signed in as: {session?.user?.email}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 max-w-lg mx-auto">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchAssignedKiosks}
                className="text-sm font-medium text-red-800 underline hover:no-underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading your kiosks...</p>
          </div>
        ) : kiosks.length === 0 ? (
          /* No Kiosks */
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg max-w-lg mx-auto">
            <ComputerDesktopIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No Kiosks Assigned</h3>
            <p className="text-gray-600 mt-2 px-6">
              You don&apos;t have any kiosks assigned to your account. Please contact your
              administrator to get access to kiosks.
            </p>
          </div>
        ) : (
          /* Kiosk Grid */
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {kiosks.map((kiosk) => (
              <div
                key={kiosk.id}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ComputerDesktopIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {kiosk.name || kiosk.kioskId}
                      </h3>
                      {kiosk.storeId && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <BuildingStorefrontIcon className="w-4 h-4" />
                          {kiosk.storeId}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Config Summary */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-500">Theme:</div>
                      <div className="text-gray-900 font-medium">
                        {(kiosk.config?.theme as string) || "Default"}
                      </div>
                      <div className="text-gray-500">Microphone:</div>
                      <div className="text-gray-900 font-medium">
                        {kiosk.config?.micEnabled !== false ? "Enabled" : "Disabled"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6">
                  <button
                    onClick={() => handleActivateKiosk(kiosk)}
                    disabled={activating === kiosk.id}
                    className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {activating === kiosk.id ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        Activate This Kiosk
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
