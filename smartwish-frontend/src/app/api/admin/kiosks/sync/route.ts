/**
 * Admin API endpoint for triggering kiosk asset sync via WebSocket
 * 
 * POST /api/admin/kiosks/sync
 * Body: { kioskIds: string[] | "all" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
    console.log('[Admin Sync] POST request received');

    try {
        // Check authentication (admin only)
        console.log('[Admin Sync] Checking authentication...');
        const { authorized, error: authError } = await verifyAdmin();

        if (!authorized) {
            console.log('[Admin Sync] Not authorized');
            return authError;
        }

        console.log('[Admin Sync] Authorized, parsing body...');

        // Parse request body
        const body = await request.json();
        const { kioskIds, command = 'sync_assets' } = body;

        if (!kioskIds) {
            return NextResponse.json(
                { success: false, error: 'kioskIds is required' },
                { status: 400 }
            );
        }

        // For now, just return success for testing
        console.log(`[Admin Sync] Received request for kioskIds:`, kioskIds, 'command:', command);

        // Call backend to broadcast via WebSocket
        const backendUrl = process.env.NEXT_PUBLIC_API_BASE ||
            (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'https://smartwish.onrender.com');

        console.log(`[Admin Sync] Calling backend at ${backendUrl}/kiosk/broadcast-sync`);

        let wsResult = { sent: [] as string[], failed: [] as string[] };

        try {
            const wsResponse = await fetch(`${backendUrl}/kiosk/broadcast-sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    kioskIds: Array.isArray(kioskIds) ? kioskIds : [kioskIds],
                    command: command,
                }),
            });

            console.log(`[Admin Sync] Backend response status: ${wsResponse.status}`);

            if (wsResponse.ok) {
                const result = await wsResponse.json();
                wsResult = { sent: result.sent || [], failed: result.failed || [] };
                console.log('[Admin Sync] WebSocket broadcast successful:', wsResult);
            } else {
                const errorText = await wsResponse.text();
                console.warn('[Admin Sync] WebSocket broadcast failed:', errorText);
            }
        } catch (wsError) {
            console.warn('[Admin Sync] WebSocket broadcast error:', wsError);
        }

        return NextResponse.json({
            success: true,
            message: `Sync command '${command}' sent`,
            sent: wsResult.sent,
            failed: wsResult.failed,
        });

    } catch (error) {
        console.error('[Admin Sync] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'Sync endpoint is working'
    });
}
