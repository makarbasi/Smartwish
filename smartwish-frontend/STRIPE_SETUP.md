# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payment processing for your SmartWish application.

## Prerequisites

- A Stripe account (sign up at [stripe.com](https://stripe.com))
- Access to your Stripe Dashboard

## Step 1: Get Your Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Click on **Developers** in the left sidebar
3. Click on **API keys**
4. You'll see two types of keys:
   - **Publishable key** (starts with `pk_test_` for test mode or `pk_live_` for live mode)
   - **Secret key** (starts with `sk_test_` for test mode or `sk_live_` for live mode)

⚠️ **Important**: Never share your secret key or commit it to version control!

## Step 2: Create Environment Variables File

Create a file named `.env.local` in the `smartwish-frontend` directory with the following content:

```bash
# Stripe API Keys
# Get your keys from https://dashboard.stripe.com/apikeys

# Publishable key (safe to expose in browser)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Secret key (NEVER expose in browser, server-side only)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here

# Stripe Webhook Secret (for production webhook verification)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### For Development (Test Mode)
Use your **test mode** keys (they start with `pk_test_` and `sk_test_`)

### For Production (Live Mode)
1. In your Stripe Dashboard, toggle from **Test mode** to **Live mode**
2. Use your **live mode** keys (they start with `pk_live_` and `sk_live_`)
3. Update the `.env.local` file with live keys

## Step 3: Set Up Webhooks (Optional but Recommended)

Webhooks allow Stripe to notify your application about payment events in real-time.

### For Local Development:
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run `stripe login` to authenticate
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copy the webhook signing secret (starts with `whsec_`) and add it to your `.env.local`

### For Production:
1. Go to **Developers** > **Webhooks** in your Stripe Dashboard
2. Click **Add endpoint**
3. Enter your webhook URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Copy the webhook signing secret and add it to your production environment variables

## Step 4: Test the Integration

### Test Cards
Stripe provides test card numbers for development:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0025 0000 3155` | Requires authentication (3D Secure) |
| `4000 0000 0000 9995` | Always fails with decline |

- Use any future expiry date (e.g., `12/34`)
- Use any 3-digit CVV (e.g., `123`)
- Use any cardholder name

### Testing the Payment Flow:
1. Start your development server: `npm run dev`
2. Navigate to the marketplace
3. Select a gift card and generate it
4. Click **Print Card** or **Send E-Card**
5. Enter test card details or scan the QR code on your phone
6. Complete the payment

## Step 5: Monitoring Payments

### View Payments in Dashboard:
1. Go to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Click on **Payments** in the left sidebar
3. You'll see all payment transactions

### View Logs:
1. Go to **Developers** > **Logs**
2. Monitor API requests and webhook events

## Step 6: Going Live

Before accepting real payments:

1. **Complete your Stripe account setup**:
   - Provide business information
   - Add bank account details
   - Verify your identity

2. **Switch to Live Mode**:
   - Toggle from Test mode to Live mode in Stripe Dashboard
   - Update your `.env.local` with live keys
   - Test with small real transactions first

3. **Security Checklist**:
   - ✅ Never commit `.env.local` to version control
   - ✅ Use environment variables in production
   - ✅ Enable webhook signature verification
   - ✅ Implement proper error handling
   - ✅ Set up monitoring and alerts

## API Endpoints Created

The following Stripe endpoints have been implemented:

### 1. `/api/stripe/create-payment-intent` (POST)
Creates a new payment intent for a transaction.

**Request Body**:
```json
{
  "amount": 25.00,
  "currency": "usd",
  "metadata": {
    "productName": "Amazon Gift Card",
    "paymentAction": "print"
  }
}
```

**Response**:
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

### 2. `/api/stripe/confirm-payment` (POST)
Confirms the status of a payment intent.

**Request Body**:
```json
{
  "paymentIntentId": "pi_xxx"
}
```

**Response**:
```json
{
  "status": "succeeded",
  "amount": 25.00,
  "currency": "usd"
}
```

### 3. `/api/stripe/webhook` (POST)
Handles Stripe webhook events (payment confirmations, failures, etc.)

## Features Implemented

### ✅ Kiosk Payment Modal
- Secure Stripe CardElement for card input
- Real-time card validation
- Support for print and e-card actions
- Error handling and user feedback

### ✅ Mobile QR Code Payment
- Generates unique payment QR codes
- Mobile-optimized payment page
- Automatic kiosk notification after payment
- Seamless UX for phone payments

### ✅ Payment Security
- PCI-compliant card handling (Stripe handles all card data)
- Client-side encryption
- Server-side payment confirmation
- Webhook signature verification

## Troubleshooting

### Issue: "Stripe has not been initialized"
**Solution**: Make sure `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in `.env.local` and restart your dev server.

### Issue: "Payment Intent creation failed"
**Solution**: Check that `STRIPE_SECRET_KEY` is correctly set and valid.

### Issue: Webhook signature verification failed
**Solution**: Ensure `STRIPE_WEBHOOK_SECRET` matches the signing secret from your webhook endpoint.

### Issue: Test card declined
**Solution**: Use `4242 4242 4242 4242` for successful test payments. Other test cards simulate different scenarios.

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Stripe API Reference: https://stripe.com/docs/api

## Security Best Practices

1. **Never log sensitive data**: Don't log full card numbers or secrets
2. **Use HTTPS in production**: Stripe requires HTTPS for live mode
3. **Validate on server-side**: Always verify payments server-side
4. **Keep Stripe.js up to date**: Use the latest version
5. **Monitor for fraud**: Set up Stripe Radar for fraud detection

---

🎉 **Your Stripe integration is now complete!** You can now accept real payments securely.

