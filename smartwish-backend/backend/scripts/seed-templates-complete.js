const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Sample data for seeding
const CATEGORIES = [
  {
    slug: 'birthday',
    name: 'birthday',
    display_name: 'Birthday Cards',
    description: 'Celebrate special birthdays with beautiful greeting cards',
    sort_order: 1,
    is_active: true
  },
  {
    slug: 'anniversary',
    name: 'anniversary',
    display_name: 'Anniversary Cards',
    description: 'Mark milestones and celebrate love with anniversary cards',
    sort_order: 2,
    is_active: true
  },
  {
    slug: 'wedding',
    name: 'wedding',
    display_name: 'Wedding Cards',
    description: 'Perfect cards for weddings and engagements',
    sort_order: 3,
    is_active: true
  },
  {
    slug: 'christmas',
    name: 'christmas',
    display_name: 'Christmas Cards',
    description: 'Spread holiday cheer with festive Christmas cards',
    sort_order: 4,
    is_active: true
  },
  {
    slug: 'valentine',
    name: 'valentine',
    display_name: 'Valentine Cards',
    description: 'Express love and affection with romantic Valentine cards',
    sort_order: 5,
    is_active: true
  },
  {
    slug: 'business',
    name: 'business',
    display_name: 'Business Cards',
    description: 'Professional cards for business and corporate occasions',
    sort_order: 6,
    is_active: true
  },
  {
    slug: 'sympathy',
    name: 'sympathy',
    display_name: 'Sympathy Cards',
    description: 'Thoughtful cards for difficult times',
    sort_order: 7,
    is_active: true
  },
  {
    slug: 'graduation',
    name: 'graduation',
    display_name: 'Graduation Cards',
    description: 'Celebrate academic achievements and milestones',
    sort_order: 8,
    is_active: true
  }
];

