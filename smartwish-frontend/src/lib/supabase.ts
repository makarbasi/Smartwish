'use client';

import { createClient } from '@supabase/supabase-js';

// For client-side usage, Next.js requires NEXT_PUBLIC_ prefix
// Add these to your frontend .env.local:
// NEXT_PUBLIC_SUPABASE_URL=https://kfitmirodgoduifcsyug.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single instance of the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type for the kiosk_configs table
export interface KioskConfigRow {
  id: string;
  kiosk_id: string;
  store_id: string | null;
  name: string | null;
  api_key: string;
  config: Record<string, unknown>;
  version: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
