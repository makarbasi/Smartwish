// utils/request_utils.ts
import { ApiResponse } from "@/types/general_types";
import { signOut } from "next-auth/react";

/* ──────────────────────────────────────────────────────────────
   URL builder (Original - Unchanged)
──────────────────────────────────────────────────────────────── */
function normalizeBaseUrl(url?: string): string {
  if (!url) return "";
  return url.replace(/\/+$/, "");
}

export function DynamicRouter(
  service: string,
  endpoint: string,
  params?: Record<string, any>,
  trailingSlash = true
) {
  const base = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  let url = `${base}/${service}/${endpoint}`;
  if (trailingSlash) url += "/";
  if (params) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    url += `?${qs}`;
  }
  return url;
}

/* ──────────────────────────────────────────────────────────────
   NEW URL builder for Detail Routes
──────────────────────────────────────────────────────────────── */
/**
 * Creates a URL for a detail endpoint (e.g., /api/service/endpoint/id/).
 * This is used for GET, PUT, DELETE requests on a specific resource.
 * @param service - The API service name (e.g., "project").
 * @param endpoint - The resource endpoint (e.g., "generated-rfp").
 * @param id - The unique identifier of the resource.
 * @param trailingSlash - Whether to add a trailing slash.
 * @returns The formatted URL string.
 */
export function DynamicDetailRouter(
  service: string,
  endpoint: string,
  id: string | number,
  trailingSlash = true
) {
  const base = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  let url = `${base}/${service}/${endpoint}/${id}`;
  if (trailingSlash) url += "/";
  return url;
}

/* ──────────────────────────────────────────────────────────────
   Auth.js session type
──────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────
   GET helper with Bearer token
──────────────────────────────────────────────────────────────── */
async function tryRefresh(session: AuthSession): Promise<boolean> {
  if (!session?.user?.refresh_token) return false;
  try {
    console.log("[tryRefresh] Attempting to refresh token");
    const url = DynamicRouter("auth", "refresh", undefined, false);
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        refresh_token: session.user.refresh_token
      })
    });
    if (!res.ok) {
      console.log("[tryRefresh] Failed with status:", res.status);
      return false;
    }
    const json = await res.json();
    console.log("[tryRefresh] Successfully refreshed token");
    // Mutate session in-place so callers reuse the new token without a reload
    session.user.access_token = json.access_token;
    if (json.refresh_token) {
      session.user.refresh_token = json.refresh_token;
    }
    // Update the expiration time
    if (json.expires_in) {
      const accessMs = json.expires_in * 1000; // Convert seconds to ms
      const safetyMs = 5 * 60 * 1000; // 5m margin
      session.user.access_expires = Date.now() + (accessMs - safetyMs);
    }
    return true;
  } catch (error) {
    console.log("[tryRefresh] Error:", error);
    return false;
  }
}

// Check if token is expired or will expire soon (within 5 minutes)
function isTokenExpiredSoon(session: AuthSession): boolean {
  if (!session?.user?.access_expires) return false;
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
  return session.user.access_expires < fiveMinutesFromNow;
}

// Proactively refresh token if it's expiring soon
async function ensureValidToken(session: AuthSession): Promise<void> {
  if (isTokenExpiredSoon(session)) {
    console.log("[ensureValidToken] Token expiring soon, refreshing proactively");
    await tryRefresh(session);
  }
}

async function isTokenInvalid(res: Response): Promise<boolean> {
  try {
    const clone = res.clone();
    const data = await clone.json().catch(() => null as any);
    const detail = (data && (data.detail || data.message)) as string | undefined;
    const code = data && (data.code as string | undefined);
    if (code === "token_not_valid") return true;
    if (typeof detail === "string" && detail.toLowerCase().includes("token not valid")) return true;
    return false;
  } catch {
    return false;
  }
}

function redirectToLogin(): never {
  if (typeof window !== "undefined") {
    try {
      // Use Auth.js signOut
      signOut({ callbackUrl: "/" });
    } catch {
      window.location.href = "/";
    }
  }
  throw new Error("Unauthorized – redirecting to sign-in");
}

