import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabaseServer';

/**
 * GET /api/kiosk/chat/test
 * Diagnostic endpoint to check chat system setup
 */
export async function GET(request: NextRequest) {
  const diagnostics: Record<string, any> = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    timestamp: new Date().toISOString(),
  };

  try {
    // Test 1: Check if table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('kiosk_chat_messages')
      .select('id')
      .limit(1);

    diagnostics.tableExists = !tableError;
    diagnostics.tableError = tableError?.message || null;

    // Test 2: Try to query kiosk_configs
    const { data: kioskCheck, error: kioskError } = await supabase
      .from('kiosk_configs')
      .select('kiosk_id')
      .limit(1);

    diagnostics.kioskConfigsAccessible = !kioskError;
    diagnostics.kioskConfigsError = kioskError?.message || null;

    // Test 3: Check if we can insert (will rollback)
    const testKioskId = 'test_diagnostic_' + Date.now();
    const { error: insertError } = await supabase
      .from('kiosk_chat_messages')
      .insert({
        kiosk_id: testKioskId,
        sender_type: 'kiosk',
        message: 'test',
      });

    diagnostics.canInsert = !insertError;
    diagnostics.insertError = insertError?.message || null;

    // Clean up test insert if it succeeded
    if (!insertError) {
      await supabase
        .from('kiosk_chat_messages')
        .delete()
        .eq('kiosk_id', testKioskId);
    }

    return NextResponse.json({
      success: true,
      diagnostics,
    });
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      diagnostics,
    });
  }
}
