'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, KioskConfigRow } from '@/lib/supabase';
import { cachedFetch, fetchWithRetry, resetBackoff, getBackoffDelay } from '@/utils/requestUtils';
import { assetSyncService } from '@/services/AssetSyncService';

// ==================== Types ====================

export interface PrinterTray {
  trayNumber: number;
  trayName: string;
  paperType: string; // 'greeting-card' | 'sticker' | 'photo' | 'envelope' | 'label' | 'plain'
  paperSize: string; // 'letter' | 'a4' | '4x6' | '5x7' | etc.
}

// Bundle discount gift card configuration
export interface BundleGiftCardConfig {
  id: string; // Unique ID for this config entry
  source: 'smartwish' | 'tillo';
  brandId?: string; // For SmartWish (UUID)
  brandSlug?: string; // For Tillo (slug)
  brandName: string; // Display name
  brandLogo?: string; // Logo URL
  giftCardDiscountPercent: number; // 0-100, discount on gift card value (customer pays less, gets full value)
  printDiscountPercent: number; // 0-100, discount on print cost (greeting card/sticker)
  minAmount?: number;
  maxAmount?: number;
  appliesTo?: ('greeting-card' | 'sticker')[]; // Default: both
}

// Featured category configuration for homepage carousels
export interface FeaturedCategoryConfig {
  categoryId: string;
  categoryName: string;
  displayOrder: number;
}

export interface KioskConfig {
  theme: string;
  featuredTemplateIds: string[];
  featuredCategories?: FeaturedCategoryConfig[]; // Categories to show as carousels on templates page
  featuredStickerCategories?: FeaturedCategoryConfig[]; // Categories to show as carousels on stickers page
  promotedGiftCardIds?: string[]; // Gift card brand IDs/slugs to feature in Gift Hub
  micEnabled: boolean;
  giftCardRibbonEnabled?: boolean; // Show gift card marketplace ribbon (default true)
  greetingCardsEnabled?: boolean; // Enable greeting cards tile on kiosk home (default true)
  stickersEnabled?: boolean; // Enable stickers tile on kiosk home (default true)
  ads: {
    playlist: Array<{ url: string; duration?: number; weight?: number }>;
  };
  printerProfile: string;
  // NOTE: printerName and printerIP are DEPRECATED - use kiosk_printers table instead
  // These fields are kept for backwards compatibility but should not be used
  printerName?: string;
  printerIP?: string;
  printerTrays: PrinterTray[];
  revenueSharePercent: number; // Store owner's share of net profit (default 30%)
  surveillance?: {
    enabled: boolean;
    webcamIndex: number;
    dwellThresholdSeconds: number;
    frameThreshold: number;
    httpPort: number;
  };
  giftCardTile?: {
    enabled: boolean;
    visibility: 'visible' | 'hidden' | 'disabled';
    source: 'smartwish' | 'tillo';
    brandId: string | null;
    tilloBrandSlug: string | null;
    tilloBrandName?: string;
    tilloBrandLogo?: string;
    tilloMinAmount?: number;
    tilloMaxAmount?: number;
    discountPercent: number;
    displayName?: string;
    description?: string;
    presetAmounts?: number[];
    minAmount?: number;
    maxAmount?: number;
    allowCustomAmount?: boolean;
  };
  // Bundle discounts: gift cards that give discounts when purchased with greeting cards/stickers
  bundleDiscounts?: {
    enabled: boolean;
    eligibleGiftCards: BundleGiftCardConfig[];
  };
  [key: string]: unknown;
}

export interface KioskInfo {
  id: string;
  kioskId: string;
  name: string | null;
  storeId: string | null;
  version: string;
  config: KioskConfig;
  updatedAt: string;
}

interface KioskContextType {
  // State
  isActivated: boolean;
  kioskId: string | null;
  kioskInfo: KioskInfo | null;
  config: KioskConfig;
  loading: boolean;
  error: string | null;

  // Actions
  activateKiosk: (id: string) => Promise<void>;
  deactivateKiosk: () => void;
  refreshConfig: () => Promise<void>;
}

// ==================== Constants ====================

const STORAGE_KEY = 'smartwish_kiosk_id';
const CONFIG_CACHE_KEY = 'smartwish_kiosk_config';

const DEFAULT_CONFIG: KioskConfig = {
  theme: 'default',
  featuredTemplateIds: [],
  featuredCategories: [], // No featured categories by default - shows regular grid view
  featuredStickerCategories: [], // No featured sticker categories by default
  micEnabled: true,
  ads: { playlist: [] },
  printerProfile: 'default',
  // NOTE: Printers are now configured via kiosk_printers table (Printers section in admin)
  printerTrays: [
    { trayNumber: 1, trayName: 'Tray 1', paperType: 'greeting-card', paperSize: 'letter' },
    { trayNumber: 2, trayName: 'Tray 2', paperType: 'sticker', paperSize: 'letter' },
  ],
  revenueSharePercent: 30, // Default 30% of net profit goes to store owner
};

