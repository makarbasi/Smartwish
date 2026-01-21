/**
 * DEVICE PAIRING SERVER
 * 
 * Runs a local HTTP server that allows the manager dashboard
 * to pair this device with a specific kiosk.
 * 
 * Flow:
 * 1. Local agent starts this server on port 8766
 * 2. Opens browser to /manager page
 * 3. Manager logs in and selects a kiosk
 * 4. Frontend calls localhost:8766/pair with the kiosk details
 * 5. This saves the pairing and the local agent can start
 */

import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAIRING_FILE = path.join(__dirname, 'device-pairing.json');
const PAIRING_PORT = 8766;

export class DevicePairingServer {
  constructor(options = {}) {
    this.port = options.port || PAIRING_PORT;
    this.onPaired = options.onPaired || (() => {});
    this.server = null;
    this.pairing = null;
    this.surveillanceManager = options.surveillanceManager || null;
  }

  /**
   * Load existing pairing from file
   */
  async loadPairing() {
    try {
      const data = await fs.readFile(PAIRING_FILE, 'utf-8');
      this.pairing = JSON.parse(data);
      console.log(`  📱 Loaded device pairing: ${this.pairing.kioskId}`);
      return this.pairing;
    } catch (err) {
      console.log('  📱 No existing device pairing found');
      return null;
    }
  }

  /**
   * Save pairing to file
   */
  async savePairing(pairing) {
    this.pairing = pairing;
    await fs.writeFile(PAIRING_FILE, JSON.stringify(pairing, null, 2), 'utf-8');
    console.log(`  📱 Device pairing saved: ${pairing.kioskId}`);
  }

  /**
   * Start the pairing HTTP server
   */
  start() {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        // CORS headers for local requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost:${this.port}`);

        // GET /status - Check if device is paired
        if (req.method === 'GET' && url.pathname === '/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            paired: !!this.pairing,
            kioskId: this.pairing?.kioskId || null,
            kioskName: this.pairing?.kioskName || null,
            pairedAt: this.pairing?.pairedAt || null,
          }));
          return;
        }

        // GET /pairing - Get full pairing details
        if (req.method === 'GET' && url.pathname === '/pairing') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.pairing || {}));
          return;
        }

        // POST /session/recording/start - Start session recording
        if (req.method === 'POST' && url.pathname === '/session/recording/start') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { sessionId, kioskConfig } = data;
              
              if (!sessionId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'sessionId is required' }));
                return;
              }
              
              if (this.surveillanceManager) {
                await this.surveillanceManager.startSessionRecording(sessionId, kioskConfig || {});
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Recording started' }));
              } else {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Surveillance manager not available' }));
              }
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // POST /session/recording/stop - Stop session recording
        if (req.method === 'POST' && url.pathname === '/session/recording/stop') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const { sessionId } = data;
              
              if (!sessionId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'sessionId is required' }));
                return;
              }
              
              if (this.surveillanceManager) {
                await this.surveillanceManager.stopSessionRecording(sessionId);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Recording stopped' }));
              } else {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Surveillance manager not available' }));
              }
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // POST /pair - Pair device with a kiosk
        if (req.method === 'POST' && url.pathname === '/pair') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              
              if (!data.kioskId || !data.apiKey) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing kioskId or apiKey' }));
                return;
              }

              const pairing = {
                kioskId: data.kioskId,
                kioskName: data.kioskName || data.kioskId,
                apiKey: data.apiKey,
                storeId: data.storeId || null,
                config: data.config || {},
                pairedAt: new Date().toISOString(),
                pairedBy: data.pairedBy || 'unknown',
              };

              await this.savePairing(pairing);
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, kioskId: pairing.kioskId }));

              // Notify callback
              this.onPaired(pairing);
              
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
          return;
        }

        // POST /unpair - Remove pairing
        if (req.method === 'POST' && url.pathname === '/unpair') {
          try {
            await fs.unlink(PAIRING_FILE);
            this.pairing = null;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'No pairing to remove' }));
          }
          return;
        }

        // 404 for unknown routes
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      this.server.listen(this.port, () => {
        console.log(`  🔗 Device pairing server (LOCAL): http://localhost:${this.port}`);
        resolve(this.server);
      });
    });
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Open browser to manager page
   */
  openManagerPage(baseUrl) {
    // Use provided URL or default to production
    const frontendUrl = baseUrl || 'https://app.smartwish.us';
    const managerUrl = `${frontendUrl}/manager?pair=true&port=${this.port}`;
    console.log(`  🌐 Opening browser to: ${managerUrl}`);
    
    // Open browser based on platform
    const platform = process.platform;
    let command;
    
    if (platform === 'win32') {
      command = `start "" "${managerUrl}"`;
    } else if (platform === 'darwin') {
      command = `open "${managerUrl}"`;
    } else {
      command = `xdg-open "${managerUrl}"`;
    }
    
    exec(command, (err) => {
      if (err) {
        console.log(`  ⚠️ Could not open browser automatically`);
        console.log(`  📋 Please open this URL manually: ${managerUrl}`);
      }
    });
  }
}

/**
 * Fetch kiosk configuration from cloud
 */
export async function fetchKioskConfig(serverUrl, kioskId, apiKey) {
  try {
    // First try the specific endpoint for pairing
    let response = await fetch(`${serverUrl}/local-agent/kiosk-config/${kioskId}`, {
      headers: {
        'x-kiosk-api-key': apiKey,
      },
    });

    if (response.ok) {
      const kiosk = await response.json();
      if (kiosk && !kiosk.error) {
        return kiosk;
      }
    }

    // Fallback to the general printer config endpoint
    response = await fetch(`${serverUrl}/local-agent/printer-config`, {
      headers: {
        'x-kiosk-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const kiosks = await response.json();
    const kiosk = kiosks.find(k => k.kioskId === kioskId);
    
    if (!kiosk) {
      throw new Error(`Kiosk ${kioskId} not found`);
    }

    return kiosk;
  } catch (err) {
    console.error(`  ❌ Failed to fetch kiosk config: ${err.message}`);
    return null;
  }
}

export default DevicePairingServer;
