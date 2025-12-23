const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Try to load .env.local manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const TILLO_API_KEY = process.env.TILLO_API_KEY || '';
const TILLO_API_SECRET = process.env.TILLO_API_SECRET || '';
const TILLO_BASE_URL = process.env.TILLO_BASE_URL || 'https://sandbox.tillo.dev/api/v2';

function generateSignature(method, endpoint, timestamp) {
  const parts = [TILLO_API_KEY, method.toUpperCase(), endpoint];
  parts.push(timestamp.toString());
  const signatureString = parts.join('-');
  
  const hmac = crypto.createHmac('sha256', TILLO_API_SECRET);
  hmac.update(signatureString);
  return hmac.digest('hex');
}

async function fetchBrands() {
  try {
    if (!TILLO_API_KEY || !TILLO_API_SECRET) {
      console.error('❌ Tillo API credentials not configured');
      console.log('Please set TILLO_API_KEY and TILLO_API_SECRET in .env.local');
      return;
    }

    const timestamp = Date.now();
    const endpoint = 'brands';
    const signature = generateSignature('GET', endpoint, timestamp);

    console.log('🔑 Making Tillo API request to:', `${TILLO_BASE_URL}/${endpoint}`);
    console.log('📋 API Key:', TILLO_API_KEY.substring(0, 8) + '...');
    console.log('📋 Timestamp:', timestamp);
    console.log('📋 Signature:', signature.substring(0, 16) + '...');

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

    const responseText = await response.text();
    console.log('\n📥 Tillo response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error('❌ Tillo API error:', responseText);
      return;
    }

    const data = JSON.parse(responseText);
    console.log('\n✅ SUCCESS! Actual Tillo API Response:');
    console.log('==========================================');
    console.log(JSON.stringify(data, null, 2));
    console.log('==========================================');
    
    // Show structure summary
    if (data.data && data.data.brands) {
      const brandSlugs = Object.keys(data.data.brands);
      console.log(`\n📊 Found ${brandSlugs.length} brands`);
      if (brandSlugs.length > 0) {
        console.log('📊 Sample brand keys:', Object.keys(data.data.brands[brandSlugs[0]]));
        console.log('📊 Sample brand:', JSON.stringify(data.data.brands[brandSlugs[0]], null, 2).substring(0, 500));
      }
    }

  } catch (error) {
    console.error('❌ Error fetching Tillo brands:', error.message);
    console.error(error.stack);
  }
}

fetchBrands();

