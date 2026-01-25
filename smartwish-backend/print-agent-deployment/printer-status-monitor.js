/**
 * PRINTER STATUS MONITOR
 * 
 * Monitors HP printer status using SNMP and Windows APIs.
 * Reports status to the cloud server for display on the kiosk.
 * 
 * Supports:
 * - Ink levels (per cartridge)
 * - Paper levels (per tray)
 * - Error conditions (paper jam, door open, etc.)
 * - Connectivity status
 * - Print job status
 * 
 * UPDATED: Uses cleaner SNMP logic with "fake door open" fix
 * When printer reports "door open" but alerts show paper-related issues,
 * it's actually just a paper problem (HP printer quirk).
 */

import snmp from 'net-snmp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// =============================================================================
// SNMP OIDs for Printer Monitoring (Simplified & Reliable)
// =============================================================================

const SNMP_OIDS = {
  // Basic status
  hrPrinterStatus: '1.3.6.1.2.1.25.3.5.1.1.1',
  hrPrinterErrorState: '1.3.6.1.2.1.25.3.5.1.2.1',

  // Ink/Toner levels
  inkLevel: '1.3.6.1.2.1.43.11.1.1.9',
  inkMax: '1.3.6.1.2.1.43.11.1.1.8',
  inkDesc: '1.3.6.1.2.1.43.11.1.1.6',

  // Paper trays
  paperLevel: '1.3.6.1.2.1.43.8.2.1.10',
  paperMax: '1.3.6.1.2.1.43.8.2.1.9',
  paperDesc: '1.3.6.1.2.1.43.8.2.1.18',

  // Alerts
  alertCode: '1.3.6.1.2.1.43.18.1.1.7',
  alertDesc: '1.3.6.1.2.1.43.18.1.1.8',
};

// Printer status codes (hrPrinterStatus)
const PRINTER_STATUS = {
  1: 'other',
  2: 'unknown',
  3: 'idle',
  4: 'printing',
  5: 'warmup',
};

// =============================================================================
// HELPER FUNCTIONS (Simplified)
// =============================================================================

/**
 * Clean SNMP string value
 */
function cleanString(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8').replace(/\0/g, '').trim();
  return String(value).trim();
}

/**
 * Parse SNMP number value
 */
function parseNumber(value) {
  if (Buffer.isBuffer(value)) return parseInt(value.toString('hex'), 16);
  return Number(value);
}

// =============================================================================
// PRINTER STATUS MONITOR CLASS
// =============================================================================

export class PrinterStatusMonitor {
  constructor(options = {}) {
    this.printerIP = options.printerIP || null;
    this.snmpCommunity = options.snmpCommunity || 'public';
    this.printerName = options.printerName || null;
    this.kioskId = options.kioskId || null;
    this.apiKey = options.apiKey || null;
    this.serverUrl = options.serverUrl || 'https://smartwish.onrender.com';

    this.pollInterval = options.pollInterval || 30000; // 30 seconds
    this.reportInterval = options.reportInterval || 60000; // 1 minute

    this.lastStatus = null;
    this.lastReportedStatus = null;
    this.pollTimer = null;
    this.reportTimer = null;

    // Callbacks
    this.onStatusChange = options.onStatusChange || null;
    this.onError = options.onError || null;
  }

  /**
   * Start monitoring the printer
   */
  start() {
    console.log('  🖨️  [PrinterStatusMonitor] Starting printer monitoring...');

    if (this.printerIP) {
      console.log(`  📡 Printer IP: ${this.printerIP}`);
    }
    if (this.printerName) {
      console.log(`  🏷️  Printer Name: ${this.printerName}`);
    }

    // Initial status check
    this.checkStatus();

    // Start polling
    this.pollTimer = setInterval(() => this.checkStatus(), this.pollInterval);

    // Start reporting to server
    this.reportTimer = setInterval(() => this.reportStatus(), this.reportInterval);

    // Report initial status after first check
    setTimeout(() => this.reportStatus(), 5000);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    console.log('  🖨️  [PrinterStatusMonitor] Stopped');
  }

