'use client'

import Link from 'next/link'
import Image from 'next/image'
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
}

export default function MarketplaceGiftCarousel({ cardId, giftCardData }: MarketplaceGiftCarouselProps) {
  // Temporarily hidden - Tillo integration in sandbox
  return null
  
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

  // Fetch featured products from marketplace
  const [featuredProducts, setFeaturedProducts] = useState<MarketplaceProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const response = await fetch('/api/tremendous/products')
        if (response.ok) {
          const data = await response.json()
          // Get exactly 2 random products for variety
          const products = data.products || []
          if (products.length > 0) {
            const shuffled = products.sort(() => 0.5 - Math.random())
            // Always show exactly 2 products
            setFeaturedProducts(shuffled.slice(0, 2))
          }
        }
      } catch (error) {
        console.error('Failed to fetch marketplace products:', error)
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
      <div className="w-full bg-gradient-to-br from-gray-50 via-white to-gray-50 border-2 border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-gray-300">
        <div className="flex items-center gap-6">
          {/* Gift Card Details */}
          <div className="flex items-center gap-4 flex-1">
            {/* Overlapping Gift Cards - Modern Design */}
            <div className="flex-shrink-0 relative" style={{ width: '160px', height: '112px' }}>
              {isLoading ? (
                <div className="w-28 h-28 bg-gray-200 rounded-2xl animate-pulse"></div>
              ) : featuredProducts.length > 0 ? (
                <>
                  {/* Second Card (Behind, Tilted) */}
                  {featuredProducts.length > 1 && (
                    <div 
                      className="absolute left-14 top-0 w-28 h-28 rounded-2xl transform rotate-6 transition-all duration-300 group-hover:rotate-12 group-hover:translate-x-2"
                      style={{ 
                        zIndex: 1,
                        filter: 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.2))'
                      }}
                    >
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <div className="relative w-full h-full opacity-90">
                          <Image
                            src={featuredProducts[1].image || 'https://via.placeholder.com/112x112?text=🎁'}
                            alt={featuredProducts[1].name}
                            fill
                            className="object-contain"
                            style={{ mixBlendMode: 'multiply' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = 'https://via.placeholder.com/112x112?text=🎁'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* First Card (Front, Main) */}
                  <div 
                    className="absolute left-0 top-0 w-28 h-28 rounded-2xl transform -rotate-3 transition-all duration-300 group-hover:-rotate-6 group-hover:-translate-y-1"
                    style={{ 
                      zIndex: 2,
                      filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.3))'
                    }}
                  >
                    <div className="w-full h-full flex items-center justify-center p-3">
                      <div className="relative w-full h-full">
                        <Image
                          src={featuredProducts[0].image || 'https://via.placeholder.com/112x112?text=🎁'}
                          alt={featuredProducts[0].name}
                          fill
                          className="object-contain"
                          style={{ mixBlendMode: 'multiply' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.src = 'https://via.placeholder.com/112x112?text=🎁'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-28 h-28 rounded-2xl shadow-2xl flex items-center justify-center transform -rotate-3">
                  <span className="text-5xl drop-shadow-lg">🎁</span>
                </div>
              )}
            </div>

            {/* Card Info */}
            <div className="flex-1 ml-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
                Add a Gift Card
              </h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-base text-gray-700">
                  {isLoading ? (
                    'Loading gift cards...'
                  ) : featuredProducts.length > 0 ? (
                    <>
                      <span className="font-semibold text-gray-900">{featuredProducts[0].name}</span>
                      {featuredProducts.length > 1 && (
                        <>
                          {', '}
                          <span className="font-semibold text-gray-900">{featuredProducts[1].name}</span>
                        </>
                      )}
                      {' '}and hundreds more
                    </>
                  ) : (
                    'Amazon, Starbucks, Target, and hundreds more'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                <span>Browse marketplace</span>
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </div>

            {/* Decorative Badge */}
            <div className="hidden lg:flex flex-shrink-0 items-center justify-center">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                      50+
                    </div>
                    <div className="text-xs text-gray-600 font-semibold">
                      Brands
                    </div>
                  </div>
                </div>
                {/* Pulse animation */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full opacity-20 animate-ping"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Badge */}
        <div className="mt-4 inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-gray-700">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Add a gift card to make your greeting extra special</span>
        </div>
      </div>
    </Link>
  )
}

