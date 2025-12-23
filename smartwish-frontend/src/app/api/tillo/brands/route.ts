import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// Tillo API configuration
const TILLO_API_KEY = process.env.TILLO_API_KEY || ''
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || ''
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://app.tillo.io/api/v2'

function generateSignature(
  method: string,
  endpoint: string,
  timestamp: number,
  clientRequestId: string = '',
  brandSlug: string = ''
): string {
  // Signature format: API_KEY-METHOD-ENDPOINT-CLIENT_REQUEST_ID-BRAND_SLUG-TIMESTAMP
  // For GET requests without brand, some parts may be empty
  const parts = [TILLO_API_KEY, method.toUpperCase(), endpoint]

  if (clientRequestId) {
    parts.push(clientRequestId)
  }
  if (brandSlug) {
    parts.push(brandSlug)
  }

  parts.push(timestamp.toString())

  const signatureString = parts.join('-')

  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET)
  hmac.update(signatureString)
  return hmac.digest('hex')
}

export async function GET(request: NextRequest) {
  try {
    if (!TILLO_API_KEY || !TILLO_API_SECRET) {
      console.error('❌ Tillo API credentials not configured')
      return NextResponse.json(
        {
          error: 'Tillo API configuration missing',
          details: 'Please set TILLO_API_KEY and TILLO_API_SECRET environment variables'
        },
        { status: 500 }
      )
    }

    // If raw=1 is provided, return the *raw* upstream Tillo response (useful for certification/debugging).
    // This does not expose secrets; it's just the upstream JSON payload.
    const raw = request.nextUrl.searchParams.get('raw') === '1'

    const timestamp = Date.now()
    const endpoint = 'brands'
    const signature = generateSignature('GET', endpoint, timestamp)

    // Request brand detail so we receive brand assets (logo_url / gift_card_url) as per Tillo docs:
    // - https://tillo.tech/v2_docs/brand_information.html#brands-api-response
    // - https://tillo.tech/v2_docs/brand_information.html#brand-assets
    const upstreamUrl = `${TILLO_BASE_URL}/${endpoint}?detail=true`

    console.log('🔑 Making Tillo API request to:', upstreamUrl)
    console.log('📋 API Key:', TILLO_API_KEY.substring(0, 8) + '...')

    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-Key': TILLO_API_KEY,
        'Signature': signature,
        'Timestamp': timestamp.toString(),
      },
    })

    const responseText = await response.text()
    console.log('📥 Tillo response status:', response.status)

    if (!response.ok) {
      console.error('❌ Tillo API error:', responseText)
      return NextResponse.json(
        {
          error: 'Failed to fetch brands from Tillo',
          status: response.status,
          details: responseText
        },
        { status: response.status }
      )
    }

    const data = JSON.parse(responseText)

    // Return the raw upstream payload if requested
    if (raw) {
      return NextResponse.json(data)
    }

    // Log the actual response structure for debugging
    console.log('📦 Tillo Response Structure:', JSON.stringify(data).substring(0, 500))
    console.log('📦 Response keys:', Object.keys(data))

    // Tillo API v2 response format:
    // { "code": "000", "status": "success", "message": "...", "data": { "brands": { "brand-slug": {...}, ... } } }
    let brandsObject: Record<string, any> = {}

    if (data.data && data.data.brands && typeof data.data.brands === 'object') {
      // Standard Tillo v2 format: data.brands is an object with slugs as keys
      brandsObject = data.data.brands
    } else if (data.brands && typeof data.brands === 'object' && !Array.isArray(data.brands)) {
      // Alternative: brands directly in response
      brandsObject = data.brands
    } else if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
      // Alternative: data itself is the brands object
      brandsObject = data.data
    }

    // Convert object to array
    const brandSlugs = Object.keys(brandsObject)
    console.log('📊 Found', brandSlugs.length, 'brands')

    if (brandSlugs.length > 0) {
      const sampleBrand = brandsObject[brandSlugs[0]]
      console.log('📊 Sample brand keys:', Object.keys(sampleBrand))
      console.log('📊 Sample brand logo fields:', {
        logo: sampleBrand.logo,
        logo_url: sampleBrand.logo_url,
        logoUrl: sampleBrand.logoUrl,
        image: sampleBrand.image,
        imageUrl: sampleBrand.imageUrl,
        image_url: sampleBrand.image_url,
        icon: sampleBrand.icon,
        icon_url: sampleBrand.icon_url,
        brand_logo: sampleBrand.brand_logo,
        brand_logo_url: sampleBrand.brand_logo_url,
        allKeys: Object.keys(sampleBrand).filter(k => k.toLowerCase().includes('logo') || k.toLowerCase().includes('image') || k.toLowerCase().includes('icon'))
      })
    }

    // -------------------------------------------------------------------------
    // Logo strategy
    // -------------------------------------------------------------------------
    // With `detail=true`, Tillo can provide brand assets under `detail.assets`
    // (e.g. `detail.assets.logo_url`) per docs. If a logo is not present for a
    // given brand/account, we fall back to:
    // 1) Manual asset hosting: `smartwish-frontend/public/tillo-logos/<slug>.png`
    // 2) Guaranteed fallback: generated SVG "initials badge" data URI.

    const normalizeSlug = (s: string): string => {
      return (s || '')
        .toLowerCase()
        .trim()
        .replace(/-+(us|usa|uk|ca|au|eu|url)$/g, '') // common suffixes in slugs
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }

    const fileExistsInPublic = (relativePathFromPublic: string): boolean => {
      try {
        const fullPath = path.join(process.cwd(), 'public', relativePathFromPublic)
        return fs.existsSync(fullPath)
      } catch {
        return false
      }
    }

    const pickInitials = (name: string): string => {
      const cleaned = (name || '')
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!cleaned) return 'GC'
      const parts = cleaned.split(' ').filter(Boolean)
      const first = parts[0]?.[0] || 'G'
      const second = parts[1]?.[0] || (parts[0]?.[1] ?? 'C')
      return (first + second).toUpperCase()
    }

    const hashColor = (input: string): string => {
      // simple deterministic color from slug
      let hash = 0
      for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0
      const hue = hash % 360
      return `hsl(${hue} 70% 45%)`
    }

    const svgLogoDataUri = (name: string, slug: string): string => {
      const initials = pickInitials(name)
      const bg = hashColor(slug || name || 'gift-card')
      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320" role="img" aria-label="${name}">
  <rect width="480" height="320" rx="36" fill="${bg}"/>
  <rect x="18" y="18" width="444" height="284" rx="28" fill="rgba(255,255,255,0.12)"/>
  <text x="240" y="185" text-anchor="middle" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="112" font-weight="800" fill="white">${initials}</text>
</svg>`.trim()
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    }

    const getBrandLogo = (brandName: string, brandSlug: string): string => {
      const normalized = normalizeSlug(brandSlug)

      // Prefer raster logos first (more common from manual downloads), then svg.
      const candidates = [
        path.posix.join('tillo-logos', `${normalized}.png`),
        path.posix.join('tillo-logos', `${normalized}.jpg`),
        path.posix.join('tillo-logos', `${normalized}.jpeg`),
        path.posix.join('tillo-logos', `${normalized}.webp`),
        path.posix.join('tillo-logos', `${normalized}.svg`),
      ]

      for (const rel of candidates) {
        if (fileExistsInPublic(rel)) return `/${rel}`
      }

      // Always return a usable logo, even if you haven't uploaded assets yet
      return svgLogoDataUri(brandName || normalized || 'Gift Card', normalized || brandSlug)
    }

    // Transform the brands data to match our UI needs
    const brands = brandSlugs.map((slug: string) => {
      const brand = brandsObject[slug]

      // Try multiple possible logo field names from Tillo API
      // (kept for compatibility if Tillo ever adds assets in the future)
      let logo =
        // Preferred: documented assets location when using detail=true
        brand?.detail?.assets?.logo_url ||
        brand?.detail?.assets?.logoUrl ||
        brand?.assets?.logo_url ||
        brand?.assets?.logoUrl ||
        brand.logo ||
        brand.logo_url ||
        brand.logoUrl ||
        brand.image ||
        brand.imageUrl ||
        brand.image_url ||
        brand.icon ||
        brand.icon_url ||
        brand.brand_logo ||
        brand.brand_logo_url ||
        brand.assets?.logo ||
        brand.assets?.logo_url ||
        null

      const giftCardImage =
        brand?.detail?.assets?.gift_card_url ||
        brand?.detail?.assets?.giftCardUrl ||
        brand?.assets?.gift_card_url ||
        brand?.assets?.giftCardUrl ||
        null

      // If no logo from API (expected), use manual asset if present; otherwise initials SVG
      if (!logo) {
        logo = getBrandLogo(brand.name || slug, brand.slug || slug)
      }

      return {
        id: slug,
        name: brand.name || slug,
        slug: brand.slug || slug,
        logo: logo,
        image: logo, // Also set image for backward compatibility
        giftCardImage,
        category: (brand.categories && brand.categories[0]) || brand.category || 'Gift Card',
        minAmount: brand.digital_face_value_limits?.lower || brand.min_value || brand.minValue || 5,
        maxAmount: brand.digital_face_value_limits?.upper || brand.max_value || brand.maxValue || 500,
        currency: brand.currency || 'USD',
        type: brand.type || 'gift-card',
        status: brand.status?.code || 'ENABLED',
        deliveryMethods: brand.delivery_methods || ['url'],
        countriesServed: brand.countries_served || ['US']
      }
    })

    console.log(`✅ Successfully processed ${brands.length} brands from Tillo`)

    return NextResponse.json({
      brands,
      count: brands.length,
      source: 'tillo'
    })
  } catch (error: any) {
    console.error('❌ Error fetching Tillo brands:', error.message)
    return NextResponse.json(
      {
        error: 'Failed to fetch brands',
        details: error.message
      },
      { status: 500 }
    )
  }
}

