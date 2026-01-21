import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { SurveillanceService } from './surveillance.service';
import { IncomingMessage } from 'http';

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
 * Message Protocol (JSON):
 * - Kiosk authentication: { event: 'auth', data: { kioskId: string, apiKey: string } }
 * - Viewer subscription: { event: 'subscribe', data: { kioskId: string } }
 * - Kiosk frame: { event: 'frame' } followed by binary data
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
    console.log('[SurveillanceWS] Gateway initialized');
  }

  afterInit() {
    console.log('[SurveillanceWS] WebSocket server started at /ws/surveillance');
    
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

  handleConnection(client: AuthenticatedSocket, request: IncomingMessage) {
    client.isAlive = true;
    client.on('pong', () => {
      client.isAlive = true;
    });
    
    console.log('[SurveillanceWS] New connection from:', request.socket?.remoteAddress);
    
    // Handle all messages manually (raw ws adapter doesn't use decorators well)
    client.on('message', (data: Buffer | string) => {
      this.handleMessage(client, data);
    });
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
   * Handle all incoming messages (JSON or binary)
   */
  private async handleMessage(client: AuthenticatedSocket, data: Buffer | string) {
    // Binary data = frame from authenticated kiosk
    if (Buffer.isBuffer(data)) {
      if (client.isKiosk && client.kioskId) {
        this.handleFrame(client, data);
      }
      return;
    }

    // Try to parse JSON message
    try {
      const message = JSON.parse(data.toString());
      const event = message.event;
      const payload = message.data || {};

      switch (event) {
        case 'auth':
          await this.handleKioskAuth(client, payload);
          break;
        case 'subscribe':
          this.handleViewerSubscribe(client, payload);
          break;
        case 'frame':
          // Frame event followed by binary - binary will come as next message
          // Some clients send event + binary separately
          break;
        default:
          console.log(`[SurveillanceWS] Unknown event: ${event}`);
      }
    } catch (e) {
      // Not JSON - could be binary frame or invalid message
      console.log('[SurveillanceWS] Non-JSON message received');
    }
  }

  /**
   * Handle kiosk authentication
   */
  private async handleKioskAuth(
    client: AuthenticatedSocket,
    data: { kioskId: string; apiKey: string },
  ) {
    const { kioskId, apiKey } = data;
    
    if (!kioskId || !apiKey) {
      client.send(JSON.stringify({ type: 'error', message: 'Missing kioskId or apiKey' }));
      return;
    }

    console.log(`[SurveillanceWS] Auth attempt from kiosk: ${kioskId}`);

    // Validate API key
    const isValid = await this.surveillanceService.validateKioskApiKey(kioskId, apiKey);
    if (!isValid) {
      console.log(`[SurveillanceWS] Invalid API key for kiosk: ${kioskId}`);
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
    
    // Check if there are already viewers waiting
    const viewerSet = this.viewers.get(kioskId);
    if (viewerSet && viewerSet.size > 0) {
      console.log(`[SurveillanceWS] ${viewerSet.size} viewers waiting for ${kioskId}, starting stream`);
      client.send(JSON.stringify({ type: 'start_streaming' }));
    }
  }

  /**
   * Handle viewer subscription
   */
  private handleViewerSubscribe(
    client: AuthenticatedSocket,
    data: { kioskId: string },
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
   */
  private handleFrame(client: AuthenticatedSocket, frameData: Buffer) {
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
      
      // Log every 100 frames
      if (this.stats.framesRelayed % 100 === 0) {
        console.log(`[SurveillanceWS] Relayed ${this.stats.framesRelayed} frames total`);
      }
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
