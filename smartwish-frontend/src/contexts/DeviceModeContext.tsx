'use client'

import { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type DeviceMode = 'mobile' | 'pc' | 'kiosk'

interface DeviceModeContextType {
  mode: DeviceMode
  isMobile: boolean
  isPC: boolean
  isKiosk: boolean
  /** True once the kiosk activation status has been checked from localStorage */
  isInitialized: boolean
}

const DeviceModeContext = createContext<DeviceModeContextType | undefined>(undefined)

// Storage key for kiosk activation (same as in KioskContext)
const KIOSK_STORAGE_KEY = 'smartwish_kiosk_id';

// Check if a kiosk has been activated on this device
function isKioskActivated(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const kioskId = localStorage.getItem(KIOSK_STORAGE_KEY);
    return !!kioskId;
  } catch {
    return false;
  }
}

export function DeviceModeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [kioskActivated, setKioskActivated] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Check kiosk activation status on mount and when localStorage changes
  useEffect(() => {
    setKioskActivated(isKioskActivated());
    setIsInitialized(true);
    
    // Listen for storage changes (in case kiosk is activated/deactivated in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === KIOSK_STORAGE_KEY) {
        setKioskActivated(!!e.newValue);
      }
    };
    
    // Listen for custom event from KioskContext (same-tab activation changes)
    const handleKioskActivationChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ activated: boolean; kioskId: string | null }>;
      console.log('🖥️ [DeviceMode] Kiosk activation changed:', customEvent.detail);
      setKioskActivated(customEvent.detail.activated);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('kioskActivationChange', handleKioskActivationChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('kioskActivationChange', handleKioskActivationChange);
    };
  }, []);

  const mode = useMemo<DeviceMode>(() => {
    // Check if user is logged in as kiosk account
    const userEmail = session?.user?.email
    
    console.log('🔍 [DeviceMode] Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: userEmail || 'not logged in',
      isKioskEmail: userEmail === 'kiosk@smartwish.us',
      isKioskActivated: kioskActivated
    })
    
    // Kiosk mode if logged in as kiosk@smartwish.us OR if a kiosk has been activated by a manager
    if (userEmail === 'kiosk@smartwish.us' || kioskActivated) {
      console.log('🖥️ [DeviceMode] ✅ KIOSK MODE ACTIVATED -', 
        kioskActivated ? 'via manager setup' : `user: ${userEmail}`)
      return 'kiosk'
    }

    // Fallback to browser detection for mobile vs PC
    if (typeof window !== 'undefined') {
      const isMobileSize = window.innerWidth < 768
      const detectedMode = isMobileSize ? 'mobile' : 'pc'
      console.log(`📱 [DeviceMode] Detected ${detectedMode.toUpperCase()} mode - width:`, window.innerWidth)
      return detectedMode
    }

    return 'pc'
  }, [session?.user?.email, kioskActivated])

  const value: DeviceModeContextType = {
    mode,
    isMobile: mode === 'mobile',
    isPC: mode === 'pc',
    isKiosk: mode === 'kiosk',
    isInitialized,
  }

  return (
    <DeviceModeContext.Provider value={value}>
      {children}
    </DeviceModeContext.Provider>
  )
}

export function useDeviceMode() {
  const context = useContext(DeviceModeContext)
  if (context === undefined) {
    throw new Error('useDeviceMode must be used within a DeviceModeProvider')
  }
  return context
}

