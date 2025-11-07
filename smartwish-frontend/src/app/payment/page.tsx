'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useSession } from 'next-auth/react'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentContent() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm />
    </Elements>
  )
}

function PaymentForm() {
  const stripe = useStripe()
  const elements = useElements()
  const searchParams = useSearchParams()
  
  // ✅ Use NextAuth session for authentication
  const { data: session, status: sessionStatus } = useSession()
  
  const [cardholderName, setCardholderName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionData, setSessionData] = useState<any>(null)
  
  // 🔍 DEBUG: Log every render to see if component updates
  console.log('🔍 RENDER: PaymentForm - paymentComplete:', paymentComplete, 'isProcessing:', isProcessing)

  // Get session ID from URL
  const sessionId = searchParams.get('session')
  
  // ✅ Backend configuration
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001'
  const accessToken = (session?.user as any)?.access_token

  // ✅ FIX: Wait for session to load before initializing payment
  useEffect(() => {
    // Don't do anything while session is loading
    if (sessionStatus === 'loading') {
      console.log('⏳ Waiting for session to load...')
      return
    }

    if (!sessionId) {
      setPaymentError('Invalid payment link')
      setLoadingSession(false)
      return
    }

    // Only load payment session once authenticated
    if (sessionStatus === 'authenticated') {
      loadPaymentSession()
    } else {
      // User not authenticated - show sign in prompt
      setLoadingSession(false)
      setPaymentError('Please sign in to complete your payment')
    }
  }, [sessionId, sessionStatus])

  /**
   * Load payment session - simplified (no database)
   * Get card info from URL params instead
   */
  const loadPaymentSession = async () => {
    try {
      setLoadingSession(true)
      console.log('📡 Loading payment session:', sessionId)
      
      // Get card details from URL
      const cardId = searchParams.get('cardId')
      const action = searchParams.get('action')
      
      if (!cardId) {
        throw new Error('Invalid payment link - missing card ID')
      }

      // ✅ FIX: Check for gift card in localStorage (same as main payment modal)
      let giftCardAmount = 0
      try {
        const storedGiftData = localStorage.getItem(`giftCard_${cardId}`)
        if (storedGiftData) {
          const giftData = JSON.parse(storedGiftData)
          const parsedAmount = parseFloat(giftData.amount || 0)
          // ✅ Validate gift card amount is a valid number
          if (!isNaN(parsedAmount) && parsedAmount >= 0) {
            giftCardAmount = parsedAmount
            console.log('🎁 Gift card found in mobile payment:', giftCardAmount)
          } else {
            console.warn('⚠️ Invalid gift card amount:', giftData.amount)
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse gift card data:', error)
        // Continue without gift card - don't crash the payment flow
      }

      // ✅ Calculate price from BACKEND (not deleted frontend API)
      console.log('💰 Calculating price for card:', cardId, 'with gift card:', giftCardAmount)
      
      // ✅ Authentication is already checked in useEffect - we only reach here if authenticated
      if (!accessToken) {
        console.error('❌ CRITICAL: loadPaymentSession called without accessToken!')
        throw new Error('Authentication error')
      }
      
      const priceResponse = await fetch(`${backendUrl}/saved-designs/calculate-price`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          cardId: cardId,
          giftCardAmount: giftCardAmount
        })
      })
      
      if (!priceResponse.ok) {
        const errorText = await priceResponse.text()
        console.error('💰 Price calculation failed:', errorText)
        throw new Error('Failed to calculate price')
      }

      const priceData = await priceResponse.json()
      console.log('✅ Price calculated (from backend):', priceData)
      
      setSessionData({
        cardId,
        action,
        amount: priceData.total,
        priceBreakdown: priceData
      })

      // ✅ FIX: Create order in database BEFORE payment intent (matching kiosk flow)
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
          cardName: `Card ${cardId}`,
          recipientEmail: null,
          cardPrice: priceData.cardPrice,
          giftCardAmount: priceData.giftCardAmount,
          processingFee: priceData.processingFee,
          totalAmount: priceData.total,
          currency: 'USD',
          metadata: {
            source: 'mobile_qr',
            action,
            sessionId
          }
        })
      })

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({}))
        console.error('Failed to create order:', errorData)
        throw new Error(errorData.error || 'Failed to create order')
      }

      const orderResult = await orderResponse.json()
      
      // ✅ FIX: Validate response structure
      if (!orderResult.success || !orderResult.order || !orderResult.order.id) {
        console.error('Invalid order response:', orderResult)
        throw new Error('Invalid response from order creation')
      }
      
      const orderId = orderResult.order.id
      console.log('✅ Order created:', orderId)

      // Store order ID for later use
      setSessionData(prev => ({ ...prev!, orderId }))

      // ✅ FIX: Get userId from session
      const userId = (session?.user as any)?.id
      if (!userId) {
        throw new Error('User ID not found in session')
      }

      // Create a new payment intent for mobile payment
      const intentResponse = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: priceData.total,
          currency: 'usd',
          metadata: {
            orderId,  // ✅ Include order ID
            userId,   // ✅ FIX: Include user ID (required for webhook)
            sessionId: sessionId,
            cardId,
            action,
            source: 'mobile_qr_payment',
            cardPrice: priceData.cardPrice,
            giftCardAmount: priceData.giftCardAmount,
            processingFee: priceData.processingFee
          }
        })
      })

      const intentData = await intentResponse.json()
      
      if (intentResponse.ok && intentData.clientSecret) {
        setClientSecret(intentData.clientSecret)
        console.log('✅ Payment intent created:', intentData.paymentIntentId)

        // ✅ Create payment session in database
        const paymentSessionResponse = await fetch(`${backendUrl}/orders/payment-sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            orderId,
          amount: priceData.total,
          currency: 'USD',
          stripePaymentIntentId: intentData.paymentIntentId,
          stripeClientSecret: intentData.clientSecret,
          initiatedFrom: 'mobile',
          paymentMethod: 'qr_mobile', // ✅ FIX Bug #24: Must be 'qr_mobile' not 'card_mobile' (DB constraint)
          sessionId,
          metadata: {
            cardId,
            action
          }
          })
        })

        if (paymentSessionResponse.ok) {
          const sessionResult = await paymentSessionResponse.json()
          console.log('✅ Payment session created:', sessionResult.session.id)
        } else {
          console.warn('⚠️ Failed to create payment session record')
        }
      } else {
        throw new Error(intentData.error || 'Failed to initialize payment')
      }

    } catch (error: any) {
      console.error('❌ Error loading payment session:', error)
      setPaymentError(error.message || 'Failed to load payment session')
    } finally {
      setLoadingSession(false)
    }
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

      console.log('💳 Processing payment for session:', sessionId)

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
        console.error('❌ Payment error:', error)
        setPaymentError(error.message || 'Payment failed')
        setIsProcessing(false)
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('✅ Payment successful:', paymentIntent.id)
        console.log('💰 Amount charged:', sessionData?.amount)
        
        // ✅ FIX: Record transaction in database (matching kiosk flow)
        try {
          const orderId = paymentIntent.metadata?.orderId || (sessionData as any)?.orderId
          
          if (!orderId) {
            console.error('❌ CRITICAL: Payment succeeded but no orderId found!')
            console.error('Metadata:', paymentIntent.metadata)
            console.error('Session Data:', sessionData)
            throw new Error('Payment succeeded but order tracking failed. Payment ID: ' + paymentIntent.id)
          }
          
          if (!accessToken) {
            console.error('❌ CRITICAL: No access token for recording transaction')
            throw new Error('Authentication error after payment. Payment ID: ' + paymentIntent.id)
          }
          
          console.log('💾 Creating transaction record...')
          
          const txResponse = await fetch(`${backendUrl}/orders/transactions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
              },
              body: JSON.stringify({
                orderId,
                paymentSessionId: sessionId,
                amount: sessionData?.amount || paymentIntent.amount / 100,
                currency: 'USD',
                stripePaymentIntentId: paymentIntent.id,
                stripeChargeId: paymentIntent.charges?.data[0]?.id,
                status: 'succeeded',
                paymentMethodType: paymentIntent.payment_method_types?.[0] || 'card',
                cardLast4: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.last4,
                cardBrand: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.brand,
                metadata: {
                  paymentIntentId: paymentIntent.id,
                  source: 'mobile_qr',
                  sessionId,
                  cardId: sessionData?.cardId,
                  action: sessionData?.action
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
          console.log('🔍 DEBUG: About to exit try block...')
        } catch (dbError) {
          console.log('🔍 DEBUG: Entered catch block - this should NOT show if success')

          // ⚠️ CRITICAL: Payment succeeded on Stripe but database update failed
          console.error('❌ CRITICAL DATABASE ERROR (payment succeeded on Stripe):', dbError)
          console.error('Payment Intent ID:', paymentIntent.id)
          
          // ❌ DO NOT show success - this is a CRITICAL failure
          setPaymentError(
            '⚠️ CRITICAL ERROR: Payment processed but recording failed. ' +
            'Save this Payment ID: ' + paymentIntent.id + ' and contact support IMMEDIATELY.'
          )
          setIsProcessing(false)
          setPaymentComplete(false)
          // ❌ DO NOT show success - leave error visible
          return
        }
        
        // Only show success if database operations completed successfully
        console.log('🎉 All operations successful! Setting paymentComplete to true...')
        setIsProcessing(false)
        setPaymentComplete(true)
        console.log('✅ State updated - should show success screen now')
      }
    } catch (error: any) {
      console.error('❌ Payment processing error:', error)
      setPaymentError(error.message || 'Payment failed. Please try again.')
      setIsProcessing(false)
    }
  }

  // Stripe CardElement styling
  const CARD_ELEMENT_OPTIONS = {
    style: {
      base: {
        fontSize: '18px',
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

  console.log('🔍 CHECKING: paymentComplete =', paymentComplete)
  
  if (paymentComplete) {
    console.log('🎯 SUCCESS SCREEN RENDERING!')
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Your payment of ${sessionData?.amount?.toFixed(2) || '0.00'} has been processed successfully.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">
              ✓ The kiosk has been notified and will proceed with your request.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            You can close this window now.
          </p>
        </div>
      </div>
    )
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 text-lg">Loading payment session...</p>
        </div>
      </div>
    )
  }

  if (paymentError && !sessionData) {
    // ✅ FIX: Show sign-in button if user is not authenticated
    const isAuthError = sessionStatus === 'unauthenticated'
    
    return (
      <div className={`min-h-screen bg-gradient-to-br ${isAuthError ? 'from-indigo-50 to-blue-50' : 'from-red-50 to-rose-50'} flex items-center justify-center p-4`}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className={`mx-auto w-20 h-20 ${isAuthError ? 'bg-indigo-100' : 'bg-red-100'} rounded-full flex items-center justify-center mb-6`}>
            {isAuthError ? (
              <svg className="w-10 h-10 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {isAuthError ? 'Sign In Required' : 'Payment Error'}
          </h1>
          <p className="text-gray-600 mb-6">{paymentError}</p>
          
          {isAuthError ? (
            <div className="space-y-4">
              <button
                onClick={() => {
                  // Redirect to sign in with callback to current page
                  const currentUrl = window.location.href
                  window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(currentUrl)}`
                }}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
              >
                Sign In to Continue
              </button>
              <p className="text-xs text-gray-500">
                You'll be redirected back to complete your payment after signing in.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Please scan the QR code again or contact support.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-8 text-white">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Mobile Payment</h1>
          <p className="text-center text-indigo-100 text-sm">Complete your payment securely</p>
        </div>

        {/* Payment Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Order ID</span>
            <span className="text-xs font-mono text-gray-900">{sessionData?.orderId?.substring(0, 8)}...</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Amount</span>
            <span className="text-2xl font-bold text-indigo-600">${sessionData?.amount?.toFixed(2) || '0.00'}</span>
          </div>
        </div>

        {/* Payment Form */}
        <div className="p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Card Information</h2>
          
          <div className="space-y-4">
            {/* Stripe Card Element */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card Details</label>
              <div className="w-full px-4 py-4 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 bg-white">
                <CardElement options={CARD_ELEMENT_OPTIONS} />
              </div>
              <p className="mt-2 text-xs text-gray-500 text-center">
                🔒 Secured by Stripe - Card details are encrypted
              </p>
            </div>

            {/* Cardholder Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
              <input
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                placeholder="JOHN DOE"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg"
              />
            </div>

            {/* Error Message */}
            {paymentError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <svg className="inline-block w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {paymentError}
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={processPayment}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-4 px-4 rounded-xl font-semibold text-lg hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {isProcessing ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing Payment...
                </>
              ) : (
                <>Pay ${sessionData?.amount?.toFixed(2) || '0.00'}</>
              )}
            </button>
          </div>

          {/* Security Badge */}
          <div className="mt-6 flex items-center justify-center text-xs text-gray-500">
            <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secured by 256-bit SSL encryption
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading payment...</p>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
