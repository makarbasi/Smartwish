import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { SurveillanceService } from './surveillance.service';

interface AuthenticatedSocket extends WebSocket {
  kioskId?: string;
  isKiosk?: boolean;
  isViewer?: boolean;
  viewingKioskId?: string;
  isAlive?: boolean;
}

/**
 * WebSocket Gateway for real-time surveillance video streaming
 * 
 * Architecture:
 * - Kiosks connect and send binary frame data
 * - Admin viewers connect and subscribe to specific kiosk feeds
 * - Gateway relays frames from kiosk to all subscribed viewers
 * 
 * Message Protocol:
 * - Kiosk authentication: { type: 'auth', kioskId: string, apiKey: string }
 * - Viewer subscription: { type: 'subscribe', kioskId: string }
 * - Kiosk sends frames as binary data after authentication
 * - Viewers receive binary frames for subscribed kiosk
 */
@WebSocketGateway({
  path: '/ws/surveillance',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class SurveillanceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map of kioskId -> connected kiosk socket
  private kioskSockets = new Map<string, AuthenticatedSocket>();
  
  // Map of kioskId -> Set of viewer sockets watching that kiosk
  private viewers = new Map<string, Set<AuthenticatedSocket>>();
  
  // Stats for monitoring
  private stats = {
    totalKiosks: 0,
    totalViewers: 0,
    framesRelayed: 0,
  };

  constructor(private readonly surveillanceService: SurveillanceService) {
    // Heartbeat to detect dead connections
    setInterval(() => {
      this.server?.clients?.forEach((ws: AuthenticatedSocket) => {
        if (ws.isAlive === false) {
          console.log('[SurveillanceWS] Terminating dead connection');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleConnection(client: AuthenticatedSocket) {
    client.isAlive = true;
    client.on('pong', () => {
      client.isAlive = true;
    });
    
    console.log('[SurveillanceWS] New connection');
  }

  handleDisconnect(client: AuthenticatedSocket) {
    // Clean up kiosk connection
    if (client.isKiosk && client.kioskId) {
      this.kioskSockets.delete(client.kioskId);
      this.stats.totalKiosks--;
      console.log(`[SurveillanceWS] Kiosk disconnected: ${client.kioskId}`);
    }
    
    // Clean up viewer connection
    if (client.isViewer && client.viewingKioskId) {
      const kioskId = client.viewingKioskId;
      const viewerSet = this.viewers.get(kioskId);
      if (viewerSet) {
        viewerSet.delete(client);
        
        // If no more viewers, tell kiosk to stop streaming
        if (viewerSet.size === 0) {
          this.viewers.delete(kioskId);
          
          // Notify kiosk to stop streaming (save resources)
          const kioskSocket = this.kioskSockets.get(kioskId);
          if (kioskSocket?.readyState === WebSocket.OPEN) {
            console.log(`[SurveillanceWS] No more viewers for ${kioskId}, telling kiosk to stop streaming`);
            kioskSocket.send(JSON.stringify({ type: 'stop_streaming' }));
          }
        }
      }
      this.stats.totalViewers--;
      console.log(`[SurveillanceWS] Viewer disconnected from: ${kioskId} (remaining viewers: ${viewerSet?.size || 0})`);
    }
  }

  /**
   * Handle kiosk authentication
   * Kiosk sends: { type: 'auth', kioskId: string, apiKey: string }
   */
  @SubscribeMessage('auth')
  async handleKioskAuth(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { kioskId: string; apiKey: string },
  ) {
    const { kioskId, apiKey } = data;
    
    if (!kioskId || !apiKey) {
      client.send(JSON.stringify({ type: 'error', message: 'Missing kioskId or apiKey' }));
      return;
    }

    // Validate API key
    const isValid = await this.surveillanceService.validateKioskApiKey(kioskId, apiKey);
    if (!isValid) {
      client.send(JSON.stringify({ type: 'error', message: 'Invalid API key' }));
      client.close();
      return;
    }

    // Mark as authenticated kiosk
    client.kioskId = kioskId;
    client.isKiosk = true;
    
    // Replace existing connection for this kiosk
    const existingSocket = this.kioskSockets.get(kioskId);
    if (existingSocket && existingSocket !== client) {
      existingSocket.close();
    }
    
    this.kioskSockets.set(kioskId, client);
    this.stats.totalKiosks++;
    
    console.log(`[SurveillanceWS] Kiosk authenticated: ${kioskId}`);
    client.send(JSON.stringify({ type: 'auth_success', kioskId }));
  }

  /**
   * Handle viewer subscription
   * Viewer sends: { type: 'subscribe', kioskId: string }
   */
  @SubscribeMessage('subscribe')
  handleViewerSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { kioskId: string },
  ) {
    const { kioskId } = data;
    
    if (!kioskId) {
      client.send(JSON.stringify({ type: 'error', message: 'Missing kioskId' }));
      return;
    }

    // Mark as viewer
    client.isViewer = true;
    client.viewingKioskId = kioskId;
    
    // Track if this is the first viewer for this kiosk
    const hadViewers = this.viewers.has(kioskId) && this.viewers.get(kioskId)!.size > 0;
    
    // Add to viewers set for this kiosk
    if (!this.viewers.has(kioskId)) {
      this.viewers.set(kioskId, new Set());
    }
    this.viewers.get(kioskId)!.add(client);
    this.stats.totalViewers++;
    
    // Check if kiosk is currently connected
    const kioskSocket = this.kioskSockets.get(kioskId);
    const kioskConnected = kioskSocket?.readyState === WebSocket.OPEN;
    
    // If this is the first viewer, tell the kiosk to start streaming
    if (!hadViewers && kioskConnected) {
      console.log(`[SurveillanceWS] First viewer for ${kioskId}, telling kiosk to start streaming`);
      kioskSocket!.send(JSON.stringify({ type: 'start_streaming' }));
    }
    
    console.log(`[SurveillanceWS] Viewer subscribed to: ${kioskId} (kiosk ${kioskConnected ? 'online' : 'offline'}, viewers: ${this.viewers.get(kioskId)!.size})`);
    client.send(JSON.stringify({ 
      type: 'subscribed', 
      kioskId,
      kioskOnline: kioskConnected,
    }));
  }

  /**
   * Handle binary frame data from kiosk
   * Kiosk sends raw binary JPEG data after authentication
   */
  @SubscribeMessage('frame')
  handleFrame(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() frameData: Buffer,
  ) {
    if (!client.isKiosk || !client.kioskId) {
      return; // Ignore frames from non-authenticated clients
    }

    const kioskId = client.kioskId;
    const viewerSet = this.viewers.get(kioskId);
    
    if (!viewerSet || viewerSet.size === 0) {
      return; // No viewers, don't process
    }

    // Relay frame to all viewers
    let sentCount = 0;
    viewerSet.forEach((viewer) => {
      if (viewer.readyState === WebSocket.OPEN) {
        try {
          viewer.send(frameData);
          sentCount++;
        } catch (err) {
          // Viewer disconnected
        }
      }
    });

    if (sentCount > 0) {
      this.stats.framesRelayed++;
    }
  }

  /**
   * Handle raw binary messages (frames sent directly as binary)
   */
  handleMessage(client: AuthenticatedSocket, data: Buffer | string) {
    // If it's binary data and client is authenticated kiosk, treat as frame
    if (Buffer.isBuffer(data) && client.isKiosk && client.kioskId) {
      this.handleFrame(client, data);
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      ...this.stats,
      connectedKiosks: Array.from(this.kioskSockets.keys()),
      viewerCounts: Object.fromEntries(
        Array.from(this.viewers.entries()).map(([k, v]) => [k, v.size])
      ),
    };
  }

  /**
   * Check if a kiosk is connected
   */
  isKioskConnected(kioskId: string): boolean {
    const socket = this.kioskSockets.get(kioskId);
    return socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get viewer count for a kiosk
   */
  getViewerCount(kioskId: string): number {
    return this.viewers.get(kioskId)?.size || 0;
  }
}
