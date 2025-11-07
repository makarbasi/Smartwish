'use client'

import Link from 'next/link'
import Image from 'next/image'

interface GiftCardData {
  storeName: string
  storeLogo: string
  amount: number
  qrCode: string
  redemptionLink?: string
  orderId?: string
  rewardId?: string
  generatedAt?: string
}

interface MarketplaceGiftCarouselProps {
  cardId: string
  giftCardData?: GiftCardData | null
}

export default function MarketplaceGiftCarousel({ cardId, giftCardData }: MarketplaceGiftCarouselProps) {
  // If gift card is selected, show it
  if (giftCardData) {
    return (
      <Link 
        href={`/marketplace?returnTo=/my-cards/${cardId}?showGift=true`}
        className="block w-full group cursor-pointer"
      >
        <div className="w-full bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-2 border-green-300 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-green-400 relative">
          {/* Success Badge */}
          <div className="absolute -top-3 left-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            GIFT CARD ATTACHED
          </div>

          <div className="flex items-center gap-6">
            {/* Gift Card Details */}
            <div className="flex items-center gap-4 flex-1">
              {/* Store Logo */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2 border-2 border-green-200 group-hover:border-green-300 transition-colors">
                  {giftCardData.storeLogo ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={giftCardData.storeLogo}
                        alt={giftCardData.storeName}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <span className="text-4xl">🎁</span>
                  )}
                </div>
              </div>

              {/* Card Info */}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-green-600 transition-colors">
                  {giftCardData.storeName}
                </h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                    ${giftCardData.amount}
                  </span>
                  <span className="text-sm text-gray-600">Gift Card Value</span>
                </div>
                <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
                  <span>Click to change gift card</span>
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>

              {/* QR Code Preview */}
              {giftCardData.qrCode && (
                <div className="hidden lg:block flex-shrink-0">
                  <div className="w-24 h-24 bg-white rounded-xl shadow-md border-2 border-green-200 p-2 group-hover:border-green-300 transition-colors">
                    <img
                      src={giftCardData.qrCode}
                      alt="QR Code"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Badge */}
          <div className="mt-4 inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-gray-700">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>This gift card will be included when you print or send this card</span>
          </div>
        </div>
      </Link>
    )
  }

  // Default: No gift card selected
  return (
    <Link 
      href={`/marketplace?returnTo=/my-cards/${cardId}?showGift=true`}
      className="block w-full group cursor-pointer"
    >
      <div className="w-full bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-2 border-indigo-200 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-indigo-300">
        <div className="flex items-center gap-6">
          {/* Gift Card Icon */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg flex items-center justify-center transform group-hover:rotate-6 transition-transform duration-300">
              <span className="text-5xl">🎁</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
              Add a Gift Card
            </h3>
            <p className="text-gray-700 text-base mb-3">
              Make your card extra special! Click here to browse and select a gift card from our marketplace.
            </p>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold">
              <span>Browse Gift Cards</span>
              <svg className="w-5 h-5 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>

          {/* Preview Cards */}
          <div className="hidden lg:flex gap-2 flex-shrink-0">
            <div className="w-16 h-20 bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center text-2xl opacity-80 group-hover:opacity-100 transition-opacity">
              💳
            </div>
            <div className="w-16 h-20 bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center text-2xl opacity-60 group-hover:opacity-100 transition-opacity">
              🎫
            </div>
            <div className="w-16 h-20 bg-white rounded-lg shadow-md border border-gray-200 flex items-center justify-center text-2xl opacity-40 group-hover:opacity-100 transition-opacity">
              🎟️
            </div>
          </div>
        </div>

        {/* Info Badge */}
        <div className="mt-4 inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-gray-600">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Amazon, Starbucks, Target, and hundreds more available</span>
        </div>
      </div>
    </Link>
  )
}

