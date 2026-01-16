import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, currency = 'usd', metadata = {} } = body

    // ✅ Validate amount with strict bounds
    if (!amount || typeof amount !== 'number' || !isFinite(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a valid number' },
        { status: 400 }
      )
    }

    if (amount < 0.01) {
      return NextResponse.json(
        { error: 'Amount must be at least $0.01' },
        { status: 400 }
      )
    }

    // Stripe maximum amount: $999,999.99 USD
    if (amount > 999999.99) {
      return NextResponse.json(
        { error: 'Amount exceeds maximum limit ($999,999.99)' },
        { status: 400 }
      )
    }

    // Create a PaymentIntent with the order amount and currency
    const amountInCents = Math.round(amount * 100)
    
    // Final sanity check
    if (amountInCents < 1) {
      return NextResponse.json(
        { error: 'Amount too small (minimum $0.01)' },
        { status: 400 }
      )
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents, // Stripe expects amount in cents
      currency: currency,
      metadata: {
        ...metadata,
        integration_check: 'accept_a_payment',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: any) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

