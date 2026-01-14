/**
 * Server-side Supabase client for API routes
 * Use this in API routes instead of the client-side supabase.ts
 * Uses service role key when available to bypass RLS for server-side operations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.warn('[SupabaseServer] Missing NEXT_PUBLIC_SUPABASE_URL');
}

// Prefer service role key for server-side operations (bypasses RLS)
// Fall back to anon key if service role is not available
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseKey) {
  console.warn('[SupabaseServer] Missing both SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (supabaseServiceRoleKey) {
  console.log('[SupabaseServer] Using service role key (bypasses RLS)');
} else {
  console.warn('[SupabaseServer] Using anon key (may be blocked by RLS policies)');
}

// Create a server-side Supabase client
export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // No session persistence needed on server
  },
});
