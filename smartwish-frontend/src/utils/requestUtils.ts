/**
 * Request Utilities for Rate Limit Prevention
 * 
 * This module provides:
 * 1. Request deduplication - prevents duplicate concurrent requests
 * 2. Response caching - caches responses with TTL
 * 3. Exponential backoff - for retry logic after rate limits
 * 4. Request throttling - limits requests per time window
 */

// ==================== Request Deduplication ====================

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest>();

/**
 * Deduplicates concurrent requests to the same endpoint.
 * If a request to the same URL is already in-flight, returns the existing promise.
 * 
 * @param key - Unique key for the request (usually the URL)
 * @param fetcher - Function that performs the actual fetch
 * @returns The response from the fetch
 */
export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);
  
  // If there's a pending request less than 100ms old, return it
  if (existing && Date.now() - existing.timestamp < 100) {
    return existing.promise;
  }

  const promise = fetcher().finally(() => {
    // Clean up after request completes
    setTimeout(() => {
      const current = pendingRequests.get(key);
      if (current?.promise === promise) {
        pendingRequests.delete(key);
      }
    }, 100);
  });

  pendingRequests.set(key, { promise, timestamp: Date.now() });
  return promise;
}

// ==================== Response Caching ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const responseCache = new Map<string, CacheEntry<any>>();

/**
 * Caches the response from a fetch with a TTL.
 * Returns cached data if still valid, otherwise fetches fresh data.
 * 
 * @param key - Cache key (usually the URL)
 * @param fetcher - Function that performs the actual fetch
 * @param ttlMs - Time-to-live in milliseconds (default: 30 seconds)
 * @returns The response data
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 30000
): Promise<T> {
  const cached = responseCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }

  const data = await deduplicatedFetch(key, fetcher);
  
  responseCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });

  return data;
}

/**
 * Invalidates a specific cache entry
 */
export function invalidateCache(key: string): void {
  responseCache.delete(key);
}

/**
 * Clears the entire cache
 */
export function clearCache(): void {
  responseCache.clear();
}

// ==================== Exponential Backoff ====================

interface BackoffState {
  retryCount: number;
  nextRetryTime: number;
}

const backoffStates = new Map<string, BackoffState>();

/**
 * Calculates the next retry delay using exponential backoff with jitter.
 * 
 * @param key - Unique key for tracking retries
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds, or -1 if should not retry yet
 */
export function getBackoffDelay(
  key: string,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  const state = backoffStates.get(key);
  
  if (!state) {
    backoffStates.set(key, { retryCount: 0, nextRetryTime: 0 });
    return 0;
  }

  if (Date.now() < state.nextRetryTime) {
    return -1; // Not time to retry yet
  }

  // Exponential backoff: 2^retryCount * baseDelay + jitter
  const exponentialDelay = Math.min(
    Math.pow(2, state.retryCount) * baseDelayMs,
    maxDelayMs
  );
  
  // Add jitter (±25%)
  const jitter = exponentialDelay * (0.5 + Math.random() * 0.5);
  const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

  state.retryCount++;
  state.nextRetryTime = Date.now() + delay;

  return delay;
}

/**
 * Resets the backoff state for a key (call on successful request)
 */
export function resetBackoff(key: string): void {
  backoffStates.delete(key);
}

/**
 * Checks if we should retry based on backoff state
 */
export function shouldRetry(key: string, maxRetries: number = 5): boolean {
  const state = backoffStates.get(key);
  if (!state) return true;
  return state.retryCount < maxRetries && Date.now() >= state.nextRetryTime;
}

// ==================== Request Throttling ====================

interface ThrottleState {
  requestTimes: number[];
  windowMs: number;
  maxRequests: number;
}

const throttleStates = new Map<string, ThrottleState>();

/**
 * Throttles requests to a maximum number per time window.
 * Returns true if the request should proceed, false if it should be skipped.
 * 
 * @param key - Unique key for the throttle group
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns True if request should proceed
 */
export function shouldThrottle(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  let state = throttleStates.get(key);

  if (!state) {
    state = { requestTimes: [], windowMs, maxRequests };
    throttleStates.set(key, state);
  }

  // Remove old requests outside the window
  state.requestTimes = state.requestTimes.filter(t => now - t < windowMs);

  if (state.requestTimes.length >= maxRequests) {
    return true; // Should throttle (skip this request)
  }

  state.requestTimes.push(now);
  return false; // Should not throttle (proceed with request)
}

// ==================== Fetch with Rate Limit Handling ====================

interface FetchWithRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  cacheTtlMs?: number;
  onRateLimited?: () => void;
}

/**
 * Fetch with automatic rate limit handling, caching, and retry logic.
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry and caching options
 * @returns Response data or null if all retries failed
 */
export async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  retryOptions?: FetchWithRetryOptions
): Promise<T | null> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    onRateLimited,
  } = retryOptions || {};

  const key = `${options?.method || 'GET'}:${url}`;

  // Check if we should retry
  if (!shouldRetry(key, maxRetries)) {
    console.warn(`[fetchWithRetry] Skipping ${url} - in backoff period`);
    return null;
  }

  try {
    const response = await fetch(url, options);

    if (response.status === 429) {
      // Rate limited
      console.warn(`[fetchWithRetry] Rate limited: ${url}`);
      onRateLimited?.();
      
      const delay = getBackoffDelay(key, baseDelayMs, maxDelayMs);
      if (delay > 0) {
        console.log(`[fetchWithRetry] Backing off for ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retryOptions);
      }
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Success - reset backoff
    resetBackoff(key);
    return await response.json();
  } catch (error) {
    console.error(`[fetchWithRetry] Error fetching ${url}:`, error);
    
    const delay = getBackoffDelay(key, baseDelayMs, maxDelayMs);
    if (delay > 0 && shouldRetry(key, maxRetries)) {
      console.log(`[fetchWithRetry] Retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryOptions);
    }
    
    return null;
  }
}

// ==================== Cleanup ====================

/**
 * Cleanup function to clear all state (useful for testing or logout)
 */
export function cleanupRequestUtils(): void {
  pendingRequests.clear();
  responseCache.clear();
  backoffStates.clear();
  throttleStates.clear();
}
