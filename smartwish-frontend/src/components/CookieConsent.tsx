'use client'

import { useEffect, useState } from 'react'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const acknowledged = window.localStorage.getItem('cookie-consent')
      if (!acknowledged) setVisible(true)
    } catch {}
  }, [])

  const accept = () => {
    try {
      window.localStorage.setItem('cookie-consent', 'accepted')
    } catch {}
    setVisible(false)
  }

  const reject = () => {
    try {
      window.localStorage.setItem('cookie-consent', 'rejected')
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 flex flex-col justify-between gap-x-8 gap-y-4 border-t border-gray-900/10 bg-white p-6 shadow-lg md:flex-row md:items-center lg:px-8">
      <p className="max-w-4xl text-sm/6 text-gray-900">
        This website uses cookies to supplement a balanced diet and provide a much deserved reward to the senses after
        consuming bland but nutritious meals. Accepting our cookies is optional but recommended, as they are delicious.
        See our{' '}
        <a href="/privacy" className="font-semibold text-indigo-600 hover:text-indigo-500">
          cookie policy
        </a>
        .
      </p>
      <div className="flex flex-none items-center gap-x-5">
        <button
          type="button"
          onClick={accept}
          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
        >
          Accept all
        </button>
        <button type="button" onClick={reject} className="text-sm/6 font-semibold text-gray-900 hover:text-gray-700">
          Reject all
        </button>
      </div>
    </div>
  )
}

