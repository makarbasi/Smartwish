const { Client } = require('pg');
require('dotenv').config();

async function checkTemplateImages() {
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

    // Check specific image-related columns
    console.log('\n📋 STEP 2: Image-related columns in templates');
    const imageColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'sw_templates' 
      AND (column_name LIKE '%image%' OR column_name LIKE '%cover%' OR column_name LIKE '%preview%')
      ORDER BY column_name;
    `);
    
    console.log('Image-related columns:');
    imageColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Let's look at some sample template records to see the actual data
    console.log('\n📋 STEP 3: Sample template data');
    const sampleTemplates = await client.query(`
      SELECT 
        id, 
        title, 
        cover_image,
        design_data
      FROM sw_templates 
      LIMIT 3;
    `);
    
    console.log('Sample templates:');
    sampleTemplates.rows.forEach((template, index) => {
      console.log(`\n  Template ${index + 1}:`);
      console.log(`    ID: ${template.id}`);
      console.log(`    Title: ${template.title}`);
      console.log(`    Cover Image: ${template.cover_image}`);
      
      // Check if design_data contains image information
      if (template.design_data) {
        console.log(`    Design Data Keys: ${Object.keys(template.design_data)}`);
        
        // Look for pages array which might contain images
        if (template.design_data.pages) {
          console.log(`    Pages Count: ${template.design_data.pages.length}`);
          template.design_data.pages.forEach((page, pageIndex) => {
            console.log(`      Page ${pageIndex + 1}:`);
            if (page.image) {
              console.log(`        Image: ${page.image}`);
            }
            if (page.backgroundImage) {
              console.log(`        Background Image: ${page.backgroundImage}`);
            }
            if (page.images) {
              console.log(`        Images Array: ${page.images}`);
            }
          });
        }
      }
    });

    // Check if there are any separate image tables
    console.log('\n📋 STEP 4: Looking for related image tables');
    const imageTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%image%' OR table_name LIKE '%media%' OR table_name LIKE '%asset%')
      ORDER BY table_name;
    `);
    
    console.log('Image-related tables:');
    imageTables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Let's check the design_data structure more deeply
    console.log('\n📋 STEP 5: Deep dive into design_data structure');
    const designDataSample = await client.query(`
      SELECT 
        id,
        title,
        design_data->'pages' as pages_data
      FROM sw_templates 
      WHERE design_data IS NOT NULL
      AND design_data->'pages' IS NOT NULL
      LIMIT 2;
    `);
    
    console.log('Design data pages structure:');
    designDataSample.rows.forEach((template, index) => {
      console.log(`\n  Template ${index + 1} (${template.title}):`);
      console.log(`    ID: ${template.id}`);
      if (template.pages_data && Array.isArray(template.pages_data)) {
        template.pages_data.forEach((page, pageIndex) => {
          console.log(`    Page ${pageIndex + 1}:`);
          console.log(`      Keys: ${Object.keys(page)}`);
          if (page.image) {
            console.log(`      Image: ${page.image}`);
          }
        });
      }
    });

    console.log('\n✅ Template image analysis completed!');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

checkTemplateImages().catch(console.error);
