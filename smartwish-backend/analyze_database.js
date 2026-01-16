import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'aws-0-us-west-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.bvpkdwgghfwlgrjpklts',
  password: 'Amin123456789',
  ssl: { rejectUnauthorized: false }
});

async function analyzeDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to Supabase successfully!');
    
    // First, let's check what tables exist
    console.log('\n=== CHECKING EXISTING TABLES ===');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sw_categories', 'sw_templates', 'categories', 'templates')
      ORDER BY table_name;
    `);
    
    console.log('Found tables:', tablesResult.rows.map(r => r.table_name));
    
    // Check sw_categories structure and data
    if (tablesResult.rows.some(r => r.table_name === 'sw_categories')) {
      console.log('\n=== SW_CATEGORIES TABLE STRUCTURE ===');
      const categoriesStructure = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'sw_categories' 
        ORDER BY ordinal_position;
      `);
      console.log('Categories columns:', categoriesStructure.rows);
      
      console.log('\n=== SW_CATEGORIES DATA (ALL RECORDS) ===');
      const categoriesData = await client.query('SELECT * FROM sw_categories ORDER BY created_at');
      console.log('Total categories:', categoriesData.rows.length);
      categoriesData.rows.forEach((row, index) => {
        console.log(`Category ${index + 1}:`, row);
      });
    }
    
    // Check sw_templates structure and data
    if (tablesResult.rows.some(r => r.table_name === 'sw_templates')) {
      console.log('\n=== SW_TEMPLATES TABLE STRUCTURE ===');
      const templatesStructure = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'sw_templates' 
        ORDER BY ordinal_position;
      `);
      console.log('Templates columns:', templatesStructure.rows);
      
      console.log('\n=== SW_TEMPLATES DATA (ALL RECORDS) ===');
      const templatesData = await client.query('SELECT * FROM sw_templates ORDER BY created_at');
      console.log('Total templates:', templatesData.rows.length);
      templatesData.rows.forEach((row, index) => {
        console.log(`Template ${index + 1}:`, row);
      });
      
      // Check the relationship between templates and categories
      console.log('\n=== TEMPLATE-CATEGORY RELATIONSHIPS ===');
      const relationshipData = await client.query(`
        SELECT 
          t.id as template_id,
          t.title as template_title,
          t.category_id,
          c.name as category_name,
          c.id as actual_category_id
        FROM sw_templates t
        LEFT JOIN sw_categories c ON t.category_id = c.id
        ORDER BY t.created_at;
      `);
      console.log('Template-Category relationships:');
      relationshipData.rows.forEach((row, index) => {
        console.log(`Relationship ${index + 1}:`, row);
      });
    }
    
    // Also check if there are any other template-related tables
    console.log('\n=== CHECKING ALL TEMPLATE-RELATED TABLES ===');
    const allTablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%template%' OR table_name LIKE '%category%' OR table_name LIKE '%author%')
      ORDER BY table_name;
    `);
    console.log('All template-related tables:', allTablesResult.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeDatabase();
