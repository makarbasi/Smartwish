const { Client } = require('pg');
require('dotenv').config();

async function checkTemplateStructure() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // First, let's check the structure of the templates table
    console.log('\n📋 STEP 1: Template table structure');
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sw_templates' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Template table columns:');
    tableStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check sample data with all columns
    console.log('\n📋 STEP 2: Sample template data (first 2 records)');
    const sampleTemplates = await client.query(`
      SELECT * FROM sw_templates LIMIT 2;
    `);
    
    if (sampleTemplates.rows.length > 0) {
      console.log('Sample template records:');
      sampleTemplates.rows.forEach((template, index) => {
        console.log(`\n  Template ${index + 1}:`);
        Object.keys(template).forEach(key => {
          let value = template[key];
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value).substring(0, 200) + '...';
          } else if (typeof value === 'string' && value.length > 100) {
            value = value.substring(0, 100) + '...';
          }
          console.log(`    ${key}: ${value}`);
        });
      });
    }

    console.log('\n✅ Template structure analysis completed!');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkTemplateStructure().catch(console.error);
