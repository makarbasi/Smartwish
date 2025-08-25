'use client'

import { useMemo, useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import QRCode from 'qrcode'

// Types
type Product = {
  id: string
  name: string
  category: string
  image?: string
  minAmount: number
  maxAmount: number
  availableAmounts: number[]
}

type ProductsResponse = {
  products: Product[]
}

// SWR fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Global state variables
let allProducts: Product[] = []
let filteredProducts: Product[] = []
let selectedProduct: Product | null = null
const selectedAmount: number | null = null

function ProductCard({ p }: { p: Product }) {
  const selectProduct = (productId: string) => {
    // Get product data
    selectedProduct = allProducts.find(prod => prod.id === productId) || null

    // Show checkout modal
    showCheckout()

    // Update selected product info
    updateSelectedProductInfo()

    // Generate amount options
    generateAmountOptions()
  }

  return (
    <div
      className="group overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200 transition-shadow hover:shadow-sm cursor-pointer"
      onClick={() => selectProduct(p.id)}
    >
      <div className="relative">
        <img
          src={p.image || 'https://via.placeholder.com/400x267?text=🎁'}
          alt={p.name}
          className="aspect-[3/2] w-full bg-gray-100 object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'https://via.placeholder.com/400x267?text=🎁'
          }}
        />
      </div>
      <div className="px-4 pt-3 pb-4 text-left">
        <div className="flex items-center justify-between">
          <h3 className="line-clamp-1 text-[15px] font-semibold leading-6 text-gray-900">{p.name}</h3>
          <div className="text-sm text-gray-700 font-medium">${p.minAmount}-${p.maxAmount}</div>
        </div>
        <div className="mt-1.5 text-[12px] text-gray-600">{p.category.replace('_', ' ')} · Gift Card</div>
      </div>
    </div>
  )
}

function MarketplaceContent() {
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

  // Fetch data from API
  const { data: productsData, error, isLoading } = useSWR<ProductsResponse>(
    '/api/tremendous/products',
    fetcher
  )

  // Update global products when data loads
  useEffect(() => {
    if (productsData?.products) {
      allProducts = productsData.products
      filteredProducts = [...allProducts]

      // Debug: Log available categories
      const categories = [...new Set(productsData.products.map(p => p.category))]
      console.log('Available categories:', categories)
      console.log('Sample products:', productsData.products.slice(0, 3))
    }
  }, [productsData])

  // Filter products based on search and category filter
  const displayProducts = useMemo(() => {
    if (!productsData?.products) return []

    let filtered = productsData.products

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

    setIsVoiceRecording(true)

    recognition.onstart = () => {
      console.log('🎤 Voice recognition started')
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
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">GiftCard Hub</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-gray-500">Generate redeemable gift card links instantly with beautiful QR codes.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array(15).fill(0).map((_, index) => (
            <div key={`skeleton-${index}`} className="group overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200">
              <div className="relative">
                <div className="aspect-[3/2] w-full bg-gray-200 animate-pulse" />
              </div>
              <div className="px-4 pt-3 pb-4 text-left">
                <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  // Show error state
  if (error || !productsData) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">GiftCard Hub</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-gray-500">Generate redeemable gift card links instantly with beautiful QR codes.</p>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center">
          <div className="text-red-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 mb-2">Failed to load gift cards</h3>
          <p className="text-red-600">There was an error loading the available gift cards. Please try again later.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">GiftCard Hub</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-gray-500">Generate redeemable gift card links instantly with beautiful QR codes.</p>
      </div>

      {/* Floating Search Bar */}
      <div className="sticky top-4 z-30 mb-6">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <div className="flex items-center gap-1 sm:gap-2 rounded-2xl bg-white/95 p-1.5 sm:p-2 shadow-sm ring-1 ring-gray-300 backdrop-blur transition focus-within:ring-indigo-400">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search for gift cards..."
                className="flex-1 min-w-0 rounded-2xl bg-transparent px-2 sm:px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              />

              {/* Voice Input Button */}
              <button
                type="button"
                onClick={startVoiceSearch}
                className={`flex-shrink-0 mr-1 sm:mr-2 grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full shadow-xs transition-all ${isVoiceRecording
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                aria-label="Voice search"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" aria-hidden="true">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {/* Search Button */}
              <button
                type="button"
                className="flex-shrink-0 mr-0.5 sm:mr-1 grid h-8 w-8 sm:h-10 sm:w-10 place-items-center rounded-full bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 transition-all"
                aria-label="Search"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex justify-center">
        <div className="flex gap-2">
          <button
            className={`filter-btn px-4 py-2 text-sm font-medium rounded-full border transition-colors ${activeFilter === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            onClick={() => filterProducts('all')}
          >
            All
          </button>
          <button
            className={`filter-btn px-4 py-2 text-sm font-medium rounded-full border transition-colors ${activeFilter === 'merchant_card'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            onClick={() => filterProducts('merchant_card')}
          >
            Gift Cards
          </button>
          <button
            className={`filter-btn px-4 py-2 text-sm font-medium rounded-full border transition-colors ${activeFilter === 'charity'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            onClick={() => filterProducts('charity')}
          >
            Charity
          </button>
          <button
            className={`filter-btn px-4 py-2 text-sm font-medium rounded-full border transition-colors ${activeFilter === 'prepaid_card'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            onClick={() => filterProducts('prepaid_card')}
          >
            Prepaid Cards
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {displayProducts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No gift cards found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          displayProducts.map(product => <ProductCard key={product.id} p={product} />)
        )}
      </div>

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
      />
    </main>
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
  setQrCodeDataUrl
}: any) {
  const [currentSelectedProduct, setCurrentSelectedProduct] = useState<Product | null>(null)

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
      const response = await fetch('/api/tremendous/generate-gift-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: currentSelectedProduct.id,
          amount: amount
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccessData(data)
        // Generate QR code from the redemption link
        await generateQRCodeFromLink(data.redemptionLink)
        setGiftCardAmount('')
      } else {
        setErrorMessage('Failed to generate gift card: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error generating gift card:', error)
      setErrorMessage('Failed to generate gift card. Please try again.')
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
                      <img
                        src={currentSelectedProduct.image || 'https://via.placeholder.com/60x60?text=🎁'}
                        alt={currentSelectedProduct.name}
                        className="w-12 h-12 object-contain rounded-lg bg-gray-100"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = 'https://via.placeholder.com/60x60?text=🎁'
                        }}
                      />
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
                  <input
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Generate Gift Card Link
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

export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div>Loading...</div>}>
        <MarketplaceContent />
      </Suspense>
    </div>
  )
}