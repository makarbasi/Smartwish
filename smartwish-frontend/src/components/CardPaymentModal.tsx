'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useSession } from 'next-auth/react'
import QRCode from 'qrcode'
import { useKioskInactivity } from '@/hooks/useKioskInactivity'

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

// Generate UUID v4 for Tillo gift card orders (Tillo uses slugs, not UUIDs)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Check if a string is a valid UUID
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

// Gift card data returned after payment success
// Exported so consuming components can use the same type
export interface IssuedGiftCardData {
  id?: string  // The actual gift card ID from the database
  storeName: string
  amount: number
  qrCode: string
  storeLogo?: string
  redemptionLink?: string
  code?: string
  pin?: string
  isIssued: boolean
}

// Product types supported by the payment modal
export type ProductType = 'card' | 'stickers' | 'gift-card'

// Print status for tracking print progress
export type PrintStatus = 'idle' | 'sending' | 'printing' | 'completed' | 'failed'

interface CardPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: (issuedGiftCard?: IssuedGiftCardData) => void
  cardId: string
  cardName: string
  action: 'send' | 'print'
  recipientEmail?: string
  giftCardAmount?: number
  // Optional: product type for different pricing (default: 'card')
  productType?: ProductType
  // Optional: for stickers - number of stickers on the sheet
  stickerCount?: number
  // Optional: Print status for showing progress in modal
  printStatus?: PrintStatus
  // Optional: Error message if print failed
  printError?: string
  // Optional: for gift-card product type - the brand ID
  giftCardBrandId?: string
  // Optional: for gift-card product type - discount percentage
  giftCardDiscountPercent?: number
  // Optional: for gift-card product type - kiosk ID
  kioskId?: string
}

