 'use client'

import { PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

// Removed Product / Features / Marketplace / Company menus per request

export default function Header() {
  const { data: session, status } = useSession()

  return (
    <header className="relative isolate z-10 bg-white">
      <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5 inline-flex items-center justify-center">
            <span className="sr-only">Smartwish</span>
            <div className="inline-flex items-center justify-center rounded-full bg-indigo-50 p-1.5">
              <PlusIcon className="h-6 w-6 text-indigo-600" aria-hidden="true" />
            </div>
          </Link>
        </div>
  {/* No hamburger menu needed: show primary CTA on all sizes */}
  {/* Main navigation removed per request - only logo and Start Designing remain */}
  <div className="flex lg:flex-1 lg:justify-end">
          {status === 'loading' ? (
            // Show loading skeleton while session is loading
            <div className="h-10 w-32 rounded-full bg-gray-200 animate-pulse"></div>
          ) : (
            // Always show Start Designing button - goes to templates if authenticated, sign-in if not
            <Link
              href={session && status === 'authenticated' ? '/templates' : `/sign-in?callbackUrl=${encodeURIComponent('/templates')}`}
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
            >
              Start Designing
            </Link>
          )}
        </div>
  </nav>
    </header>
  )
}