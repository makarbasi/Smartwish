/**
 * Script to fetch and count all Tillo brands
 * Usage: node scripts/count-tillo-brands.js
 */

import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

// Tillo API configuration
// Try both naming conventions (frontend uses TILLO_API_SECRET, backend might use TILLO_SECRET_KEY)
const TILLO_API_KEY = process.env.TILLO_API_KEY || '';
const TILLO_SECRET_KEY = process.env.TILLO_SECRET_KEY || process.env.TILLO_API_SECRET || '';
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://app.tillo.io/api/v2';

/**
 * Generate HMAC signature for Tillo API authentication
 * Signature format: [API Key]-[HTTP Method]-[Endpoint]-[Timestamp]
 */
function generateSignature(method, endpoint, timestamp) {
  const signatureString = `${TILLO_API_KEY}-${method}-${endpoint}-${timestamp}`;
  const hmac = crypto.createHmac('sha256', TILLO_SECRET_KEY);
  hmac.update(signatureString);
  return hmac.digest('hex');
}

async function fetchTilloBrands() {
  try {
    if (!TILLO_API_KEY || !TILLO_SECRET_KEY) {
      console.error('❌ TILLO_API_KEY or TILLO_SECRET_KEY not found in environment variables');
      console.error('   Make sure you have a .env file with these values set');
      process.exit(1);
    }

    console.log('🎁 Fetching Tillo brands...');
    console.log('🔑 API Key:', TILLO_API_KEY.substring(0, 10) + '...');
    console.log('🌐 Base URL:', TILLO_BASE_URL);
    console.log('');

    const timestamp = Date.now();
    const endpoint = 'brands';
    const signature = generateSignature('GET', endpoint, timestamp);

    const response = await fetch(`${TILLO_BASE_URL}/${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'API-Key': TILLO_API_KEY,
        'Signature': signature,
        'Timestamp': timestamp.toString(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Tillo API error:', response.status);
      console.error('Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Log the actual response structure for debugging
    console.log('📦 Response structure:', Object.keys(data));
    console.log('📦 Response sample:', JSON.stringify(data).substring(0, 500));
    console.log('');
    
    // Tillo API v2 structure can be:
    // { code: "000", status: "success", data: { brands: {...} } } - brands is an object with slugs as keys
    // OR { data: [...] } - array directly
    // OR { brands: [...] } - array directly
    let brands = [];
    
    if (data.data && data.data.brands && typeof data.data.brands === 'object' && !Array.isArray(data.data.brands)) {
      // Brands is an object with slugs as keys: { "brand-slug": {...}, ... }
      brands = Object.values(data.data.brands);
    } else if (data.data && Array.isArray(data.data)) {
      // Data is directly an array
      brands = data.data;
    } else if (data.brands && Array.isArray(data.brands)) {
      // Brands is directly an array
      brands = data.brands;
    } else if (data.data && typeof data.data === 'object') {
      // Try to extract brands from nested object
      const nestedBrands = data.data.brands || data.data.data || Object.values(data.data);
      brands = Array.isArray(nestedBrands) ? nestedBrands : Object.values(nestedBrands || {});
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📊 TILLO BRANDS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Total Brands: ${brands.length}`);
    console.log('');
    
    if (brands.length > 0) {
      // Count by status (status is object { code: "ENABLED" } in Tillo API)
      const activeBrands = brands.filter(b => {
        const status = typeof b.status === 'object' ? b.status?.code : b.status;
        return status === 'ENABLED' || status === 'active' || status === 'ACTIVE';
      }).length;
      const inactiveBrands = brands.length - activeBrands;
      
      console.log(`  Active Brands: ${activeBrands}`);
      console.log(`  Inactive Brands: ${inactiveBrands}`);
      console.log('');
      
      // Count by currency (Tillo uses 'currency' field, not 'currency_code')
      const usdBrands = brands.filter(b => {
        const currency = b.currency || b.currency_code;
        return currency === 'USD';
      }).length;
      const otherCurrencyBrands = brands.length - usdBrands;
      
      console.log(`  USD Brands: ${usdBrands}`);
      console.log(`  Other Currency Brands: ${otherCurrencyBrands}`);
      console.log('');
      
      // Show first 20 brands as sample
      console.log('  Sample Brands (first 20):');
      console.log('  ───────────────────────────────────────────────────────');
      brands.slice(0, 20).forEach((brand, index) => {
        const status = typeof brand.status === 'object' ? brand.status?.code : brand.status;
        const currency = brand.currency || brand.currency_code || 'N/A';
        const minValue = brand.digital_face_value_limits?.lower || brand.min_value;
        const maxValue = brand.digital_face_value_limits?.upper || brand.max_value;
        
        console.log(`  ${index + 1}. ${brand.name || brand.brand_name || 'Unknown'}`);
        console.log(`     Slug: ${brand.slug || brand.brand_code || 'N/A'}`);
        console.log(`     Status: ${status || 'N/A'}`);
        console.log(`     Currency: ${currency}`);
        if (minValue && maxValue) {
          console.log(`     Value Range: $${minValue} - $${maxValue}`);
        }
        console.log('');
      });
      
      if (brands.length > 20) {
        console.log(`  ... and ${brands.length - 20} more brands`);
      }
    } else {
      console.log('  ⚠️  No brands found in response');
      console.log('  Response structure:', Object.keys(data));
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    
    return brands;
    
  } catch (error) {
    console.error('❌ Error fetching Tillo brands:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
fetchTilloBrands();

