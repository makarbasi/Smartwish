"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  XCircleIcon,
  LockClosedIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

function ManagerSignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    if (token) {
      verifyToken();
    } else {
      setError("No invitation token provided. Please check your email for the invitation link.");
      setVerifying(false);
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/managers/verify-invite-token?token=${encodeURIComponent(token!)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid or expired token");
      }

      setTokenInfo({
        email: data.email,
        name: data.name,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || "Invalid or expired invitation token");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError("Please enter and confirm your password");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/managers/complete-setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token!,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set up account");
      }

      setSuccess(true);
      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        router.push("/sign-in?callbackUrl=/manager");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to set up account");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <ArrowPathIcon className="h-12 w-12 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-gray-600">Verifying invitation token...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Set Up Successfully!</h2>
          <p className="text-gray-600 mb-6">
            Your password has been set. Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
            <LockClosedIcon className="h-8 w-8 text-teal-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Up Your Account</h1>
          {tokenInfo && (
            <p className="text-gray-600">
              Welcome, <span className="font-semibold">{tokenInfo.name}</span>!
              <br />
              <span className="text-sm text-gray-500">{tokenInfo.email}</span>
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{error}</p>
              {error.includes("expired") && (
                <p className="text-xs text-red-600 mt-1">
                  Please contact your administrator for a new invitation.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Setup Form */}
        {tokenInfo && !error && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  placeholder="Enter your password (min. 8 characters)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 8 characters long
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  placeholder="Confirm your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                    Setting up account...
                  </span>
                ) : (
                  "Set Up Account"
                )}
              </button>
            </form>
          </div>
        )}

        {/* Back to Sign In */}
        <div className="mt-6 text-center">
          <a
            href="/sign-in"
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            Already have an account? Sign in →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ManagerSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <ManagerSignupContent />
    </Suspense>
  );
}
