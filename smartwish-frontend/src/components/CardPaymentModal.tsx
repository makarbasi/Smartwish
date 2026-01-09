'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useSession } from 'next-auth/react'
import QRCode from 'qrcode'

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

interface CardPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: () => void
  cardId: string
  cardName: string
  action: 'send' | 'print'
  recipientEmail?: string
  giftCardAmount?: number
}

export default function CardPaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  cardId,
  cardName,
  action,
  recipientEmail,
  giftCardAmount: propGiftCardAmount
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
      />
    </Elements>
  )
}

function CardPaymentModalContent({
  isOpen,
  onClose,
  onPaymentSuccess,
  cardId,
  cardName,
  action,
  recipientEmail,
  giftCardAmount: propGiftCardAmount
}: CardPaymentModalProps) {
  const stripe = useStripe()
  const elements = useElements()

  // ✅ Use NextAuth session for authentication
  const { data: session, status: sessionStatus } = useSession()

  // UI State
  const [cardholderName, setCardholderName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(true)
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const VALID_PROMO_CODE = 'smartwish2'

  // Payment Data
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null)
  const [priceData, setPriceData] = useState<any>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentQRCode, setPaymentQRCode] = useState('')

  const checkPaymentIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // ✅ Get authentication from NextAuth session (no localStorage)
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001'
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

    if (isOpen && cardId && userId) {
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
  }, [isOpen, cardId, userId])

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
   * 1. Calculate price
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
      const paymentUrl = `${window.location.origin}/payment?session=${paymentSessionId}&cardId=${cardId}&action=${action}&orderId=${orderId}`

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

    console.log('💡 Mobile payment URL:', `${window.location.origin}/payment?session=${paymentSessionId}&cardId=${cardId}&action=${action}`)
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
   */
  const handlePaymentSuccess = async () => {
    // ✅ Stop polling when payment succeeds
    if (checkPaymentIntervalRef.current) {
      clearInterval(checkPaymentIntervalRef.current)
      checkPaymentIntervalRef.current = null
    }

    setIsProcessing(false)
    setPaymentComplete(true)

    // 🎁 Issue gift card if one is pending
    try {
      const storedGiftCard = localStorage.getItem(`giftCard_${cardId}`)
      if (storedGiftCard) {
        const giftCardSelection = JSON.parse(storedGiftCard)

        // Check if gift card is pending (not yet issued)
        if (giftCardSelection.status === 'pending' && !giftCardSelection.isIssued) {
          console.log('🎁 Payment successful - Now issuing gift card:', giftCardSelection)

          // Call Tillo API to issue the actual gift card
          const response = await fetch('/api/tillo/issue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandSlug: giftCardSelection.brandSlug,
              amount: giftCardSelection.amount,
              currency: giftCardSelection.currency || 'USD'
            })
          })

          const data = await response.json()

          if (response.ok && data.success) {
            console.log('✅ Gift card issued successfully after payment:', data.giftCard)

            // Update localStorage with issued gift card data
            const issuedGiftCard = {
              ...giftCardSelection,
              status: 'issued',
              isIssued: true,
              issuedAt: new Date().toISOString(),
              // Add the actual gift card data from Tillo
              redemptionLink: data.giftCard?.url || data.giftCard?.redemptionUrl,
              code: data.giftCard?.code,
              pin: data.giftCard?.pin,
              orderId: data.giftCard?.orderId,
              expiryDate: data.giftCard?.expiryDate,
              qrCode: '' // Will be generated if needed
            }

            // Generate QR code for the redemption link
            if (issuedGiftCard.redemptionLink) {
              try {
                const qrCodeUrl = await QRCode.toDataURL(issuedGiftCard.redemptionLink, {
                  width: 200,
                  margin: 2,
                  color: { dark: '#2d3748', light: '#ffffff' },
                  errorCorrectionLevel: 'H'
                })
                issuedGiftCard.qrCode = qrCodeUrl
              } catch (qrError) {
                console.warn('Failed to generate QR code:', qrError)
              }
            }

            // Encrypt and save the issued gift card
            try {
              const encryptResponse = await fetch('/api/giftcard/encrypt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ giftCardData: issuedGiftCard })
              })

              if (encryptResponse.ok) {
                const { encryptedData } = await encryptResponse.json()
                localStorage.setItem(`giftCard_${cardId}`, encryptedData)
                localStorage.setItem(`giftCardMeta_${cardId}`, JSON.stringify({
                  storeName: issuedGiftCard.storeName,
                  amount: issuedGiftCard.amount,
                  source: 'tillo',
                  status: 'issued',
                  issuedAt: issuedGiftCard.issuedAt,
                  isEncrypted: true
                }))
                console.log('🔐 Issued gift card saved with encryption')
              } else {
                // Fallback - save without encryption
                localStorage.setItem(`giftCard_${cardId}`, JSON.stringify(issuedGiftCard))
              }
            } catch (encryptError) {
              console.warn('Encryption failed, saving unencrypted:', encryptError)
              localStorage.setItem(`giftCard_${cardId}`, JSON.stringify(issuedGiftCard))
            }
          } else {
            console.error('❌ Failed to issue gift card after payment:', data)
            // Don't fail the payment - the card was paid, just log the error
            // User can contact support with the payment receipt
          }
        } else {
          console.log('🎁 Gift card already issued or no pending gift card')
        }
      }
    } catch (giftCardError) {
      console.error('❌ Error processing gift card after payment:', giftCardError)
      // Don't fail - payment was successful
    }

    // Wait a moment to show success message
    setTimeout(() => {
      onPaymentSuccess()
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
   * Handle free checkout with promo code
   */
  const handleFreeCheckout = () => {
    if (promoApplied) {
      console.log('🎟️ Free checkout with promo code')
      setPaymentComplete(true)
      onPaymentSuccess()
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
              disabled={isProcessing}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {paymentComplete ? (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-600">
                  {action === 'send' ? 'Your e-card will be sent shortly.' : 'Your card will be printed shortly.'}
                </p>
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
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Card:</span>
                        <span className="font-medium text-gray-900">{cardName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type:</span>
                        <span className="font-medium text-gray-900">
                          {action === 'send' ? 'E-Card' : 'Print'}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 my-2 pt-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Card Price:</span>
                          <span className="font-medium">${priceData?.cardPrice?.toFixed(2) || '0.00'}</span>
                        </div>
                        {priceData?.giftCardAmount > 0 && (
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
                          type="text"
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value)
                            setPromoApplied(false)
                            setPromoError(null)
                          }}
                          placeholder="Enter code"
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                            promoApplied
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
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            promoApplied
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
