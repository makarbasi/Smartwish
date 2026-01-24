import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { KioskSyncGateway } from './kiosk-sync.gateway';

interface BroadcastSyncDto {
    kioskIds: string[];
    command: string;
    data?: any;
}

/**
 * Controller for broadcasting sync commands to kiosks via WebSocket
 * 
 * This endpoint is called by the frontend admin panel to trigger syncs on kiosks.
 */
@Controller('kiosk')
export class KioskBroadcastController {
    constructor(private readonly syncGateway: KioskSyncGateway) { }

    /**
     * Broadcast sync command to specified kiosks
     * 
     * POST /kiosk/broadcast-sync
     * Body: { kioskIds: string[], command: 'sync_assets'|'sync_stickers'|'sync_templates'|'clear_cache' }
     */
    @Post('broadcast-sync')
    @HttpCode(HttpStatus.OK)
    async broadcastSync(@Body() dto: BroadcastSyncDto) {
        const { kioskIds, command, data } = dto;

        if (!kioskIds || !Array.isArray(kioskIds) || kioskIds.length === 0) {
            return {
                success: false,
                error: 'kioskIds must be a non-empty array',
            };
        }

        if (!command) {
            return {
                success: false,
                error: 'command is required',
            };
        }

        // Validate command
        const validCommands = ['sync_assets', 'sync_stickers', 'sync_templates', 'clear_cache'];
        if (!validCommands.includes(command)) {
            return {
                success: false,
                error: `Invalid command. Valid commands: ${validCommands.join(', ')}`,
            };
        }

        console.log(`[BroadcastSync] Broadcasting ${command} to ${kioskIds.length} kiosk(s)`);

        const result = this.syncGateway.broadcastToKiosks(kioskIds, command, data);

        return {
            success: true,
            command,
            sent: result.sent,
            failed: result.failed,
            connectedKiosks: this.syncGateway.getConnectedKiosks(),
        };
    }

    /**
     * Get list of connected kiosks
     * 
     * POST /kiosk/connected
     */
    @Post('connected')
    @HttpCode(HttpStatus.OK)
    getConnected() {
        return {
            success: true,
            kiosks: this.syncGateway.getConnectedKiosks(),
        };
    }
}
