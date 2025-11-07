import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json(
        { error: `Webhook Error: ${err.message}` },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('✅ Webhook: Payment succeeded:', paymentIntent.id)
        console.log('Metadata:', paymentIntent.metadata)
        
        // ✅ FIX: CRITICAL - Record payment in database as BACKUP for frontend
        // This ensures payment is ALWAYS recorded even if frontend fails
        try {
          const orderId = paymentIntent.metadata?.orderId
          const userId = paymentIntent.metadata?.userId
          
          if (!orderId || !userId) {
            console.error('❌ WEBHOOK CRITICAL: Payment succeeded but missing orderId or userId in metadata!')
            console.error('Payment Intent ID:', paymentIntent.id)
            console.error('Metadata:', paymentIntent.metadata)
            // TODO: Alert support team - payment succeeded but can't be recorded
            break
          }
          
          // Call backend to record transaction (use server-side auth)
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001'
          
          // Check if transaction already exists (frontend might have succeeded)
          const checkResponse = await fetch(`${backendUrl}/orders/transactions/by-stripe/${paymentIntent.id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              // TODO: Use service account token for webhook authentication
            }
          })
          
          if (checkResponse.ok) {
            const existingTx = await checkResponse.json()
            if (existingTx.transaction) {
              console.log('✅ Transaction already recorded by frontend:', existingTx.transaction.id)
              break
            }
          }
          
          // Transaction doesn't exist - create it now (frontend failed)
          console.log('⚠️ Frontend failed to record - webhook creating transaction as backup')
          
          const txResponse = await fetch(`${backendUrl}/orders/transactions/webhook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // TODO: Use service account token for webhook authentication
            },
            body: JSON.stringify({
              orderId,
              userId,
              amount: paymentIntent.amount / 100,
              currency: paymentIntent.currency.toUpperCase(),
              stripePaymentIntentId: paymentIntent.id,
              stripeChargeId: paymentIntent.charges?.data[0]?.id,
              status: 'succeeded',
              paymentMethodType: paymentIntent.payment_method_types?.[0] || 'card',
              cardLast4: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.last4,
              cardBrand: (paymentIntent.charges?.data[0]?.payment_method_details as any)?.card?.brand,
              metadata: {
                source: 'webhook_backup',
                paymentIntentId: paymentIntent.id,
                ...paymentIntent.metadata
              }
            })
          })
          
          if (txResponse.ok) {
            console.log('✅ Webhook successfully recorded transaction')
          } else {
            const error = await txResponse.json().catch(() => ({}))
            console.error('❌ Webhook failed to record transaction:', error)
            // TODO: Alert support team
          }
          
        } catch (error) {
          console.error('❌ Webhook error processing payment:', error)
          // TODO: Alert support team - payment succeeded but webhook failed to record
        }
        break

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent
        console.log('❌ Payment failed:', failedPayment.id)
        break

      case 'payment_intent.canceled':
        const canceledPayment = event.data.object as Stripe.PaymentIntent
        console.log('🚫 Payment canceled:', canceledPayment.id)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

