const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
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

async function fetchRawTilloResponse() {
  try {
    if (!TILLO_API_KEY || !TILLO_API_SECRET) {
      console.error('❌ Tillo API credentials not configured');
      console.log('Please set TILLO_API_KEY and TILLO_API_SECRET in .env.local');
      process.exit(1);
    }

    const timestamp = Date.now();
    const endpoint = 'brands';
    const signature = generateSignature('GET', endpoint, timestamp);

    console.log('🔑 Making direct Tillo API request to:', `${TILLO_BASE_URL}/${endpoint}`);
    console.log('📋 API Key:', TILLO_API_KEY.substring(0, 8) + '...');
    console.log('📋 Timestamp:', timestamp);
    console.log('📋 Signature:', signature.substring(0, 16) + '...\n');

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
    
    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Status Text:', response.statusText);
    console.log('📥 Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    
    console.log('\n==========================================');
    console.log('COMPLETE RAW RESPONSE FROM TILLO API:');
    console.log('==========================================\n');
    console.log(responseText);
    console.log('\n==========================================\n');
    
    // Also show formatted JSON if valid
    try {
      const data = JSON.parse(responseText);
      console.log('Formatted JSON:');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Response is not valid JSON');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

fetchRawTilloResponse();

