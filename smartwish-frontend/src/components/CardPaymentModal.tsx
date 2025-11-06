'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
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
  giftCardAmount?: number // Optional: pass from localStorage if available
}

export default function CardPaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  cardId,
  cardName,
  action,
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
  giftCardAmount: propGiftCardAmount
}: CardPaymentModalProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [cardholderName, setCardholderName] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingPrice, setLoadingPrice] = useState(true)
  const [priceData, setPriceData] = useState<any>(null)
  const [paymentQRCode, setPaymentQRCode] = useState('')
  const [paymentSessionId] = useState(() => `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const checkPaymentIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen && cardId) {
      fetchPriceAndCreateIntent()
    }

    return () => {
      if (checkPaymentIntervalRef.current) {
        clearInterval(checkPaymentIntervalRef.current)
      }
    }
  }, [isOpen, cardId])

  // Generate QR code after price is loaded
  useEffect(() => {
    if (priceData && priceData.total > 0) {
      generatePaymentQRCode()
    }
  }, [priceData])

  const generatePaymentQRCode = async () => {
    try {
      // Create a payment URL with session ID and card info
      const paymentUrl = `${window.location.origin}/payment?session=${paymentSessionId}&amount=${priceData?.total || 0}&product=${encodeURIComponent(cardName)}&cardId=${cardId}&action=${action}`
      
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

  const startPaymentMonitoring = () => {
    if (checkPaymentIntervalRef.current) {
      clearInterval(checkPaymentIntervalRef.current)
    }

    console.log('👀 Starting payment monitoring for session:', paymentSessionId)

    // Check localStorage every 2 seconds for payment completion
    checkPaymentIntervalRef.current = setInterval(() => {
      const paymentStatus = localStorage.getItem(`payment_${paymentSessionId}`)
      if (paymentStatus === 'completed') {
        console.log('✅ Mobile payment completed!')
        handlePaymentSuccess()
        if (checkPaymentIntervalRef.current) {
          clearInterval(checkPaymentIntervalRef.current)
        }
      }
    }, 2000)
  }

  const handlePaymentSuccess = () => {
    setIsProcessing(false)
    setPaymentComplete(true)

    // Wait a moment to show success message
    setTimeout(() => {
      onPaymentSuccess()
    }, 1500)
  }

  const fetchPriceAndCreateIntent = async () => {
    try {
      setLoadingPrice(true)
      setPaymentError(null)

      // Check localStorage for gift card amount if not provided
      let giftCardAmount = propGiftCardAmount || 0
      if (!giftCardAmount) {
        const storedGiftData = localStorage.getItem(`giftCard_${cardId}`)
        if (storedGiftData) {
          const giftData = JSON.parse(storedGiftData)
          giftCardAmount = parseFloat(giftData.amount || 0)
        }
      }

      console.log('💰 Fetching price for card:', cardId, 'Gift card amount:', giftCardAmount)

      // Fetch price calculation
      console.log('💰 Fetching price calculation for:', { cardId, giftCardAmount })
      
      const priceResponse = await fetch('/api/cards/calculate-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId,
          giftCardAmount // Pass gift card amount to backend
        })
      })

      console.log('💰 Price response status:', priceResponse.status)

      if (!priceResponse.ok) {
        const errorText = await priceResponse.text()
        console.error('💰 Price calculation failed:', errorText)
        throw new Error(`Failed to calculate price: ${errorText}`)
      }

      const priceResult = await priceResponse.json()
      console.log('💰 Price calculation result:', priceResult)
      
      if (priceResult.warning) {
        console.warn('⚠️ Price calculation warning:', priceResult.warning)
      }

      // If total is 0, no payment needed
      if (priceResult.total === 0) {
        setPaymentError('No payment required for this card')
        setLoadingPrice(false)
        // Allow user to proceed without payment
        setTimeout(() => {
          onPaymentSuccess()
        }, 1000)
        return
      }

      setPriceData(priceResult)

      // Create Stripe payment intent
      const intentResponse = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: priceResult.total,
          currency: 'usd',
          metadata: {
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

      if (intentResponse.ok && intentResult.clientSecret) {
        setClientSecret(intentResult.clientSecret)
      } else {
        throw new Error(intentResult.error || 'Failed to initialize payment')
      }
    } catch (error: any) {
      console.error('Error fetching price:', error)
      setPaymentError(error.message || 'Failed to load payment information')
    } finally {
      setLoadingPrice(false)
    }
  }

  const processPayment = async () => {
    if (!stripe || !elements || !clientSecret) {
      setPaymentError('Payment system not ready')
      return
    }

    if (!cardholderName || cardholderName.length < 3) {
      setPaymentError('Please enter cardholder name')
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

  const handleClose = () => {
    if (!isProcessing) {
      setCardholderName('')
      setPaymentError(null)
      setClientSecret(null)
      setPriceData(null)
      setPaymentComplete(false)
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
                  {action === 'print' ? 'Preparing your card for printing...' : 'Processing your e-card...'}
                </p>
              </div>
            ) : loadingPrice ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-gray-600">Calculating total amount...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Card Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Card Details</h4>
                  <p className="text-sm text-gray-700">{cardName}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {action === 'print' ? 'Physical Print' : 'Digital E-Card'}
                  </p>
                </div>

                {/* Price Breakdown */}
                {priceData && (
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Price Breakdown</h4>
                    <div className="space-y-2">
                      {priceData.breakdown.cardPrice.amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">{priceData.breakdown.cardPrice.label}</span>
                          <span className="font-medium text-gray-900">${priceData.breakdown.cardPrice.amount.toFixed(2)}</span>
                        </div>
                      )}
                      {priceData.breakdown.giftCardAmount && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">{priceData.breakdown.giftCardAmount.label}</span>
                          <span className="font-medium text-gray-900">${priceData.breakdown.giftCardAmount.amount.toFixed(2)}</span>
                        </div>
                      )}
                      {priceData.breakdown.processingFee.amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700">{priceData.breakdown.processingFee.label}</span>
                          <span className="font-medium text-gray-900">${priceData.breakdown.processingFee.amount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-indigo-200 pt-2 mt-2 flex justify-between">
                        <span className="text-base font-semibold text-gray-900">Total</span>
                        <span className="text-lg font-bold text-indigo-600">${priceData.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Form - Two Column Layout */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Card Entry */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-900">Pay with Card</h4>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Card Details</label>
                      <div className="w-full px-3 py-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
                        <CardElement options={CARD_ELEMENT_OPTIONS} />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        🔒 Secured by Stripe
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                      <input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                        placeholder="JOHN DOE"
                        disabled={isProcessing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                      />
                    </div>

                    <button
                      onClick={processPayment}
                      disabled={isProcessing || !priceData}
                      className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all shadow-lg"
                    >
                      {isProcessing ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>Pay ${priceData?.total.toFixed(2) || '0.00'}</>
                      )}
                    </button>
                  </div>

                  {/* Right: QR Code for Mobile Payment */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Or Pay with Mobile</h4>
                    
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 text-center">
                      <div className="mb-4">
                        {paymentQRCode ? (
                          <img
                            src={paymentQRCode}
                            alt="Payment QR Code"
                            className="mx-auto rounded-lg shadow-sm"
                          />
                        ) : (
                          <div className="w-[250px] h-[250px] mx-auto bg-gray-200 rounded-lg flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                          </div>
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
                        👀 Monitoring for payment...
                      </button>
                    </div>
                  </div>
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
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

