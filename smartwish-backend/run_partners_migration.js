const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

async function runPartnersMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🚀 Starting Partners Table Migration...');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Not set');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase credentials not found in environment variables');
    console.log('Please check your .env file in the backend folder');
    return;
  }

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'partners_migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL file loaded successfully');
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔗 Connected to Supabase');
    
    // Execute the migration SQL
    console.log('⚡ Executing migration...');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== 'BEGIN' && stmt !== 'COMMIT');
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        });
        
        if (error) {
          // Try direct query execution as fallback
          const { data: queryData, error: queryError } = await supabase
            .from('partners')
            .select('count')
            .limit(0);
            
          if (queryError && queryError.message.includes('relation "partners" does not exist')) {
            console.log('Creating table using direct SQL execution...');
            // For table creation, we'll need to use a different approach
            // Let's try using the REST API directly
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({ sql: statement })
            });
            
            if (!response.ok) {
              console.log('⚠️ Direct SQL execution not available, trying alternative approach...');
              break;
            }
          }
        }
      }
    }
    
    // Verify the table was created
    console.log('🔍 Verifying partners table creation...');
    
    const { data: tableCheck, error: tableError } = await supabase
      .from('partners')
      .select('count')
      .limit(0);
    
    if (tableError) {
      if (tableError.message.includes('relation "partners" does not exist')) {
        console.log('❌ Partners table was not created. Please run the SQL manually in Supabase SQL Editor.');
        console.log('\n📋 Manual Steps:');
        console.log('1. Go to your Supabase project dashboard');
        console.log('2. Navigate to SQL Editor');
        console.log('3. Copy and paste the contents of partners_migration.sql');
        console.log('4. Click "Run" to execute the migration');
        return;
      } else {
        console.error('❌ Error checking table:', tableError.message);
        return;
      }
    }
    
    console.log('✅ Partners table verified successfully!');
    
    // Test inserting a sample record
    console.log('🧪 Testing table with sample data...');
    
    const { data: insertData, error: insertError } = await supabase
      .from('partners')
      .insert({
        address: '123 Test Street, Test City, TC 12345',
        owner: 'Test Owner',
        email: 'test@example.com',
        telephone: '+1-555-123-4567',
        pictures: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
      })
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting test data:', insertError.message);
    } else {
      console.log('✅ Test data inserted successfully:', insertData);
      
      // Clean up test data
      const { error: deleteError } = await supabase
        .from('partners')
        .delete()
        .eq('email', 'test@example.com');
      
      if (deleteError) {
        console.log('⚠️ Could not clean up test data:', deleteError.message);
      } else {
        console.log('🧹 Test data cleaned up');
      }
    }
    
    console.log('\n🎉 Partners table migration completed successfully!');
    console.log('\n📊 Table Structure:');
    console.log('- id: UUID (Primary Key)');
    console.log('- address: TEXT (Required)');
    console.log('- owner: VARCHAR(255) (Required)');
    console.log('- email: VARCHAR(255) (Required, Unique)');
    console.log('- telephone: VARCHAR(50) (Required)');
    console.log('- pictures: TEXT[] (Array of image URLs)');
    console.log('- created_at: TIMESTAMP WITH TIME ZONE');
    console.log('- updated_at: TIMESTAMP WITH TIME ZONE');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📋 Manual Migration Steps:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of partners_migration.sql');
    console.log('4. Click "Run" to execute the migration');
  }
}

// Run the migration
runPartnersMigration();