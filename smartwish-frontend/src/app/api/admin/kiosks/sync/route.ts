/**
 * Admin API endpoint for triggering kiosk asset sync via WebSocket
 * 
 * POST /api/admin/kiosks/sync
 * Body: { kioskIds: string[] | "all" }
 * 
 * This broadcasts sync commands to kiosks via WebSocket (or stores in Supabase
 * for polling fallback if WebSocket is not available).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
    try {
        // Check authentication (admin only)
        const { authorized, session, error: authError } = await verifyAdmin();
        if (!authorized) return authError;

        // Parse request body
        const body = await request.json();
        const { kioskIds, command = 'sync_assets' }: { kioskIds: string[] | 'all'; command?: string } = body;

        if (!kioskIds) {
            return NextResponse.json(
                { success: false, error: 'kioskIds is required' },
                { status: 400 }
            );
        }

        // Validate command
        const validCommands = ['sync_assets', 'sync_stickers', 'sync_templates', 'clear_cache'];
        if (!validCommands.includes(command)) {
            return NextResponse.json(
                { success: false, error: `Invalid command. Valid commands: ${validCommands.join(', ')}` },
                { status: 400 }
            );
        }

        // Get target kiosk IDs
        let targetKioskIds: string[] = [];

        if (kioskIds === 'all') {
            // Fetch all active kiosk IDs from database
            const { data: kiosks, error } = await supabase
                .from('kiosk_configs')
                .select('kiosk_id')
                .eq('is_active', true);

            if (error) {
                console.error('[Admin Sync] Failed to fetch kiosks:', error);
                return NextResponse.json(
                    { success: false, error: 'Failed to fetch kiosk list' },
                    { status: 500 }
                );
            }

            targetKioskIds = kiosks?.map(k => k.kiosk_id) || [];
        } else {
            targetKioskIds = Array.isArray(kioskIds) ? kioskIds : [kioskIds];
        }

        if (targetKioskIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No kiosks found to sync' },
                { status: 404 }
            );
        }

        console.log(`[Admin Sync] Sending ${command} to ${targetKioskIds.length} kiosk(s):`, targetKioskIds);

        // Insert sync commands into database (kiosks poll this table or receive via WebSocket)
        const syncCommands = targetKioskIds.map(kioskId => ({
            kiosk_id: kioskId,
            command: command,
            status: 'pending',
            created_at: new Date().toISOString(),
            created_by: session.user?.email,
        }));

        const { data: insertedCommands, error: insertError } = await supabase
            .from('kiosk_sync_commands')
            .insert(syncCommands)
            .select();

        if (insertError) {
            console.error('[Admin Sync] Failed to create sync commands:', insertError);
            // If table doesn't exist, we'll still try WebSocket
            console.log('[Admin Sync] Continuing with WebSocket broadcast...');
        }

        // Try to broadcast via WebSocket to backend
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE || 'https://smartwish.onrender.com';

        try {
            const wsResponse = await fetch(`${backendUrl}/kiosk/broadcast-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    kioskIds: targetKioskIds,
                    command: command,
                }),
            });

            if (wsResponse.ok) {
                console.log('[Admin Sync] WebSocket broadcast successful');
            } else {
                console.warn('[Admin Sync] WebSocket broadcast failed, kiosks will poll for commands');
            }
        } catch (wsError) {
            console.warn('[Admin Sync] WebSocket broadcast error:', wsError);
            // Commands are in database, kiosks can poll
        }

        return NextResponse.json({
            success: true,
            message: `Sync command '${command}' sent to ${targetKioskIds.length} kiosk(s)`,
            kioskCount: targetKioskIds.length,
            kioskIds: targetKioskIds,
            commandIds: insertedCommands?.map(c => c.id) || [],
        });

    } catch (error) {
        console.error('[Admin Sync] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint to check sync command status
export async function GET(request: NextRequest) {
    try {
        const { authorized, error: authError } = await verifyAdmin();
        if (!authorized) return authError;

        const { searchParams } = new URL(request.url);
        const kioskId = searchParams.get('kioskId');
        const commandId = searchParams.get('commandId');

        let query = supabase
            .from('kiosk_sync_commands')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (kioskId) {
            query = query.eq('kiosk_id', kioskId);
        }
        if (commandId) {
            query = query.eq('id', commandId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Admin Sync] Failed to fetch sync commands:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch sync commands' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data || [],
        });

    } catch (error) {
        console.error('[Admin Sync] GET Error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
