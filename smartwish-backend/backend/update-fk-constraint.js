const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function updateForeignKeyConstraint() {
  console.log('🔧 Updating foreign key constraint to reference public.users...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Step 1: Drop the existing foreign key constraint
    console.log('\n📋 Step 1: Dropping existing foreign key constraint...');
    
    const { data: dropResult, error: dropError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE saved_designs 
        DROP CONSTRAINT IF EXISTS saved_designs_author_id_fkey;
      `
    });

    if (dropError) {
      console.error('Error dropping constraint:', dropError);
      // Try alternative approach if exec_sql doesn't work
      console.log('Trying alternative approach...');
      
      // Create a SQL migration file instead
      const migrationSQL = `
-- Drop existing foreign key constraint
ALTER TABLE saved_designs 
DROP CONSTRAINT IF EXISTS saved_designs_author_id_fkey;

-- Add new foreign key constraint referencing public.users
ALTER TABLE saved_designs 
ADD CONSTRAINT saved_designs_author_id_fkey 
FOREIGN KEY (author_id) REFERENCES public.users(id) 
ON DELETE CASCADE;
      `;

      console.log('\n📝 Migration SQL to run manually:');
      console.log(migrationSQL);
      return;
    } else {
      console.log('✅ Existing constraint dropped successfully');
    }

    // Step 2: Add new foreign key constraint referencing public.users
    console.log('\n📋 Step 2: Adding new foreign key constraint to public.users...');
    
    const { data: addResult, error: addError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE saved_designs 
        ADD CONSTRAINT saved_designs_author_id_fkey 
        FOREIGN KEY (author_id) REFERENCES public.users(id) 
        ON DELETE CASCADE;
      `
    });

    if (addError) {
      console.error('Error adding new constraint:', addError);
      throw addError;
    }

    console.log('✅ New foreign key constraint added successfully');

    // Step 3: Test the new constraint
    console.log('\n📋 Step 3: Testing new constraint...');
    
    const { data: testInsert, error: testError } = await supabase
      .from('saved_designs')
      .insert({
        author_id: '9c33b723-7018-426a-8f0c-574e9de6ba2a', // User that exists in public.users
        title: 'Test Design with Public Users FK',
        description: 'Test Description',
        status: 'draft',
        price: 0,
        language: 'en',
        region: 'US',
        popularity: 0,
        num_downloads: 0,
        search_keywords: [],
        tags: [],
        metadata: { test: true }
      })
      .select()
      .single();

    if (testError) {
      console.error('❌ Test insert failed:', testError);
      throw testError;
    }

    console.log('✅ Test insert successful with new constraint!');
    
    // Clean up test record
    if (testInsert?.id) {
      await supabase.from('saved_designs').delete().eq('id', testInsert.id);
      console.log('🧹 Test record cleaned up');
    }

    console.log('\n🎉 Foreign key constraint successfully updated to reference public.users!');

  } catch (error) {
    console.error('❌ Error updating foreign key constraint:', error);
    
    // Provide manual SQL as fallback
    const fallbackSQL = `
-- Manual SQL to run in Supabase SQL Editor:

-- 1. Drop existing constraint
ALTER TABLE saved_designs 
DROP CONSTRAINT IF EXISTS saved_designs_author_id_fkey;

-- 2. Add new constraint referencing public.users
ALTER TABLE saved_designs 
ADD CONSTRAINT saved_designs_author_id_fkey 
FOREIGN KEY (author_id) REFERENCES public.users(id) 
ON DELETE CASCADE;
    `;

    console.log('\n📝 Please run this SQL manually in Supabase SQL Editor:');
    console.log(fallbackSQL);
  }
}

updateForeignKeyConstraint().catch(console.error);