/**
 * Get the tray number for a specific paper type
 * @param config - The kiosk config
 * @param paperType - The type of paper needed (e.g., 'greeting-card', 'sticker')
 * @returns The tray number to use, or undefined if no matching tray found
 */
export function getTrayForPaperType(config: KioskConfig, paperType: string): number | undefined {
  const tray = config.printerTrays?.find(t => t.paperType === paperType);
  return tray?.trayNumber;
}

/**
 * Get tray info for a specific paper type
 * @param config - The kiosk config
 * @param paperType - The type of paper needed
 * @returns The tray configuration or undefined
 */
export function getTrayInfo(config: KioskConfig, paperType: string): PrinterTray | undefined {
  return config.printerTrays?.find(t => t.paperType === paperType);
}

// ==================== Context ====================

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export const useKiosk = () => {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk must be used within a KioskProvider');
  }
  return context;
};

// Safe version that returns null if not within KioskProvider (useful for components that may render outside provider)
export const useKioskSafe = () => {
  const context = useContext(KioskContext);
  return context ?? null;
};

// ==================== Helper Functions ====================

function getStoredKioskId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredKioskId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
    // Dispatch custom event to notify DeviceModeContext
    window.dispatchEvent(new CustomEvent('kioskActivationChange', { detail: { activated: true, kioskId: id } }));
  } catch {
    console.error('Failed to store kiosk ID');
  }
}

function clearStoredKioskId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CONFIG_CACHE_KEY);
    // Dispatch custom event to notify DeviceModeContext
    window.dispatchEvent(new CustomEvent('kioskActivationChange', { detail: { activated: false, kioskId: null } }));
  } catch {
    console.error('Failed to clear kiosk ID');
  }
}

function getCachedConfig(): KioskInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCachedConfig(info: KioskInfo): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(info));
  } catch {
    console.error('Failed to cache kiosk config');
  }
}

function mergeConfig(storedConfig: Record<string, unknown> | null | undefined): KioskConfig {
  const merged = {
    ...DEFAULT_CONFIG,
    ...(storedConfig || {}),
  } as KioskConfig;
  console.log('[KioskContext] Merged config:', {
    screenSavers: merged.screenSavers,
    screenSaverSettings: merged.screenSaverSettings,
    storedScreenSavers: storedConfig?.screenSavers,
  });
  return merged;
}

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';
}

// ==================== Provider ====================

