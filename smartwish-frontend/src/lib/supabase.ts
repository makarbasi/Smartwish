'use client';

import { createClient } from '@supabase/supabase-js';

// Support both naming conventions
// Note: For browser/client-side, only NEXT_PUBLIC_ prefixed vars are accessible
// The non-prefixed fallback only works during SSR
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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
