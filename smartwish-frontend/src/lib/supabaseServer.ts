/**
 * Server-side Supabase client for API routes
 * Use this in API routes instead of the client-side supabase.ts
 * Uses service role key when available to bypass RLS for server-side operations
 */

import { createClient } from '@supabase/supabase-js';

// Support both naming conventions for environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Log which env vars are being used (helpful for debugging)
console.log('[SupabaseServer] Environment loaded:', {
  url: supabaseUrl ? supabaseUrl.substring(0, 40) + '...' : 'MISSING',
  serviceRoleKey: supabaseServiceRoleKey ? 'SET (' + supabaseServiceRoleKey.length + ' chars)' : 'MISSING',
  anonKey: supabaseAnonKey ? 'SET (' + supabaseAnonKey.length + ' chars)' : 'MISSING',
});

if (!supabaseUrl) {
  console.error('[SupabaseServer] ❌ Missing SUPABASE_URL - Supabase will not work!');
}

// Prefer service role key for server-side operations (bypasses RLS)
// Fall back to anon key if service role is not available
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseKey) {
  console.error('[SupabaseServer] ❌ Missing both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY');
}

if (supabaseServiceRoleKey) {
  console.log('[SupabaseServer] ✅ Using SERVICE ROLE key (bypasses RLS)');
} else if (supabaseAnonKey) {
  console.warn('[SupabaseServer] ⚠️ Using ANON key (may be blocked by RLS policies)');
}

// Create a server-side Supabase client
export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // No session persistence needed on server
  },
});
