"use client"

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Sidebar from '@/components/Sidebar'
import MobileMenu from '@/components/MobileMenu'
import { useDeviceMode } from '@/contexts/DeviceModeContext'
import { useKioskInactivity } from '@/hooks/useKioskInactivity'
import KioskScreenSaver from '@/components/KioskScreenSaver'
import KioskProductSwitcher from '@/components/KioskProductSwitcher'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const p = usePathname()
  const router = useRouter()
  const { isKiosk } = useDeviceMode()
  
  // Initialize kiosk inactivity tracking and screen saver
  const { showScreenSaver, exitScreenSaver } = useKioskInactivity()

  const isAuth = p.includes('/sign-in') || p.includes('/sign-up') || p.includes('/forgot-password')
  const showSidebar = !isAuth && (p.startsWith('/templates') || p.startsWith('/my-cards') || p.startsWith('/event') || p.startsWith('/marketplace') || p.startsWith('/contacts') || p.startsWith('/partners') || p.startsWith('/settings') || p.startsWith('/stickers'))
  const isLanding = p === '/' // header/footer only here
  const isKioskHome = p === '/kiosk/home'
  const isKioskSetup = p === '/kiosk'

  // Redirect kiosk users from landing page to kiosk home
  useEffect(() => {
    if (isKiosk && isLanding) {
      console.log('🖥️ [AppChrome] Kiosk mode - Redirecting to kiosk home')
      router.replace('/kiosk/home')
    }
  }, [isKiosk, isLanding, router])

  // Log navigation visibility in kiosk mode
  if (isKiosk) {
    console.log('🖥️ [AppChrome] Kiosk mode - Navigation hidden')
  }

  // Check if we should show the product switcher (in templates or stickers pages in kiosk mode)
  const showProductSwitcher = isKiosk && (p.startsWith('/templates') || p.startsWith('/stickers') || p.startsWith('/my-cards'))

  return (
    <>
      {/* Hide Header in Kiosk mode */}
      {isLanding && !isKiosk && <Header />}
      
      {/* Hide Sidebar and MobileMenu in Kiosk mode */}
      {showSidebar && !isKiosk && <Sidebar />}
      {showSidebar && !isKiosk && <MobileMenu />}
      
      {/* Kiosk Product Switcher - floating button to switch between greeting cards and stickers */}
      {showProductSwitcher && <KioskProductSwitcher />}
      
      {/* Adjust padding only if sidebar is shown (not in Kiosk mode) */}
      <div className={`${showSidebar && !isKiosk ? 'md:pl-14 lg:pl-16 pb-20 md:pb-0' : ''}`}>{children}</div>
      
      {/* Hide Footer in Kiosk mode */}
      {isLanding && !isKiosk && <Footer />}
      
      {/* Kiosk Screen Saver */}
      <KioskScreenSaver isVisible={showScreenSaver} onExit={exitScreenSaver} />
    </>
  )
}

