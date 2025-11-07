'use client'

import Link from 'next/link'

interface MarketplaceGiftCarouselProps {
    cardId: string
}

export default function MarketplaceGiftCarousel({ cardId }: MarketplaceGiftCarouselProps) {
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

