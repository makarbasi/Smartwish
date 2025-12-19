# Tillo Gift Card API Setup Guide

## Prerequisites

You need **TWO** credentials from Tillo:

1. **API Key** - Your unique identifier (looks like a shorter alphanumeric string)
2. **API Secret** - Used for HMAC signature (64 character hex string)

## Configuration

Add these to your `.env.local` file in the `smartwish-frontend` directory:

```bash
# Tillo API Configuration
TILLO_API_KEY=your-api-key-here
TILLO_API_SECRET=6e9cf0f6549bef4c5ad5eeb17fb32b7c08bc0ab8154bb905cff625d9470588b8
TILLO_BASE_URL=https://sandbox.tillo.dev/api/v2
```

## Getting Your Credentials

1. **Log into Tillo Hub**:
   - Sandbox: https://hub.sandbox.tillo.dev/
   - Production: https://hub.tillo.io/

2. **Navigate to API Admin section**

3. **Create or find your API Key/Secret pair**
   - Note: The Secret is only shown ONCE when created!

4. **Whitelist your IP address** (required for API access)

## Testing the Integration

After configuring, test the integration:

1. Start the dev server: `npm run dev`
2. Visit: http://localhost:3000/api/tillo/check
3. If configured correctly, visit: http://localhost:3000/api/tillo/test
4. To see available brands: http://localhost:3000/api/tillo/brands

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/tillo/check` | Check configuration status |
| `/api/tillo/test` | Test API connection |
| `/api/tillo/brands` | Get available gift card brands |
| `/api/tillo/issue` | Issue a gift card (POST) |

## Issue a Gift Card

```bash
curl -X POST http://localhost:3000/api/tillo/issue \
  -H "Content-Type: application/json" \
  -d '{"brandSlug": "amazon-uk", "amount": 25, "currency": "USD"}'
```

## Troubleshooting

### "API configuration missing"
- Ensure both `TILLO_API_KEY` and `TILLO_API_SECRET` are set in `.env.local`
- Restart the Next.js dev server after updating `.env.local`

### "401 Unauthorized"
- Check that your API Key and Secret are correct
- Ensure your IP is whitelisted in Tillo Hub

### "403 Forbidden"
- Your IP address needs to be added to Tillo's IP whitelist
- Go to Tillo Hub → API Admin → IP Whitelist

### "Connection failed"
- Check that `TILLO_BASE_URL` is correct
- Sandbox: https://sandbox.tillo.dev/api/v2
- Production: https://api.tillo.io/api/v2

