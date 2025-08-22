'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type React from 'react'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const hasAccessToken = Boolean(session?.user && (session.user as unknown as Record<string, unknown>)['access_token'])
  const [signingOut, setSigningOut] = useState(false)

  const isPreventableEvent = (
    ev: unknown
  ): ev is
    | React.MouseEvent<HTMLButtonElement>
    | React.TouchEvent<HTMLButtonElement>
    | React.PointerEvent<HTMLButtonElement> => {
  return !!ev && typeof (ev as Record<string, unknown>)['preventDefault'] === 'function'
  }

  // Use explicit handler that disables next-auth's automatic redirect
  // then performs a client-side navigation. This works more reliably
  // across mobile browsers where automatic redirects can be blocked.
  const handleSignOut = async (
    e?: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement> | React.PointerEvent<HTMLButtonElement>
  ) => {
    try {
  if (isPreventableEvent(e)) e.preventDefault()
  console.log('[Dashboard] signOut triggered event:', (e as unknown as Record<string, unknown>)['type'] ?? 'none')
      // Guard against multiple taps
      if (signingOut) {
        console.log('[Dashboard] signOut already in progress')
        return
      }
      setSigningOut(true)
      await signOut({ redirect: false })
    } catch (err) {
      console.error('[Dashboard] signOut error', err)
    } finally {
      // Ensure navigation regardless of signOut result to keep behavior consistent on mobile
      router.push('/')
      setSigningOut(false)
    }
  }

  useEffect(() => {
    if (status === 'loading') return // Still loading
  if (!session) router.push('/') // Redirect to base dir if not authenticated
  }, [session, status, router])

  // Debugging: log global pointer/touch events to see if mobile taps reach the page
  useEffect(() => {
    console.log('[Dashboard] mounted - setting up global touch/pointer listeners')
    const onPointerDown = (ev: PointerEvent) => {
      console.log('[Dashboard] global pointerdown', { type: ev.type, x: ev.clientX, y: ev.clientY, target: (ev.target as Element)?.tagName })
    }
    const onTouchEnd = (ev: TouchEvent) => {
      const t = ev.changedTouches && ev.changedTouches[0]
      console.log('[Dashboard] global touchend', { type: ev.type, x: t?.clientX, y: t?.clientY, target: (ev.target as Element)?.tagName })
      if (typeof document !== 'undefined') {
        try {
          const x = t?.clientX ?? 0
          const y = t?.clientY ?? 0
          const el = document.elementFromPoint(x, y)
          console.log('[Dashboard] elementFromPoint at touch', el)
        } catch (err) {
          console.error('[Dashboard] elementFromPoint failed', err)
        }
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (!session) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Welcome!</h2>
                <p className="text-gray-600">You are successfully signed in.</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium text-gray-900 mb-2">Session Info:</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>Name:</strong> {session.user?.name}</p>
                  <p><strong>Email:</strong> {session.user?.email}</p>
                  <p><strong>ID:</strong> {session.user?.id}</p>
                  {hasAccessToken && (
                    <p><strong>Has Access Token:</strong> Yes</p>
                  )}
                </div>
              </div>

              <button
                onClick={handleSignOut}
                onClickCapture={(e) => console.log('[Dashboard] onClickCapture', e.type)}
                onTouchEnd={handleSignOut}
                onPointerUp={handleSignOut}
                disabled={signingOut}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-2 px-4 rounded relative z-50"
              >
                {signingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}