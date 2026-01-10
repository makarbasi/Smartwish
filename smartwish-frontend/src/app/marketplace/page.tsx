'use client'

import { useMemo, useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import QRCode from 'qrcode'
import { VirtualInput } from '@/components/VirtualInput'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useKioskConfig } from '@/hooks/useKioskConfig'

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
console.log('🔑 Stripe Publishable Key:', stripePublishableKey ? 'Loaded ✅' : 'Missing ❌')
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

// Types
type Product = {
  id: string
  name: string
  slug?: string  // Tillo brand slug
  category: string
  image?: string
  logo?: string  // Tillo brand logo
  minAmount: number
  maxAmount: number
  availableAmounts?: number[]
  currency?: string
  type?: string
}

type ProductsResponse = {
  products?: Product[]
  brands?: Product[]  // Tillo uses 'brands'
}

// SWR fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Global state variables
let allProducts: Product[] = []
let filteredProducts: Product[] = []
let selectedProduct: Product | null = null
const selectedAmount: number | null = null

// Category icons mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'all': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  'food-and-drink': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  'supermarket': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  'fashion': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
  'beauty': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
  'gaming': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>,
  'electronics': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  'travel-and-leisure': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  'tv-and-movies': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
  'music': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
  'sports': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  'home': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  'other': <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
}

