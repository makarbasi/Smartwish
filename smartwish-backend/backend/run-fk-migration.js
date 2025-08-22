const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runFKMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('🔧 Running FK constraint migration...');

  try {
    // Step 1: Drop existing FK constraint
    console.log('📋 Step 1: Dropping existing FK constraint...');
    const dropResult = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE saved_designs DROP CONSTRAINT IF EXISTS saved_designs_author_id_fkey;'
    });

    if (dropResult.error) {
      console.error('❌ Error dropping FK constraint:', dropResult.error);
    } else {
      console.log('✅ Successfully dropped existing FK constraint');
    }

    // Step 2: Add new FK constraint referencing public.users
    console.log('📋 Step 2: Adding new FK constraint to public.users...');
    const addResult = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE saved_designs 
            ADD CONSTRAINT saved_designs_author_id_fkey 
            FOREIGN KEY (author_id) REFERENCES public.users(id) 
            ON DELETE CASCADE;`
    });

    if (addResult.error) {
      console.error('❌ Error adding FK constraint:', addResult.error);
    } else {
      console.log('✅ Successfully added FK constraint to public.users');
    }

    // Step 3: Verify the constraint
    console.log('📋 Step 3: Verifying FK constraint...');
    const verifyResult = await supabase.rpc('exec_sql', {
      sql: `SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table
            FROM pg_constraint 
            WHERE conname = 'saved_designs_author_id_fkey';`
    });

    if (verifyResult.error) {
      console.error('❌ Error verifying FK constraint:', verifyResult.error);
    } else {
      console.log('✅ FK constraint verification result:', verifyResult.data);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runFKMigration()
  .then(() => {
    console.log('🎉 FK Migration completed successfully!');
    console.log('💡 The saved_designs.author_id now properly references public.users.id');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 FK Migration failed:', error);
    process.exit(1);
  });