const SAMPLE_TEMPLATES = [
  {
    slug: 'birthday-celebration',
    title: 'Birthday Celebration',
    description: 'A vibrant and colorful birthday card perfect for any age',
    price: 2.99,
    language: 'en',
    region: 'US',
    status: 'published',
    popularity: 95,
    num_downloads: 1250,
    cover_image: 'https://example.com/birthday-celebration.jpg'
  },
  {
    slug: 'anniversary-love',
    title: 'Anniversary Love',
    description: 'Elegant anniversary card with romantic design',
    price: 3.99,
    language: 'en',
    region: 'US',
    status: 'published',
    popularity: 88,
    num_downloads: 890,
    cover_image: 'https://example.com/anniversary-love.jpg'
  },
  {
    slug: 'wedding-bells',
    title: 'Wedding Bells',
    description: 'Beautiful wedding card with classic design',
    price: 4.99,
    language: 'en',
    region: 'US',
    status: 'published',
    popularity: 92,
    num_downloads: 1100,
    cover_image: 'https://example.com/wedding-bells.jpg'
  },
  {
    slug: 'christmas-joy',
    title: 'Christmas Joy',
    description: 'Festive Christmas card with holiday spirit',
    price: 2.49,
    language: 'en',
    region: 'US',
    status: 'published',
    popularity: 98,
    num_downloads: 2100,
    cover_image: 'https://example.com/christmas-joy.jpg'
  },
  {
    slug: 'valentine-hearts',
    title: 'Valentine Hearts',
    description: 'Romantic Valentine card with heart design',
    price: 2.99,
    language: 'en',
    region: 'US',
    status: 'published',
    popularity: 90,
    num_downloads: 1500,
    cover_image: 'https://example.com/valentine-hearts.jpg'
  }
];

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  // Check environment variables
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Step 1: Seed categories
    console.log('\n📁 Seeding categories...');
    const categoryIds = {};
    
    for (const category of CATEGORIES) {
      const { data, error } = await supabase
        .from('sw_categories')
        .upsert(category, { onConflict: 'slug' })
        .select('id, slug')
        .single();

      if (error) {
        console.error(`❌ Error seeding category ${category.slug}:`, error);
        continue;
      }

      categoryIds[category.slug] = data.id;
      console.log(`✅ Category seeded: ${category.display_name} (${data.id})`);
    }

    // Step 2: Get default author
    console.log('\n👤 Getting default author...');
    const { data: authorData, error: authorError } = await supabase
      .from('sw_authors')
      .select('id')
      .limit(1)
      .single();

    if (authorError) {
      console.error('❌ Error getting author:', authorError);
      process.exit(1);
    }

    const defaultAuthorId = authorData.id;
    console.log(`✅ Using author: ${defaultAuthorId}`);

    // Step 3: Seed templates
    console.log('\n🎨 Seeding templates...');
    const templateIds = {};
    
    for (const template of SAMPLE_TEMPLATES) {
      // Determine category based on template slug
      let categoryId = null;
      for (const [slug, id] of Object.entries(categoryIds)) {
        if (template.slug.includes(slug)) {
          categoryId = id;
          break;
        }
      }

      const templateData = {
        ...template,
        category_id: categoryId,
        author_id: defaultAuthorId,
        published_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sw_templates')
        .upsert(templateData, { onConflict: 'slug' })
        .select('id, slug')
        .single();

      if (error) {
        console.error(`❌ Error seeding template ${template.slug}:`, error);
        continue;
      }

      templateIds[template.slug] = data.id;
      console.log(`✅ Template seeded: ${template.title} (${data.id})`);
    }

    // Step 4: Seed template pages
    console.log('\n📄 Seeding template pages...');
    for (const [slug, templateId] of Object.entries(templateIds)) {
      const pages = [
        {
          template_id: templateId,
          page_index: 0,
          header: `Front Cover - ${slug}`,
          text_content: 'Welcome to your special day!',
          image_path: `https://example.com/${slug}-page1.jpg`
        },
        {
          template_id: templateId,
          page_index: 1,
          header: 'Inside Message',
          text_content: 'Wishing you joy and happiness on this special occasion.',
          image_path: `https://example.com/${slug}-page2.jpg`
        }
      ];

      for (const page of pages) {
        const { error } = await supabase
          .from('sw_template_pages')
          .upsert(page, { onConflict: 'template_id,page_index' });

        if (error) {
          console.error(`❌ Error seeding page for ${slug}:`, error);
        }
      }
      console.log(`✅ Pages seeded for: ${slug}`);
    }

    // Step 5: Seed template keywords
    console.log('\n🔑 Seeding template keywords...');
    for (const [slug, templateId] of Object.entries(templateIds)) {
      const keywords = [slug, 'greeting', 'card', 'celebration'];
      
      for (const keyword of keywords) {
        const { error } = await supabase
          .from('sw_template_keywords')
          .upsert({
            template_id: templateId,
            keyword: keyword.toLowerCase()
          }, { onConflict: 'template_id,keyword' });

        if (error) {
          console.error(`❌ Error seeding keyword for ${slug}:`, error);
        }
      }
      console.log(`✅ Keywords seeded for: ${slug}`);
    }

    // Step 6: Seed template tags
    console.log('\n🏷️ Seeding template tags...');
    for (const [slug, templateId] of Object.entries(templateIds)) {
      // Get tag ID based on category
      let tagId = null;
      for (const [catSlug, catId] of Object.entries(categoryIds)) {
        if (slug.includes(catSlug)) {
          const { data: tagData } = await supabase
            .from('sw_tags')
            .select('id')
            .eq('name', catSlug)
            .single();
          
          if (tagData) {
            tagId = tagData.id;
            break;
          }
        }
      }

      if (tagId) {
        const { error } = await supabase
          .from('sw_template_tags')
          .upsert({
            template_id: templateId,
            tag_id: tagId
          }, { onConflict: 'template_id,tag_id' });

        if (error) {
          console.error(`❌ Error seeding tag for ${slug}:`, error);
        }
      }
      console.log(`✅ Tags seeded for: ${slug}`);
    }

    // Step 7: Create template versions
    console.log('\n📝 Creating template versions...');
    for (const [slug, templateId] of Object.entries(templateIds)) {
      const { error } = await supabase
        .from('sw_template_versions')
        .upsert({
          template_id: templateId,
          version_number: '1.0.0',
          changelog: 'Initial version',
          is_active: true
        }, { onConflict: 'template_id,version_number' });

      if (error) {
        console.error(`❌ Error creating version for ${slug}:`, error);
      }
    }
    console.log('✅ Template versions created');

    // Step 8: Summary
    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Categories: ${Object.keys(categoryIds).length}`);
    console.log(`   - Templates: ${Object.keys(templateIds).length}`);
    console.log(`   - Pages: ${Object.keys(templateIds).length * 2}`);
    console.log(`   - Keywords: ${Object.keys(templateIds).length * 4}`);
    console.log(`   - Tags: ${Object.keys(templateIds).length}`);
    console.log(`   - Versions: ${Object.keys(templateIds).length}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeding
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('\n✅ Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
