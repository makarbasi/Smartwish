/**
 * Script to fetch and count all Tillo brands via the production API
 * This goes through your production server (which has whitelisted IP)
 * Usage: node scripts/count-tillo-brands-via-api.js
 */

import fetch from 'node-fetch';

// Frontend URL (where Next.js API routes are hosted)
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://smartwish.onrender.com';

async function fetchBrandsViaAPI() {
  try {
    console.log('🎁 Fetching Tillo brands via production API...');
    console.log('🌐 API URL:', `${FRONTEND_URL}/api/tillo/brands`);
    console.log('');

    const response = await fetch(`${FRONTEND_URL}/api/tillo/brands`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API error:', response.status);
      console.error('Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // API returns: { brands: [...], count: number, source: 'tillo' }
    const brands = data?.brands || [];
    const count = data?.count || brands.length;
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  📊 TILLO BRANDS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Total Brands: ${count}`);
    console.log('');
    
    if (brands.length > 0) {
      // Count by status
      const activeBrands = brands.filter(b => b.status === 'active' || b.status === 'ENABLED').length;
      const inactiveBrands = brands.length - activeBrands;
      
      console.log(`  Active Brands: ${activeBrands}`);
      console.log(`  Inactive Brands: ${inactiveBrands}`);
      console.log('');
      
      // Count by currency
      const usdBrands = brands.filter(b => b.currency === 'USD' || b.currency_code === 'USD').length;
      const otherCurrencyBrands = brands.length - usdBrands;
      
      console.log(`  USD Brands: ${usdBrands}`);
      console.log(`  Other Currency Brands: ${otherCurrencyBrands}`);
      console.log('');
      
      // Show first 20 brands as sample
      console.log('  Sample Brands (first 20):');
      console.log('  ───────────────────────────────────────────────────────');
      brands.slice(0, 20).forEach((brand, index) => {
        console.log(`  ${index + 1}. ${brand.name || 'Unknown'}`);
        console.log(`     Slug: ${brand.slug || brand.id || 'N/A'}`);
        console.log(`     Status: ${brand.status || 'N/A'}`);
        console.log(`     Currency: ${brand.currency || brand.currency_code || 'N/A'}`);
        if (brand.minAmount && brand.maxAmount) {
          console.log(`     Value Range: $${brand.minAmount} - $${brand.maxAmount}`);
        }
        console.log('');
      });
      
      if (brands.length > 20) {
        console.log(`  ... and ${brands.length - 20} more brands`);
      }
    } else {
      console.log('  ⚠️  No brands found in response');
      if (data.error) {
        console.log('  Error:', data.error);
      }
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    
    return brands;
    
  } catch (error) {
    console.error('❌ Error fetching brands:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
fetchBrandsViaAPI();

