"use client"

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Sidebar from '@/components/Sidebar'
import MobileMenu from '@/components/MobileMenu'
import { useDeviceMode } from '@/contexts/DeviceModeContext'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const p = usePathname()
  const { isKiosk } = useDeviceMode()

  const isAuth = p.includes('/sign-in') || p.includes('/sign-up') || p.includes('/forgot-password')
  const showSidebar = !isAuth && (p.startsWith('/templates') || p.startsWith('/my-cards') || p.startsWith('/event') || p.startsWith('/marketplace') || p.startsWith('/contacts') || p.startsWith('/partners') || p.startsWith('/settings'))
  const isLanding = p === '/' // header/footer only here

  // Log navigation visibility in kiosk mode
  if (isKiosk) {
    console.log('🖥️ [AppChrome] Kiosk mode - Navigation hidden')
  }

  return (
    <>
      {/* Hide Header in Kiosk mode */}
      {isLanding && !isKiosk && <Header />}
      
      {/* Hide Sidebar and MobileMenu in Kiosk mode */}
      {showSidebar && !isKiosk && <Sidebar />}
      {showSidebar && !isKiosk && <MobileMenu />}
      
      {/* Adjust padding only if sidebar is shown (not in Kiosk mode) */}
      <div className={`${showSidebar && !isKiosk ? 'md:pl-14 lg:pl-16 pb-20 md:pb-0' : ''}`}>{children}</div>
      
      {/* Hide Footer in Kiosk mode */}
      {isLanding && !isKiosk && <Footer />}
    </>
  )
}

