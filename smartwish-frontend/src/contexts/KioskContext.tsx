'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, KioskConfigRow } from '@/lib/supabase';

// ==================== Types ====================

export interface PrinterTray {
  trayNumber: number;
  trayName: string;
  paperType: string; // 'greeting-card' | 'sticker' | 'photo' | 'envelope' | 'label' | 'plain'
  paperSize: string; // 'letter' | 'a4' | '4x6' | '5x7' | etc.
}

export interface KioskConfig {
  theme: string;
  featuredTemplateIds: string[];
  micEnabled: boolean;
  ads: {
    playlist: Array<{ url: string; duration?: number; weight?: number }>;
  };
  printerProfile: string;
  printerName: string;
  printerTrays: PrinterTray[];
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
  micEnabled: true,
  ads: { playlist: [] },
  printerProfile: 'default',
  printerName: 'HP OfficeJet Pro 9130e Series [HPIE4B65B]',
  printerTrays: [
    { trayNumber: 1, trayName: 'Tray 1', paperType: 'greeting-card', paperSize: 'letter' },
    { trayNumber: 2, trayName: 'Tray 2', paperType: 'sticker', paperSize: 'letter' },
  ],
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
  return {
    ...DEFAULT_CONFIG,
    ...(storedConfig || {}),
  } as KioskConfig;
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

  // Computed values
  const isActivated = !!kioskId && !!kioskInfo;
  const config = kioskInfo?.config || DEFAULT_CONFIG;

  // Fetch config from backend API
  const fetchConfig = useCallback(async (id: string): Promise<KioskInfo | null> => {
    try {
      const response = await fetch(`${getApiBase()}/kiosk/config/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch kiosk configuration');
      }
      const data = await response.json();
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
      console.error('Error fetching kiosk config:', err);
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
          console.log('Kiosk config updated via realtime:', payload);
          const newData = payload.new as KioskConfigRow;
          setKioskInfo((prev) => {
            if (!prev) return prev;
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

  // Initialize from localStorage
  useEffect(() => {
    const storedId = getStoredKioskId();
    if (storedId) {
      setKioskId(storedId);
      // Try to use cached config immediately
      const cached = getCachedConfig();
      if (cached && cached.id === storedId) {
        setKioskInfo(cached);
      }
    }
    setLoading(false);
  }, []);

  // Fetch config when kioskId changes
  useEffect(() => {
    if (!kioskId) {
      setKioskInfo(null);
      unsubscribeFromUpdates();
      return;
    }

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromUpdates();
    };
  }, [unsubscribeFromUpdates]);

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
