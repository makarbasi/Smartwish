const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkTableStructure() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Checking sw_templates table structure...');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Not set');
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase credentials not found');
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('\n🔍 Testing sw_templates table access...');
    
    // First test if table exists and is accessible
    const { data: testData, error: testError } = await supabase
      .from('sw_templates')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.log('❌ sw_templates table test failed:', testError.message);
      return;
    }
    
    console.log('✅ sw_templates table exists and is accessible');
    
    // Try to get sample data to see actual columns
    const { data: sampleData, error: sampleError } = await supabase
      .from('sw_templates')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Could not get sample data:', sampleError.message);
    } else if (sampleData && sampleData.length > 0) {
      console.log('\n📋 Available columns in sw_templates:');
      const columns = Object.keys(sampleData[0]);
      columns.forEach(col => {
        console.log(`- ${col}`);
      });
      
      console.log(`\n🔍 created_by_user_id column exists: ${columns.includes('created_by_user_id') ? '✅ YES' : '❌ NO'}`);
      console.log(`🔍 author_id column exists: ${columns.includes('author_id') ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('⚠️ No data in sw_templates table to check column structure');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTableStructure();
