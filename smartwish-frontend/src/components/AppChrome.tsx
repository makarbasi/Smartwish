"use client"

import { usePathname } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Sidebar from '@/components/Sidebar'
import MobileMenu from '@/components/MobileMenu'

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const p = usePathname()

  const isAuth = p.includes('/sign-in') || p.includes('/sign-up') || p.includes('/forgot-password')
  const showSidebar = !isAuth && (p.startsWith('/templates') || p.startsWith('/my-cards') || p.startsWith('/event') || p.startsWith('/marketplace') || p.startsWith('/contacts'))
  const isLanding = p === '/' // header/footer only here

  return (
    <>
      {isLanding && <Header />}
      {showSidebar && <Sidebar />}
      {showSidebar && <MobileMenu />}
      <div className={`${showSidebar ? 'md:pl-14 lg:pl-16 pb-20 md:pb-0' : ''}`}>{children}</div>
      {isLanding && <Footer />}
    </>
  )
}