// Premium Product Card Component
function ProductCard({ p, variant = 'default' }: { p: Product; variant?: 'default' | 'featured' }) {
  const selectProduct = (productId: string) => {
    selectedProduct = allProducts.find(prod => prod.id === productId) || null
    showCheckout()
    updateSelectedProductInfo()
    generateAmountOptions()
  }

  const imageUrl = p.image || p.logo || null
  const isFeatured = variant === 'featured'

  return (
    <div
      className={`group relative overflow-hidden bg-white cursor-pointer transition-all duration-300 ${
        isFeatured 
          ? 'rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 ring-1 ring-gray-100' 
          : 'rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 ring-1 ring-gray-100 hover:ring-indigo-200'
      }`}
      onClick={() => selectProduct(p.id)}
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent" />
      </div>
      
      {/* Image container */}
      <div className={`relative w-full bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 ${
        isFeatured ? 'aspect-[4/3]' : 'aspect-[3/2]'
      }`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={p.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              target.parentElement!.innerHTML = `
                <div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                  <span class="text-4xl">🎁</span>
                </div>
              `
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
            <span className={isFeatured ? 'text-5xl' : 'text-4xl'}>🎁</span>
          </div>
        )}
        
        {/* Price badge */}
        <div className="absolute bottom-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-900 shadow-sm">
            ${p.minAmount}–${p.maxAmount}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className={`${isFeatured ? 'p-4' : 'p-3'}`}>
        <h3 className={`font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors ${
          isFeatured ? 'text-base' : 'text-sm'
        }`}>
          {p.name}
        </h3>
        <p className="mt-1 text-xs text-gray-500 capitalize">
          {(p.category || 'Gift Card').replace(/[-_]/g, ' ')}
        </p>
      </div>
      
      {/* Hover action hint */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    </div>
  )
}

// Featured Card with Badge
function FeaturedProductCard({ p, badge = 'Featured' }: { p: Product; badge?: string }) {
  return (
    <div className="relative flex-shrink-0 w-[280px] sm:w-[320px]">
      {/* Badge */}
      <div className="absolute top-3 left-3 z-10">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-xs font-bold text-white shadow-lg shadow-orange-500/25">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {badge}
        </span>
      </div>
      <ProductCard p={p} variant="featured" />
    </div>
  )
}

function MarketplaceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [giftCardAmount, setGiftCardAmount] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<any>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAction, setPaymentAction] = useState<'print' | 'send' | null>(null)
  const { config: kioskConfig } = useKioskConfig()
  const micEnabled = kioskConfig?.micEnabled !== false

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔵 MarketplaceContent State:', {
      showCheckoutModal,
      showPaymentModal,
      paymentAction,
      hasSuccessData: !!successData,
      hasQrCode: !!qrCodeDataUrl
    })
  }, [showCheckoutModal, showPaymentModal, paymentAction, successData, qrCodeDataUrl])

  // Check if we're in gift card integration mode
  const cardId = searchParams.get('cardId')
  const cardName = searchParams.get('cardName')
  const isGiftMode = searchParams.get('mode') === 'gift'

  // Fetch data from Tillo API
  const { data: productsData, error, isLoading } = useSWR<ProductsResponse>(
    '/api/tillo/brands',
    fetcher
  )

  const CATEGORY_LABELS: Record<string, string> = {
    'food-and-drink': 'Food & Drink',
    'tv-and-movies': 'TV & Movies',
    'travel-and-leisure': 'Travel & Leisure',
    'department-store': 'Department Store',
    'school-vouchers': 'School Vouchers',
  }

  const formatCategoryLabel = (category: string): string => {
    if (!category) return 'Other'
    const known = CATEGORY_LABELS[category]
    if (known) return known
    return category
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const categoryTabs = useMemo(() => {
    const items = productsData?.brands || productsData?.products || []
    if (!items || items.length === 0) return [{ key: 'all', label: 'All' }]

    const counts = new Map<string, number>()
    for (const p of items) {
      const c = (p.category || 'other').toLowerCase()
      counts.set(c, (counts.get(c) || 0) + 1)
    }

    // Prefer common, user-meaningful categories first, then remaining by count.
    const preferredOrder = [
      'food-and-drink',
      'supermarket',
      'fashion',
      'beauty',
      'gaming',
      'electronics',
      'home',
      'travel-and-leisure',
      'sports',
      'tv-and-movies',
      'music',
      'baby',
      'charity',
      'other',
    ]

    const preferredIndex = (c: string) => {
      const idx = preferredOrder.indexOf(c)
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
    }

    const categories = Array.from(counts.keys()).sort((a, b) => {
      const ai = preferredIndex(a)
      const bi = preferredIndex(b)
      if (ai !== bi) return ai - bi
      const ac = counts.get(a) || 0
      const bc = counts.get(b) || 0
      if (ac !== bc) return bc - ac
      return a.localeCompare(b)
    })

    // Keep UI compact: show the most relevant categories; always keep "other" last if present.
    const withoutOther = categories.filter((c) => c !== 'other')
    const hasOther = categories.includes('other')
    const limited = withoutOther.slice(0, 8)
    if (hasOther) limited.push('other')

    return [
      { key: 'all', label: 'All' },
      ...limited.map((c) => ({ key: c, label: formatCategoryLabel(c) })),
    ]
  }, [productsData])

  // Update global products when data loads (Tillo brands)
  useEffect(() => {
    const items = productsData?.brands || productsData?.products || []
    if (items.length > 0) {
      allProducts = items
      filteredProducts = [...allProducts]

      // Debug: Log available categories
      const categories = [...new Set(items.map(p => p.category))]
      console.log('🎁 Available gift card brands:', items.length)
      console.log('Available categories:', categories)
      console.log('Sample brands:', items.slice(0, 3))
    }
  }, [productsData])

  // Get promoted gift card IDs from kiosk config
  // Use sample promoted cards for demo/testing when none are configured
  const configuredPromotedIds = kioskConfig?.promotedGiftCardIds || []
  const promotedGiftCardIds = configuredPromotedIds.length > 0 
    ? configuredPromotedIds 
    : ['amazon-com-usa', 'starbucks-usa', 'target-usa', 'uber-usa', 'doordash-usa'] // Default samples

  // Debug: Log kiosk config and promoted IDs
  useEffect(() => {
    console.log('🌟 Gift Hub - Promoted Config:', {
      hasKioskConfig: !!kioskConfig,
      configuredPromotedIds,
      promotedGiftCardIds,
      usingDefaults: configuredPromotedIds.length === 0
    })
  }, [kioskConfig, configuredPromotedIds, promotedGiftCardIds])

  // Get promoted products (always visible, unaffected by search/filter)
  const promotedProducts = useMemo(() => {
    const items = productsData?.brands || productsData?.products || []
    if (items.length === 0 || promotedGiftCardIds.length === 0) return []

    // Find products that match the promoted IDs (by id, slug, or name)
    const promoted = promotedGiftCardIds
      .map(promotedId => {
        const normalizedId = promotedId.toLowerCase()
        const found = items.find(product => 
          product.id?.toLowerCase() === normalizedId ||
          product.slug?.toLowerCase() === normalizedId ||
          product.name?.toLowerCase().includes(normalizedId.replace(/-/g, ' '))
        )
        if (!found) {
          console.log(`🌟 Promoted "${promotedId}" not found in brands`)
        }
        return found
      })
      .filter(Boolean) as Product[]

    console.log('🌟 Promoted gift cards found:', promoted.length, 'of', promotedGiftCardIds.length)
    return promoted
  }, [productsData, promotedGiftCardIds])

  // Filter products based on search and category filter
  const displayProducts = useMemo(() => {
    const items = productsData?.brands || productsData?.products || []
    if (items.length === 0) return []

    let filtered = items

    // Apply category filter first
    if (activeFilter !== 'all') {
      filtered = filtered.filter(product => product.category === activeFilter)
      console.log(`Filtered by category "${activeFilter}":`, filtered.length, 'products')
    }

    // Then apply search filter
    if (searchTerm !== '') {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
      console.log(`Filtered by search "${searchTerm}":`, filtered.length, 'products')
    }

    console.log('Final display products:', filtered.length)
    return filtered
  }, [productsData, searchTerm, activeFilter])

  // Filter products by category
  const filterProducts = (category: string) => {
    console.log('Filtering by category:', category)
    setActiveFilter(category)
    setSearchTerm('') // Clear search when filtering
  }

  // Voice search functionality
  const startVoiceSearch = () => {
    if (typeof window === 'undefined') return
    if (!micEnabled) {
      alert('Microphone is disabled on this kiosk.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    // Clear existing text when mic is clicked
    setSearchTerm('')
    setIsVoiceRecording(true)

    recognition.onstart = () => {
      console.log('🎤 Voice recognition started - previous text cleared')
    }

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      console.log('🗣️ Voice input:', transcript)
      setSearchTerm(transcript)
    }

    recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error)
      setIsVoiceRecording(false)

      switch (event.error) {
        case 'no-speech':
          alert('No speech detected. Please try again.')
          break
        case 'audio-capture':
          alert('No microphone found. Please check your microphone permissions.')
          break
        case 'not-allowed':
          alert('Microphone access denied. Please allow microphone access and try again.')
          break
        case 'network':
          alert('Network error. Please check your internet connection.')
          break
        default:
          alert('Speech recognition failed. Please try again.')
      }
    }

    recognition.onend = () => {
      console.log('🔇 Voice recognition ended')
      setIsVoiceRecording(false)
    }

    recognition.start()
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero skeleton */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="h-10 w-64 bg-white/20 rounded-lg mx-auto mb-4 animate-pulse" />
            <div className="h-6 w-96 bg-white/10 rounded-lg mx-auto animate-pulse" />
          </div>
        </div>
        
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Skeleton grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array(15).fill(0).map((_, index) => (
              <div key={`skeleton-${index}`} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="aspect-[3/2] w-full bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
                <div className="p-3">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // Show error state
  if (error || !productsData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">GiftCard Hub</h1>
            <p className="text-indigo-100">Choose the perfect gift in seconds</p>
          </div>
        </div>
        
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center shadow-sm">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-red-900 mb-2">Unable to load gift cards</h3>
            <p className="text-red-600 mb-6">We couldn't load the available gift cards. Please try again.</p>
            <button 
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        </main>
      </div>
    )
  }

  // Get returnTo URL for back navigation
  const returnTo = searchParams.get('returnTo')

  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo)
    } else {
      router.back()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* ==================== HERO SECTION ==================== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="2" fill="white" />
              </pattern>
            </defs>
            <rect fill="url(#hero-pattern)" width="100%" height="100%" />
          </svg>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          
          {/* Hero content */}
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-4">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Over {displayProducts.length}+ brands available
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-3 tracking-tight">
              GiftCard Hub
            </h1>
            <p className="text-lg sm:text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              Choose the perfect gift in seconds. Browse top brands and send instantly.
            </p>
            
            {/* Premium Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition-opacity" />
                <div className="relative flex items-center gap-2 rounded-xl bg-white p-2 shadow-2xl shadow-indigo-900/20">
                  <div className="flex-1 flex items-center gap-2 px-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <VirtualInput
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search for gift cards..."
                      className="flex-1 min-w-0 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none bg-transparent"
                    />
                  </div>
                  
                  {/* Voice Input Button */}
                  {micEnabled && (
                    <button
                      type="button"
                      onClick={startVoiceSearch}
                      className={`flex-shrink-0 grid h-10 w-10 place-items-center rounded-lg transition-all ${
                        isVoiceRecording
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                      }`}
                      aria-label="Voice search"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Search Button */}
                  <button
                    type="button"
                    className="flex-shrink-0 grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    aria-label="Search"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 60V30C240 50 480 60 720 45C960 30 1200 0 1440 15V60H0Z" fill="white" fillOpacity="0.1" />
            <path d="M0 60V40C240 55 480 60 720 50C960 40 1200 20 1440 30V60H0Z" className="fill-slate-50" />
          </svg>
        </div>
      </div>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-2">
        
        {/* ==================== CATEGORY PILLS ==================== */}
        <div className="py-6">
          <div className="flex justify-center">
            <div className="inline-flex max-w-full gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`group inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-full transition-all duration-200 ${
                    activeFilter === tab.key
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 ring-1 ring-gray-200 hover:ring-gray-300'
                  }`}
                  onClick={() => filterProducts(tab.key)}
                >
                  <span className={`transition-colors ${activeFilter === tab.key ? 'text-indigo-200' : 'text-gray-400 group-hover:text-gray-500'}`}>
                    {CATEGORY_ICONS[tab.key] || CATEGORY_ICONS['other']}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ==================== FEATURED GIFT CARDS SECTION ==================== */}
        {promotedProducts.length > 0 && (
          <section className="py-8">
            {/* Section header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/25">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Featured Gift Cards</h2>
                  <p className="text-sm text-gray-500">Hand-picked top brands for you</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-medium">
                {promotedProducts.length} curated
              </span>
            </div>
            
            {/* Horizontal scroll carousel */}
            <div className="relative -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {promotedProducts.map((product, idx) => (
                  <FeaturedProductCard 
                    key={`featured-${product.id}`} 
                    p={product} 
                    badge={idx === 0 ? 'Top Pick' : idx === 1 ? 'Popular' : 'Featured'}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================== SECTION DIVIDER ==================== */}
        {promotedProducts.length > 0 && (
          <div className="py-4">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>
        )}

        {/* ==================== ALL GIFT CARDS SECTION ==================== */}
        <section className="py-8">
          {/* Section header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {searchTerm || activeFilter !== 'all' ? 'Search Results' : 'All Gift Cards'}
                </h2>
                <p className="text-sm text-gray-500">
                  {searchTerm ? `Showing results for "${searchTerm}"` : 'Browse our complete collection'}
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
              {displayProducts.length} available
            </span>
          </div>
          
          {/* Products Grid */}
          {displayProducts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No gift cards found</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                We couldn't find any gift cards matching your search. Try different keywords or browse all categories.
              </p>
              <button
                onClick={() => { setSearchTerm(''); setActiveFilter('all'); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {displayProducts.map(product => (
                <ProductCard key={product.id} p={product} />
              ))}
            </div>
          )}
        </section>
        
        {/* ==================== TRUST FOOTER ==================== */}
        <div className="py-12 border-t border-gray-100">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Instant Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>500+ Brands</span>
            </div>
          </div>
        </div>
      </main>

      {/* Checkout Modal */}
      <CheckoutModal
        showCheckoutModal={showCheckoutModal}
        setShowCheckoutModal={setShowCheckoutModal}
        selectedProduct={selectedProduct}
        giftCardAmount={giftCardAmount}
        setGiftCardAmount={setGiftCardAmount}
        isGenerating={isGenerating}
        setIsGenerating={setIsGenerating}
        successData={successData}
        setSuccessData={setSuccessData}
        errorMessage={errorMessage}
        setErrorMessage={setErrorMessage}
        qrCodeDataUrl={qrCodeDataUrl}
        setQrCodeDataUrl={setQrCodeDataUrl}
        setShowPaymentModal={setShowPaymentModal}
        setPaymentAction={setPaymentAction}
      />

      {/* Payment Modal */}
      <PaymentModal
        showPaymentModal={showPaymentModal}
        setShowPaymentModal={setShowPaymentModal}
        paymentAction={paymentAction}
        successData={successData}
        qrCodeDataUrl={qrCodeDataUrl}
      />
    </div>
  )
}

// Global functions for checkout modal
function showCheckout() {
  const event = new CustomEvent('showCheckout')
  window.dispatchEvent(event)
}

function updateSelectedProductInfo() {
  const event = new CustomEvent('updateSelectedProductInfo', { detail: selectedProduct })
  window.dispatchEvent(event)
}

function generateAmountOptions() {
  const event = new CustomEvent('generateAmountOptions', { detail: selectedProduct })
  window.dispatchEvent(event)
}

// Checkout Modal Component
function CheckoutModal({
  showCheckoutModal,
  setShowCheckoutModal,
  selectedProduct,
  giftCardAmount,
  setGiftCardAmount,
  isGenerating,
  setIsGenerating,
  successData,
  setSuccessData,
  errorMessage,
  setErrorMessage,
  qrCodeDataUrl,
  setQrCodeDataUrl,
  setShowPaymentModal,
  setPaymentAction
}: any) {
  const [currentSelectedProduct, setCurrentSelectedProduct] = useState<Product | null>(null)

  console.log('🟢 CheckoutModal Props:', {
    showCheckoutModal,
    hasSetShowPaymentModal: typeof setShowPaymentModal === 'function',
    hasSetPaymentAction: typeof setPaymentAction === 'function',
    hasSuccessData: !!successData
  })

  useEffect(() => {
    const handleShowCheckout = () => setShowCheckoutModal(true)
    const handleUpdateProduct = (e: any) => setCurrentSelectedProduct(e.detail)
    const handleGenerateAmount = (e: any) => setCurrentSelectedProduct(e.detail)

    window.addEventListener('showCheckout', handleShowCheckout)
    window.addEventListener('updateSelectedProductInfo', handleUpdateProduct)
    window.addEventListener('generateAmountOptions', handleGenerateAmount)

    return () => {
      window.removeEventListener('showCheckout', handleShowCheckout)
      window.removeEventListener('updateSelectedProductInfo', handleUpdateProduct)
      window.removeEventListener('generateAmountOptions', handleGenerateAmount)
    }
  }, [setShowCheckoutModal])

  // Generate QR code from redemption link
  const generateQRCodeFromLink = async (link: string) => {
    try {
      const qrCodeUrl = await QRCode.toDataURL(link, {
        width: 200,
        margin: 2,
        color: {
          dark: '#2d3748',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      })
      setQrCodeDataUrl(qrCodeUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
      // Fallback: just set empty string so we show the link instead
      setQrCodeDataUrl('')
    }
  }

  const generateGiftCard = async () => {
    if (!currentSelectedProduct || !giftCardAmount) {
      setErrorMessage('Please select a gift card and enter an amount first.')
      return
    }

    const amount = parseFloat(giftCardAmount)
    if (amount < currentSelectedProduct.minAmount || amount > currentSelectedProduct.maxAmount) {
      setErrorMessage(`Amount must be between $${currentSelectedProduct.minAmount} and $${currentSelectedProduct.maxAmount}`)
      return
    }

    setIsGenerating(true)
    setErrorMessage(null)
    setSuccessData(null)

    try {
      // IMPORTANT: We do NOT issue the gift card here!
      // We only store the SELECTION. The actual gift card will be issued
      // only after successful payment in the CardPaymentModal.
      console.log('🎁 Storing gift card selection (NOT issuing yet):', {
        brand: currentSelectedProduct.name,
        brandSlug: currentSelectedProduct.slug || currentSelectedProduct.id,
        amount: amount
      })

      // Check if we're in gift mode - integrate with card design
      const searchParams = new URLSearchParams(window.location.search)
      const returnTo = searchParams.get('returnTo')

      if (returnTo) {
        console.log('🎁 Return Mode Detected - Saving gift card SELECTION and redirecting:', returnTo)

        // Extract cardId from returnTo URL (e.g., /my-cards/abc123?showGift=true)
        const cardIdMatch = returnTo.match(/\/my-cards\/([^?]+)/)
        const cardId = cardIdMatch ? cardIdMatch[1] : null

        if (cardId) {
          // Store gift card SELECTION (not issued yet) - no sensitive data
          // The actual gift card will be issued after payment
          const giftCardSelection = {
            // Selection data (for display)
            storeLogo: currentSelectedProduct.logo || currentSelectedProduct.image || '',
            storeName: currentSelectedProduct.name,
            amount: amount,
            brandSlug: currentSelectedProduct.slug || currentSelectedProduct.id,
            currency: currentSelectedProduct.currency || 'USD',
            // Status
            status: 'pending', // Will change to 'issued' after payment
            isIssued: false,   // Flag to indicate not yet issued
            selectedAt: new Date().toISOString(),
            source: 'tillo'
          }

          // Store selection in localStorage (no encryption needed - no sensitive data)
          localStorage.setItem(`giftCard_${cardId}`, JSON.stringify(giftCardSelection))
          localStorage.setItem(`giftCardMeta_${cardId}`, JSON.stringify({
            storeName: currentSelectedProduct.name,
            amount: amount,
            source: 'tillo',
            status: 'pending',
            selectedAt: new Date().toISOString(),
            isEncrypted: false
          }))

          console.log('✅ Gift card SELECTION saved for card:', cardId)
          console.log('📝 Note: Gift card will be issued after payment')

          // Navigate back to the card editor
          window.location.href = returnTo
          return
        }
      }

      // Normal flow (not returning to card) - show success
      // Store selection for standalone use
      const successPayload = {
        success: true,
        amount: amount,
        productName: currentSelectedProduct.name,
        brandSlug: currentSelectedProduct.slug || currentSelectedProduct.id,
        status: 'pending',
        source: 'tillo'
      }
      console.log('📝 Setting Success Data (selection only):', successPayload)
      setSuccessData(successPayload)
      setGiftCardAmount('')
      console.log('✅ Gift card selection complete')

    } catch (error) {
      console.error('Error saving gift card selection:', error)
      setErrorMessage('Failed to save gift card selection. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const closeCheckout = () => {
    setShowCheckoutModal(false)
    setSuccessData(null)
    setErrorMessage(null)
    setGiftCardAmount('')
    setCurrentSelectedProduct(null)
    setQrCodeDataUrl('')
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Link copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy text: ', err)
      alert('Failed to copy to clipboard. Please copy manually.')
    }
  }



  if (!showCheckoutModal) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeCheckout}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {!successData ? 'Generate Gift Card Link' : 'Gift Card Generated!'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {!successData ? 'Create a redeemable link with QR code' : 'Your gift card is ready to share'}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {!successData ? (
              <>
                {/* Selected Product Info */}
                {currentSelectedProduct && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center overflow-hidden">
                        {currentSelectedProduct.image ? (
                          <img
                            src={currentSelectedProduct.image}
                            alt={currentSelectedProduct.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              target.parentElement!.innerHTML = '<span class="text-2xl">🎁</span>'
                            }}
                          />
                        ) : (
                          <span className="text-2xl">🎁</span>
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{currentSelectedProduct.name}</div>
                        <div className="text-sm text-gray-500">{currentSelectedProduct.category.replace('_', ' ')}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Amount Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gift Card Amount ($)</label>
                  <VirtualInput
                    type="number"
                    value={giftCardAmount}
                    onChange={(e) => setGiftCardAmount(e.target.value)}
                    placeholder="Enter amount (e.g., 25.50)"
                    min={currentSelectedProduct?.minAmount || 1}
                    max={currentSelectedProduct?.maxAmount || 1000}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Available range: ${currentSelectedProduct?.minAmount || 1} - ${currentSelectedProduct?.maxAmount || 1000}
                  </p>
                </div>

                {/* Generate Button */}
                <button
                  onClick={generateGiftCard}
                  disabled={isGenerating || !giftCardAmount || !currentSelectedProduct}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="inline-block w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Attach Gift to Card
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {/* Success Message */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <svg className="h-5 w-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <h3 className="font-medium text-green-800">Gift Card Generated!</h3>
                  </div>

                  <div className="space-y-4">
                    {/* QR Code */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">📱 QR Code</div>
                      <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
                        {qrCodeDataUrl ? (
                          <img
                            src={qrCodeDataUrl}
                            alt="Gift Card QR Code"
                            className="mx-auto"
                            style={{ width: '200px', height: '200px' }}
                          />
                        ) : (
                          <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <div className="text-lg font-semibold text-gray-700 mb-2">📱 Mobile-Friendly Link</div>
                            <div className="font-mono text-sm text-gray-600 break-all bg-white p-2 rounded border border-gray-200">
                              {successData.redemptionLink}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Copy this link and share it with recipients</p>
                          </div>
                        )}
                      </div>
                      <div className="text-center mt-3">
                        <button
                          onClick={() => copyToClipboard(successData.redemptionLink)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
                        >
                          <svg className="inline-block w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Link
                        </button>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Amount</div>
                        <div className="font-medium text-gray-900">${successData.amount} USD</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Product</div>
                        <div className="font-medium text-gray-900">{successData.productName}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={() => {
                      console.log('🖨️ Print Card button clicked!')
                      console.log('📊 Success Data:', successData)
                      console.log('📞 Calling setPaymentAction with: print')
                      console.log('📞 Calling setShowPaymentModal with: true')
                      setPaymentAction('print')
                      setShowPaymentModal(true)
                      console.log('✅ State setters called - payment modal should show')
                    }}
                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Card
                  </button>
                  <button
                    onClick={() => {
                      setPaymentAction('send')
                      setShowPaymentModal(true)
                    }}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-500 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send E-Card
                  </button>
                </div>
              </>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <svg className="inline-block w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {errorMessage}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
            <button onClick={closeCheckout} className="text-gray-400 hover:text-gray-600 px-4 py-2 text-sm font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Payment Modal Component (Wrapper with Stripe Elements)
function PaymentModal({
  showPaymentModal,
  setShowPaymentModal,
  paymentAction,
  successData,
  qrCodeDataUrl
}: any) {
  console.log('💳 PaymentModal render:', {
    showPaymentModal,
    paymentAction,
    hasSuccessData: !!successData,
    hasStripePromise: !!stripePromise
  })

  if (!showPaymentModal) return null

  if (!stripePromise) {
    console.error('❌ Stripe not initialized! Check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-bold text-red-600 mb-2">Payment System Error</h3>
          <p className="text-gray-700">Stripe is not configured. Please check your environment variables.</p>
          <button
            onClick={() => setShowPaymentModal(false)}
            className="mt-4 bg-gray-600 text-white px-4 py-2 rounded"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentModalContent
        showPaymentModal={showPaymentModal}
        setShowPaymentModal={setShowPaymentModal}
        paymentAction={paymentAction}
        successData={successData}
        qrCodeDataUrl={qrCodeDataUrl}
      />
    </Elements>
  )
}

// Inner Payment Modal Component with Stripe Hooks
function PaymentModalContent({
  showPaymentModal,
  setShowPaymentModal,
  paymentAction,
  successData,
  qrCodeDataUrl
}: any) {
  const stripe = useStripe()
  const elements = useElements()

  const [cardholderName, setCardholderName] = useState('')
  const [paymentQRCode, setPaymentQRCode] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSessionId] = useState(() => `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const checkPaymentIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (showPaymentModal && successData) {
      // Create Stripe payment intent
      createPaymentIntent()
      // Generate QR code for payment
      generatePaymentQRCode()
    }

    return () => {
      if (checkPaymentIntervalRef.current) {
        clearInterval(checkPaymentIntervalRef.current)
      }
    }
  }, [showPaymentModal, successData])

  const createPaymentIntent = async () => {
    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: successData?.amount || 0,
          currency: 'usd',
          metadata: {
            productName: successData?.productName || '',
            paymentAction: paymentAction,
            sessionId: paymentSessionId,
          },
        }),
      })

      const data = await response.json()

      if (response.ok && data.clientSecret) {
        setClientSecret(data.clientSecret)
      } else {
        setPaymentError(data.error || 'Failed to initialize payment')
      }
    } catch (error) {
      console.error('Error creating payment intent:', error)
      setPaymentError('Failed to initialize payment')
    }
  }

  const generatePaymentQRCode = async () => {
    try {
      // Create a payment URL with session ID
      const paymentUrl = `${window.location.origin}/payment?session=${paymentSessionId}&amount=${successData?.amount || 0}&product=${encodeURIComponent(successData?.productName || '')}`

      const qrCode = await QRCode.toDataURL(paymentUrl, {
        width: 250,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      })
      setPaymentQRCode(qrCode)
    } catch (error) {
      console.error('Error generating payment QR code:', error)
    }
  }

  // Simulate checking for mobile payment completion
  const startPaymentMonitoring = () => {
    if (checkPaymentIntervalRef.current) {
      clearInterval(checkPaymentIntervalRef.current)
    }

    // Check localStorage every 2 seconds for payment completion
    checkPaymentIntervalRef.current = setInterval(() => {
      const paymentStatus = localStorage.getItem(`payment_${paymentSessionId}`)
      if (paymentStatus === 'completed') {
        handlePaymentSuccess()
        if (checkPaymentIntervalRef.current) {
          clearInterval(checkPaymentIntervalRef.current)
        }
      }
    }, 2000)
  }

  const validatePaymentForm = () => {
    if (!stripe || !elements) {
      setPaymentError('Payment system not initialized')
      return false
    }
    if (!cardholderName || cardholderName.length < 3) {
      setPaymentError('Please enter cardholder name')
      return false
    }
    if (paymentAction === 'send' && (!recipientEmail || !recipientEmail.includes('@'))) {
      setPaymentError('Please enter a valid recipient email')
      return false
    }
    if (!clientSecret) {
      setPaymentError('Payment not initialized. Please try again.')
      return false
    }
    return true
  }

  const processPayment = async () => {
    if (!validatePaymentForm()) {
      return
    }

    setIsProcessing(true)
    setPaymentError(null)

    try {
      const cardElement = elements!.getElement(CardElement)

      if (!cardElement) {
        throw new Error('Card element not found')
      }

      // Confirm the payment with Stripe
      const { error, paymentIntent } = await stripe!.confirmCardPayment(clientSecret!, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardholderName,
          },
        },
      })

      if (error) {
        console.error('Payment error:', error)
        setPaymentError(error.message || 'Payment failed')
        setIsProcessing(false)
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('✅ Payment successful:', paymentIntent.id)
        handlePaymentSuccess()
      }
    } catch (error: any) {
      console.error('Payment processing error:', error)
      setPaymentError(error.message || 'Payment failed. Please try again.')
      setIsProcessing(false)
    }
  }

  const handlePaymentSuccess = () => {
    setIsProcessing(false)
    setPaymentComplete(true)

    // Execute action after payment
    setTimeout(() => {
      if (paymentAction === 'print') {
        handlePrint()
      } else if (paymentAction === 'send') {
        handleSendECard()
      }
    }, 1500)
  }

  const handlePrint = () => {
    // Create a printable version of the card
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Gift Card</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .card-container {
                background: white;
                border-radius: 16px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                text-align: center;
                max-width: 500px;
              }
              .card-header {
                font-size: 28px;
                font-weight: bold;
                color: #1f2937;
                margin-bottom: 20px;
              }
              .card-amount {
                font-size: 48px;
                font-weight: bold;
                color: #4f46e5;
                margin: 20px 0;
              }
              .qr-code {
                margin: 30px 0;
              }
              .qr-code img {
                border: 4px solid #e5e7eb;
                border-radius: 8px;
              }
              .instructions {
                color: #6b7280;
                font-size: 14px;
                line-height: 1.6;
                margin-top: 20px;
              }
              @media print {
                body {
                  background: white;
                }
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="card-container">
              <div class="card-header">${successData?.productName || 'Gift Card'}</div>
              <div class="card-amount">$${successData?.amount || 0}</div>
              <div class="qr-code">
                <img src="${qrCodeDataUrl}" alt="Gift Card QR Code" />
              </div>
              <div class="instructions">
                <p><strong>How to redeem:</strong></p>
                <p>Scan the QR code above or visit the link to redeem your gift card.</p>
                <p style="word-break: break-all; font-size: 12px; margin-top: 15px;">
                  ${successData?.redemptionLink || ''}
                </p>
              </div>
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }

    // Close modals after a delay
    setTimeout(() => {
      closePaymentModal()
    }, 2000)
  }

  const handleSendECard = async () => {
    try {
      // In a real application, you would send the email via an API
      console.log('Sending e-card to:', recipientEmail)
      console.log('Gift card data:', successData)

      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1000))

      alert(`E-Card successfully sent to ${recipientEmail}!`)

      // Close modals after a delay
      setTimeout(() => {
        closePaymentModal()
      }, 2000)
    } catch (error) {
      console.error('Error sending e-card:', error)
      setPaymentError('Failed to send e-card. Please try again.')
      setIsProcessing(false)
      setPaymentComplete(false)
    }
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setCardholderName('')
    setRecipientEmail('')
    setPaymentQRCode('')
    setIsProcessing(false)
    setPaymentComplete(false)
    setPaymentError(null)
    setClientSecret(null)
    if (checkPaymentIntervalRef.current) {
      clearInterval(checkPaymentIntervalRef.current)
    }
  }

  // Stripe CardElement styling
  const CARD_ELEMENT_OPTIONS = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closePaymentModal}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {paymentComplete ? 'Payment Successful!' : 'Complete Payment'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {paymentComplete
                ? `Processing your ${paymentAction === 'print' ? 'print' : 'e-card'}...`
                : `Pay $${successData?.amount || 0} to ${paymentAction === 'print' ? 'print your card' : 'send e-card'}`}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {paymentComplete ? (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-600">
                  {paymentAction === 'print' ? 'Preparing your card for printing...' : 'Sending your e-card...'}
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Side - Card Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Card Information</h3>

                  <div className="space-y-4">
                    {/* Stripe Card Element */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Card Details</label>
                      <div className="w-full px-3 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                        <CardElement options={CARD_ELEMENT_OPTIONS} />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Secured by Stripe. Your card details are never stored on our servers.
                      </p>
                    </div>

                    {/* Cardholder Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                      <VirtualInput
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                        placeholder="JOHN DOE"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    {/* Recipient Email (for e-cards) */}
                    {paymentAction === 'send' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                        <VirtualInput
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="recipient@example.com"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    )}

                    {/* Pay Button */}
                    <button
                      onClick={processPayment}
                      disabled={isProcessing}
                      className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {isProcessing ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing Payment...
                        </>
                      ) : (
                        <>Pay ${successData?.amount || 0}</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right Side - QR Code for Mobile Payment */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Or Pay with Mobile</h3>

                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 text-center">
                    <div className="mb-4">
                      {paymentQRCode && (
                        <img
                          src={paymentQRCode}
                          alt="Payment QR Code"
                          className="mx-auto rounded-lg shadow-sm"
                        />
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-gray-700">
                      <p className="font-medium">Scan to pay on your phone</p>
                      <p className="text-xs text-gray-500">
                        1. Scan QR code with your phone<br />
                        2. Complete payment on mobile<br />
                        3. Kiosk will automatically proceed
                      </p>
                    </div>

                    <button
                      onClick={startPaymentMonitoring}
                      className="mt-4 text-xs text-indigo-600 hover:text-indigo-500 font-medium"
                    >
                      Waiting for mobile payment...
                    </button>
                  </div>

                  {/* Payment Summary */}
                  <div className="mt-6 bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Product</span>
                        <span className="font-medium text-gray-900">{successData?.productName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount</span>
                        <span className="font-medium text-gray-900">${successData?.amount}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="font-semibold text-gray-900">${successData?.amount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {paymentError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <svg className="inline-block w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {paymentError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center text-xs text-gray-500">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Secure Payment
            </div>
            <button
              onClick={closePaymentModal}
              className="text-gray-400 hover:text-gray-600 px-4 py-2 text-sm font-medium"
              disabled={isProcessing}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading gift cards...</p>
        </div>
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  )
}