export const KioskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [kioskId, setKioskId] = useState<string | null>(null);
  const [kioskInfo, setKioskInfo] = useState<KioskInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track if we've already fetched config for a specific kioskId to prevent duplicates
  const fetchedKioskIdRef = useRef<string | null>(null);

  // OPTIMIZATION: Skip kiosk initialization on admin/manager pages to prevent unnecessary API calls
  const [shouldInitialize, setShouldInitialize] = useState(false);

  // Check if we're on an admin or manager page (these don't need kiosk functionality)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const isAdminOrManagerPage = path.startsWith('/admin') || path.startsWith('/manager') || path.startsWith('/sales-rep');
    setShouldInitialize(!isAdminOrManagerPage);
  }, []);

  // Computed values
  const isActivated = !!kioskId && !!kioskInfo;
  const config = kioskInfo?.config || DEFAULT_CONFIG;

  // Fetch config from backend API with caching and rate limit handling
  const fetchConfig = useCallback(async (id: string): Promise<KioskInfo | null> => {
    const url = `${getApiBase()}/kiosk/config/${id}`;
    const cacheKey = `kiosk-config:${id}`;

    try {
      console.log(`[KioskContext] Fetching config from: ${url}`);

      // Use cached fetch with 60-second TTL
      // Config rarely changes and we have realtime subscriptions for updates
      const data = await cachedFetch(
        cacheKey,
        async () => {
          const response = await fetch(url);
          if (!response.ok) {
            if (response.status === 429) {
              console.warn('[KioskContext] ⚠️ Rate limited, using cached config');
              // Get backoff delay for logging
              const delay = getBackoffDelay(cacheKey);
              console.log(`[KioskContext] Next retry in ${delay}ms`);
              return null; // Will fall back to cached data
            }
            const errorText = await response.text();
            console.error(`[KioskContext] ❌ Config fetch failed (${response.status}):`, errorText);
            throw new Error('Failed to fetch kiosk configuration');
          }
          return response.json();
        },
        60000 // 60 second cache TTL (config rarely changes, realtime updates handle changes)
      );

      if (!data) {
        // Rate limited - return null, caller will use cached version
        return null;
      }

      console.log('[KioskContext] ✅ Config fetched successfully:', data.kioskId, data.name);
      resetBackoff(cacheKey);

      return {
        id: data.id,
        kioskId: data.kioskId,
        name: data.name,
        storeId: data.storeId,
        version: data.version,
        config: mergeConfig(data.config),
        updatedAt: data.updatedAt,
      };
    } catch (err) {
      console.error('[KioskContext] ❌ Error fetching kiosk config:', err);
      return null;
    }
  }, []);

  // Subscribe to realtime updates
  const subscribeToUpdates = useCallback((id: string) => {
    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    // Create new subscription
    const channel = supabase
      .channel(`kiosk-config-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kiosk_configs',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const newData = payload.new as KioskConfigRow;
          const newConfig = newData.config as Record<string, unknown> || {};

          // Check if this is a meaningful update (not just heartbeat/printerStatus)
          // These fields are updated frequently and don't require UI re-render
          const ignoredFields = ['lastHeartbeat', 'printerStatus'];

          setKioskInfo((prev) => {
            if (!prev) return prev;

            const prevConfig = prev.config as Record<string, unknown> || {};

            // Compare configs excluding ignored fields
            const prevMeaningful = { ...prevConfig };
            const newMeaningful = { ...newConfig };
            ignoredFields.forEach(field => {
              delete prevMeaningful[field];
              delete newMeaningful[field];
            });

            // Also check top-level fields
            const topLevelChanged =
              prev.name !== newData.name ||
              prev.storeId !== newData.store_id ||
              prev.version !== newData.version;

            const configChanged = JSON.stringify(prevMeaningful) !== JSON.stringify(newMeaningful);

            if (!topLevelChanged && !configChanged) {
              // Only heartbeat/printerStatus changed - skip update
              console.log('[KioskContext] Realtime: ignoring heartbeat/status-only update');
              return prev;
            }

            console.log('[KioskContext] Realtime: meaningful config update detected');
            const updated: KioskInfo = {
              ...prev,
              name: newData.name,
              storeId: newData.store_id,
              version: newData.version,
              config: mergeConfig(newData.config),
              updatedAt: newData.updated_at,
            };
            setCachedConfig(updated);
            return updated;
          });
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
  }, []);

  // Unsubscribe from realtime updates
  const unsubscribeFromUpdates = useCallback(() => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  }, []);

  // Initialize: First check local print agent pairing, then fall back to localStorage
  // OPTIMIZATION: Only run on non-admin pages
  useEffect(() => {
    // Skip initialization on admin/manager pages to prevent unnecessary API calls
    if (!shouldInitialize) {
      console.log('[KioskContext] ⏭️ Skipping initialization (admin/manager page)');
      setLoading(false);
      return;
    }

    const initializeKiosk = async () => {
      console.log('[KioskContext] 🚀 Initializing...');

      // Try to get kiosk from local print agent pairing server
      // This ensures the browser syncs with whatever kiosk the print agent is configured for
      try {
        const localPairingPort = 8766; // Default pairing port from config
        console.log('[KioskContext] Checking local print agent at port', localPairingPort);
        const response = await fetch(`http://localhost:${localPairingPort}/pairing`, {
          signal: AbortSignal.timeout(2000), // 2 second timeout
        });

        if (response.ok) {
          const pairing = await response.json();
          console.log('[KioskContext] Pairing response:', pairing);
          if (pairing && pairing.kioskId) {
            console.log(`[KioskContext] 🔗 Found local print agent pairing: ${pairing.kioskId} (${pairing.kioskName || 'unnamed'})`);

            // Check if this is different from what we have stored
            const storedId = getStoredKioskId();
            if (storedId !== pairing.kioskId) {
              console.log(`[KioskContext] 📝 Syncing localStorage with local print agent (was: ${storedId || 'none'})`);
              setStoredKioskId(pairing.kioskId);
            }

            setKioskId(pairing.kioskId);
            setLoading(false);
            return; // Successfully got kiosk from local pairing
          } else {
            console.log('[KioskContext] ⚠️ Pairing response has no kioskId');
          }
        } else {
          console.log('[KioskContext] ⚠️ Pairing fetch returned status:', response.status);
        }
      } catch (err) {
        // Local pairing server not available - this is normal if print agent isn't running
        console.log('[KioskContext] ℹ️ Local print agent not detected, using localStorage. Error:', err);
      }

      // Fall back to localStorage
      const storedId = getStoredKioskId();
      console.log('[KioskContext] Falling back to localStorage, stored ID:', storedId);
      if (storedId) {
        setKioskId(storedId);
        // Try to use cached config immediately
        const cached = getCachedConfig();
        if (cached && cached.id === storedId) {
          console.log('[KioskContext] Using cached config');
          setKioskInfo(cached);
        }
      }
      setLoading(false);
    };

    initializeKiosk();
  }, [shouldInitialize]);

  // Fetch config when kioskId changes
  useEffect(() => {
    if (!kioskId) {
      setKioskInfo(null);
      unsubscribeFromUpdates();
      fetchedKioskIdRef.current = null;
      return;
    }

    // Prevent duplicate fetches for the same kioskId (React Strict Mode runs effects twice)
    if (fetchedKioskIdRef.current === kioskId) {
      return;
    }
    fetchedKioskIdRef.current = kioskId;

    let cancelled = false;

    const loadConfig = async () => {
      setError(null);
      const info = await fetchConfig(kioskId);
      if (cancelled) return;

      if (info) {
        setKioskInfo(info);
        setCachedConfig(info);
        subscribeToUpdates(kioskId);
      } else {
        setError('Failed to load kiosk configuration');
        // If fetch fails but we have a cached version, keep using it
        const cached = getCachedConfig();
        if (cached && cached.id === kioskId) {
          setKioskInfo(cached);
        }
      }
    };

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [kioskId, fetchConfig, subscribeToUpdates, unsubscribeFromUpdates]);

  // Send heartbeat when kiosk is activated (with rate limit handling)
  const sendHeartbeat = useCallback(async (id: string) => {
    const cacheKey = `heartbeat:${id}`;

    try {
      const response = await fetch('/api/kiosk/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kioskId: id }),
      });

      if (response.status === 429) {
        // Rate limited - skip this heartbeat silently, will retry next interval
        console.log('[KioskContext] ⚠️ Heartbeat rate limited, will retry next interval');
        return;
      }

      if (!response.ok) {
        console.error('[KioskContext] Heartbeat failed:', response.status);
      } else {
        console.log('[KioskContext] ✅ Heartbeat sent for kiosk:', id);
        resetBackoff(cacheKey);
      }
    } catch (error) {
      console.error('[KioskContext] Error sending heartbeat:', error);
    }
  }, []);

  // Start/stop heartbeat interval when kiosk is activated/deactivated
  // OPTIMIZATION: Only send heartbeats on kiosk pages, not admin/manager pages
  useEffect(() => {
    // Clear existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Start heartbeat if kiosk is activated AND we should initialize (not on admin pages)
    if (kioskId && isActivated && shouldInitialize) {
      // Send initial heartbeat immediately
      sendHeartbeat(kioskId);

      // Then send heartbeat every 60 seconds (increased from 30s to reduce request volume)
      // Heartbeat is mainly for "online" status which doesn't need frequent updates
      heartbeatIntervalRef.current = setInterval(() => {
        sendHeartbeat(kioskId);
      }, 60000); // 60 seconds (was 30s)

      console.log('[KioskContext] Started heartbeat interval for kiosk:', kioskId);
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
        console.log('[KioskContext] Stopped heartbeat interval');
      }
    };
  }, [kioskId, isActivated, sendHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromUpdates();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [unsubscribeFromUpdates]);

  // Initialize AssetSyncService when kiosk is activated
  useEffect(() => {
    if (kioskId && isActivated && shouldInitialize) {
      console.log('[KioskContext] Initializing AssetSyncService for kiosk:', kioskId);
      assetSyncService.initialize(kioskId);
    }
  }, [kioskId, isActivated, shouldInitialize]);

  // Actions
  const activateKiosk = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    const info = await fetchConfig(id);
    if (info) {
      setStoredKioskId(id);
      setKioskId(id);
      setKioskInfo(info);
      setCachedConfig(info);
      subscribeToUpdates(id);
    } else {
      setError('Failed to activate kiosk - configuration not found');
      throw new Error('Failed to activate kiosk');
    }

    setLoading(false);
  }, [fetchConfig, subscribeToUpdates]);

  const deactivateKiosk = useCallback(() => {
    // Stop heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    clearStoredKioskId();
    setKioskId(null);
    setKioskInfo(null);
    unsubscribeFromUpdates();
  }, [unsubscribeFromUpdates]);

  const refreshConfig = useCallback(async () => {
    if (!kioskId) return;
    setLoading(true);
    const info = await fetchConfig(kioskId);
    if (info) {
      setKioskInfo(info);
      setCachedConfig(info);
    }
    setLoading(false);
  }, [kioskId, fetchConfig]);

  return (
    <KioskContext.Provider
      value={{
        isActivated,
        kioskId,
        kioskInfo,
        config,
        loading,
        error,
        activateKiosk,
        deactivateKiosk,
        refreshConfig,
      }}
    >
      {children}
    </KioskContext.Provider>
  );
};
