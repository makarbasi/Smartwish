'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useSession } from 'next-auth/react';
import QRCode from 'qrcode';

// Initialize Stripe
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

// Fixed sticker sheet price
const STICKER_PRICE = 3.99;
const PROCESSING_FEE_PERCENT = 0.05; // 5%

interface StickerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  stickerCount: number;
}

export default function StickerPaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  stickerCount,
}: StickerPaymentModalProps) {
  if (!isOpen) return null;

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
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <StickerPaymentContent
        isOpen={isOpen}
        onClose={onClose}
        onPaymentSuccess={onPaymentSuccess}
        stickerCount={stickerCount}
      />
    </Elements>
  );
}

function StickerPaymentContent({
  isOpen,
  onClose,
  onPaymentSuccess,
  stickerCount,
}: StickerPaymentModalProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { data: session, status: sessionStatus } = useSession();

  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentQRCode, setPaymentQRCode] = useState('');
  const [paymentSessionId, setPaymentSessionId] = useState<string | null>(null);

  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const VALID_PROMO_CODE = 'smartwish2';

  const checkPaymentIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate prices
  const processingFee = STICKER_PRICE * PROCESSING_FEE_PERCENT;
  const totalPrice = STICKER_PRICE + processingFee;

  // Initialize payment on mount
  useEffect(() => {
    if (isOpen && session?.user) {
      initializePayment();
    }

    return () => {
      if (checkPaymentIntervalRef.current) {
        clearInterval(checkPaymentIntervalRef.current);
      }
    };
  }, [isOpen, session]);

  const initializePayment = async () => {
    try {
      setPaymentError(null);

      // Create Stripe payment intent for fixed sticker price
      const intentResponse = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalPrice,
          currency: 'usd',
          metadata: {
            productType: 'sticker-sheet',
            stickerCount,
            price: STICKER_PRICE,
            processingFee,
          },
        }),
      });

      const intentResult = await intentResponse.json();

      if (!intentResponse.ok || !intentResult.clientSecret) {
        throw new Error(intentResult.error || 'Failed to initialize payment');
      }

      setClientSecret(intentResult.clientSecret);
      
      // Generate session ID for QR payment
      const sessionId = `STICKER-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setPaymentSessionId(sessionId);

      console.log('✅ Sticker payment intent created:', intentResult.paymentIntentId);
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      setPaymentError(error.message || 'Failed to initialize payment');
    }
  };

  // Generate QR code for mobile payment
  useEffect(() => {
    if (paymentSessionId && totalPrice > 0) {
      generatePaymentQRCode();
    }
  }, [paymentSessionId, totalPrice]);

  const generatePaymentQRCode = async () => {
    if (!paymentSessionId) return;

    try {
      const paymentUrl = `${window.location.origin}/payment?session=${paymentSessionId}&type=stickers&amount=${totalPrice}`;

      const qrCode = await QRCode.toDataURL(paymentUrl, {
        width: 250,
        margin: 2,
        color: {
          dark: '#be185d',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });
      setPaymentQRCode(qrCode);
    } catch (error) {
      console.error('Error generating payment QR code:', error);
    }
  };

  const applyPromoCode = () => {
    setPromoError(null);
    if (promoCode.toLowerCase() === VALID_PROMO_CODE.toLowerCase()) {
      setPromoApplied(true);
    } else {
      setPromoError('Invalid promo code');
      setPromoApplied(false);
    }
  };

  const handleFreeCheckout = () => {
    if (promoApplied) {
      setPaymentComplete(true);
      setTimeout(() => {
        onPaymentSuccess();
      }, 1500);
    }
  };

  const processPayment = async () => {
    if (!stripe || !elements || !clientSecret) {
      setPaymentError('Payment system not ready');
      return;
    }

    if (!cardholderName || cardholderName.length < 3) {
      setPaymentError('Please enter cardholder name');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: cardholderName,
          },
        },
      });

      if (error) {
        console.error('Payment error:', error);
        setPaymentError(error.message || 'Payment failed');
        setIsProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('✅ Sticker payment successful:', paymentIntent.id);
        setPaymentComplete(true);
        setIsProcessing(false);
        setTimeout(() => {
          onPaymentSuccess();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Payment processing error:', error);
      setPaymentError(error.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setCardholderName('');
      setPaymentError(null);
      setClientSecret(null);
      setPaymentComplete(false);
      setPaymentSessionId(null);
      onClose();
    }
  };

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
  };

  // Loading state
  if (sessionStatus === 'loading') {
    return (
      <Dialog open={isOpen} onClose={() => {}} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-pink-500 to-purple-600">
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <PrinterIcon className="w-5 h-5" />
              {paymentComplete ? 'Payment Successful!' : 'Print Sticker Sheet'}
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
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
                <p className="text-gray-600">Your sticker sheet will be printed shortly.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Order Summary */}
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-4 border border-pink-100">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-pink-500 text-white rounded-full flex items-center justify-center text-xs">✓</span>
                    Order Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sticker Sheet ({stickerCount} stickers)</span>
                      <span className="font-medium text-gray-900">${STICKER_PRICE.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Processing Fee (5%)</span>
                      <span className="font-medium">${processingFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-pink-200 pt-2 mt-2">
                      <div className="flex justify-between font-semibold text-base">
                        <span className="text-gray-900">Total</span>
                        <span className={promoApplied ? 'text-green-600 line-through' : 'text-pink-600'}>
                          ${totalPrice.toFixed(2)}
                        </span>
                      </div>
                      {promoApplied && (
                        <div className="flex justify-between font-semibold text-base text-green-600">
                          <span>Promo Applied</span>
                          <span>$0.00</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div className="mt-4 pt-3 border-t border-pink-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Have a promo code?
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          setPromoApplied(false);
                          setPromoError(null);
                        }}
                        placeholder="Enter code"
                        className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                          promoApplied
                            ? 'border-green-400 bg-green-50 focus:ring-green-300'
                            : promoError
                            ? 'border-red-400 focus:ring-red-300'
                            : 'border-gray-300 focus:ring-pink-300'
                        }`}
                        disabled={promoApplied}
                      />
                      <button
                        type="button"
                        onClick={applyPromoCode}
                        disabled={!promoCode || promoApplied}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          promoApplied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-300'
                        }`}
                      >
                        {promoApplied ? '✓ Applied' : 'Apply'}
                      </button>
                    </div>
                    {promoError && <p className="mt-1 text-sm text-red-600">{promoError}</p>}
                    {promoApplied && <p className="mt-1 text-sm text-green-600">🎉 Promo code applied!</p>}
                  </div>
                </div>

                {/* Payment Form or Free Checkout */}
                {promoApplied ? (
                  <button
                    onClick={handleFreeCheckout}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    Complete Free Checkout
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Enter Card Details</h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        value={cardholderName}
                        onChange={(e) => setCardholderName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        disabled={isProcessing}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Card Information
                      </label>
                      <div className="border border-gray-300 rounded-lg p-3">
                        <CardElement options={CARD_ELEMENT_OPTIONS} />
                      </div>
                    </div>

                    {paymentError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                        {paymentError}
                      </div>
                    )}

                    <button
                      onClick={processPayment}
                      disabled={isProcessing || !stripe || !clientSecret}
                      className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <PrinterIcon className="w-5 h-5" />
                          Pay ${totalPrice.toFixed(2)} & Print
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* QR Code for mobile payment */}
                {!promoApplied && paymentQRCode && paymentQRCode.length > 0 && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <p className="text-sm text-gray-600 text-center mb-3">
                      Or scan to pay with your phone
                    </p>
                    <div className="flex justify-center">
                      <img src={paymentQRCode} alt="Payment QR Code" className="w-32 h-32" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
