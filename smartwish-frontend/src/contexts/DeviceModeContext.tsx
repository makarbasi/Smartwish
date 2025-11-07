'use client'

import { createContext, useContext, ReactNode, useMemo } from 'react'
import { useSession } from 'next-auth/react'

type DeviceMode = 'mobile' | 'pc' | 'kiosk'

interface DeviceModeContextType {
  mode: DeviceMode
  isMobile: boolean
  isPC: boolean
  isKiosk: boolean
}

const DeviceModeContext = createContext<DeviceModeContextType | undefined>(undefined)

export function DeviceModeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()

  const mode = useMemo<DeviceMode>(() => {
    // Check if user is logged in as kiosk account
    const userEmail = session?.user?.email
    
    if (userEmail === 'kiosk@smartwish.us') {
      console.log('🖥️ [DeviceMode] Detected KIOSK mode - user:', userEmail)
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
  }, [session?.user?.email])

  const value: DeviceModeContextType = {
    mode,
    isMobile: mode === 'mobile',
    isPC: mode === 'pc',
    isKiosk: mode === 'kiosk',
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

