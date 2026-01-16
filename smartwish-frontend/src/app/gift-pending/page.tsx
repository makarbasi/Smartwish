'use client'

import Link from 'next/link'

export default function GiftPendingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Gift Card Pending
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          This gift card has been <span className="font-semibold text-amber-600">selected</span> but 
          not yet purchased. It will be activated once the greeting card payment is completed.
        </p>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-left text-sm text-amber-800">
              <p className="font-semibold mb-1">What happens next?</p>
              <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>Recipient prints or sends the card</li>
                <li>Payment is processed</li>
                <li>Gift card is instantly activated</li>
                <li>A real QR code replaces this one</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Decorative Gift */}
        <div className="text-6xl mb-6">🎁</div>

        {/* Footer */}
        <p className="text-xs text-gray-500 mb-4">
          Powered by SmartWish
        </p>

        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Go to SmartWish
        </Link>
      </div>
    </div>
  )
}

