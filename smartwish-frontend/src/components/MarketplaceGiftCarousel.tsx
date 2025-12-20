'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

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

interface MarketplaceProduct {
  id: string
  name: string
  image: string
  minAmount: number
  maxAmount: number
  category: string
}

interface MarketplaceGiftCarouselProps {
  cardId: string
  giftCardData?: GiftCardData | null
  onRemove?: () => void
}

export default function MarketplaceGiftCarousel({ cardId, giftCardData, onRemove }: MarketplaceGiftCarouselProps) {
  // If gift card is selected, show it
  if (giftCardData) {
    const handleRemove = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (onRemove) {
        onRemove()
      }
    }

    return (
      <Link
        href={`/marketplace?returnTo=/my-cards/${cardId}?showGift=true`}
        className="block w-full group cursor-pointer"
      >
        <div className="w-full bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-2 border-green-300 rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-green-400 relative">
          {/* Success Badge */}
          <div className="absolute -top-3 left-4 sm:left-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-bold px-3 sm:px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="hidden xs:inline">GIFT CARD ATTACHED</span>
            <span className="xs:hidden">ATTACHED</span>
          </div>

          {/* Remove Button */}
          {onRemove && (
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 sm:top-2 sm:right-2 w-8 h-8 bg-white border-2 border-red-300 rounded-full shadow-lg flex items-center justify-center text-red-500 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all z-10"
              title="Remove gift card"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Main content - stacks vertically on small screens */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mt-2">
            {/* Store Logo */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-xl sm:rounded-2xl shadow-lg flex items-center justify-center p-2 border-2 border-green-200 group-hover:border-green-300 transition-colors">
                {giftCardData.storeLogo ? (
                  <img
                    src={giftCardData.storeLogo}
                    alt={giftCardData.storeName}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.parentElement!.innerHTML = '<span class="text-3xl sm:text-4xl">🎁</span>'
                    }}
                  />
                ) : (
                  <span className="text-3xl sm:text-4xl">🎁</span>
                )}
              </div>
            </div>

            {/* Card Info - centered on mobile */}
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-1 group-hover:text-green-600 transition-colors line-clamp-1">
                {giftCardData.storeName}
              </h3>
              <div className="flex items-baseline justify-center sm:justify-start gap-2 mb-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
                  ${giftCardData.amount}
                </span>
                <span className="text-xs sm:text-sm text-gray-600">Gift Card Value</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 text-green-600 font-semibold text-xs sm:text-sm">
                <span>Click to change</span>
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>

            {/* QR Code Preview - hidden on small screens */}
            {giftCardData.qrCode && (
              <div className="hidden md:block flex-shrink-0">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-xl shadow-md border-2 border-green-200 p-2 group-hover:border-green-300 transition-colors">
                  <img
                    src={giftCardData.qrCode}
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Info Badge */}
          <div className="mt-3 sm:mt-4 inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm text-gray-700">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">This gift card will be included when you print or send this card</span>
            <span className="sm:hidden">Included when you print or send</span>
          </div>
        </div>
      </Link>
    )
  }

  // Fetch featured products from marketplace
  const [featuredProducts, setFeaturedProducts] = useState<MarketplaceProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        // Fetch from Tillo brands endpoint
        const response = await fetch('/api/tillo/brands')
        if (response.ok) {
          const data = await response.json()
          // Get exactly 2 random brands for variety
          const brands = data.brands || data.products || []
          if (brands.length > 0) {
            // Map Tillo brand format to our component format
            const mappedBrands = brands.map((b: any) => ({
              id: b.id || b.slug,
              name: b.name,
              image: b.logo || b.image || '',
              minAmount: b.minAmount || 5,
              maxAmount: b.maxAmount || 500,
              category: b.category || 'Gift Card'
            }))
            const shuffled = mappedBrands.sort(() => 0.5 - Math.random())
            // Always show exactly 2 products
            setFeaturedProducts(shuffled.slice(0, 2))
          }
        }
      } catch (error) {
        console.error('Failed to fetch marketplace brands:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeaturedProducts()
  }, [])

  // Default: No gift card selected - Show real products (same height as gift card attached)
  return (
    <Link
      href={`/marketplace?returnTo=/my-cards/${cardId}?showGift=true`}
      className="block w-full group cursor-pointer"
    >
      <div className="w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 border-2 border-gray-200 rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-gray-300">
        {/* Main content - stacks vertically on small screens */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Gift Card Icon - simplified on mobile */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-lg transform -rotate-3 group-hover:-rotate-6 transition-transform">
              {isLoading ? (
                <div className="w-full h-full bg-gray-200 rounded-xl animate-pulse"></div>
              ) : (
                <span className="text-3xl sm:text-4xl md:text-5xl">🎁</span>
              )}
            </div>
          </div>

          {/* Card Info - centered on mobile */}
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
              Add a Gift Card
            </h3>
            <div className="mb-2">
              <span className="text-sm sm:text-base text-gray-700">
                {isLoading ? (
                  'Loading gift cards...'
                ) : featuredProducts.length > 0 ? (
                  <>
                    <span className="font-semibold text-gray-900">{featuredProducts[0].name}</span>
                    <span className="hidden sm:inline">
                      {featuredProducts.length > 1 && (
                        <>
                          {', '}
                          <span className="font-semibold text-gray-900">{featuredProducts[1].name}</span>
                        </>
                      )}
                      {' '}and more
                    </span>
                    <span className="sm:hidden"> & more</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Amazon, Starbucks, Target & more</span>
                    <span className="sm:hidden">Top brands available</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-700 font-semibold text-xs sm:text-sm">
              <span>Browse marketplace</span>
              <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>

          {/* Decorative Badge - hidden on small screens */}
          <div className="hidden md:flex flex-shrink-0 items-center justify-center">
            <div className="relative">
              <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <div className="text-center">
                  <div className="text-xl lg:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                    50+
                  </div>
                  <div className="text-[10px] lg:text-xs text-gray-600 font-semibold">
                    Brands
                  </div>
                </div>
              </div>
              {/* Pulse animation */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full opacity-20 animate-ping"></div>
            </div>
          </div>
        </div>

        {/* Info Badge */}
        <div className="mt-3 sm:mt-4 inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm text-gray-700">
          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">Add a gift card to make your greeting extra special</span>
          <span className="sm:hidden">Make your greeting extra special</span>
        </div>
      </div>
    </Link>
  )
}

