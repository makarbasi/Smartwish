const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function createSpecificAuthUser() {
  console.log('🎯 Creating auth user with specific ID...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Delete the user we accidentally created
  console.log('\n🧹 Cleaning up incorrectly created user...');
  const { data: deleteData, error: deleteError } = await supabase.auth.admin.deleteUser('3b71f587-ff58-4655-992e-1f6faaa4f949');
  console.log('Delete result:', { deleteData, deleteError });

  // Now create the user with the exact ID we need
  console.log('\n👤 Creating auth user with exact ID: 9c33b723-7018-426a-8f0c-574e9de6ba2a');
  
  const { data: createAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
    user_id: '9c33b723-7018-426a-8f0c-574e9de6ba2a',
    email: 'abubakarx72@gmail.com',
    password: 'temporary_password_123!',
    email_confirm: true,
    user_metadata: {
      name: 'Abubakar'
    }
  });
  
  console.log('Auth user creation with specific ID:', { createAuthUser, createAuthError });

  // Now test the design insert
  console.log('\n📋 Testing design insert with correct auth user...');
  const { data: testInsert, error: insertError } = await supabase
    .from('saved_designs')
    .insert({
      author_id: '9c33b723-7018-426a-8f0c-574e9de6ba2a',
      title: 'Test Design With Correct Auth User',
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

  console.log('Insert result with correct auth user:', { testInsert, insertError });

  // Clean up test record if successful
  if (testInsert && testInsert.id) {
    console.log('🧹 Cleaning up test record...');
    await supabase
      .from('saved_designs')
      .delete()
      .eq('id', testInsert.id);
    console.log('✅ Test record cleaned up');
  }
}

createSpecificAuthUser().catch(console.error);
