const bcrypt = require('bcrypt');

// Get password from command line argument
const password = process.argv[2];

if (!password) {
  console.error('Usage: node hash-password.js <your-password>');
  console.error('Example: node hash-password.js MySecurePassword123!');
  process.exit(1);
}

// Hash the password with 12 rounds (same as backend)
bcrypt.hash(password, 12, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  
  console.log('\n✅ Password hashed successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Hashed password:');
  console.log(hash);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Get email from command line or use default
  const email = process.argv[3] || 'admin@smartwish.us';
  const name = process.argv[4] || 'Admin User';
  
  console.log('📋 SQL to UPDATE existing user to admin:');
  console.log(`UPDATE users 
SET role = 'admin', 
    status = 'active',
    is_email_verified = true,
    password = '${hash}'
WHERE email = '${email}';`);
  
  console.log('\n📋 SQL to CREATE new admin user:');
  console.log(`INSERT INTO users (email, password, name, role, status, is_email_verified, created_at, updated_at)
VALUES (
  '${email}',
  '${hash}',
  '${name}',
  'admin',
  'active',
  true,
  NOW(),
  NOW()
);`);
  console.log('\n💡 Tip: Run this SQL in your Supabase SQL editor or PostgreSQL client\n');
});
