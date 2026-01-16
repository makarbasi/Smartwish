/**
 * SURVEILLANCE MANAGER
 * 
 * Manages the Python surveillance process for people counting.
 * Spawns, monitors, and restarts the process as needed.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SurveillanceManager {
  constructor(config = {}) {
    this.config = {
      kioskId: config.kioskId || process.env.KIOSK_ID || 'default-kiosk',
      serverUrl: config.serverUrl || process.env.CLOUD_SERVER_URL || 'https://smartwish.onrender.com',
      apiKey: config.apiKey || process.env.KIOSK_API_KEY || '',
      webcamIndex: config.webcamIndex ?? parseInt(process.env.SURVEILLANCE_WEBCAM || '0', 10),
      pythonPath: config.pythonPath || process.env.PYTHON_PATH || 'python',
      dwellThreshold: config.dwellThreshold ?? 8,
      frameThreshold: config.frameThreshold ?? 10,
      httpPort: config.httpPort ?? parseInt(process.env.SURVEILLANCE_PORT || '8765', 10),
      showPreview: config.showPreview ?? false,
      autoRestart: config.autoRestart ?? true,
      restartDelayMs: config.restartDelayMs ?? 5000,
    };

    this.process = null;
    this.isRunning = false;
    this.restartCount = 0;
    this.maxRestarts = 10; // Max restarts before giving up
    this.scriptPath = path.join(__dirname, 'surveillance', 'count_people.py');
  }

  /**
   * Start the surveillance process
   */
  async start() {
    if (this.isRunning) {
      console.log('  [Surveillance] Already running');
      return;
    }

    // Check if script exists
    try {
      await fs.access(this.scriptPath);
    } catch (err) {
      console.error(`  [Surveillance] ❌ Script not found: ${this.scriptPath}`);
      return;
    }

    // Check if API key is configured
    if (!this.config.apiKey) {
      console.warn('  [Surveillance] ⚠️ No API key configured - detections will not be uploaded');
    }

    const args = [
      this.scriptPath,
      `--kiosk-id=${this.config.kioskId}`,
      `--server-url=${this.config.serverUrl}`,
      `--api-key=${this.config.apiKey}`,
      `--webcam-index=${this.config.webcamIndex}`,
      `--output-dir=${path.join(__dirname, 'surveillance', 'saved_detections')}`,
      `--dwell-threshold=${this.config.dwellThreshold}`,
      `--frame-threshold=${this.config.frameThreshold}`,
      `--http-port=${this.config.httpPort}`,
      `--batch-interval=30`,
    ];

    if (!this.config.showPreview) {
      args.push('--no-preview');
    }

    console.log(`  [Surveillance] 🎥 Starting surveillance for kiosk: ${this.config.kioskId}`);
    console.log(`  [Surveillance] Python: ${this.config.pythonPath}`);
    console.log(`  [Surveillance] Webcam: ${this.config.webcamIndex}`);
    console.log(`  [Surveillance] Image server (LOCAL): http://localhost:${this.config.httpPort}`);

    this.process = spawn(this.config.pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, // Hide console window on Windows
    });

    this.isRunning = true;

    // Handle stdout
    this.process.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`  [Surveillance] ${line}`);
        }
      }
    });

    // Handle stderr
    this.process.stderr.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.error(`  [Surveillance] ⚠️ ${line}`);
        }
      }
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.isRunning = false;
      console.log(`  [Surveillance] Process exited with code ${code}, signal ${signal}`);

      // Auto-restart if enabled and not manually stopped
      if (this.config.autoRestart && code !== 0 && this.restartCount < this.maxRestarts) {
        this.restartCount++;
        console.log(`  [Surveillance] Restarting in ${this.config.restartDelayMs / 1000}s (attempt ${this.restartCount}/${this.maxRestarts})...`);
        setTimeout(() => this.start(), this.config.restartDelayMs);
      } else if (this.restartCount >= this.maxRestarts) {
        console.error('  [Surveillance] ❌ Max restarts reached, giving up');
      }
    });

    // Handle errors
    this.process.on('error', (err) => {
      this.isRunning = false;
      console.error(`  [Surveillance] ❌ Error: ${err.message}`);
      
      if (err.message.includes('ENOENT')) {
        console.error(`  [Surveillance] Python not found. Make sure Python is installed and in PATH.`);
        console.error(`  [Surveillance] Or set PYTHON_PATH environment variable.`);
      }
    });

    return new Promise((resolve) => {
      // Consider started after a short delay if no immediate error
      setTimeout(() => {
        if (this.isRunning) {
          this.restartCount = 0; // Reset restart count on successful start
          resolve(true);
        } else {
          resolve(false);
        }
      }, 2000);
    });
  }

  /**
   * Stop the surveillance process
   */
  stop() {
    if (!this.process || !this.isRunning) {
      console.log('  [Surveillance] Not running');
      return;
    }

    console.log('  [Surveillance] Stopping...');
    this.config.autoRestart = false; // Prevent auto-restart
    
    // Try graceful shutdown first
    this.process.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      if (this.isRunning) {
        console.log('  [Surveillance] Force killing...');
        this.process.kill('SIGKILL');
      }
    }, 3000);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      running: this.isRunning,
      kioskId: this.config.kioskId,
      webcamIndex: this.config.webcamIndex,
      httpPort: this.config.httpPort,
      restartCount: this.restartCount,
      imageServerUrl: `http://localhost:${this.config.httpPort}`, // Local service on this machine
    };
  }

  /**
   * Update configuration (requires restart)
   */
  updateConfig(newConfig) {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    Object.assign(this.config, newConfig);
    
    if (wasRunning) {
      setTimeout(() => this.start(), 1000);
    }
  }
}

// Singleton instance for use in print agent
let surveillanceManagerInstance = null;

export function getSurveillanceManager(config) {
  if (!surveillanceManagerInstance) {
    surveillanceManagerInstance = new SurveillanceManager(config);
  }
  return surveillanceManagerInstance;
}

export default SurveillanceManager;