export async function authGet<T>(
  input: RequestInfo,
  session: AuthSession
): Promise<ApiResponse<T>> {
  // Proactively refresh token if it's expiring soon
  await ensureValidToken(session);

  const doFetch = async () =>
    fetch(input, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.user.access_token}`,
      },
      credentials: "include",
    });

  console.log("[authGet] →", input);
  let res = await doFetch();
  if (res.status === 401) {
    const invalid = await isTokenInvalid(res);
    const refreshed = await tryRefresh(session);
    if (refreshed) res = await doFetch();
    if (!refreshed || res.status === 401 || (invalid && !(await tryRefresh(session)))) {
      redirectToLogin();
    }
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return (await res.json()) as ApiResponse<T>;
}

/* ──────────────────────────────────────────────────────────────
   NEW GET helper for downloading files
──────────────────────────────────────────────────────────────── */
/**
 * Performs an authenticated GET request to download a file.
 * Returns the raw Response object on success to allow for blob processing.
 * @param input - The URL to fetch.
 * @param session - The user session containing the access token.
 * @returns A Promise that resolves to the raw Response object.
 */
export async function authDownload(
  input: RequestInfo,
  session: AuthSession
): Promise<Response> {
  // Proactively refresh token if it's expiring soon
  await ensureValidToken(session);

  const doFetch = async () =>
    fetch(input, {
      headers: {
        Authorization: `Bearer ${session.user.access_token}`,
      },
      credentials: "include",
    });

  console.log("[authDownload] →", input);
  let res = await doFetch();
  if (res.status === 401) {
    const invalid = await isTokenInvalid(res);
    const refreshed = await tryRefresh(session);
    if (refreshed) res = await doFetch();
    if (!refreshed || res.status === 401 || (invalid && !(await tryRefresh(session)))) {
      redirectToLogin();
    }
  }

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`HTTP ${res.status}: ${errorJson.message || res.statusText}`);
  }
  return res;
}

/* ──────────────────────────────────────────────────────────────
   Internal work-horse for POST / PUT / DELETE
──────────────────────────────────────────────────────────────── */
async function _request<T>(
  method: "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  body: any,
  session?: AuthSession
): Promise<ApiResponse<T>> {
  // Proactively refresh token if it's expiring soon
  if (session) {
    await ensureValidToken(session);
  }

  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.user.access_token}`;

  let requestBody: BodyInit | undefined = body;

  // Only stringify / set JSON header when body is *not* FormData
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    requestBody =
      body !== undefined && body !== null ? JSON.stringify(body) : undefined;
  }

  console.log(`[${method}] →`, url, body ?? "");
  const doFetch = async () =>
    fetch(url, {
      method,
      headers,
      credentials: "include",
      body: requestBody,
    });

  let res = await doFetch();
  if (res.status === 401 && session) {
    const invalid = await isTokenInvalid(res);
    const refreshed = await tryRefresh(session);
    if (refreshed) {
      headers.Authorization = `Bearer ${session.user.access_token}`;
      res = await doFetch();
    }
    if (!refreshed || res.status === 401 || (invalid && !(await tryRefresh(session)))) {
      redirectToLogin();
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  if (method === "DELETE" && res.status === 204) {
    return { statusCode: 204, message: "Deleted", data: null } as ApiResponse<any>;
  }

  try {
    const json = (await res.json()) as any;
    // If backend returns raw model on 201, wrap it to our ApiResponse shape
    if (json && typeof json === "object" && (json.statusCode === undefined || json.data === undefined)) {
      return {
        statusCode: res.status,
        message: res.statusText || "Success",
        data: json,
      } as ApiResponse<any>;
    }
    return json as ApiResponse<T>;
  } catch {
    return { statusCode: res.status, message: res.statusText, data: null } as ApiResponse<any>;
  }
}

/* ──────────────────────────────────────────────────────────────
   Exposed helpers
──────────────────────────────────────────────────────────────── */
export function postRequest<T = any>(
  url: string,
  body?: any,
  session?: AuthSession
) {
  return _request<T>("POST", url, body, session);
}

export function putRequest<T = any>(
  url: string,
  body?: any,
  session?: AuthSession
) {
  return _request<T>("PUT", url, body, session);
}

export function patchRequest<T = any>(
  url: string,
  body?: any,
  session?: AuthSession
) {
  return _request<T>("PATCH", url, body, session);
}

export function deleteRequest<T = any>(
  url: string,
  session?: AuthSession
) {
  return _request<T>("DELETE", url, null, session);
}

/* ──────────────────────────────────────────────────────────────
   Token refresh utilities for manual use
──────────────────────────────────────────────────────────────── */

/**
 * Manually refresh the access token using the refresh token
 * @param session - The current session object
 * @returns Promise<boolean> - true if refresh was successful
 */
export async function refreshAccessToken(session: AuthSession): Promise<boolean> {
  return await tryRefresh(session);
}

/**
 * Check if the current access token is expired or will expire soon
 * @param session - The current session object
 * @returns boolean - true if token needs refreshing
 */
export function isAccessTokenExpiring(session: AuthSession): boolean {
  return isTokenExpiredSoon(session);
}

/**
 * Ensure the access token is valid, refreshing if necessary
 * @param session - The current session object
 * @returns Promise<void>
 */
export async function ensureAccessTokenValid(session: AuthSession): Promise<void> {
  await ensureValidToken(session);
}

/* ──────────────────────────────────────────────────────────────
   Generic fetcher for SWR
──────────────────────────────────────────────────────────────── */
export async function fetcher<T>(
  input: RequestInfo,
  session?: AuthSession
): Promise<ApiResponse<T>> {
  // Proactively refresh token if session is provided and token is expiring
  if (session) {
    await ensureValidToken(session);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session) headers.Authorization = `Bearer ${session.user.access_token}`;

  console.log("[fetcher] →", input);
  const res = await fetch(input, {
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return (await res.json()) as ApiResponse<T>;
}