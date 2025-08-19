// Script to check the actual structure of the users table
// Run with: node check-table-structure.js

require('dotenv').config();
const { DataSource } = require('typeorm');
const { databaseConfig } = require('./dist/backend/src/config/database.config');

async function checkTableStructure() {
  console.log('🔍 Checking users table structure...\n');
  
  try {
    // Create a test data source
    const dataSource = new DataSource({
      ...databaseConfig,
      entities: [], // Don't load entities for connection test
    });

    // Initialize the connection
    await dataSource.initialize();
    console.log('✅ Connected to database');
    
    // Get table structure
    console.log('\n📋 Users table structure:');
    const structureResult = await dataSource.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    structureResult.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    // Get sample data
    console.log('\n📊 Sample user data:');
    const sampleResult = await dataSource.query('SELECT * FROM users LIMIT 1');
    if (sampleResult.length > 0) {
      const user = sampleResult[0];
      Object.keys(user).forEach(key => {
        console.log(`  ${key}: ${user[key]}`);
      });
    }
    
    // Close the connection
    await dataSource.destroy();
    console.log('\n✅ Table structure check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTableStructure();
