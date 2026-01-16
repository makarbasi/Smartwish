// Fetch brands from the Next.js API endpoint
async function fetchBrands() {
  try {
    const response = await fetch('http://localhost:3000/api/tillo/brands', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    console.log('\n==========================================');
    console.log('COMPLETE RESPONSE FROM TILLO API:');
    console.log('==========================================\n');
    console.log(responseText);
    console.log('\n==========================================\n');
    
    // Also try to parse and show structure
    try {
      const data = JSON.parse(responseText);
      console.log('Parsed JSON structure:');
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Response is not valid JSON');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

fetchBrands();

