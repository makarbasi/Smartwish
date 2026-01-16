import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { refreshAccessToken, isAccessTokenExpiring } from "@/utils/request_utils";

interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    access_token: string;
    refresh_token?: string;
    access_expires?: number;
  };
  error?: string;
}

/**
 * Custom hook for automatic token refresh
 * Automatically refreshes access tokens before they expire
 * @param intervalMs - How often to check for token expiration (default: 60 seconds)
 */
export function useTokenRefresh(intervalMs: number = 60000) {
  const { data: session, update } = useSession();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    const authSession = session as unknown as AuthSession;

    // Function to check and refresh token
    const checkAndRefreshToken = async () => {
      try {
        if (isAccessTokenExpiring(authSession)) {
          console.log("[useTokenRefresh] Token expiring, attempting refresh");
          const refreshed = await refreshAccessToken(authSession);
          
          if (refreshed) {
            console.log("[useTokenRefresh] Token refreshed successfully");
            // Update the session with new token data
            await update({
              access_token: authSession.user.access_token,
              refresh_token: authSession.user.refresh_token,
              access_expires: authSession.user.access_expires,
            });
          } else {
            console.error("[useTokenRefresh] Failed to refresh token");
          }
        }
      } catch (error) {
        console.error("[useTokenRefresh] Error during token refresh:", error);
      }
    };

    // Set up interval to check token expiration
    intervalRef.current = setInterval(checkAndRefreshToken, intervalMs);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [session, intervalMs, update]);

  // Manual refresh function that components can call
  const manualRefresh = async () => {
    if (!session?.user) return false;
    
    const authSession = session as unknown as AuthSession;
    const refreshed = await refreshAccessToken(authSession);
    
    if (refreshed) {
      await update({
        access_token: authSession.user.access_token,
        refresh_token: authSession.user.refresh_token,
        access_expires: authSession.user.access_expires,
      });
    }
    
    return refreshed;
  };

  return {
    isExpiring: session ? isAccessTokenExpiring(session as unknown as AuthSession) : false,
    refreshToken: manualRefresh,
  };
}