export default function CardPaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  cardId,
  cardName,
  action,
  recipientEmail,
  giftCardAmount: propGiftCardAmount,
  productType = 'card',
  stickerCount,
  printStatus = 'idle',
  printError,
  giftCardBrandId,
  giftCardDiscountPercent,
  kioskId
}: CardPaymentModalProps) {
  if (!isOpen) return null

  if (!stripePromise) {
    return (
      <Dialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold text-red-600 mb-2">Payment System Error</h3>
            <p className="text-gray-700">Stripe is not configured. Please check your environment variables.</p>
            <button
              onClick={onClose}
              className="mt-4 bg-gray-600 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </DialogPanel>
        </div>
      </Dialog>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CardPaymentModalContent
        isOpen={isOpen}
        onClose={onClose}
        onPaymentSuccess={onPaymentSuccess}
        cardId={cardId}
        cardName={cardName}
        action={action}
        recipientEmail={recipientEmail}
        giftCardAmount={propGiftCardAmount}
        productType={productType}
        stickerCount={stickerCount}
        printStatus={printStatus}
        printError={printError}
        giftCardBrandId={giftCardBrandId}
        giftCardDiscountPercent={giftCardDiscountPercent}
        kioskId={kioskId}
      />
    </Elements>
  )
}

// Sticker sheet pricing
const STICKER_PRICE = 3.99
const STICKER_PROCESSING_FEE_PERCENT = 0.05 // 5%

function CardPaymentModalContent({
  isOpen,
  onClose,
  onPaymentSuccess,
  cardId,
  cardName,
  action,
  recipientEmail,
  giftCardAmount: propGiftCardAmount,
  productType = 'card',
  stickerCount = 0,
  printStatus = 'idle',
  printError,
  giftCardBrandId,
  giftCardDiscountPercent = 0,
  kioskId
}: CardPaymentModalProps) {
  const stripe = useStripe()
  const elements = useElements()

  // ✅ Use NextAuth session for authentication
  const { data: session, status: sessionStatus } = useSession()
  
  // Extend inactivity timeout during payment
  const { pauseForPayment, resumeFromPayment } = useKioskInactivity()

  // Check if this is a sticker payment (simplified flow, no gift cards)
  const isStickers = productType === 'stickers'
  // Check if this is a kiosk gift card purchase
  const isKioskGiftCard = productType === 'gift-card'

  // Determine if we're in a printing state (to prevent modal close)
  const isPrintInProgress = printStatus === 'sending' || printStatus === 'printing'

  // UI State
  const [cardholderName, setCardholderName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(!isStickers && !isKioskGiftCard) // Stickers and gift cards have known prices

  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const VALID_PROMO_CODE = 'mypromo'

  // Payment Data
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null)
  const [priceData, setPriceData] = useState<any>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentQRCode, setPaymentQRCode] = useState('')
  
  // Gift card success display state
  const [issuedGiftCardDisplay, setIssuedGiftCardDisplay] = useState<IssuedGiftCardData | null>(null)
  const [giftCardEmail, setGiftCardEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const checkPaymentIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Extend inactivity timeout when payment modal is open
  useEffect(() => {
    if (isOpen) {
      pauseForPayment()
    }
    return () => {
      if (isOpen) {
        resumeFromPayment()
      }
    }
  }, [isOpen, pauseForPayment, resumeFromPayment])

  // ✅ Get authentication from NextAuth session (no localStorage)
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'
  const userId = session?.user?.id
  const accessToken = (session?.user as any)?.access_token

  // ✅ Show error if not authenticated (no guest users)
  if (sessionStatus === 'loading') {
    return (
      <Dialog open={isOpen} onClose={() => { }} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading session...</p>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    )
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <Dialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <XMarkIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Authentication Required</h3>
              <p className="mt-2 text-sm text-gray-600">
                Please sign in to complete your purchase.
              </p>
              <div className="mt-6">
                <button
                  onClick={onClose}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    )
  }

  // Initialize order and payment session
  useEffect(() => {
    // ✅ Use AbortController to cancel fetch requests on unmount
    const abortController = new AbortController()
    let isSubscribed = true

    // For kiosk gift cards, we don't need cardId - we use giftCardBrandId instead
    const canInitialize = isKioskGiftCard 
      ? (isOpen && giftCardBrandId && propGiftCardAmount && userId)
      : (isOpen && cardId && userId)

    if (canInitialize) {
      initializePayment().catch(err => {
        if (isSubscribed && err.name !== 'AbortError') {
          console.error('Payment initialization error:', err)
        }
      })
    }

    return () => {
      isSubscribed = false
      abortController.abort()
      if (checkPaymentIntervalRef.current) {
        clearInterval(checkPaymentIntervalRef.current)
      }
    }
  }, [isOpen, cardId, userId, isKioskGiftCard, giftCardBrandId, propGiftCardAmount])

  // Generate QR code and start monitoring after session is created
  useEffect(() => {
    // ✅ FIX: Also wait for orderId to be set before generating QR
    if (paymentSessionId && orderId && priceData && priceData.total > 0) {
      generatePaymentQRCode()
      startPaymentMonitoring()
    }
  }, [paymentSessionId, orderId, priceData])

  /**
   * Initialize the complete payment flow
   * 1. Calculate price (fixed for stickers, dynamic for cards)
   * 2. Create order in database
   * 3. Create payment session
   * 4. Create Stripe payment intent
   */
  const initializePayment = async () => {
    try {
      setLoadingPrice(true)
      setPaymentError(null)

      if (!userId) {
        throw new Error('User not authenticated')
      }

      // ======== STICKERS: Fixed pricing but still need order in database for QR payment ========
      if (isStickers) {
        console.log('🎨 Sticker payment - using fixed pricing')
        const stickerProcessingFee = STICKER_PRICE * STICKER_PROCESSING_FEE_PERCENT
        const stickerTotal = STICKER_PRICE + stickerProcessingFee

        // Set price data directly (no backend call needed for pricing)
        const stickerPriceData = {
          cardPrice: STICKER_PRICE,
          giftCardAmount: 0,
          processingFee: stickerProcessingFee,
          total: stickerTotal
        }
        setPriceData(stickerPriceData)

        // Step 1: Create order in database (required for QR code mobile payment)
        console.log('📦 Creating sticker order in database...')
        const orderResponse = await fetch(`${backendUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            cardId,
            orderType: 'sticker',
            cardName: cardName || 'Sticker Sheet',
            cardPrice: STICKER_PRICE,
            giftCardAmount: 0,
            processingFee: stickerProcessingFee,
            totalAmount: stickerTotal,
            currency: 'USD',
            metadata: {
              source: 'kiosk',
              productType: 'sticker-sheet',
              stickerCount
            }
          })
        })

        if (!orderResponse.ok) {
          const errorData = await orderResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create sticker order')
        }

        const orderResult = await orderResponse.json()

        if (!orderResult.success || !orderResult.order || !orderResult.order.id) {
          console.error('Invalid sticker order response:', orderResult)
          throw new Error('Invalid response from sticker order creation')
        }

        const createdOrderId = orderResult.order.id
        setOrderId(createdOrderId)
        console.log('✅ Sticker order created:', createdOrderId)

        // Step 2: Create Stripe payment intent for stickers
        console.log('💳 Creating Stripe payment intent for stickers...')
        const intentResponse = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: stickerTotal,
            currency: 'usd',
            metadata: {
              orderId: createdOrderId,
              userId,
              productType: 'sticker-sheet',
              stickerCount,
              price: STICKER_PRICE,
              processingFee: stickerProcessingFee
            }
          })
        })

        const intentResult = await intentResponse.json()

        if (!intentResponse.ok || !intentResult.clientSecret) {
          throw new Error(intentResult.error || 'Failed to initialize sticker payment')
        }

        setClientSecret(intentResult.clientSecret)
        console.log('✅ Sticker payment intent created:', intentResult.paymentIntentId)

        // Step 3: Create payment session in database
        const sessionId = `STICKER-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        console.log('💳 Creating sticker payment session in database...')

        const sessionResponse = await fetch(`${backendUrl}/orders/payment-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            orderId: createdOrderId,
            amount: stickerTotal,
            currency: 'USD',
            stripePaymentIntentId: intentResult.paymentIntentId,
            stripeClientSecret: intentResult.clientSecret,
            initiatedFrom: 'kiosk',
            paymentMethod: 'card_kiosk',
            sessionId,
            metadata: {
              cardId,
              cardName: cardName || 'Sticker Sheet',
              productType: 'sticker-sheet',
              stickerCount
            }
          })
        })

        if (!sessionResponse.ok) {
          const errorData = await sessionResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create sticker payment session')
        }

        const sessionResult = await sessionResponse.json()

        if (!sessionResult.success || !sessionResult.session || !sessionResult.session.id) {
          console.error('Invalid sticker session response:', sessionResult)
          throw new Error('Invalid response from sticker payment session creation')
        }

        setPaymentSessionId(sessionResult.session.id)
        console.log('✅ Sticker payment session created:', sessionResult.session.id)

        setLoadingPrice(false)
        return
      }

      // ======== KIOSK GIFT CARD: Direct gift card purchase from kiosk tile ========
      if (isKioskGiftCard && giftCardBrandId && propGiftCardAmount) {
        console.log('🎁 Kiosk gift card payment - using direct pricing')
        const giftCardPrice = propGiftCardAmount
        const discountAmount = giftCardPrice * (giftCardDiscountPercent / 100)
        const chargeAmount = giftCardPrice - discountAmount
        const processingFee = chargeAmount * 0.05 // 5% processing fee
        const totalAmount = chargeAmount + processingFee

        // Set price data directly
        const giftCardPriceData = {
          cardPrice: chargeAmount,
          giftCardAmount: 0, // This is the gift card we're selling, not an attached gift card
          processingFee: processingFee,
          total: totalAmount,
          originalGiftCardValue: giftCardPrice,
          discountPercent: giftCardDiscountPercent,
          discountAmount: discountAmount
        }
        setPriceData(giftCardPriceData)

        // Step 1: Create order in database
        // Note: For kiosk gift card purchases, we need a valid UUID for cardId.
        // SmartWish brands have UUID brandIds, but Tillo brands use slugs.
        // For Tillo brands (non-UUID slugs), generate a placeholder UUID.
        const isTilloBrand = !isValidUUID(giftCardBrandId)
        const orderCardId = isTilloBrand ? generateUUID() : giftCardBrandId
        
        console.log('📦 Creating kiosk gift card order in database...')
        console.log('🎁 Brand source:', isTilloBrand ? 'Tillo (slug)' : 'SmartWish (UUID)')
        console.log('🎁 Using cardId:', orderCardId, '(original brandId:', giftCardBrandId, ')')
        
        const orderResponse = await fetch(`${backendUrl}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            // Use generated UUID for Tillo brands, or actual UUID for SmartWish brands
            cardId: orderCardId,
            orderType: 'print', // Backend only allows: print, send_ecard, sticker
            cardName: cardName || 'Gift Card',
            cardPrice: chargeAmount,
            giftCardAmount: giftCardPrice,
            processingFee: processingFee,
            totalAmount: totalAmount,
            currency: 'USD',
            metadata: {
              source: 'kiosk',
              productType: 'kiosk-gift-card', // This identifies it as a gift card
              brandId: giftCardBrandId, // Store original brandId (UUID or slug)
              brandSlug: isTilloBrand ? giftCardBrandId : undefined, // For Tillo, also store as slug
              giftCardSource: isTilloBrand ? 'tillo' : 'smartwish', // Track the source
              kioskId: kioskId,
              discountPercent: giftCardDiscountPercent,
              originalValue: giftCardPrice,
              chargeAmount: chargeAmount
            }
          })
        })

        if (!orderResponse.ok) {
          const errorData = await orderResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create gift card order')
        }

        const orderResult = await orderResponse.json()

        if (!orderResult.success || !orderResult.order || !orderResult.order.id) {
          console.error('Invalid gift card order response:', orderResult)
          throw new Error('Invalid response from gift card order creation')
        }

        const createdOrderId = orderResult.order.id
        setOrderId(createdOrderId)
        console.log('✅ Gift card order created:', createdOrderId)

        // Step 2: Create Stripe payment intent
        console.log('💳 Creating Stripe payment intent for gift card...')
        const intentResponse = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalAmount,
            currency: 'usd',
            metadata: {
              orderId: createdOrderId,
              userId,
              productType: 'kiosk-gift-card',
              brandId: giftCardBrandId,
              brandSlug: isTilloBrand ? giftCardBrandId : undefined,
              giftCardSource: isTilloBrand ? 'tillo' : 'smartwish',
              kioskId: kioskId,
              originalValue: giftCardPrice,
              chargeAmount: chargeAmount,
              discountPercent: giftCardDiscountPercent,
              processingFee: processingFee
            }
          })
        })

        const intentResult = await intentResponse.json()

        if (!intentResponse.ok || !intentResult.clientSecret) {
          throw new Error(intentResult.error || 'Failed to initialize gift card payment')
        }

        setClientSecret(intentResult.clientSecret)
        console.log('✅ Gift card payment intent created:', intentResult.paymentIntentId)

        // Step 3: Create payment session in database
        const sessionId = `GIFTCARD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        console.log('💳 Creating gift card payment session in database...')

        const sessionResponse = await fetch(`${backendUrl}/orders/payment-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            orderId: createdOrderId,
            amount: totalAmount,
            currency: 'USD',
            stripePaymentIntentId: intentResult.paymentIntentId,
            stripeClientSecret: intentResult.clientSecret,
            initiatedFrom: 'kiosk',
            paymentMethod: 'card_kiosk',
            sessionId,
            metadata: {
              cardName: cardName || 'Gift Card',
              productType: 'kiosk-gift-card',
              brandId: giftCardBrandId,
              brandSlug: isTilloBrand ? giftCardBrandId : undefined,
              giftCardSource: isTilloBrand ? 'tillo' : 'smartwish',
              kioskId: kioskId
            }
          })
        })

        if (!sessionResponse.ok) {
          const errorData = await sessionResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to create gift card payment session')
        }

        const sessionResult = await sessionResponse.json()

        if (!sessionResult.success || !sessionResult.session || !sessionResult.session.id) {
          console.error('Invalid gift card session response:', sessionResult)
          throw new Error('Invalid response from gift card payment session creation')
        }

        setPaymentSessionId(sessionResult.session.id)
        console.log('✅ Gift card payment session created:', sessionResult.session.id)

        setLoadingPrice(false)
        return
      }

      // ======== CARDS: Full flow with gift card support ========

      // Step 1: Check localStorage for gift card amount if not provided
      let giftCardAmount = propGiftCardAmount || 0
      let giftCardProductName = ''
      let giftCardRedemptionLink = ''

      if (!giftCardAmount) {
        try {
          // Debug: List all localStorage keys containing "giftCard"
          const allKeys = Object.keys(localStorage).filter(k => k.includes('giftCard') && !k.includes('Meta'))
          console.log('🎁 DEBUG: All giftCard keys in localStorage:', allKeys)
          console.log('🎁 DEBUG: Looking for key:', `giftCard_${cardId}`)

          // Try to find gift card - check both exact match and any matching key
          let storedGiftData = localStorage.getItem(`giftCard_${cardId}`)

          // ✅ Fallback: If not found and only one gift card exists, use it (likely a migration issue)
          if (!storedGiftData && allKeys.length === 1) {
            console.log('🎁 DEBUG: Exact key not found, trying fallback to:', allKeys[0])
            storedGiftData = localStorage.getItem(allKeys[0])
          }
          console.log('🎁 Checking localStorage for gift card:', `giftCard_${cardId}`)
          console.log('🎁 Stored data:', storedGiftData ? storedGiftData.substring(0, 100) + '...' : 'null')

          if (storedGiftData) {
            let giftData: any = null

            // ✅ FIX: Handle both encrypted and unencrypted gift card data
            if (storedGiftData.startsWith('{') || storedGiftData.startsWith('[')) {
              // Unencrypted JSON format (legacy or pre-payment)
              console.log('🎁 Detected unencrypted JSON format')
              giftData = JSON.parse(storedGiftData)
            } else {
              // Encrypted format - decrypt via API
              console.log('🎁 Detected encrypted format, decrypting...')
              try {
                const decryptResponse = await fetch('/api/giftcard/decrypt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ encryptedData: storedGiftData })
                })

                if (decryptResponse.ok) {
                  const { giftCardData } = await decryptResponse.json()
                  giftData = giftCardData
                  console.log('🎁 Decrypted gift card data successfully')
                } else {
                  console.warn('⚠️ Failed to decrypt gift card data')
                }
              } catch (decryptError) {
                console.warn('⚠️ Decryption error:', decryptError)
              }
            }

            if (giftData) {
              const parsedAmount = parseFloat(giftData.amount || 0)

              // ✅ FIX: Validate parsed amount
              if (!isNaN(parsedAmount) && parsedAmount >= 0 && parsedAmount <= 1000) {
                giftCardAmount = parsedAmount
                giftCardProductName = giftData.storeName || giftData.productName || ''
                giftCardRedemptionLink = giftData.redemptionLink || ''
                console.log('🎁 Loaded gift card from localStorage:', {
                  amount: giftCardAmount,
                  store: giftCardProductName,
                  hasRedemptionLink: !!giftCardRedemptionLink
                })
              } else {
                console.warn('⚠️ Invalid gift card amount:', giftData.amount, '(parsed:', parsedAmount, ')')
                // Continue without gift card - invalid data
              }
            }
          } else {
            console.log('🎁 No gift card data found in localStorage')
          }
        } catch (error) {
          console.warn('⚠️ Failed to parse gift card data from localStorage:', error)
          // Continue without gift card - don't crash the payment flow
        }
      }

      console.log('💰 Calculating price for card:', cardId, 'Gift card amount:', giftCardAmount)
      console.log('🎁 DEBUG: Gift card amount being sent to backend:', giftCardAmount, typeof giftCardAmount)

      // Step 2: ✅ Fetch price calculation from BACKEND (not Next.js API)
      const priceResponse = await fetch(`${backendUrl}/saved-designs/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          cardId,
          giftCardAmount
        })
      })

      if (!priceResponse.ok) {
        const errorText = await priceResponse.text()
        throw new Error(`Failed to calculate price: ${errorText}`)
      }

      const priceResult = await priceResponse.json()
      console.log('💰 Price calculation (from backend):', priceResult)
      console.log('🎁 DEBUG: Backend returned giftCardAmount:', priceResult.giftCardAmount)

      // ✅ FIX: Handle zero-dollar case properly
      if (priceResult.total < 0.01) {
        console.warn('⚠️ Total amount is below minimum ($0.01)')
        setPaymentError('Invalid amount: Card price must be at least $0.01')
        setLoadingPrice(false)
        return
      }

      setPriceData(priceResult)

      // Step 3: Create order in database
      console.log('📦 Creating order in database...')
      const orderResponse = await fetch(`${backendUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          cardId,
          orderType: action === 'send' ? 'send_ecard' : 'print',
          cardName: cardName || 'Greeting Card',
          recipientEmail: null, // TODO: Get from send e-card form
          cardPrice: priceResult.cardPrice,
          giftCardAmount: priceResult.giftCardAmount,
          processingFee: priceResult.processingFee,
          totalAmount: priceResult.total,
          currency: 'USD',
          giftCardProductName,
          giftCardRedemptionLink,
          metadata: {
            source: 'kiosk',
            action
          }
        })
      })

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create order')
      }

      const orderResult = await orderResponse.json()

      // ✅ FIX: Validate response structure
      if (!orderResult.success || !orderResult.order || !orderResult.order.id) {
        console.error('Invalid order response:', orderResult)
        throw new Error('Invalid response from order creation')
      }

      const createdOrderId = orderResult.order.id
      setOrderId(createdOrderId) // ✅ Store order ID for polling
      console.log('✅ Order created:', createdOrderId)

      // Step 4: Create Stripe payment intent
      console.log('💳 Creating Stripe payment intent...')
      const intentResponse = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: priceResult.total,
          currency: 'usd',
          metadata: {
            orderId: createdOrderId,
            userId,
            cardId,
            cardName,
            action,
            cardPrice: priceResult.cardPrice,
            giftCardAmount: priceResult.giftCardAmount,
            processingFee: priceResult.processingFee
          }
        })
      })

      const intentResult = await intentResponse.json()

      if (!intentResponse.ok || !intentResult.clientSecret) {
        throw new Error(intentResult.error || 'Failed to initialize payment')
      }

      setClientSecret(intentResult.clientSecret)
      console.log('✅ Payment intent created:', intentResult.paymentIntentId)

      // Step 5: Create payment session in database
      const sessionId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      console.log('💳 Creating payment session in database...')

      const sessionResponse = await fetch(`${backendUrl}/orders/payment-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          orderId: createdOrderId,
          amount: priceResult.total,
          currency: 'USD',
          stripePaymentIntentId: intentResult.paymentIntentId,
          stripeClientSecret: intentResult.clientSecret,
          initiatedFrom: 'kiosk',
          paymentMethod: 'card_kiosk',
          sessionId,
          metadata: {
            cardId,
            cardName,
            action
          }
        })
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create payment session')
      }

      const sessionResult = await sessionResponse.json()

      // ✅ FIX: Validate session response structure
      if (!sessionResult.success || !sessionResult.session || !sessionResult.session.id) {
        console.error('Invalid session response:', sessionResult)
        throw new Error('Invalid response from payment session creation')
      }

      setPaymentSessionId(sessionResult.session.id)
      console.log('✅ Payment session created:', sessionResult.session.id)

    } catch (error: any) {
      console.error('❌ Payment initialization error:', error)
      setPaymentError(error.message || 'Failed to initialize payment')

      // ✅ FIX: TODO - Mark order as failed if it was created
      // Future enhancement: Call backend to cancel/mark order as failed
      // For now, orders with status 'pending' and no payment session are orphaned
      // They can be cleaned up by a background job
    } finally {
      setLoadingPrice(false)
    }
  }

  /**
   * Generate QR code for mobile payment
   */
  const generatePaymentQRCode = async () => {
    if (!paymentSessionId || !orderId) return

    try {
      // ✅ FIX: Include orderId in QR code so mobile uses the SAME order as kiosk
      // For kiosk gift cards, we include productType instead of cardId
      let paymentUrl = `${window.location.origin}/payment?session=${paymentSessionId}&action=${action}&orderId=${orderId}`
      
      if (isKioskGiftCard) {
        paymentUrl += `&productType=gift-card&brandId=${giftCardBrandId}`
      } else {
        paymentUrl += `&cardId=${cardId}`
      }

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
      console.log('📱 Payment QR code generated')
    } catch (error) {
      console.error('Error generating payment QR code:', error)
    }
  }

  /**
   * Monitor payment session status (for mobile payments)
   */
  const startPaymentMonitoring = () => {
    if (!paymentSessionId || !orderId) return

    if (checkPaymentIntervalRef.current) {
      clearInterval(checkPaymentIntervalRef.current)
    }

    const mobileUrl = isKioskGiftCard
      ? `${window.location.origin}/payment?session=${paymentSessionId}&productType=gift-card&brandId=${giftCardBrandId}&action=${action}`
      : `${window.location.origin}/payment?session=${paymentSessionId}&cardId=${cardId}&action=${action}`
    console.log('💡 Mobile payment URL:', mobileUrl)
    console.log('🔄 Starting payment status polling...')

    // Poll the backend every 3 seconds to check if payment completed
    checkPaymentIntervalRef.current = setInterval(async () => {
      try {
        console.log('🔍 Checking payment status for order:', orderId)

        const response = await fetch(`${backendUrl}/orders/${orderId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

        if (!response.ok) {
          console.error('Failed to check order status:', response.status)
          return
        }

        const result = await response.json()
        console.log('📊 Order status:', result.order?.status)

        // If payment completed on mobile, update kiosk UI
        if (result.success && result.order && result.order.status === 'paid') {
          console.log('✅ Payment detected! Closing modal...')
          clearInterval(checkPaymentIntervalRef.current!)
          checkPaymentIntervalRef.current = null
          handlePaymentSuccess()
        }
      } catch (error) {
        console.error('Error polling payment status:', error)
      }
    }, 3000) // Check every 3 seconds
  }

  /**
   * Handle successful payment
   * Issues the gift card if one is attached (pending)
   * Returns the issued gift card data to the parent component for printing
   */
  const handlePaymentSuccess = async () => {
    // ✅ Stop polling when payment succeeds
    if (checkPaymentIntervalRef.current) {
      clearInterval(checkPaymentIntervalRef.current)
      checkPaymentIntervalRef.current = null
    }

    setIsProcessing(false)
    setPaymentComplete(true)

    // 🎁 Issue gift card if one is pending (NOT for stickers - stickers don't have gift cards)
    let issuedGiftCardData: IssuedGiftCardData | undefined = undefined

    // Skip gift card processing for stickers
    if (isStickers) {
      console.log('🎨 Sticker payment - skipping gift card processing')
      // Wait a moment to show success message, then call callback
      setTimeout(() => {
        onPaymentSuccess(undefined)
      }, 1500)
      return
    }

    // Handle kiosk gift card issuance
    if (isKioskGiftCard && giftCardBrandId && propGiftCardAmount) {
      console.log('🎁 Kiosk gift card payment - issuing gift card')
      
      // Determine if this is a Tillo brand (slug) or SmartWish brand (UUID)
      const isTilloBrand = !isValidUUID(giftCardBrandId)
      console.log('🎁 Gift card source:', isTilloBrand ? 'TILLO' : 'SMARTWISH', 'brandId:', giftCardBrandId)
      
      try {
        let response: Response
        let data: any
        
        if (isTilloBrand) {
          // Call Tillo API to issue the gift card
          console.log('🎁 Calling Tillo API to issue gift card:', giftCardBrandId)
          response = await fetch('/api/tillo/issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandSlug: giftCardBrandId, // For Tillo, giftCardBrandId is the slug
              amount: propGiftCardAmount,
              orderId: orderId,
              kioskId: kioskId,
            }),
          })
          data = await response.json()
        } else {
          // Call SmartWish internal API to issue gift card
          console.log('🎁 Calling SmartWish API to issue gift card:', giftCardBrandId)
          response = await fetch('/api/gift-cards/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandId: giftCardBrandId,
              amount: propGiftCardAmount,
              orderId: orderId,
            }),
          })
          data = await response.json()
        }

        if (response.ok && (data.success || data.giftCard)) {
          console.log('✅ Kiosk gift card issued via', isTilloBrand ? 'Tillo' : 'SmartWish', ':', data)

          // Extract gift card data - different fields for SmartWish vs Tillo
          const giftCard = data.giftCard
          if (giftCard) {
            // Get redemption URL for Tillo cards
            const redemptionUrl = isTilloBrand 
              ? (giftCard.url || giftCard.redemptionUrl || giftCard.claim_url || '')
              : ''
            
            // Generate QR code
            let qrCodeDataUrl = ''
            try {
              // For SmartWish: use qrContent or cardNumber
              // For Tillo: use redemption URL or code
              let qrContent = ''
              if (isTilloBrand) {
                qrContent = redemptionUrl || giftCard.code || ''
                if (!qrContent && giftCard.code) {
                  qrContent = giftCard.code
                  if (giftCard.pin) {
                    qrContent += ` PIN: ${giftCard.pin}`
                  }
                }
              } else {
                qrContent = giftCard.qrContent || giftCard.cardNumber || ''
              }
              
              if (qrContent) {
                qrCodeDataUrl = await QRCode.toDataURL(qrContent, {
                  width: 200,
                  margin: 2,
                  color: { dark: '#2d3748', light: '#ffffff' },
                  errorCorrectionLevel: 'H'
                })
                console.log('✅ QR code generated for', isTilloBrand ? 'Tillo' : 'SmartWish', 'gift card')
              }
            } catch (qrError) {
              console.error('Failed to generate QR code:', qrError)
            }

            issuedGiftCardData = {
              id: isTilloBrand ? (giftCard.orderId || giftCard.clientRequestId || '') : giftCard.id,
              storeName: cardName || 'Gift Card',
              amount: propGiftCardAmount,
              qrCode: qrCodeDataUrl,
              storeLogo: '', // Can be fetched from brand if needed
              redemptionLink: redemptionUrl,
              code: isTilloBrand ? giftCard.code : giftCard.cardNumber,
              pin: giftCard.pin || '',
              isIssued: true
            }
            console.log('🎁 Prepared issued gift card data:', {
              id: issuedGiftCardData.id,
              storeName: issuedGiftCardData.storeName,
              hasQrCode: !!issuedGiftCardData.qrCode,
              hasRedemptionLink: !!issuedGiftCardData.redemptionLink,
              hasCode: !!issuedGiftCardData.code
            })
            
            // Show the gift card in the modal instead of closing
            setIssuedGiftCardDisplay(issuedGiftCardData)
          }
        } else {
          console.error('❌ Failed to issue kiosk gift card:', data)
          // Still show success but without gift card details
          setIssuedGiftCardDisplay({
            storeName: cardName || 'Gift Card',
            amount: propGiftCardAmount,
            qrCode: '',
            isIssued: false
          })
        }
      } catch (error) {
        console.error('❌ Error issuing kiosk gift card:', error)
        // Still mark payment as complete
        setIssuedGiftCardDisplay({
          storeName: cardName || 'Gift Card',
          amount: propGiftCardAmount,
          qrCode: '',
          isIssued: false
        })
      }

      // Don't call onPaymentSuccess yet - wait for user to click Done
      // The modal will show the gift card QR and email option
      return
    }

    console.log('═══════════════════════════════════════════════════════════')
    console.log('🎁 GIFT CARD ISSUANCE FLOW - START')
    console.log('🎁 cardId:', cardId)
    console.log('🎁 action:', action)

    // Debug: List ALL localStorage keys related to gift cards
    const allGiftCardKeys = Object.keys(localStorage).filter(k => k.includes('giftCard') && !k.includes('Meta'))
    console.log('🎁 All gift card keys in localStorage:', allGiftCardKeys)

    try {
      const expectedKey = `giftCard_${cardId}`
      console.log('🎁 Looking for key:', expectedKey)
      let storedGiftCard = localStorage.getItem(expectedKey)
      let actualGiftCardKey = expectedKey

      // ✅ FALLBACK: If exact key not found, try to find any gift card (handles card ID migration issues)
      if (!storedGiftCard && allGiftCardKeys.length > 0) {
        console.log('🎁 Exact key not found, trying fallback...')
        // Use the most recent gift card (last one in the list, or the only one)
        actualGiftCardKey = allGiftCardKeys[allGiftCardKeys.length - 1]
        storedGiftCard = localStorage.getItem(actualGiftCardKey)
        console.log('🎁 Using fallback key:', actualGiftCardKey, 'found:', storedGiftCard ? 'YES' : 'NO')
      }

      console.log('🎁 Raw stored gift card found:', storedGiftCard ? 'YES' : 'NO')
      if (storedGiftCard) {
        console.log('🎁 Raw data (first 200 chars):', storedGiftCard.substring(0, 200))
      }

      if (storedGiftCard) {
        let giftCardSelection: any = null

        // Handle both encrypted and unencrypted formats
        if (storedGiftCard.startsWith('{') || storedGiftCard.startsWith('[')) {
          console.log('🎁 Gift card is in plain JSON format')
          giftCardSelection = JSON.parse(storedGiftCard)
        } else {
          // Encrypted format - decrypt first
          console.log('🎁 Gift card is encrypted, decrypting...')
          try {
            const decryptResponse = await fetch('/api/giftcard/decrypt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ encryptedData: storedGiftCard })
            })
            if (decryptResponse.ok) {
              const { giftCardData } = await decryptResponse.json()
              giftCardSelection = giftCardData
              console.log('🎁 Gift card decrypted successfully')
            } else {
              console.error('🎁 Failed to decrypt gift card, status:', decryptResponse.status)
            }
          } catch (decryptError) {
            console.warn('Failed to decrypt gift card:', decryptError)
          }
        }

        console.log('🎁 Parsed gift card selection:', giftCardSelection ? {
          storeName: giftCardSelection.storeName,
          amount: giftCardSelection.amount,
          status: giftCardSelection.status,
          isIssued: giftCardSelection.isIssued,
          hasQrCode: !!giftCardSelection.qrCode
        } : 'null')

        if (giftCardSelection) {
          // Check if gift card is pending (not yet issued)
          if (giftCardSelection.status === 'pending' && !giftCardSelection.isIssued) {
            // Determine if this is a SmartWish internal brand or Tillo
            const isSmartWishBrand = giftCardSelection.source === 'smartwish'
            console.log('🎁 Gift card is PENDING - issuing via', isSmartWishBrand ? 'SMARTWISH API' : 'TILLO API')

            let response: Response
            let data: any

            if (isSmartWishBrand) {
              // Validate brandId is a proper UUID before calling API
              const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
              if (!giftCardSelection.brandId || !uuidRegex.test(giftCardSelection.brandId)) {
                console.error('❌ Invalid brandId in gift card selection:', giftCardSelection.brandId)
                console.error('❌ Full gift card selection:', JSON.stringify(giftCardSelection, null, 2))
                throw new Error(`Invalid gift card brand ID. Please remove the gift card and try adding it again.`)
              }

              // Call SmartWish internal API to issue gift card
              response = await fetch('/api/gift-cards/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  brandId: giftCardSelection.brandId,
                  amount: giftCardSelection.amount,
                  paymentIntentId: orderId,
                })
              })

              data = await response.json()

              console.log('🎁 SmartWish API response:', {
                ok: response.ok,
                success: data.success,
                hasGiftCard: !!data.giftCard,
                giftCard: data.giftCard ? {
                  cardNumber: data.giftCard.cardNumber,
                  pin: data.giftCard.pin ? '***PRESENT***' : 'N/A',
                  balance: data.giftCard.balance,
                  expiresAt: data.giftCard.expiresAt,
                } : null,
                error: data.error
              })
            } else {
              // Call Tillo API to issue the actual gift card
              response = await fetch('/api/tillo/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  brandSlug: giftCardSelection.brandSlug,
                  amount: giftCardSelection.amount,
                  currency: giftCardSelection.currency || 'USD'
                })
              })

              data = await response.json()

              console.log('🎁 Tillo API FULL response:', JSON.stringify(data, null, 2))
              console.log('🎁 Tillo API response summary:', {
                ok: response.ok,
                success: data.success,
                hasGiftCard: !!data.giftCard,
                giftCard: data.giftCard ? {
                  url: data.giftCard.url,
                  redemptionUrl: data.giftCard.redemptionUrl,
                  code: data.giftCard.code ? '***PRESENT***' : 'N/A',
                  pin: data.giftCard.pin ? '***PRESENT***' : 'N/A',
                  orderId: data.giftCard.orderId
                } : null,
                error: data.error
              })
            }

            // 🎁 Extract redemption URL - try multiple fields
            const redemptionUrl = isSmartWishBrand 
              ? '' // SmartWish cards use QR with card code, not redemption URL
              : (data.giftCard?.url || data.giftCard?.redemptionUrl || data.giftCard?.claim_url || '')
            console.log('🎁 Extracted redemption URL:', redemptionUrl || 'NONE (SmartWish uses QR code)')

            if (response.ok && data.success) {
              console.log('✅ Gift card issued successfully after payment via', isSmartWishBrand ? 'SmartWish' : 'Tillo')

              // Update localStorage with issued gift card data
              const issuedGiftCard = {
                ...giftCardSelection,
                status: 'issued',
                isIssued: true,
                issuedAt: new Date().toISOString(),
                // Add the actual gift card data - different fields for SmartWish vs Tillo
                redemptionLink: redemptionUrl,
                code: isSmartWishBrand ? data.giftCard?.cardNumber : data.giftCard?.code,
                pin: data.giftCard?.pin,
                cardNumber: isSmartWishBrand ? data.giftCard?.cardNumber : undefined,
                cardCode: isSmartWishBrand ? data.giftCard?.cardCode : undefined,
                orderId: isSmartWishBrand ? data.giftCard?.id : (data.giftCard?.orderId || data.giftCard?.clientRequestId),
                expiryDate: isSmartWishBrand ? data.giftCard?.expiresAt : data.giftCard?.expiryDate,
                qrCode: '', // Will be generated below
                source: isSmartWishBrand ? 'smartwish' : 'tillo'
              }

              console.log('🎁 Issued gift card redemptionLink set to:', issuedGiftCard.redemptionLink || 'EMPTY!')

              console.log('🎁 Issued gift card object:', {
                storeName: issuedGiftCard.storeName,
                amount: issuedGiftCard.amount,
                redemptionLink: issuedGiftCard.redemptionLink || 'N/A',
                code: issuedGiftCard.code ? '***' : 'N/A',
                hasStoreLogo: !!issuedGiftCard.storeLogo,
                source: issuedGiftCard.source
              })

              // Generate QR code for the redemption link or code
              // For SmartWish cards, use the qrContent from API
              // For Tillo cards, use redemption URL or code
              let qrContent = '';
              let qrSource = '';

              if (isSmartWishBrand && data.giftCard?.qrContent) {
                // SmartWish: use the QR content from the API (contains card code for lookup)
                qrContent = data.giftCard.qrContent;
                qrSource = 'smartwish_qr';
              } else {
                qrContent = issuedGiftCard.redemptionLink || '';
                qrSource = 'redemptionLink';
              }

              console.log('🎁 QR content check - redemptionLink:', issuedGiftCard.redemptionLink || 'EMPTY')
              console.log('🎁 QR content check - code:', issuedGiftCard.code || 'EMPTY')

              // If no URL, create QR from gift card code
              if (!qrContent && issuedGiftCard.code) {
                qrContent = issuedGiftCard.code;
                qrSource = 'code';
                if (issuedGiftCard.pin) {
                  qrContent += ` PIN: ${issuedGiftCard.pin}`;
                }
              }

              // Fallback: create QR with store name and amount
              if (!qrContent) {
                qrContent = `${giftCardSelection.storeName || 'Gift Card'} - $${issuedGiftCard.amount || giftCardSelection.amount}`;
                qrSource = 'fallback';
                console.warn('⚠️ USING FALLBACK QR CONTENT - No redemption URL or code available!')
              }

              console.log('🎁 Generating QR code from:', qrSource, '- content:', qrContent.substring(0, 80));

              try {
                const qrCodeUrl = await QRCode.toDataURL(qrContent, {
                  width: 200,
                  margin: 2,
                  color: { dark: '#2d3748', light: '#ffffff' },
                  errorCorrectionLevel: 'H'
                })
                issuedGiftCard.qrCode = qrCodeUrl
                console.log('✅ QR code generated successfully, length:', qrCodeUrl.length);
              } catch (qrError) {
                console.error('❌ Failed to generate QR code:', qrError)
                // Create a simple fallback QR code
                try {
                  const fallbackQr = await QRCode.toDataURL('Gift Card', {
                    width: 200,
                    margin: 2,
                    color: { dark: '#2d3748', light: '#ffffff' },
                    errorCorrectionLevel: 'H'
                  })
                  issuedGiftCard.qrCode = fallbackQr
                  console.log('⚠️ Using fallback QR code');
                } catch {
                  console.error('❌ Even fallback QR generation failed');
                }
              }

              // ✅ Convert store logo URL to base64 (so backend doesn't need to fetch it)
              let storeLogoBase64 = issuedGiftCard.storeLogo || '';
              if (storeLogoBase64 && !storeLogoBase64.startsWith('data:')) {
                try {
                  console.log('🏪 Converting store logo to base64:', storeLogoBase64.substring(0, 50));
                  const logoResponse = await fetch(storeLogoBase64);
                  if (logoResponse.ok) {
                    const logoBlob = await logoResponse.blob();
                    const logoBase64 = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onloadend = () => resolve(reader.result as string);
                      reader.readAsDataURL(logoBlob);
                    });
                    storeLogoBase64 = logoBase64;
                    console.log('✅ Store logo converted to base64, length:', logoBase64.length);
                  } else {
                    console.warn('⚠️ Failed to fetch store logo, status:', logoResponse.status);
                  }
                } catch (logoError) {
                  console.warn('⚠️ Failed to convert store logo to base64:', logoError);
                }
              }

              // ✅ Prepare issued gift card data to return to parent for printing
              issuedGiftCardData = {
                storeName: issuedGiftCard.storeName,
                amount: issuedGiftCard.amount,
                qrCode: issuedGiftCard.qrCode,
                storeLogo: storeLogoBase64, // Now base64 encoded
                redemptionLink: issuedGiftCard.redemptionLink,
                code: issuedGiftCard.code,
                pin: issuedGiftCard.pin,
                isIssued: true
              }
              console.log('🎁 Returning issued gift card data for printing:', {
                storeName: issuedGiftCardData.storeName,
                amount: issuedGiftCardData.amount,
                hasQrCode: !!issuedGiftCardData.qrCode,
                qrCodeLength: issuedGiftCardData.qrCode?.length || 0,
                hasStoreLogo: !!issuedGiftCardData.storeLogo,
                hasRedemptionLink: !!issuedGiftCardData.redemptionLink
              })

              // Encrypt and save the issued gift card (use actual key that was found, not just cardId)
              const saveKey = actualGiftCardKey || `giftCard_${cardId}`
              const metaKey = saveKey.replace('giftCard_', 'giftCardMeta_')

              try {
                const encryptResponse = await fetch('/api/giftcard/encrypt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ giftCardData: issuedGiftCard })
                })

                if (encryptResponse.ok) {
                  const { encryptedData } = await encryptResponse.json()
                  localStorage.setItem(saveKey, encryptedData)
                  localStorage.setItem(metaKey, JSON.stringify({
                    storeName: issuedGiftCard.storeName,
                    amount: issuedGiftCard.amount,
                    source: issuedGiftCard.source || (isSmartWishBrand ? 'smartwish' : 'tillo'),
                    status: 'issued',
                    issuedAt: issuedGiftCard.issuedAt,
                    isEncrypted: true
                  }))
                  console.log('🔐 Issued gift card saved with encryption to key:', saveKey)
                } else {
                  // Fallback - save without encryption
                  localStorage.setItem(saveKey, JSON.stringify(issuedGiftCard))
                  console.log('🔐 Issued gift card saved without encryption to key:', saveKey)
                }
              } catch (encryptError) {
                console.warn('Encryption failed, saving unencrypted:', encryptError)
                localStorage.setItem(saveKey, JSON.stringify(issuedGiftCard))
              }
            } else {
              console.error('❌ Failed to issue gift card after payment:', data)
              // Don't fail the payment - the card was paid, just log the error
              // User can contact support with the payment receipt
            }
          } else if (giftCardSelection.isIssued && giftCardSelection.qrCode) {
            // Gift card already issued - still pass it for printing
            console.log('🎁 Gift card already issued, passing to print:', giftCardSelection)

            // ✅ Convert store logo URL to base64 if needed
            let existingLogoBase64 = giftCardSelection.storeLogo || '';
            if (existingLogoBase64 && !existingLogoBase64.startsWith('data:')) {
              try {
                console.log('🏪 Converting existing store logo to base64');
                const logoResponse = await fetch(existingLogoBase64);
                if (logoResponse.ok) {
                  const logoBlob = await logoResponse.blob();
                  existingLogoBase64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(logoBlob);
                  });
                  console.log('✅ Existing store logo converted to base64');
                }
              } catch (logoError) {
                console.warn('⚠️ Failed to convert existing store logo:', logoError);
              }
            }

            issuedGiftCardData = {
              storeName: giftCardSelection.storeName,
              amount: giftCardSelection.amount,
              qrCode: giftCardSelection.qrCode,
              storeLogo: existingLogoBase64,
              redemptionLink: giftCardSelection.redemptionLink,
              code: giftCardSelection.code,
              pin: giftCardSelection.pin,
              isIssued: true
            }
          } else {
            console.log('🎁 Gift card already issued or no pending gift card')
          }
        }
      }
    } catch (giftCardError) {
      console.error('❌ Error processing gift card after payment:', giftCardError)
      // Don't fail - payment was successful
    }

    console.log('═══════════════════════════════════════════════════════════')
    console.log('🎁 GIFT CARD ISSUANCE FLOW - COMPLETE')
    console.log('🎁 issuedGiftCardData:', issuedGiftCardData ? {
      storeName: issuedGiftCardData.storeName,
      amount: issuedGiftCardData.amount,
      hasQrCode: !!issuedGiftCardData.qrCode,
      qrCodeLength: issuedGiftCardData.qrCode?.length || 0,
      hasStoreLogo: !!issuedGiftCardData.storeLogo,
      hasRedemptionLink: !!issuedGiftCardData.redemptionLink,
      hasCode: !!issuedGiftCardData.code,
      isIssued: issuedGiftCardData.isIssued
    } : 'UNDEFINED - NO GIFT CARD TO ISSUE')
    console.log('🎁 Calling onPaymentSuccess with gift card data...')
    console.log('═══════════════════════════════════════════════════════════')

    // Wait a moment to show success message, then pass issued gift card data to parent
    setTimeout(() => {
      console.log('🎁 onPaymentSuccess callback triggered with:', issuedGiftCardData ? 'GIFT CARD DATA' : 'undefined')
      onPaymentSuccess(issuedGiftCardData)
    }, 1500)
  }

  /**
   * Apply promo code to bypass payment
   */
  const applyPromoCode = () => {
    setPromoError(null)
    if (promoCode.toLowerCase() === VALID_PROMO_CODE.toLowerCase()) {
      setPromoApplied(true)
      console.log('🎟️ Promo code applied - payment will be bypassed')
    } else {
      setPromoError('Invalid promo code')
      setPromoApplied(false)
    }
  }
  
  /**
   * Email the gift card to the user
   */
  const handleEmailGiftCard = async () => {
    if (!giftCardEmail || !giftCardEmail.includes('@') || !issuedGiftCardDisplay) {
      return
    }
    
    setEmailSending(true)
    try {
      // Determine if this is a Tillo card based on whether it has a redemption link or no valid UUID
      const isTilloBrand = !isValidUUID(giftCardBrandId || '') || !!issuedGiftCardDisplay.redemptionLink
      
      const response = await fetch('/api/gift-cards/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: giftCardEmail,
          cardNumber: issuedGiftCardDisplay.code || '',
          pin: issuedGiftCardDisplay.pin || '',
          balance: issuedGiftCardDisplay.amount,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          brandName: issuedGiftCardDisplay.storeName || 'Gift Card',
          brandLogo: issuedGiftCardDisplay.storeLogo || '',
          redemptionLink: issuedGiftCardDisplay.redemptionLink || '',
          qrCode: issuedGiftCardDisplay.qrCode || '',
          source: isTilloBrand ? 'tillo' : 'smartwish',
        }),
      })
      
      if (response.ok) {
        setEmailSent(true)
        console.log('✅ Gift card emailed successfully')
      } else {
        console.error('Failed to email gift card')
      }
    } catch (error) {
      console.error('Error emailing gift card:', error)
    } finally {
      setEmailSending(false)
    }
  }
  
  /**
   * Handle Done button - close modal and return gift card data
   */
  const handleGiftCardDone = () => {
    onPaymentSuccess(issuedGiftCardDisplay || undefined)
  }
  
  /**
   * Format card number for display (add spaces)
   */
  const formatCardNumber = (num: string) => {
    if (!num) return ''
    const clean = num.replace(/\s/g, '')
    if (clean.length === 16) {
      return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`
    }
    return num
  }
  
  /**
   * Copy text to clipboard
   */
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  /**
   * Handle free checkout with promo code
   * Still issues gift card if one is attached
   */
  const handleFreeCheckout = async () => {
    if (promoApplied) {
      console.log('🎟️ Free checkout with promo code')
      setPaymentComplete(true)

      // Even with promo code, we need to issue the gift card
      await handlePaymentSuccess()
    }
  }

  /**
   * Process card payment on kiosk
   */
  const processPayment = async () => {
    if (!stripe || !elements || !clientSecret) {
      setPaymentError('Payment system not ready')
      return
    }

    if (!cardholderName || cardholderName.length < 3) {
      setPaymentError('Please enter cardholder name')
      return
    }

    // Check if payment session is ready (no database needed, just session ID for tracking)
    if (!paymentSessionId) {
      setPaymentError('Payment session not initialized')
      return
    }

    setIsProcessing(true)
    setPaymentError(null)

    try {
      const cardElement = elements.getElement(CardElement)

      if (!cardElement) {
        throw new Error('Card element not found')
      }

      // Confirm the payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardholderName,
          },
        },
      })

      if (error) {
        console.error('❌ Payment error:', error)
        setPaymentError(error.message || 'Payment failed')
        setIsProcessing(false)

        // Payment failed - log for debugging
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('✅ Payment successful:', paymentIntent.id)
        console.log('🔍 DEBUG: Stripe returned metadata:', paymentIntent.metadata)
        console.log('🔍 DEBUG: Component state orderId:', orderId)

        // Save transaction to database
        try {
          console.log('💾 Creating transaction record...')

          // ✅ FIX Bug #28: orderId MUST be in state - no fallback!
          // If orderId is undefined, our payment flow is BROKEN.
          // We should FAIL HARD, not mask the problem with fallbacks.
          if (!orderId) {
            console.error('❌ CRITICAL BUG: orderId is undefined in component state!', {
              stateOrderId: orderId,
              stripeMetadata: paymentIntent.metadata,
              message: 'This means initializePayment() did not complete properly or state was not set'
            })
            // This is a CRITICAL flow bug that must be fixed
            throw new Error(
              '⚠️ CRITICAL SYSTEM ERROR: Payment succeeded but order was not initialized. ' +
              'DO NOT retry. Save this Payment ID: ' + paymentIntent.id + ' and contact support IMMEDIATELY.'
            )
          }

          const txResponse = await fetch(`${backendUrl}/orders/transactions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              orderId,
              paymentSessionId,
              amount: priceData?.total || paymentIntent.amount / 100,
              currency: 'USD',
              stripePaymentIntentId: paymentIntent.id,
              stripeChargeId: paymentIntent.charges?.data[0]?.id,
              status: 'succeeded',
              paymentMethodType: paymentIntent.payment_method_types?.[0] || 'card',
              cardLast4: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.last4,
              cardBrand: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.brand,
              metadata: {
                paymentIntentId: paymentIntent.id,
                cardName: cardName || 'Unknown',
                action
              }
            })
          })

          if (!txResponse.ok) {
            const txError = await txResponse.json().catch(() => ({}))
            console.error('❌ Failed to save transaction record:', txError)
            throw new Error('Failed to record transaction')
          }

          const txResult = await txResponse.json()
          console.log('✅ Transaction record created:', txResult.transaction?.id)

          // Update order status to paid
          const orderUpdateResponse = await fetch(`${backendUrl}/orders/${orderId}/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ status: 'paid' })
          })

          if (!orderUpdateResponse.ok) {
            const statusError = await orderUpdateResponse.json().catch(() => ({}))
            console.error('❌ Failed to update order status:', statusError)
            throw new Error('Failed to update order status')
          }

          console.log('✅ Order status updated to paid')
        } catch (dbError) {
          // ⚠️ CRITICAL: Payment succeeded on Stripe but database update failed
          console.error('❌ CRITICAL DATABASE ERROR (payment succeeded on Stripe):', dbError)
          console.error('Payment Intent ID:', paymentIntent.id)
          console.error('Order ID:', orderId || 'UNDEFINED')

          // ❌ DO NOT CALL handlePaymentSuccess() - this is a CRITICAL ERROR
          // User was charged but we can't record it properly
          setPaymentError(
            '⚠️ CRITICAL ERROR: Payment was processed on your card, but our system failed to record it. ' +
            'DO NOT close this window. Save this Payment ID: ' + paymentIntent.id + ' and contact support IMMEDIATELY. ' +
            'Your order will be manually processed.'
          )
          setIsProcessing(false)
          setPaymentComplete(false)
          // ❌ DO NOT call handlePaymentSuccess() - leave modal open with error
          return
        }

        // Only call success if database operations completed successfully
        handlePaymentSuccess()
      }
    } catch (error: any) {
      console.error('❌ Payment processing error:', error)
      setPaymentError(error.message || 'Payment failed. Please try again.')
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    // Don't allow closing while payment is processing or print is in progress
    if (isProcessing || isPrintInProgress) {
      return
    }

    if (!isProcessing) {
      setCardholderName('')
      setPaymentError(null)
      setClientSecret(null)
      setPriceData(null)
      setPaymentComplete(false)
      setPaymentSessionId(null)
      onClose()
    }
  }

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
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {paymentComplete ? 'Payment Successful!' : 'Complete Payment'}
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isProcessing || isPrintInProgress}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {paymentComplete ? (
              <div className="text-center py-8">
                {/* Gift Card Success View with QR Code and Email */}
                {isKioskGiftCard && issuedGiftCardDisplay ? (
                  <div className="text-left">
                    {/* Success Header */}
                    <div className="text-center mb-6">
                      <div className="text-5xl mb-3">🎉</div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">Your Gift Card is Ready!</h3>
                      <p className="text-gray-600">Save these details to use your gift card</p>
                    </div>
                    
                    {/* QR Code */}
                    {issuedGiftCardDisplay.qrCode && (
                      <div className="flex justify-center mb-6">
                        <div className="bg-white p-3 rounded-xl shadow-lg border">
                          <img
                            src={issuedGiftCardDisplay.qrCode}
                            alt="Gift Card QR Code"
                            className="w-48 h-48"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Card Details */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                      {/* Card Code */}
                      {issuedGiftCardDisplay.code && (
                        <div>
                          <p className="text-gray-500 text-sm mb-1">Card Number / Code</p>
                          <button
                            onClick={() => copyToClipboard(issuedGiftCardDisplay.code || '')}
                            className="w-full text-left group"
                          >
                            <p className="font-mono text-xl text-gray-900 group-hover:text-blue-600 transition-colors">
                              {formatCardNumber(issuedGiftCardDisplay.code)}
                            </p>
                            <p className="text-blue-500 text-xs">Tap to copy</p>
                          </button>
                        </div>
                      )}
                      
                      {/* PIN */}
                      {issuedGiftCardDisplay.pin && (
                        <div className="pt-2 border-t">
                          <p className="text-gray-500 text-sm mb-1">PIN</p>
                          <div className="flex items-center gap-3">
                            <p className="font-mono text-xl text-gray-900 tracking-wider">
                              {showPin ? issuedGiftCardDisplay.pin : '●●●●'}
                            </p>
                            <button
                              onClick={() => setShowPin(!showPin)}
                              className="px-3 py-1 bg-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-300 transition-colors"
                            >
                              {showPin ? 'Hide' : 'Show'}
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Balance */}
                      <div className="pt-2 border-t flex justify-between items-center">
                        <span className="text-gray-500">Balance:</span>
                        <span className="text-2xl font-bold text-green-600">
                          ${issuedGiftCardDisplay.amount?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      
                      {/* Redemption Link for Tillo */}
                      {issuedGiftCardDisplay.redemptionLink && (
                        <div className="pt-2 border-t">
                          <p className="text-gray-500 text-sm mb-1">Redemption Link</p>
                          <a
                            href={issuedGiftCardDisplay.redemptionLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm break-all underline"
                          >
                            {issuedGiftCardDisplay.redemptionLink}
                          </a>
                        </div>
                      )}
                    </div>
                    
                    {/* Photo Reminder */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-center">
                      <div className="text-2xl mb-1">📱</div>
                      <p className="text-green-800 font-medium">Take a photo of this screen</p>
                      <p className="text-green-600 text-sm">to save your gift card details</p>
                    </div>
                    
                    {/* Email Option */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">📧</span>
                        <span className="font-medium text-gray-900">Email my gift card</span>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="email"
                          value={giftCardEmail}
                          onChange={(e) => setGiftCardEmail(e.target.value)}
                          placeholder="your@email.com"
                          disabled={emailSent}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                        />
                        <button
                          onClick={handleEmailGiftCard}
                          disabled={emailSending || emailSent || !giftCardEmail}
                          className={`w-full py-3 rounded-xl font-medium transition-all ${
                            emailSent
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                          }`}
                        >
                          {emailSending ? 'Sending...' : emailSent ? '✓ Email Sent!' : 'Send to Email'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Done Button */}
                    <button
                      onClick={handleGiftCardDone}
                      className="w-full py-4 rounded-xl text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                      Done - Return Home
                    </button>
                  </div>
                ) : printStatus === 'completed' ? (
                  // Print completed successfully
                  <>
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Print Complete!</h3>
                    <p className="text-gray-600">
                      {isStickers
                        ? 'Your sticker sheet has been printed successfully.'
                        : 'Your card has been printed successfully.'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Please collect your {isStickers ? 'stickers' : 'card'} from the printer.</p>
                  </>
                ) : printStatus === 'failed' ? (
                  // Print failed
                  <>
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-red-600 mb-2">Print Failed</h3>
                    <p className="text-gray-600">
                      {printError || 'There was an error printing. Please try again or contact staff.'}
                    </p>
                  </>
                ) : printStatus === 'sending' || printStatus === 'printing' ? (
                  // Printing in progress
                  <>
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {printStatus === 'sending' ? 'Sending to Printer...' : 'Printing...'}
                    </h3>
                    <p className="text-gray-600">
                      {printStatus === 'sending'
                        ? 'Your payment was successful! Preparing your print job...'
                        : isStickers
                          ? 'Your sticker sheet is being printed. Please wait...'
                          : 'Your card is being printed. Please wait...'}
                    </p>
                    <div className="mt-4 flex justify-center">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </>
                ) : action === 'send' ? (
                  // E-card send (no print tracking needed)
                  <>
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                    <p className="text-gray-600">Your e-card will be sent shortly.</p>
                  </>
                ) : (
                  // Default: Payment success, waiting for print to start
                  <>
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                    <p className="text-gray-600">
                      {isStickers
                        ? 'Your sticker sheet will be printed shortly.'
                        : 'Your card will be printed shortly.'}
                    </p>
                  </>
                )}
              </div>
            ) : loadingPrice ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                <p className="text-gray-600">Calculating price...</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column: Payment Details */}
                <div className="space-y-6">
                  {/* Invoice */}
                  <div className={`rounded-lg p-4 ${isStickers ? 'bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100' : 'bg-gray-50'}`}>
                    <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{isStickers ? 'Product:' : 'Card:'}</span>
                        <span className="font-medium text-gray-900">
                          {isStickers ? `Sticker Sheet (${stickerCount} stickers)` : cardName}
                        </span>
                      </div>
                      {!isStickers && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium text-gray-900">
                            {action === 'send' ? 'E-Card' : 'Print'}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-gray-200 my-2 pt-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">{isStickers ? 'Sticker Sheet:' : 'Card Price:'}</span>
                          <span className="font-medium">${priceData?.cardPrice?.toFixed(2) || '0.00'}</span>
                        </div>
                        {!isStickers && priceData?.giftCardAmount > 0 && (
                          <div className="flex justify-between mt-1">
                            <span className="text-gray-600">Gift Card:</span>
                            <span className="font-medium">${priceData.giftCardAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between mt-1">
                          <span className="text-gray-600">Processing Fee (5%):</span>
                          <span className="font-medium">${priceData?.processingFee?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold text-base">
                        <span className="text-gray-900">Total:</span>
                        <span className={promoApplied ? "text-green-600 line-through" : "text-blue-600"}>
                          ${priceData?.total?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      {promoApplied && (
                        <div className="flex justify-between font-semibold text-base text-green-600">
                          <span>Promo Applied:</span>
                          <span>$0.00</span>
                        </div>
                      )}
                    </div>

                    {/* Promo Code Input */}
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Have a promo code?
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value)
                            setPromoApplied(false)
                            setPromoError(null)
                          }}
                          placeholder="Enter code"
                          autoComplete="off"
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-all ${promoApplied
                              ? 'border-green-400 bg-green-50 focus:ring-green-300'
                              : promoError
                                ? 'border-red-400 focus:ring-red-300'
                                : 'border-gray-300 focus:ring-blue-300'
                            }`}
                          disabled={promoApplied}
                        />
                        <button
                          type="button"
                          onClick={applyPromoCode}
                          disabled={!promoCode || promoApplied}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${promoApplied
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                            }`}
                        >
                          {promoApplied ? '✓ Applied' : 'Apply'}
                        </button>
                      </div>
                      {promoError && (
                        <p className="mt-1 text-sm text-red-600">{promoError}</p>
                      )}
                      {promoApplied && (
                        <p className="mt-1 text-sm text-green-600">🎉 Promo code applied! Free checkout available.</p>
                      )}
                    </div>
                  </div>

                  {/* Card Payment Form - Hidden when promo applied */}
                  {!promoApplied && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-gray-900">Enter Card Details</h3>

                      {/* Cardholder Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isProcessing}
                        />
                      </div>

                      {/* Card Element */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Card Information
                        </label>
                        <div className="border border-gray-300 rounded-lg p-3">
                          <CardElement options={CARD_ELEMENT_OPTIONS} />
                        </div>
                      </div>

                      {/* Error Message */}
                      {paymentError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                          {paymentError}
                        </div>
                      )}

                      {/* Pay Button */}
                      <button
                        onClick={processPayment}
                        disabled={isProcessing || !stripe || !clientSecret || !orderId}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {isProcessing ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <span>Pay ${priceData?.total?.toFixed(2) || '0.00'}</span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Free Checkout Button - When promo applied */}
                  {promoApplied && (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-green-600 text-4xl mb-2">🎉</div>
                        <h3 className="font-semibold text-green-800 mb-1">Promo Code Applied!</h3>
                        <p className="text-sm text-green-700">Your total is now $0.00</p>
                      </div>
                      <button
                        onClick={handleFreeCheckout}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <span>Complete Free Checkout</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column: QR Code Payment - Hidden when promo applied */}
                {!promoApplied && (
                  <div className="border-l border-gray-200 pl-6">
                    <div className="sticky top-6">
                      <h3 className="font-semibold text-gray-900 mb-3">Or Scan to Pay</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Use your mobile device to complete the payment
                      </p>

                      {paymentQRCode ? (
                        <div className="bg-white rounded-lg p-4 border-2 border-blue-200 text-center">
                          <img
                            src={paymentQRCode}
                            alt="Payment QR Code"
                            className="mx-auto mb-3"
                          />
                          <p className="text-xs text-gray-500">
                            Scan this code with your phone's camera
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-100 rounded-lg p-8 text-center">
                          <div className="animate-pulse">
                            <div className="h-48 w-48 mx-auto bg-gray-200 rounded"></div>
                          </div>
                          <p className="text-sm text-gray-500 mt-3">Generating QR code...</p>
                        </div>
                      )}

                      <div className="mt-4 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                        <p className="font-semibold mb-1">How it works:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Scan the QR code with your phone</li>
                          <li>Enter your card details</li>
                          <li>Complete the payment</li>
                          <li>This screen will automatically update</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
