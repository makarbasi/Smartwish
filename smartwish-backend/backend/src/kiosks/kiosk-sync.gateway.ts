import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Injectable } from '@nestjs/common';

interface KioskSocket extends WebSocket {
    kioskId?: string;
    isAlive?: boolean;
}

/**
 * WebSocket Gateway for kiosk sync commands
 * 
 * Allows admin to broadcast sync commands to kiosks in real-time.
 * Kiosks connect to /ws/kiosk and authenticate with their kiosk ID.
 * 
 * Message Protocol:
 * - Auth: { type: 'auth', kioskId: string, apiKey?: string }
 * - Commands from server: { type: 'sync_assets'|'sync_stickers'|'sync_templates'|'clear_cache' }
 */
@Injectable()
@WebSocketGateway({
    path: '/ws/kiosk',
    cors: {
        origin: '*',
        credentials: true,
    },
})
export class KioskSyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // Map of kioskId -> connected socket
    private kioskSockets = new Map<string, KioskSocket>();

    constructor() {
        console.log('[KioskSyncGateway] Gateway initialized');
    }

    afterInit(server: Server) {
        console.log('[KioskSyncGateway] WebSocket server started at /ws/kiosk');

        // Override shouldHandle to accept /ws/kiosk and /ws/kiosk/* paths
        // This allows clients to connect with kioskId in the URL path
        const originalShouldHandle = (server as any).shouldHandle;
        (server as any).shouldHandle = (request: IncomingMessage) => {
            const url = request.url || '';
            if (url.startsWith('/ws/kiosk')) {
                console.log('[KioskSyncGateway] Accepting connection for:', url);
                return true;
            }
            return originalShouldHandle ? originalShouldHandle.call(server, request) : false;
        };

        // Heartbeat to detect dead connections
        setInterval(() => {
            this.server?.clients?.forEach((ws: KioskSocket) => {
                if (ws.isAlive === false) {
                    console.log('[KioskSyncGateway] Terminating dead connection');
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    handleConnection(client: KioskSocket, request: IncomingMessage) {
        client.isAlive = true;
        client.on('pong', () => {
            client.isAlive = true;
        });

        // Parse kioskId from URL path (e.g., /ws/kiosk/my-kiosk-id)
        const url = request.url || '';
        const pathMatch = url.match(/\/ws\/kiosk\/([^/?]+)/);
        if (pathMatch) {
            const kioskId = decodeURIComponent(pathMatch[1]);
            this.registerKiosk(client, kioskId);
        }

        console.log('[KioskSyncGateway] New connection from:', request.socket?.remoteAddress);

        // Handle messages
        client.on('message', (data: Buffer | string) => {
            this.handleMessage(client, data);
        });
    }

    handleDisconnect(client: KioskSocket) {
        if (client.kioskId) {
            this.kioskSockets.delete(client.kioskId);
            console.log(`[KioskSyncGateway] Kiosk disconnected: ${client.kioskId}`);
        }
    }

    private handleMessage(client: KioskSocket, data: Buffer | string) {
        try {
            const message = JSON.parse(data.toString());
            console.log('[KioskSyncGateway] Message received:', message.type);

            if (message.type === 'auth' && message.kioskId) {
                this.registerKiosk(client, message.kioskId);
            }
        } catch (e) {
            console.log('[KioskSyncGateway] Invalid message received');
        }
    }

    private registerKiosk(client: KioskSocket, kioskId: string) {
        client.kioskId = kioskId;

        // Replace existing connection for this kiosk
        const existingSocket = this.kioskSockets.get(kioskId);
        if (existingSocket && existingSocket !== client) {
            existingSocket.close();
        }

        this.kioskSockets.set(kioskId, client);
        console.log(`[KioskSyncGateway] Kiosk registered: ${kioskId}`);

        client.send(JSON.stringify({
            type: 'connected',
            kioskId,
            message: 'Connected to sync service'
        }));
    }

    /**
     * Send sync command to a specific kiosk
     */
    sendToKiosk(kioskId: string, command: string, data?: any): boolean {
        const socket = this.kioskSockets.get(kioskId);
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: command, data }));
            console.log(`[KioskSyncGateway] Sent ${command} to ${kioskId}`);
            return true;
        }
        return false;
    }

    /**
     * Broadcast sync command to multiple kiosks
     */
    broadcastToKiosks(kioskIds: string[], command: string, data?: any): { sent: string[]; failed: string[] } {
        const sent: string[] = [];
        const failed: string[] = [];

        for (const kioskId of kioskIds) {
            if (this.sendToKiosk(kioskId, command, data)) {
                sent.push(kioskId);
            } else {
                failed.push(kioskId);
            }
        }

        console.log(`[KioskSyncGateway] Broadcast ${command}: ${sent.length} sent, ${failed.length} failed`);
        return { sent, failed };
    }

    /**
     * Broadcast sync command to ALL connected kiosks
     */
    broadcastToAll(command: string, data?: any): { sent: string[]; failed: string[] } {
        const kioskIds = Array.from(this.kioskSockets.keys());
        return this.broadcastToKiosks(kioskIds, command, data);
    }

    /**
     * Get list of connected kiosk IDs
     */
    getConnectedKiosks(): string[] {
        return Array.from(this.kioskSockets.keys());
    }

    /**
     * Check if a kiosk is connected
     */
    isKioskConnected(kioskId: string): boolean {
        const socket = this.kioskSockets.get(kioskId);
        return socket?.readyState === WebSocket.OPEN;
    }
}
