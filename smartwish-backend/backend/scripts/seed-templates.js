/*
 Seed templates and categories into Supabase tables from shared/constants/templates

 Tables:
 - sw_categories(id, name, display_name, description, cover_image, sort_order)
 - sw_templates(id, title, category, description, search_keywords[], upload_time, author, price, language, region, popularity, num_downloads, pages jsonb)
*/

/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { pathToFileURL } = require('url');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function loadShared() {
  const esm = await import(
    pathToFileURL(path.resolve(__dirname, '../dist/shared/constants/templates.js')).href
  );
  return esm;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const shared = await loadShared();

  const categories = shared.getAllCategories();
  const templates = shared.getAllTemplates();

  console.log(`Seeding ${categories.length} categories...`);
  for (const c of categories) {
    const payload = {
      id: c.id,
      name: c.name || c.id,
      display_name: c.displayName || c.name || c.id,
      description: c.description || null,
      cover_image: c.coverImage || null,
      sort_order: c.sortOrder ?? 0,
    };
    const { error } = await supabase.from('sw_categories').upsert(payload);
    if (error) {
      console.error('Category upsert error:', c.id, error.message);
      process.exit(1);
    }
  }

  console.log(`Seeding ${templates.length} templates...`);
  for (const t of templates) {
    const payload = {
      id: t.id,
      title: t.title,
      category: t.category,
      description: t.description,
      search_keywords: t.searchKeywords || [],
      upload_time: t.upload_time ? new Date(t.upload_time).toISOString() : null,
      author: t.author || null,
      price: t.price ?? null,
      language: t.language || null,
      region: t.region || null,
      popularity: t.popularity ?? null,
      num_downloads: t.num_downloads ?? null,
      pages: t.pages,
    };
    const { error } = await supabase.from('sw_templates').upsert(payload);
    if (error) {
      console.error('Template upsert error:', t.id, error.message);
      process.exit(1);
    }
  }

  console.log('✅ Seeding completed');
}

main().catch((e) => {
  console.error('Seeding failed:', e);
  process.exit(1);
});


