import NextAuth, { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { DynamicRouter } from "@/utils/request_utils";

/* ──────────────────────────────────────────────────────────
   Helper: call your /auth/refresh endpoint
─────────────────────────────────────────────────────────── */
async function refreshAccessToken(refreshToken: string) {
  try {
    if (!refreshToken) {
      console.error("[TOKEN_REFRESH] ❌ No refresh token provided");
      return null;
    }
    
    const shortRefreshToken = refreshToken.substring(0, 20) + "...";
    console.log(`[TOKEN_REFRESH] 🔄 Starting refresh with token: ${shortRefreshToken}`);
    console.log(`[TOKEN_REFRESH] ⏰ Current time: ${new Date().toISOString()}`);
    
    const url = DynamicRouter("auth", "refresh", undefined, false);
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });

    if (!res.ok) {
      console.error(`[TOKEN_REFRESH] ❌ Refresh failed: ${res.status} - ${res.statusText}`);
      
      // Handle different error types
      if (res.status === 401 || res.status === 403) {
        console.error("[TOKEN_REFRESH] 💀 Refresh token appears to be expired or invalid");
      } else if (res.status === 429) {
        console.error("[TOKEN_REFRESH] 🚫 Rate limited - too many refresh requests");
        // For rate limiting, we might want to retry after a delay, but for now just fail
      } else if (res.status >= 500) {
        console.error("[TOKEN_REFRESH] 🔥 Server error during token refresh");
      }
      
      return null;
    }

    const json = await res.json();
    
    if (!json.access_token) {
      console.error("[TOKEN_REFRESH] ❌ No access token in refresh response:", json);
      return null;
    }

    // Backend returns: { access_token, refresh_token, token_type, expires_in, user }
    const accessMs = (json.expires_in || 60) * 1000; // Convert seconds to ms (default 1 minute)
    const safetyMs = 5 * 1000; // 5s margin for short tokens
    const expirationTime = Date.now() + (accessMs - safetyMs);
    
    console.log(`[TOKEN_REFRESH] ✅ Refresh successful!`);
    console.log(`[TOKEN_REFRESH] 📊 Token details:`);
    console.log(`  - New Access Token: ${json.access_token.substring(0, 20)}...`);
    console.log(`  - New Refresh Token: ${json.refresh_token ? json.refresh_token.substring(0, 20) + '...' : 'Same as before'}`);
    console.log(`  - Expires in: ${json.expires_in} seconds`);
    console.log(`  - Expiration time: ${new Date(expirationTime).toISOString()}`);
    console.log(`  - User: ${json.user?.email || 'Unknown'}`);
    
    const result: any = {
      access_token: json.access_token,
      access_expires: expirationTime,
      user: json.user
    };
    
    // Only include refresh_token if backend provides a new one
    // Otherwise, keep using the original refresh token
    if (json.refresh_token) {
      result.refresh_token = json.refresh_token;
    }
    
    return result;
  } catch (err) {
    console.error("[TOKEN_REFRESH] 🌐 Network error:", err);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
   NextAuth
─────────────────────────────────────────────────────────── */

// Validate required environment variables
if (!process.env.AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET is missing. Please set AUTH_SECRET in your .env.local file. " +
    "You can generate one by running: openssl rand -base64 32"
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: { 
        email: { label: "Email", type: "email" }, 
        password: { label: "Password", type: "password" } 
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        try {
          const url = DynamicRouter("auth", "login");
          console.log("NextAuth login URL:", url);
          console.log("NextAuth login request:", { email: credentials.email, password: "***" });
          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              email: credentials.email, 
              password: credentials.password 
            }),
          });

          console.log("NextAuth login response status:", resp.status);
          if (!resp.ok) {
            const errorText = await resp.text();
            console.log("NextAuth login error:", errorText);
            throw new Error("Invalid credentials");
          }

          const data = await resp.json();
          
          // Backend returns: { access_token, refresh_token, token_type, expires_in, user }
          if (!data.user?.id) {
            throw new Error("Invalid credentials");
          }

          // Return user with tokens attached for JWT callback
          const user: User = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            image: data.user.profileImage,
            // Attach tokens to user object
            access_token: data.access_token,
            refresh_token: data.refresh_token, // Use the actual refresh_token from backend
            isEmailVerified: data.user.isEmailVerified
          } as any;

          return user;
        } catch (error) {
          console.error("Authorization error:", error);
          throw new Error("Invalid credentials");
        }
      },
    }),
  ],

  session: { strategy: "jwt" },
  jwt: { maxAge: 60 * 60 * 24 * 30 }, // 30 days

  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign-in
      if (user) {
        // Handle Google OAuth sign-in
        if (account?.provider === "google") {
          try {
            // Call backend OAuth callback to create/link user and get JWT
            const backendUrl = DynamicRouter("auth", "oauth/google-callback", undefined, false);
            const resp = await fetch(backendUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: user.id,
                email: user.email,
                name: user.name,
                picture: user.image,
                provider: "google"
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              token.user = data.user;
              token.access_token = data.access_token;
              token.refresh_token = data.refresh_token;
              token.access_expires = Date.now() + (60 * 1000 - 5 * 1000);
              return token;
            }
          } catch (error) {
            console.error("Google OAuth backend integration error:", error);
          }
        }

        // Handle credentials sign-in
        token.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          isEmailVerified: (user as any).isEmailVerified
        };
        token.access_token = (user as any).access_token;
        token.refresh_token = (user as any).refresh_token;
        // Set expiration (backend default is 1 minute for testing)
        token.access_expires = Date.now() + (60 * 1000 - 5 * 1000);
        return token;
      }

      // Check if access token is still valid (with 5 second buffer for short tokens)
      const exp = token.access_expires as number | undefined;
      const fiveSecondsFromNow = Date.now() + (5 * 1000);
      
      console.log(`[JWT_CALLBACK] 🔍 Token validation:`);
      console.log(`  - Current time: ${new Date().toISOString()}`);
      console.log(`  - Token expires at: ${exp ? new Date(exp).toISOString() : 'Unknown'}`);
      console.log(`  - Time until expiry: ${exp ? Math.round((exp - Date.now()) / 1000) : 'Unknown'} seconds`);
      console.log(`  - Buffer check time: ${new Date(fiveSecondsFromNow).toISOString()}`);
      
      if (exp && exp > fiveSecondsFromNow) {
        console.log(`[JWT_CALLBACK] ✅ Token is still valid, no refresh needed`);
        return token;
      }
      
      console.log(`[JWT_CALLBACK] ⚠️ Token is expired/expiring soon, needs refresh`);
      const refreshTokenShort = (token.refresh_token as string)?.substring(0, 20) + "...";
      console.log(`[JWT_CALLBACK] 🔑 Using refresh token: ${refreshTokenShort}`);

      // Token expired or expiring soon, try to refresh
      console.log("[NextAuth] Token expired or expiring, attempting refresh");
      const refreshed = await refreshAccessToken(token.refresh_token as string);
      if (!refreshed) {
        console.error("[NextAuth] Failed to refresh token - refresh token may be expired");
        // Return an empty object to trigger sign-out
        return {};
      }

      console.log("[NextAuth] Token refreshed successfully");
      // Update token with refreshed data, but preserve original refresh token if not provided
      const originalRefreshToken = token.refresh_token;
      Object.assign(token, refreshed);
      
      // If backend didn't provide a new refresh token, keep the original
      if (!refreshed.refresh_token && originalRefreshToken) {
        token.refresh_token = originalRefreshToken;
        console.log("[NextAuth] ♻️ Keeping original refresh token for absolute expiration");
      }
      
      return token;
    },

    async session({ session, token }) {
      // If token is empty (refresh failed), return null to sign out
      if (!token.user || !token.access_token) {
        console.log("[NextAuth] No valid token data, signing out user");
        return null;
      }

      // Make user data and tokens available to the client
      session.user = token.user as any;
      (session.user as any).access_token = token.access_token;
      (session.user as any).refresh_token = token.refresh_token;
      (session.user as any).access_expires = token.access_expires;
      
      // Add error if token refresh failed
      if (token.error) {
        (session as any).error = token.error;
      }
      
      return session;
    },

    async signIn() { 
      return true; 
    },
    
    async redirect({ url, baseUrl }) {
      return url.startsWith("/") ? `${baseUrl}${url}` :
             new URL(url).origin === baseUrl ? url : baseUrl;
    },
  },

  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },

  trustHost: true,
});
