'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useDeviceMode } from '@/contexts/DeviceModeContext'

export default function DeviceModeLogger() {
  const pathname = usePathname()
  const { mode, isKiosk, isMobile, isPC } = useDeviceMode()

  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📍 [DeviceMode] Navigation detected')
    console.log(`   Current Page: ${pathname}`)
    console.log(`   Device Mode:  ${mode.toUpperCase()}`)
    console.log(`   Is Kiosk:     ${isKiosk}`)
    console.log(`   Is Mobile:    ${isMobile}`)
    console.log(`   Is PC:        ${isPC}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }, [pathname, mode, isKiosk, isMobile, isPC])

  // This component doesn't render anything
  return null
}

