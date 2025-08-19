// Script to run database migration and create missing tables
// Run with: node run-migration.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🚀 Running database migration...');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Not set');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Not set');
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase credentials not found in environment variables');
    return;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_create_users_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Migration file loaded:', migrationPath);
    console.log('📝 Migration size:', migrationSQL.length, 'characters');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`🔧 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;
      
      try {
        console.log(`\n📋 Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Some statements might fail (like creating types that already exist)
          // This is normal and not a problem
          console.log(`   ⚠️ Statement ${i + 1} result:`, error.message);
          if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
            console.log('   ℹ️ This is normal - object already exists');
            successCount++;
          } else {
            errorCount++;
          }
        } else {
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (error) {
        console.log(`   ❌ Statement ${i + 1} failed:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📝 Total: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('Your users and audit_logs tables should now exist.');
    } else if (successCount > errorCount) {
      console.log('\n⚠️ Migration partially completed.');
      console.log('Some tables may have been created successfully.');
    } else {
      console.log('\n❌ Migration failed. Check the errors above.');
    }
    
    // Test if tables were created
    console.log('\n🔍 Testing if tables were created...');
    
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (usersError) {
        console.log('❌ Users table still not accessible:', usersError.message);
      } else {
        console.log('✅ Users table is now accessible!');
      }
    } catch (error) {
      console.log('❌ Error testing users table:', error.message);
    }
    
    try {
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('count')
        .limit(1);
      
      if (auditError) {
        console.log('❌ Audit_logs table still not accessible:', auditError.message);
      } else {
        console.log('✅ Audit_logs table is now accessible!');
      }
    } catch (error) {
      console.log('❌ Error testing audit_logs table:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Error running migration:', error.message);
    console.log('\n💡 Alternative: You can run the migration manually in your Supabase dashboard:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of migrations/006_create_users_table.sql');
    console.log('4. Execute the SQL');
  }
}

// Load environment variables
require('dotenv').config();

// Run the migration
runMigration();