  /**
   * Check printer status using all available methods
   */
  async checkStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      online: false,
      printerState: 'unknown',
      ink: {},
      paper: {},
      errors: [],
      warnings: [],
      printQueue: {
        jobCount: 0,
        jobs: [],
      },
    };

    try {
      // Try SNMP first (most comprehensive for network printers)
      if (this.printerIP) {
        const snmpStatus = await this.checkSNMPStatus();
        if (snmpStatus) {
          Object.assign(status, snmpStatus);
          status.online = true;
        }
      }

      // Also check Windows print queue for job status
      if (this.printerName) {
        const queueStatus = await this.checkWindowsPrintQueue();
        if (queueStatus) {
          status.printQueue = queueStatus;
          // If we couldn't get SNMP status, at least mark as online if queue is accessible
          if (!status.online && queueStatus.accessible) {
            status.online = true;
            status.printerState = 'ready';
          }
        }
      }

      // If neither worked, try basic connectivity
      if (!status.online && this.printerIP) {
        status.online = await this.checkConnectivity();
        if (status.online) {
          status.printerState = 'ready';
        }
      }

    } catch (err) {
      console.error('  ❌ [PrinterStatusMonitor] Error checking status:', err.message);
      status.errors.push({
        code: 'check_failed',
        message: `Failed to check printer status: ${err.message}`,
      });
      if (this.onError) {
        this.onError(err);
      }
    }

    // Detect status changes
    const hasChanged = this.hasStatusChanged(status);
    this.lastStatus = status;

    if (hasChanged && this.onStatusChange) {
      this.onStatusChange(status);
    }

    // Log summary
    this.logStatusSummary(status);

    return status;
  }

  /**
   * Check printer status via SNMP
   * 
   * UPDATED: Uses cleaner logic with "fake door open" fix
   * When printer reports "door open" but alerts show paper-related issues,
   * it's actually just a paper problem (HP printer quirk).
   */
  async checkSNMPStatus() {
    if (!this.printerIP) {
      return null;
    }

    const session = snmp.createSession(this.printerIP, this.snmpCommunity, {
      timeout: 5000,
      retries: 1,
    });

    const status = {
      printerState: 'unknown',
      displayStatus: 'UNKNOWN',
      snmpSuccess: false, // Track if SNMP actually worked
      flags: {
        lowPaper: false,
        noPaper: false,
        doorOpen: false,
        jam: false,
        offline: false,
        service: false,
      },
      ink: {},
      paper: {},
      errors: [],
      warnings: [],
      alerts: [],
    };

    try {
      // 1. GET ALERTS FIRST (Needed for "fake door open" fix)
      const alertCodes = await this.walkSNMPTable(session, SNMP_OIDS.alertCode);
      const alertDescs = await this.walkSNMPTable(session, SNMP_OIDS.alertDesc);

      const rawAlerts = [];
      Object.keys(alertCodes).forEach(key => {
        const index = key.split('.').pop();
        const descKey = Object.keys(alertDescs).find(k => k.endsWith(`.${index}`));
        if (descKey) {
          const msg = cleanString(alertDescs[descKey]);
          // Filter out "genuineHP" info messages
          if (!msg.includes("genuineHP")) {
            rawAlerts.push(msg);
            status.alerts.push(msg);
          }
        }
      });

      // 2. GET BASIC STATUS
      const basicStatus = await new Promise((resolve) => {
        const basicOids = [SNMP_OIDS.hrPrinterStatus, SNMP_OIDS.hrPrinterErrorState];
        session.get(basicOids, (err, varbinds) => {
          if (err) {
            console.log(`  ⚠️  SNMP basic query failed: ${err.message}`);
            resolve({ stateVal: null, errorVal: 0, failed: true }); // Mark as failed
            return;
          }

          const stateVal = parseNumber(varbinds[0]?.value || 2);
          const errorVal = parseNumber(varbinds[1]?.value || 0);
          resolve({ stateVal, errorVal, failed: false });
        });
      });

      // If SNMP completely failed, return null to indicate no connection
      if (basicStatus.failed) {
        session.close();
        return null; // SNMP not working - don't pretend printer is online
      }

      // SNMP succeeded
      status.snmpSuccess = true;

      const { stateVal, errorVal } = basicStatus;
      status.printerState = PRINTER_STATUS[stateVal] || 'unknown';

      // Check for paper-related alerts (for "fake door open" fix)
      const hasPaperAlert = rawAlerts.some(a =>
        a.toLowerCase().includes('empty') || a.toLowerCase().includes('load')
      );

      // Analyze error flags from hrPrinterErrorState
      status.flags = {
        lowPaper: (errorVal & 1) !== 0,
        noPaper: (errorVal & 2) !== 0,
        doorOpen: (errorVal & 4) !== 0,
        jam: (errorVal & 8) !== 0,
        offline: (errorVal & 16) !== 0,
        service: (errorVal & 32) !== 0,
      };

      // --- CRITICAL FIX: FAKE DOOR OPEN ---
      // HP printers often report "door open" when it's actually just "no paper"
      // If door appears open BUT we have paper-related alerts, it's really just paper
      if (status.flags.doorOpen && hasPaperAlert) {
        console.log('  🔧 [SNMP] Applying "fake door open" fix - actually no paper');
        status.flags.doorOpen = false;
        status.flags.noPaper = true;
      }

      // Determine human-readable display status
      let displayStatus = "UNKNOWN";
      if (stateVal === 3) displayStatus = "IDLE";
      if (stateVal === 4) displayStatus = "PRINTING";
      if (stateVal === 5) displayStatus = "WARMUP";

      // Override with error states (priority order: jam > door > paper > service)
      if (status.flags.jam) {
        displayStatus = "PAUSED (Paper Jam)";
        status.errors.push({ code: 'paper_jam', message: 'Paper jam detected' });
      } else if (status.flags.doorOpen) {
        displayStatus = "PAUSED (Door Open)";
        status.errors.push({ code: 'door_open', message: 'Printer door is open' });
      } else if (status.flags.noPaper) {
        displayStatus = "PAUSED (Load Paper)";
        status.errors.push({ code: 'no_paper', message: 'Printer is out of paper' });
      } else if (status.flags.service) {
        displayStatus = "SERVICE REQUIRED";
        status.errors.push({ code: 'service_needed', message: 'Service required' });
      } else if (status.flags.offline) {
        displayStatus = "OFFLINE";
        status.errors.push({ code: 'offline', message: 'Printer is offline' });
      } else if (status.flags.lowPaper) {
        status.warnings.push({ code: 'paper_low', message: 'Paper is low' });
      }

      status.displayStatus = displayStatus;

      // 3. GET INK LEVELS
      const inkLevels = await this.walkSNMPTable(session, SNMP_OIDS.inkLevel);
      const inkMax = await this.walkSNMPTable(session, SNMP_OIDS.inkMax);
      const inkDesc = await this.walkSNMPTable(session, SNMP_OIDS.inkDesc);

      Object.keys(inkLevels).forEach((key) => {
        const index = key.split('.').pop();
        const descKey = Object.keys(inkDesc).find(k => k.endsWith(`.${index}`));
        const maxKey = Object.keys(inkMax).find(k => k.endsWith(`.${index}`));

        const val = parseNumber(inkLevels[key]);
        const max = maxKey ? parseNumber(inkMax[maxKey]) : 100;
        const name = descKey ? cleanString(inkDesc[descKey]) : "Supply";

        let percent = 0;
        let state = 'unknown';
        if (max > 0 && val >= 0) {
          percent = Math.round((val / max) * 100);
          if (percent === 0) state = 'empty';
          else if (percent < 10) state = 'critical';
          else if (percent < 25) state = 'low';
          else state = 'ok';
        }

        // Determine color from description
        const nameLower = name.toLowerCase();
        let color = 'supply';
        if (nameLower.includes('black')) color = 'black';
        else if (nameLower.includes('cyan')) color = 'cyan';
        else if (nameLower.includes('magenta')) color = 'magenta';
        else if (nameLower.includes('yellow')) color = 'yellow';

        status.ink[color] = {
          level: percent,
          state,
          rawValue: val,
          description: name,
        };

        // Add warnings/errors for low ink
        if (state === 'empty' || state === 'critical') {
          status.errors.push({
            code: state === 'empty' ? 'no_ink' : 'ink_critical',
            message: `${name} is ${state === 'empty' ? 'empty' : 'critically low'} (${percent}%)`,
            color,
            level: percent,
          });
        } else if (state === 'low') {
          status.warnings.push({
            code: 'ink_low',
            message: `${name} is low (${percent}%)`,
            color,
            level: percent,
          });
        }
      });

      // 4. GET PAPER TRAYS (De-duplicated)
      const paperLevels = await this.walkSNMPTable(session, SNMP_OIDS.paperLevel);
      const paperDesc = await this.walkSNMPTable(session, SNMP_OIDS.paperDesc);
      const seenTrays = new Set();

      Object.keys(paperLevels).forEach((key) => {
        const suffix = key.substring(SNMP_OIDS.paperLevel.length);
        const descOid = SNMP_OIDS.paperDesc + suffix;
        const val = parseNumber(paperLevels[key]);
        const name = paperDesc[descOid] ? cleanString(paperDesc[descOid]) : `Input ${suffix}`;

        // Filter out manual feed slots
        const nameLower = name.toLowerCase();
        if (nameLower.includes('manual') || nameLower.includes('bypass')) {
          return;
        }

        let paperState = "unknown";
        if (val === -3 || val > 0) paperState = "ok";
        else if (val === 0) paperState = "empty";

        // De-duplicate trays
        const uniqueId = `${name}-${paperState}`;
        if (!seenTrays.has(uniqueId)) {
          seenTrays.add(uniqueId);

          // Extract tray number from name or use index
          const trayMatch = name.match(/tray\s*(\d+)/i);
          const trayNum = trayMatch ? parseInt(trayMatch[1], 10) : seenTrays.size;
          const trayName = `tray${trayNum}`;

          status.paper[trayName] = {
            description: name,
            state: paperState,
            rawValue: val,
            level: val === -3 ? -1 : (val > 0 ? 100 : 0), // -3 means "present but unknown level"
          };

          // Add errors for empty trays
          if (paperState === 'empty') {
            status.errors.push({
              code: 'paper_empty',
              message: `${name} is empty`,
              tray: trayName,
            });
          }
        }
      });

      session.close();
      return status;

    } catch (e) {
      console.log(`  ⚠️  SNMP error: ${e.message}`);
      session.close();
      return null; // Return null on failure - don't pretend printer is online
    }
  }

  /**
   * Walk an SNMP table
   */
  walkSNMPTable(session, baseOid) {
    return new Promise((resolve) => {
      const results = {};

      session.subtree(baseOid, (varbinds) => {
        for (const varbind of varbinds) {
          if (!snmp.isVarbindError(varbind)) {
            results[varbind.oid.toString()] = varbind.value;
          }
        }
      }, (error) => {
        if (error && error.message !== 'OID not increasing') {
          // This is expected at end of table
        }
        resolve(results);
      });
    });
  }


  /**
   * Check Windows print queue
   */
  async checkWindowsPrintQueue() {
    if (!this.printerName) {
      return null;
    }

    try {
      // Get print jobs
      const jobsCmd = `powershell -Command "Get-PrintJob -PrinterName '${this.printerName}' | Select-Object Id, JobStatus, DocumentName, Size, SubmittedTime | ConvertTo-Json"`;
      const { stdout: jobsOutput } = await execAsync(jobsCmd);

      let jobs = [];
      if (jobsOutput.trim()) {
        const parsed = JSON.parse(jobsOutput);
        jobs = Array.isArray(parsed) ? parsed : [parsed];
      }

      // Get printer status
      const statusCmd = `powershell -Command "Get-Printer -Name '${this.printerName}' | Select-Object PrinterStatus, JobCount | ConvertTo-Json"`;
      const { stdout: statusOutput } = await execAsync(statusCmd);

      let printerInfo = { PrinterStatus: 0, JobCount: 0 };
      if (statusOutput.trim()) {
        printerInfo = JSON.parse(statusOutput);
      }

      // Check for error jobs
      const errorJobs = jobs.filter(j =>
        j.JobStatus && (
          j.JobStatus.includes('Error') ||
          j.JobStatus.includes('Paused') ||
          j.JobStatus.includes('Offline')
        )
      );

      return {
        accessible: true,
        jobCount: jobs.length,
        jobs: jobs.map(j => ({
          id: j.Id,
          status: j.JobStatus,
          name: j.DocumentName,
          size: j.Size,
        })),
        hasErrors: errorJobs.length > 0,
        errorJobs: errorJobs,
        printerStatus: printerInfo.PrinterStatus,
      };
    } catch (err) {
      // Printer not found or other error
      return {
        accessible: false,
        jobCount: 0,
        jobs: [],
        hasErrors: false,
        error: err.message,
      };
    }
  }

  /**
   * Basic connectivity check
   */
  async checkConnectivity() {
    if (!this.printerIP) {
      return false;
    }

    try {
      const response = await fetch(`http://${this.printerIP}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok || response.status === 401 || response.status === 403;
    } catch {
      try {
        // Try IPP port
        const ippResponse = await fetch(`http://${this.printerIP}:631`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000),
        });
        return ippResponse.ok || ippResponse.status === 401 || ippResponse.status === 426;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if status has changed significantly
   */
  hasStatusChanged(newStatus) {
    if (!this.lastStatus) return true;

    // Check online state
    if (this.lastStatus.online !== newStatus.online) return true;

    // Check printer state
    if (this.lastStatus.printerState !== newStatus.printerState) return true;

    // Check error count
    if (this.lastStatus.errors?.length !== newStatus.errors?.length) return true;

    // Check if any new errors
    const lastErrorCodes = new Set(this.lastStatus.errors?.map(e => e.code) || []);
    const hasNewError = newStatus.errors?.some(e => !lastErrorCodes.has(e.code));
    if (hasNewError) return true;

    // Check ink levels (significant change only)
    for (const color of Object.keys(newStatus.ink || {})) {
      const oldLevel = this.lastStatus.ink?.[color]?.level;
      const newLevel = newStatus.ink[color]?.level;
      if (oldLevel !== undefined && newLevel !== undefined) {
        if (Math.abs(oldLevel - newLevel) >= 5) return true;
        if (this.lastStatus.ink[color]?.state !== newStatus.ink[color]?.state) return true;
      }
    }

    // Check paper levels
    for (const tray of Object.keys(newStatus.paper || {})) {
      const oldState = this.lastStatus.paper?.[tray]?.state;
      const newState = newStatus.paper[tray]?.state;
      if (oldState !== newState) return true;
    }

    return false;
  }

  /**
   * Log status summary
   */
  logStatusSummary(status) {
    const online = status.online ? '🟢' : '🔴';
    const inkSummary = Object.entries(status.ink || {})
      .map(([color, info]) => {
        const icon = info.state === 'empty' || info.state === 'critical' ? '🔴' :
          info.state === 'low' ? '🟡' :
            info.state === 'unknown' ? '⚪' : '🟢';
        const display = info.display || (info.level >= 0 ? `${info.level}%` : '?');
        return `${icon}${color[0].toUpperCase()}:${display}`;
      })
      .join(' ');

    const paperSummary = Object.entries(status.paper || {})
      .map(([tray, info]) => {
        const icon = info.state === 'empty' ? '🔴' :
          info.state === 'low' || info.state === 'critical' ? '🟡' :
            info.state === 'unknown' || info.state === 'unavailable' ? '⚪' : '🟢';
        // Show the display value which now includes better descriptions
        return `${icon}${tray}:${info.display || '?'}`;
      })
      .join(' ');

    const errCount = status.errors?.length || 0;
    const warnCount = status.warnings?.length || 0;

    console.log(`  🖨️  [Status] ${online} ${status.printerState} | Ink: ${inkSummary || 'N/A'} | Paper: ${paperSummary || 'N/A'} | Errors: ${errCount}, Warnings: ${warnCount}`);

    // Log any errors or warnings
    if (errCount > 0) {
      status.errors.forEach(err => console.log(`     ❌ ${err.message}`));
    }
    if (warnCount > 0) {
      status.warnings.forEach(warn => console.log(`     ⚠️  ${warn.message}`));
    }
  }

  /**
   * Report status to cloud server
   */
  async reportStatus() {
    if (!this.kioskId || !this.serverUrl) {
      return;
    }

    const status = this.lastStatus;
    if (!status) {
      return;
    }

    // Check if status has changed since last report
    if (this.lastReportedStatus && !this.hasSignificantChange(status, this.lastReportedStatus)) {
      // Only skip if no errors/warnings - always report issues
      if ((status.errors?.length || 0) === 0 && (status.warnings?.length || 0) === 0) {
        return;
      }
    }

    try {
      const response = await fetch(`${this.serverUrl}/kiosk/printer-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kiosk-api-key': this.apiKey || '',
        },
        body: JSON.stringify({
          kioskId: this.kioskId,
          status: {
            ...status,
            printerIP: this.printerIP,
            printerName: this.printerName,
          },
        }),
      });

      if (response.ok) {
        this.lastReportedStatus = { ...status };
        console.log('  📡 [PrinterStatus] Reported to server');
      } else if (response.status === 404) {
        // Endpoint not deployed yet
      } else {
        console.warn(`  ⚠️  [PrinterStatus] Report failed: ${response.status}`);
      }
    } catch (err) {
      // Server might be down, don't spam logs
      if (!err.message.includes('ECONNREFUSED')) {
        console.warn(`  ⚠️  [PrinterStatus] Report error: ${err.message}`);
      }
    }
  }

  /**
   * Check if there's a significant change worth reporting
   */
  hasSignificantChange(newStatus, oldStatus) {
    if (newStatus.online !== oldStatus.online) return true;
    if (newStatus.printerState !== oldStatus.printerState) return true;
    if ((newStatus.errors?.length || 0) !== (oldStatus.errors?.length || 0)) return true;
    if ((newStatus.warnings?.length || 0) !== (oldStatus.warnings?.length || 0)) return true;
    return false;
  }

  /**
   * Get current status
   */
  getStatus() {
    return this.lastStatus;
  }

  /**
   * Force an immediate status check and report
   */
  async refresh() {
    const status = await this.checkStatus();
    await this.reportStatus();
    return status;
  }
}

// =============================================================================
// MULTI-PRINTER MONITOR
// Monitors multiple printers for a kiosk and reports their statuses
// =============================================================================

export class MultiPrinterMonitor {
  constructor(options = {}) {
    this.kioskId = options.kioskId;
    this.apiKey = options.apiKey;
    this.serverUrl = options.serverUrl || 'https://smartwish.onrender.com';
    this.printers = options.printers || [];
    this.pollInterval = options.pollInterval || 30000;
    this.reportInterval = options.reportInterval || 60000;

    this.monitors = new Map(); // PrinterStatusMonitor per printer
    this.reportTimer = null;
  }

  /**
   * Start monitoring all printers
   */
  async start() {
    console.log(`  🖨️  [MultiPrinterMonitor] Starting monitoring for ${this.printers.length} printer(s)...`);

    for (const printer of this.printers) {
      const monitor = new PrinterStatusMonitor({
        printerIP: printer.ipAddress || null,
        printerName: printer.printerName,
        kioskId: this.kioskId,
        apiKey: this.apiKey,
        serverUrl: this.serverUrl,
        pollInterval: this.pollInterval,
        reportInterval: 0, // We'll handle reporting ourselves
        onStatusChange: (status) => {
          console.log(`  🖨️  [${printer.name}] Status changed: ${status.online ? 'online' : 'offline'}`);
        },
      });

      // Store printer ID with the monitor
      monitor.printerId = printer.id;
      monitor.printerDisplayName = printer.name;

      this.monitors.set(printer.id, monitor);
      monitor.start();
    }

    // Start periodic reporting to server
    this.reportTimer = setInterval(() => this.reportAllStatuses(), this.reportInterval);

    // Initial report after a short delay
    setTimeout(() => this.reportAllStatuses(), 5000);
  }

  /**
   * Stop all monitors
   */
  stop() {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    for (const monitor of this.monitors.values()) {
      monitor.stop();
    }
    this.monitors.clear();

    console.log('  🖨️  [MultiPrinterMonitor] Stopped');
  }

  /**
   * Report status of all printers to the server
   */
  async reportAllStatuses() {
    const statuses = [];

    for (const [printerId, monitor] of this.monitors) {
      const status = monitor.getStatus();
      if (!status) continue;

      statuses.push({
        printerId,
        online: status.online,
        printerState: status.printerState,
        lastError: status.errors?.[0]?.message || null,
        ink: status.ink,
        paper: status.paper,
        errors: status.errors,
        warnings: status.warnings,
        fullStatus: status,
      });
    }

    if (statuses.length === 0) {
      return;
    }

    try {
      const response = await fetch(`${this.serverUrl}/local-agent/printer-status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-kiosk-api-key': this.apiKey || '',
        },
        body: JSON.stringify({
          kioskId: this.kioskId,
          printers: statuses,
        }),
      });

      if (response.ok) {
        console.log(`  📡 [MultiPrinterMonitor] Reported ${statuses.length} printer status(es)`);
      } else if (response.status === 404) {
        // Endpoint not deployed yet
      } else {
        console.warn(`  ⚠️  [MultiPrinterMonitor] Report failed: ${response.status}`);
      }
    } catch (err) {
      if (!err.message.includes('ECONNREFUSED')) {
        console.warn(`  ⚠️  [MultiPrinterMonitor] Report error: ${err.message}`);
      }
    }
  }

  /**
   * Get status of a specific printer
   */
  getPrinterStatus(printerId) {
    const monitor = this.monitors.get(printerId);
    return monitor ? monitor.getStatus() : null;
  }

  /**
   * Get all printer statuses
   */
  getAllStatuses() {
    const statuses = {};
    for (const [printerId, monitor] of this.monitors) {
      statuses[printerId] = monitor.getStatus();
    }
    return statuses;
  }
}

export default PrinterStatusMonitor;
