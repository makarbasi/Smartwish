'use client'

import { useMemo, useState, useEffect, useRef, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import HeroSearch from '@/components/HeroSearch'

type MarketplaceItem = {
  id: number
  name: string
  description: string
  image: string
  category: string
  subcategory: string
  price: number
  currency: string
  available: boolean
  tags: string[]
  duration?: string
  features?: string[]
  createdAt: string
  updatedAt: string
}

type Product = { id: number; title: string; subtitle?: string; price?: string; image?: string; provider?: string }

const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Transform API data to Product format
function transformMarketplaceItem(item: MarketplaceItem): Product {
  return {
    id: item.id,
    title: item.name,
    subtitle: item.description,
    price: item.price > 0 ? `$${item.price}` : 'Free',
    provider: item.name.split(' ')[0], // Use first word as provider
    image: item.image.startsWith('/uploads') 
      ? `https://smartwish.onrender.com${item.image}` 
      : item.image
  }
}

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
      <div className="relative">
        <div className="aspect-[3/2] w-full bg-gray-200 animate-pulse" />
      </div>
      <div className="px-4 pt-3 pb-4 text-left">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-12"></div>
        </div>
        <div className="mt-1.5 h-3 bg-gray-200 rounded animate-pulse w-5/6"></div>
      </div>
    </div>
  )
}

function ProductCard({ p }: { p: Product }) {
  return (
    <div className="group overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm">
      <div className="relative">
        <a href="#" className="block">
          <Image alt={p.title} src={p.image || ''} width={800} height={533} className="aspect-[3/2] w-full bg-gray-100 object-contain" />
        </a>
      </div>
      <div className="px-4 pt-3 pb-4 text-left">
        <div className="flex items-center justify-between">
          <h3 className="line-clamp-1 text-[15px] font-semibold leading-6 text-gray-900">{p.title}</h3>
          <div className="text-sm text-gray-700 font-medium">{p.price}</div>
        </div>
        <div className="mt-1.5 text-[12px] text-gray-600">{p.subtitle} · {p.provider}</div>
      </div>
    </div>
  )
}

