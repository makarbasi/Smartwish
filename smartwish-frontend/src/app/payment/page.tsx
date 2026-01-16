'use client'

import { Suspense, useState, useEffect, Component, ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useSession } from 'next-auth/react'

// Initialize Stripe with null-check to prevent crashes
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

// Error Boundary to catch and display runtime errors gracefully
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class PaymentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Payment page error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment Error</h1>
            <p className="text-gray-600 mb-4">
              An error occurred while loading the payment page.
            </p>
            <p className="text-sm text-gray-500 bg-gray-100 p-3 rounded-lg font-mono break-all mb-4">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <p className="text-sm text-gray-500">
              Please scan the QR code again or contact support.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function PaymentContent() {
  // Show error if Stripe is not configured
  if (!stripePromise) {
    console.error('❌ Stripe not initialized! Check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment System Error</h1>
          <p className="text-gray-600 mb-6">The payment system is not configured correctly. Please contact support.</p>
          <p className="text-sm text-gray-500">
            Error: Stripe publishable key is missing.
          </p>
        </div>
      </div>
    )
  }

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
  
  // ✅ Session is optional - guest checkout is allowed
  const { data: session, status: sessionStatus } = useSession()
  
  const [cardholderName, setCardholderName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [sessionData, setSessionData] = useState<any>(null)
  
  // ✅ Helper function to safely format currency values
  const formatCurrency = (value: any): string => {
    const num = parseFloat(value)
    return isNaN(num) ? '0.00' : num.toFixed(2)
  }
  
  // 🔍 DEBUG: Log every render to see if component updates
  console.log('🔍 RENDER: PaymentForm - paymentComplete:', paymentComplete, 'isProcessing:', isProcessing)

  // Get session ID and orderId from URL
  const sessionId = searchParams.get('session')
  const urlOrderId = searchParams.get('orderId') // ✅ Get orderId from QR code
  
  // ✅ Backend configuration - use production URL as default
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com'
  const accessToken = (session?.user as any)?.access_token

  // ✅ FIX: Allow guest checkout - don't require authentication
  useEffect(() => {
    // Wait for session check to complete (but don't require auth)
    if (sessionStatus === 'loading') {
      console.log('⏳ Checking session...')
      return
    }

    if (!sessionId) {
      setPaymentError('Invalid payment link')
      setLoadingSession(false)
      return
    }

    // ✅ FIX: Load payment session regardless of auth status (guest checkout)
    loadPaymentSession()
  }, [sessionId, sessionStatus])

  /**
   * Load payment session - uses existing order from kiosk
   * ✅ FIX: Guest checkout - no authentication required
   */
  const loadPaymentSession = async () => {
    try {
      setLoadingSession(true)
      console.log('📡 Loading payment session:', sessionId)
      console.log('📦 Using existing order from kiosk:', urlOrderId)
      
      // Get card details from URL
      const cardId = searchParams.get('cardId')
      const action = searchParams.get('action')
      
      if (!cardId) {
        throw new Error('Invalid payment link - missing card ID')
      }

      // ✅ FIX: Use existing orderId from QR code (kiosk already created the order)
      if (!urlOrderId) {
        throw new Error('Invalid payment link - missing order ID. Please scan the QR code again.')
      }

      // ✅ FIX: Fetch the existing order details (guest endpoint - no auth required)
      console.log('📦 Fetching existing order details from:', `${backendUrl}/orders/${urlOrderId}/guest`)
      const orderResponse = await fetch(`${backendUrl}/orders/${urlOrderId}/guest`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json().catch(() => ({}))
        console.error('Failed to fetch order:', orderResponse.status, errorData)
        
        // Show specific error message based on status
        if (orderResponse.status === 404) {
          throw new Error('Order not found. Please scan the QR code again.')
        } else if (orderResponse.status === 410) {
          throw new Error(errorData.error || 'Payment link expired. Please scan a new QR code.')
        } else if (orderResponse.status === 401 || orderResponse.status === 403) {
          throw new Error('Authentication error. The payment system may need to be restarted.')
        } else {
          throw new Error(errorData.error || 'Failed to load order. Please try again.')
        }
      }

      const orderData = await orderResponse.json()
      
      if (!orderData.success || !orderData.order) {
        throw new Error('Invalid order data')
      }

      const order = orderData.order
      console.log('✅ Order loaded:', order.id, 'Status:', order.status)

      // ✅ FIX: Parse all numeric values to ensure they are numbers (backend may return strings)
      const totalAmount = parseFloat(order.totalAmount) || 0
      const cardPrice = parseFloat(order.cardPrice) || 0
      const giftCardAmount = parseFloat(order.giftCardAmount) || 0
      const processingFee = parseFloat(order.processingFee) || 0

      console.log('💰 Parsed amounts:', { totalAmount, cardPrice, giftCardAmount, processingFee })

      // Validate total amount
      if (totalAmount < 0.01) {
        throw new Error('Invalid order amount. Please try again.')
      }

      // Check if order is already paid
      if (order.status === 'paid' || order.status === 'completed') {
        setPaymentComplete(true)
        setSessionData({
          cardId,
          action,
          amount: totalAmount,
          orderId: order.id
        })
        setLoadingSession(false)
        return
      }

      // Set session data from existing order
      setSessionData({
        cardId,
        action,
        amount: totalAmount,
        orderId: order.id,
        priceBreakdown: {
          cardPrice: cardPrice,
          giftCardAmount: giftCardAmount,
          processingFee: processingFee,
          total: totalAmount
        }
      })

      // ✅ FIX: Create payment intent WITHOUT requiring auth (guest checkout)
      console.log('💳 Creating payment intent for guest checkout...')
      const intentResponse = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'usd',
          metadata: {
            orderId: order.id,
            userId: order.userId, // Use the kiosk user's ID
            sessionId: sessionId,
            cardId,
            action,
            source: 'mobile_qr_payment',
            cardPrice: cardPrice,
            giftCardAmount: giftCardAmount,
            processingFee: processingFee
          }
        })
      })

      const intentData = await intentResponse.json()
      
      if (intentResponse.ok && intentData.clientSecret) {
        setClientSecret(intentData.clientSecret)
        console.log('✅ Payment intent created:', intentData.paymentIntentId)
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
        
        // ✅ FIX: Update order status using guest endpoint (no auth required)
        try {
          const orderId = sessionData?.orderId || urlOrderId
          
          if (!orderId) {
            console.error('❌ CRITICAL: Payment succeeded but no orderId found!')
            console.error('Session Data:', sessionData)
            console.error('URL Order ID:', urlOrderId)
            throw new Error('Payment succeeded but order tracking failed. Payment ID: ' + paymentIntent.id)
          }
          
          console.log('💾 Updating order status to paid...')
          
          // ✅ FIX: Use guest endpoint to update order status (no auth required)
          const orderUpdateResponse = await fetch(`${backendUrl}/orders/${orderId}/guest-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'paid',
              stripePaymentIntentId: paymentIntent.id,
              amount: sessionData?.amount || paymentIntent.amount / 100,
              cardLast4: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.last4,
              cardBrand: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.brand
            })
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
          
          // ❌ DO NOT show success - this is a CRITICAL failure
          setPaymentError(
            '⚠️ CRITICAL ERROR: Payment processed but recording failed. ' +
            'Save this Payment ID: ' + paymentIntent.id + ' and contact support IMMEDIATELY.'
          )
          setIsProcessing(false)
          setPaymentComplete(false)
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
            Your payment of ${formatCurrency(sessionData?.amount)} has been processed successfully.
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
    // ✅ FIX: Guest checkout - no sign-in required, just show error
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment Error</h1>
          <p className="text-gray-600 mb-6">{paymentError}</p>
          <p className="text-sm text-gray-500">
            Please scan the QR code again or contact support.
          </p>
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
          
          {/* Price Breakdown */}
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Greeting Card</span>
              <span>${formatCurrency(sessionData?.priceBreakdown?.cardPrice)}</span>
            </div>
            {parseFloat(sessionData?.priceBreakdown?.giftCardAmount) > 0 && (
              <div className="flex justify-between text-green-700">
                <span>🎁 Gift Card</span>
                <span>${formatCurrency(sessionData?.priceBreakdown?.giftCardAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500 text-xs">
              <span>Processing Fee (5%)</span>
              <span>${formatCurrency(sessionData?.priceBreakdown?.processingFee)}</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center border-t border-gray-200 pt-2">
            <span className="text-sm font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-indigo-600">${formatCurrency(sessionData?.amount)}</span>
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
                <>Pay ${formatCurrency(sessionData?.amount)}</>
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
    <PaymentErrorBoundary>
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
    </PaymentErrorBoundary>
  )
}
