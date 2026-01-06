'use client';

import { useKiosk, KioskConfig } from '@/contexts/KioskContext';

/**
 * Hook to access kiosk configuration.
 * Uses the KioskContext for database-driven configuration with realtime updates.
 * 
 * @returns { config, loading, isActivated }
 */
export function useKioskConfig() {
  const { config, loading, isActivated } = useKiosk();
  return { config, loading, isActivated };
}

// Re-export the KioskConfig type for convenience
export type { KioskConfig };
