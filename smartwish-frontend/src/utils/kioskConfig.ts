/**
 * Kiosk Configuration Utilities
 * 
 * This module provides utilities for managing kiosk configuration in localStorage.
 * The actual configuration fetching and realtime updates are handled by KioskContext.
 */

// ==================== Types ====================

/**
 * Screen saver item configuration
 */
export type ScreenSaverType = 'video' | 'html' | 'default' | 'none';

export interface ScreenSaverItem {
  id: string;                    // Unique identifier
  type: ScreenSaverType;         // Type of screen saver
  name?: string;                 // Display name for admin UI
  url?: string;                  // Video URL or HTML page URL (for video/html types)
  weight: number;                // Weight for rotation (1-100)
  duration?: number;             // How long to show this screen saver (seconds) before rotating
  enabled?: boolean;             // Whether this screen saver is active
}

/**
 * Screen saver global settings
 */
export interface ScreenSaverSettings {
  inactivityTimeout?: number;    // Seconds before screen saver activates (default: 60)
  rotationInterval?: number;     // Seconds between screen saver rotations (default: 30)
  enableRotation?: boolean;      // Whether to rotate or stick with one (default: true)
}

export type KioskConfig = {
  theme: string;
  featuredTemplateIds: string[];
  micEnabled: boolean;
  ads: {
    playlist: Array<{ url: string; duration?: number; weight?: number }>;
  };
  printerProfile: string;
  // Screen saver configuration
  screenSavers?: ScreenSaverItem[];
  screenSaverSettings?: ScreenSaverSettings;
  [key: string]: unknown;
};

export type KioskConfigResponse = {
  id: string;
  kioskId: string;
  name: string | null;
  storeId: string | null;
  version: string;
  config: KioskConfig;
  updatedAt?: string;
};

// ==================== Constants ====================

const KIOSK_ID_KEY = 'smartwish_kiosk_id';
const CONFIG_CACHE_KEY = 'smartwish_kiosk_config';

/**
 * Default screen saver settings
 */
export const DEFAULT_SCREEN_SAVER_SETTINGS: ScreenSaverSettings = {
  inactivityTimeout: 60,      // 60 seconds
  rotationInterval: 30,       // 30 seconds between rotations
  enableRotation: true,       // Enable rotation by default
};

/**
 * Default screen saver (the existing card showcase)
 */
export const DEFAULT_SCREEN_SAVER: ScreenSaverItem = {
  id: 'default-screensaver',
  type: 'default',
  name: 'Card Showcase',
  weight: 100,
  duration: 30,
  enabled: true,
};

export const DEFAULT_KIOSK_CONFIG: KioskConfig = {
  theme: 'default',
  featuredTemplateIds: [],
  micEnabled: true,
  ads: { playlist: [] },
  printerProfile: 'default',
  screenSavers: [DEFAULT_SCREEN_SAVER],
  screenSaverSettings: DEFAULT_SCREEN_SAVER_SETTINGS,
};

// ==================== Storage Functions ====================

/**
 * Get the stored kiosk ID from localStorage
 */
export function getStoredKioskId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(KIOSK_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Store a kiosk ID in localStorage
 */
export function setStoredKioskId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KIOSK_ID_KEY, id);
  } catch {
    console.error('Failed to store kiosk ID');
  }
}

/**
 * Clear the stored kiosk ID and cached config
 */
export function clearStoredKioskId(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KIOSK_ID_KEY);
    localStorage.removeItem(CONFIG_CACHE_KEY);
  } catch {
    console.error('Failed to clear kiosk data');
  }
}

/**
 * Get cached kiosk configuration from localStorage
 */
export function getCachedKioskConfig(): KioskConfig {
  if (typeof window === 'undefined') return DEFAULT_KIOSK_CONFIG;
  try {
    const raw = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return DEFAULT_KIOSK_CONFIG;
    const parsed = JSON.parse(raw) as KioskConfigResponse;
    return parsed.config || DEFAULT_KIOSK_CONFIG;
  } catch {
    return DEFAULT_KIOSK_CONFIG;
  }
}

/**
 * Cache kiosk configuration in localStorage
 */
export function setCachedKioskConfig(config: KioskConfigResponse): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    console.error('Failed to cache kiosk config');
  }
}

// ==================== API Helper ====================

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';
}

/**
 * Fetch kiosk configuration from the backend API
 * @param kioskId - The UUID of the kiosk
 * @returns The kiosk configuration or null if not found
 */
export async function fetchKioskConfig(kioskId: string): Promise<KioskConfigResponse | null> {
  try {
    const response = await fetch(`${getApiBase()}/kiosk/config/${kioskId}`);
    if (!response.ok) {
      console.error('Failed to fetch kiosk config:', response.statusText);
      return null;
    }
    const data = await response.json();
    return {
      id: data.id,
      kioskId: data.kioskId,
      name: data.name,
      storeId: data.storeId,
      version: data.version,
      config: { ...DEFAULT_KIOSK_CONFIG, ...data.config },
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error('Error fetching kiosk config:', error);
    return null;
  }
}

/**
 * Check if a kiosk is currently activated on this device
 */
export function isKioskActivated(): boolean {
  return !!getStoredKioskId();
}