function MarketplaceContent() {
  const sp = useSearchParams()
  const q = sp?.get('q') ?? ''
  
  // Fetch data from API using SWR with search query
  const apiUrl = q ? `/api/marketplace?q=${encodeURIComponent(q)}` : '/api/marketplace'
  const { data: marketplaceData, error, isLoading } = useSWR<MarketplaceItem[]>(
    apiUrl,
    fetcher
  )
  
  // Transform and categorize products
  const allProducts = useMemo(() => {
    if (!marketplaceData) return []
    
    return marketplaceData.map(item => {
      const product = transformMarketplaceItem(item)
      let category = 'Other'
      
      if (item.category === 'cash-gift') {
        category = 'Cash Gift'
      } else if (item.category === 'gift-card') {
        category = 'Gift Cards'
      } else if (item.category === 'membership') {
        category = 'Memberships'
      }
      
      return { ...product, category }
    })
  }, [marketplaceData])
  
  // Group products by category (no client-side filtering needed since server handles search)
  const filteredByCategory = useMemo(() => {
    const categories = ['Cash Gift', 'Gift Cards', 'Memberships', 'Other']
    const grouped: Record<string, typeof allProducts> = {}
    
    categories.forEach(category => {
      grouped[category] = allProducts.filter(p => p.category === category)
    })
    
    return grouped
  }, [allProducts])
  
  // Show loading state
  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Marketplace</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-gray-500">Pick from cash gifts, gift cards, or memberships.</p>
        </div>
        
        {/* Floating Search Skeleton */}
        <div className="sticky top-4 z-30 mb-6">
          <div className="mx-auto max-w-3xl">
            <div className="h-12 bg-gray-200 rounded-2xl animate-pulse"></div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div>
          {/* Cash Gift Section Skeleton */}
          <section className="mt-2">
            <div className="h-6 bg-gray-200 rounded animate-pulse w-24 mb-1"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-64 mb-4"></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
              {Array(6).fill(0).map((_, i) => (
                <ProductCardSkeleton key={`cash-${i}`} />
              ))}
            </div>
          </section>

          <hr className="my-10 border-t border-gray-200" />

          {/* Gift Cards Section Skeleton */}
          <section>
            <div className="h-6 bg-gray-200 rounded animate-pulse w-32 mb-1"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-80 mb-4"></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
              {Array(9).fill(0).map((_, i) => (
                <ProductCardSkeleton key={`cards-${i}`} />
              ))}
            </div>
          </section>

          <hr className="my-10 border-t border-gray-200" />

          {/* Memberships Section Skeleton */}
          <section>
            <div className="h-6 bg-gray-200 rounded animate-pulse w-28 mb-1"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-72 mb-4"></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
              {Array(6).fill(0).map((_, i) => (
                <ProductCardSkeleton key={`membership-${i}`} />
              ))}
            </div>
          </section>
        </div>
      </main>
    )
  }
  
  // Show error state
  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Marketplace</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-gray-500">Pick from cash gifts, gift cards, or memberships.</p>
        </div>
        <div className="flex justify-center items-center py-12">
          <div className="text-red-500">Failed to load marketplace items. Please try again later.</div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">Marketplace</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-gray-500">Pick from cash gifts, gift cards, or memberships.</p>
      </div>
      
      {/* Floating Search */}
      <FloatingSearch initialQuery={q} />

      {/* Content: single column. Sidebar is provided globally via AppChrome/Sidebar */}
      <div>
        {q && allProducts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 p-12 text-center text-gray-600">
            No products found for "{q}"
          </div>
        ) : (
          <>
            {/* Cash Gifts */}
            {(!q || filteredByCategory['Cash Gift']?.length > 0) && (
              <section className="mt-2">
                <h2 className="text-lg font-semibold text-gray-900">Cash Gift</h2>
                <p className="text-sm text-gray-500 mt-1">Quick cash options: PayPal, Venmo, Zelle.</p>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
                  {filteredByCategory['Cash Gift']?.map(p => <ProductCard key={p.id} p={p} />)}
                </div>
              </section>
            )}

            {/* Gift Cards */}
            {(!q || filteredByCategory['Gift Cards']?.length > 0) && (
              <>
                {(!q || filteredByCategory['Cash Gift']?.length > 0) && (
                  <hr className="my-10 border-t border-gray-200" />
                )}
                <section>
                  <h2 className="text-lg font-semibold text-gray-900">Gift Cards</h2>
                  <p className="text-sm text-gray-500 mt-1">Gift cards for your favorite stores and services.</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
                    {filteredByCategory['Gift Cards']?.map(p => <ProductCard key={p.id} p={p} />)}
                  </div>
                </section>
              </>
            )}

            {/* Memberships */}
            {(!q || filteredByCategory['Memberships']?.length > 0) && (
              <>
                {((!q || filteredByCategory['Cash Gift']?.length > 0) || (!q || filteredByCategory['Gift Cards']?.length > 0)) && (
                  <hr className="my-10 border-t border-gray-200" />
                )}
                <section>
                  <h2 className="text-lg font-semibold text-gray-900">Memberships</h2>
                  <p className="text-sm text-gray-500 mt-1">Streaming services, gym memberships, and more.</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
                    {filteredByCategory['Memberships']?.map(p => <ProductCard key={p.id} p={p} />)}
                  </div>
                </section>
              </>
            )}

            {/* Other */}
            {(!q || filteredByCategory['Other']?.length > 0) && (
              <>
                {((!q || filteredByCategory['Cash Gift']?.length > 0) || (!q || filteredByCategory['Gift Cards']?.length > 0) || (!q || filteredByCategory['Memberships']?.length > 0)) && (
                  <hr className="my-10 border-t border-gray-200" />
                )}
                <section>
                  <h2 className="text-lg font-semibold text-gray-900">Other</h2>
                  <p className="text-sm text-gray-500 mt-1">Additional marketplace items.</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
                    {filteredByCategory['Other']?.map(p => <ProductCard key={p.id} p={p} />)}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>

    </main>
  )
}

function FloatingSearch({ initialQuery }: { initialQuery: string }) {
  const [visible, setVisible] = useState(true)
  const prevY = useRef<number>(0)
  
  useEffect(() => {
    prevY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (y > prevY.current + 10) {
        // scrolling down
        setVisible(false)
      } else if (y < prevY.current - 10) {
        // scrolling up
        setVisible(true)
      }
      prevY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`sticky top-4 z-30 mb-6 transition-all duration-200 ${visible ? 'opacity-100 translate-y-0' : 'pointer-events-none -translate-y-3 opacity-0'}`}>
      <div className="mx-auto max-w-3xl">
        <HeroSearch initialQuery={initialQuery} />
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MarketplaceContent />
    </Suspense>
  )
}