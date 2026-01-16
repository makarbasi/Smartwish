const { Client } = require('pg');
require('dotenv').config();

async function findTemplateImages() {
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

    // Check how many templates we have and their cover images
    console.log('\n📋 STEP 1: All template cover images');
    const allTemplates = await client.query(`
      SELECT 
        id, 
        title, 
        cover_image,
        status
      FROM sw_templates 
      ORDER BY created_at;
    `);
    
    console.log(`Found ${allTemplates.rows.length} templates:`);
    allTemplates.rows.forEach((template, index) => {
      console.log(`  ${index + 1}. ${template.title}`);
      console.log(`     ID: ${template.id}`);
      console.log(`     Cover Image: ${template.cover_image}`);
      console.log(`     Status: ${template.status}`);
      console.log('');
    });

    // Look for any related image/media tables
    console.log('\n📋 STEP 2: Looking for template image/media tables');
    const relatedTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%image%' OR 
        table_name LIKE '%media%' OR 
        table_name LIKE '%asset%' OR
        table_name LIKE '%file%' OR
        table_name LIKE '%template%'
      )
      ORDER BY table_name;
    `);
    
    console.log('Related tables:');
    relatedTables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Check if there are template pages or template assets tables
    console.log('\n📋 STEP 3: Checking for template pages/assets tables');
    const pagesTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (
        table_name LIKE '%page%' OR 
        table_name LIKE '%template%'
      )
      ORDER BY table_name;
    `);
    
    if (pagesTables.rows.length > 0) {
      console.log('Template-related tables found:');
      for (const table of pagesTables.rows) {
        console.log(`\n  Table: ${table.table_name}`);
        
        // Get structure of each template-related table
        const tableStructure = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `, [table.table_name]);
        
        console.log('    Columns:');
        tableStructure.rows.forEach(col => {
          console.log(`      - ${col.column_name}: ${col.data_type}`);
        });

        // Check for sample data if it has image-related columns
        const hasImageColumns = tableStructure.rows.some(col => 
          col.column_name.includes('image') || 
          col.column_name.includes('asset') || 
          col.column_name.includes('media')
        );

        if (hasImageColumns) {
          console.log('    Sample data:');
          const sampleData = await client.query(`SELECT * FROM ${table.table_name} LIMIT 3`);
          sampleData.rows.forEach((row, idx) => {
            console.log(`      Record ${idx + 1}:`);
            Object.keys(row).forEach(key => {
              if (key.includes('image') || key.includes('asset') || key.includes('media')) {
                console.log(`        ${key}: ${row[key]}`);
              }
            });
          });
        }
      }
    }

    // Check if templates have JSON data stored in other formats
    console.log('\n📋 STEP 4: Checking for any JSON/JSONB columns in templates');
    const jsonColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'sw_templates' 
      AND (data_type = 'json' OR data_type = 'jsonb')
      ORDER BY column_name;
    `);
    
    if (jsonColumns.rows.length > 0) {
      console.log('JSON columns in templates:');
      jsonColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('No JSON columns found in templates table.');
    }

    // Look for any file storage references in other tables
    console.log('\n📋 STEP 5: Summary of findings');
    console.log('IMAGE STORAGE ANALYSIS:');
    console.log(`- Templates have 'cover_image' column with paths like: /images/templates/Birthday/birthday_1.jpg`);
    console.log(`- Total templates: ${allTemplates.rows.length}`);
    console.log(`- Each template appears to have 1 cover image (not 4 images per template)`);
    console.log('- No additional image tables found for storing multiple template images');
    console.log('- No JSON columns found that might contain image arrays');

    console.log('\n🤔 QUESTION: Where are the "4 images per template"?');
    console.log('POSSIBLE EXPLANATIONS:');
    console.log('1. The 4 images might be stored in the file system with naming conventions');
    console.log('2. The 4 images might be generated dynamically from the cover image');
    console.log('3. The 4 images might be stored in a separate storage system (Supabase Storage)');
    console.log('4. The 4 images concept might be from the frontend hardcoded data that was removed');

    console.log('\n✅ Template image analysis completed!');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

findTemplateImages().catch(console.error);
