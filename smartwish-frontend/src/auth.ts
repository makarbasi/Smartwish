import NextAuth, { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { DynamicRouter } from "@/utils/request_utils";

/* ──────────────────────────────────────────────────────────
   Helper: call your /auth/refresh endpoint
─────────────────────────────────────────────────────────── */
async function refreshAccessToken(refreshToken: string) {
  try {
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

    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);

    const json = await res.json();
    // Backend returns: { access_token, refresh_token, token_type, expires_in, user }
    const accessMs = (json.expires_in || 86400) * 1000; // Convert seconds to ms
    const safetyMs = 5 * 60 * 1000; // 5m margin
    
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token, // Backend returns new refresh token
      access_expires: Date.now() + (accessMs - safetyMs),
      user: json.user
    };
  } catch (err) {
    console.error("[NextAuth] token refresh error", err);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
   NextAuth
─────────────────────────────────────────────────────────── */
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
              token.access_expires = Date.now() + (24 * 60 * 60 * 1000 - 5 * 60 * 1000);
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
        // Set expiration (backend default is 24 hours)
        token.access_expires = Date.now() + (24 * 60 * 60 * 1000 - 5 * 60 * 1000);
        return token;
      }

      // Check if access token is still valid (with 5 minute buffer)
      const exp = token.access_expires as number | undefined;
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      if (exp && exp > fiveMinutesFromNow) {
        return token;
      }

      // Token expired or expiring soon, try to refresh
      console.log("[NextAuth] Token expired or expiring, attempting refresh");
      const refreshed = await refreshAccessToken(token.refresh_token as string);
      if (!refreshed) {
        console.error("[NextAuth] Failed to refresh token");
        token.error = "RefreshAccessTokenError";
        return token;
      }

      console.log("[NextAuth] Token refreshed successfully");
      // Update token with refreshed data
      Object.assign(token, refreshed);
      return token;
    },

    async session({ session, token }) {
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
