"use client";

import { useSession } from "next-auth/react";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

/**
 * Example component showing how to use automatic token refresh
 * This component can be included in your app layout or main pages
 */
export function TokenRefreshExample() {
  const { data: session } = useSession();
  const { isExpiring, refreshToken } = useTokenRefresh(60000); // Check every 60 seconds

  if (!session?.user) {
    return null; // Don't show anything if user is not logged in
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded shadow border text-sm">
      <h3 className="font-semibold mb-2">Token Status</h3>
      <div className="space-y-1">
        <div>
          Status: <span className={isExpiring ? "text-red-600" : "text-green-600"}>
            {isExpiring ? "Expiring Soon" : "Valid"}
          </span>
        </div>
        <div>
          Expires: {session.user.access_expires 
            ? new Date(session.user.access_expires).toLocaleTimeString() 
            : "Unknown"}
        </div>
        <button 
          onClick={refreshToken}
          className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
        >
          Manual Refresh
        </button>
      </div>
    </div>
  );
}