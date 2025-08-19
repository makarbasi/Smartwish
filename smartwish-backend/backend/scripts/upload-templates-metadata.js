/*
 Upload SmartWish templates/categories metadata to Supabase Storage

 Requirements:
 - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment (or backend/.env)
 - Bucket: smartwish-assets
 - Target path: templates/metadata/templates.json
*/

/* eslint-disable @typescript-eslint/no-var-requires */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load env from .env if available
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

// Import shared templates/categories from compiled JS
const { pathToFileURL } = require('url');
// Prefer compiled shared module to avoid ESM/CJS mismatches
const sharedModulePath = path.resolve(__dirname, '../dist/shared/constants/templates.js');

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Build metadata JSON (load shared ESM module dynamically)
  const shared = await import(pathToFileURL(sharedModulePath).href);
  const templates = shared.getAllTemplates();
  const categories = shared.getAllCategories();

  const metadata = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    templates,
    categories,
    themes: [],
    marketplace: [],
    migrationInfo: {
      source: 'shared/constants/templates.ts',
      generatedAt: new Date().toISOString(),
    },
  };

  const buffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
  const targetPath = 'templates/metadata/templates.json';

  console.log('Uploading metadata to Supabase Storage...');
  const { error } = await supabase.storage
    .from('smartwish-assets')
    .upload(targetPath, buffer, {
      contentType: 'application/json',
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Upload failed:', error.message);
    process.exit(1);
  }

  const { data: urlData } = supabase.storage
    .from('smartwish-assets')
    .getPublicUrl(targetPath);

  console.log('✅ Uploaded templates metadata');
  console.log('Public URL:', urlData.publicUrl);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});


