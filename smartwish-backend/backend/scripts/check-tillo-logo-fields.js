/**
 * Script to check what logo/image fields Tillo API returns
 */

import 'dotenv/config';
import crypto from 'crypto';
import fetch from 'node-fetch';

const TILLO_API_KEY = process.env.TILLO_API_KEY || process.env.TILLO_SECRET_KEY;
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || process.env.TILLO_SECRET_KEY;
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://app.tillo.io/api/v2';

function generateSignature(method, endpoint, timestamp) {
  const signatureString = [TILLO_API_KEY, method.toUpperCase(), endpoint, timestamp.toString()].join('-');
  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET);
  hmac.update(signatureString);
  return hmac.digest('hex');
}

async function checkLogoFields() {
  try {
    console.log('🔍 Checking Tillo API response for logo fields...\n');
    
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
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const brands = data.data?.brands || {};
    const firstBrandSlug = Object.keys(brands)[0];
    const firstBrand = brands[firstBrandSlug];

    console.log('📦 Sample Brand:', firstBrand.name);
    console.log('📦 Brand Slug:', firstBrandSlug);
    console.log('\n🔑 All Fields:');
    console.log(Object.keys(firstBrand).join(', '));
    
    console.log('\n🖼️  Logo/Image/Icon Related Fields:');
    const logoFields = Object.keys(firstBrand).filter(k => 
      k.toLowerCase().includes('logo') || 
      k.toLowerCase().includes('image') || 
      k.toLowerCase().includes('icon') ||
      k.toLowerCase().includes('asset') ||
      k.toLowerCase().includes('url')
    );
    
    if (logoFields.length > 0) {
      logoFields.forEach(field => {
        console.log(`  - ${field}: ${JSON.stringify(firstBrand[field])}`);
      });
    } else {
      console.log('  ⚠️  No logo/image/icon fields found');
    }

    console.log('\n📄 Full Brand Object (first 3000 chars):');
    console.log(JSON.stringify(firstBrand, null, 2).substring(0, 3000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLogoFields();

