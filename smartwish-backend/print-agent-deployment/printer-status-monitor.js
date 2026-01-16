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
 */

import snmp from 'net-snmp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// =============================================================================
// SNMP OIDs for Printer Monitoring (Standard Printer MIB)
// =============================================================================

// SNMP OIDs for printer monitoring (without leading dots for net-snmp compatibility)
const SNMP_OIDS = {
  // Printer device status (1.3.6.1.2.1.25.3.2.1.5)
  hrDeviceStatus: '1.3.6.1.2.1.25.3.2.1.5.1',
  
  // Printer status (1.3.6.1.2.1.25.3.5.1.1)
  hrPrinterStatus: '1.3.6.1.2.1.25.3.5.1.1.1',
  
  // Detected error state - bitmap for paper jam, low paper, etc.
  prtPrinterDetectedErrorState: '1.3.6.1.2.1.25.3.5.1.2.1',
  
  // Marker supplies (ink/toner) table base - we'll walk this
  prtMarkerSuppliesTable: '1.3.6.1.2.1.43.11.1.1',
  
  // Marker supplies level (1.3.6.1.2.1.43.11.1.1.9)
  prtMarkerSuppliesLevel: '1.3.6.1.2.1.43.11.1.1.9',
  
  // Marker supplies max capacity (1.3.6.1.2.1.43.11.1.1.8)
  prtMarkerSuppliesMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8',
  
  // Marker supplies description (1.3.6.1.2.1.43.11.1.1.6)
  prtMarkerSuppliesDescription: '1.3.6.1.2.1.43.11.1.1.6',
  
  // Marker color (1.3.6.1.2.1.43.12.1.1.4)
  prtMarkerColorantValue: '1.3.6.1.2.1.43.12.1.1.4',
  
  // Input tray table base - we'll walk this
  prtInputTable: '1.3.6.1.2.1.43.8.2.1',
  
  // Input tray current level (1.3.6.1.2.1.43.8.2.1.10)
  prtInputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10',
  
  // Input tray max capacity (1.3.6.1.2.1.43.8.2.1.9)
  prtInputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9',
  
  // Input tray name/description (1.3.6.1.2.1.43.8.2.1.18)
  prtInputDescription: '1.3.6.1.2.1.43.8.2.1.18',
  
  // Input tray status (1.3.6.1.2.1.43.8.2.1.11)
  prtInputStatus: '1.3.6.1.2.1.43.8.2.1.11',
  
  // Alert table - contains active alerts like "paper low", "ink low"
  // prtAlertIndex (1.3.6.1.2.1.43.18.1.1.1)
  prtAlertGroup: '1.3.6.1.2.1.43.18.1.1.2',         // What group (input, output, marker, etc.)
  prtAlertGroupIndex: '1.3.6.1.2.1.43.18.1.1.3',    // Which tray/supply has the alert
  prtAlertSeverityLevel: '1.3.6.1.2.1.43.18.1.1.4', // 1=other, 2=critical, 3=warning
  prtAlertCode: '1.3.6.1.2.1.43.18.1.1.7',          // What kind of alert
  prtAlertDescription: '1.3.6.1.2.1.43.18.1.1.8',   // Human-readable description
};

// Error state bitmap meanings (from prtPrinterDetectedErrorState)
const ERROR_STATE_FLAGS = {
  lowPaper: 0x80,         // Bit 0 (MSB)
  noPaper: 0x40,          // Bit 1
  lowToner: 0x20,         // Bit 2
  noToner: 0x10,          // Bit 3
  doorOpen: 0x08,         // Bit 4
  jammed: 0x04,           // Bit 5
  offline: 0x02,          // Bit 6
  serviceRequested: 0x01, // Bit 7 (LSB)
  // Second byte if present
  inputTrayMissing: 0x8000,
  outputTrayMissing: 0x4000,
  markerSupplyMissing: 0x2000,
  outputNearFull: 0x1000,
  outputFull: 0x0800,
  inputTrayEmpty: 0x0400,
  overduePreventMaint: 0x0200,
};

// Printer status codes (hrPrinterStatus)
const PRINTER_STATUS = {
  1: 'other',
  2: 'unknown',
  3: 'idle',
  4: 'printing',
  5: 'warmup',
};

/**
 * Helper to convert SNMP values to strings
 * SNMP can return Buffers, strings, or numbers
 */
function snmpValueToString(value) {
  if (value === null || value === undefined) return '';
  if (Buffer.isBuffer(value)) return value.toString('utf8').replace(/\0/g, '').trim();
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return String(value);
}

/**
 * Helper to convert SNMP values to numbers
 */
function snmpValueToNumber(value) {
  if (value === null || value === undefined) return 0;
  if (Buffer.isBuffer(value)) {
    // Try to parse as integer from the buffer
    if (value.length === 4) return value.readInt32BE(0);
    if (value.length === 2) return value.readInt16BE(0);
    if (value.length === 1) return value.readInt8(0);
    return parseInt(value.toString(), 10) || 0;
  }
  if (typeof value === 'number') return value;
  return parseInt(value, 10) || 0;
}

/**
 * Interpret SNMP level values
 * Special SNMP values: -1 = other, -2 = unknown, -3 = "some remaining but unknown amount"
 * Returns: { level: number (0-100 or -1 for unknown), state: string }
 */
function interpretSNMPLevel(level, max) {
  // Handle special SNMP values
  if (level === -1 || level === -2) {
    return { level: -1, state: 'unknown', display: '?', description: 'Unknown - printer does not report level' };
  }
  if (level === -3) {
    // "At least one unit remaining" - we don't know the actual level
    // This means "has paper" but no precise level
    return { level: -1, state: 'present', display: '✓ Has paper', description: 'Paper detected (no precise level)' };
  }
  if (level === 0) {
    return { level: 0, state: 'empty', display: '⚠️ EMPTY', description: 'Tray is empty' };
  }
  
  // If max is also special value, we can't calculate percentage
  if (max <= 0) {
    if (level > 0) {
      return { level: -1, state: 'present', display: '✓ Has paper', description: `Paper detected (raw: ${level})` };
    }
    return { level: -1, state: 'unknown', display: '?', description: 'Unknown level' };
  }
  
  // Calculate percentage
  const percent = Math.round((level / max) * 100);
  const clampedPercent = Math.max(0, Math.min(100, percent));
  
  let state = 'ok';
  if (clampedPercent <= 0) state = 'empty';
  else if (clampedPercent < 10) state = 'critical';
  else if (clampedPercent < 25) state = 'low';
  
  return { level: clampedPercent, state, display: `${clampedPercent}%`, description: `${clampedPercent}% full` };
}

// Device status codes (hrDeviceStatus)
const DEVICE_STATUS = {
  1: 'unknown',
  2: 'running',
  3: 'warning',
  4: 'testing',
  5: 'down',
};

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
   */
  async checkSNMPStatus() {
    return new Promise((resolve) => {
      if (!this.printerIP) {
        resolve(null);
        return;
      }

      const status = {
        printerState: 'unknown',
        ink: {},
        paper: {},
        errors: [],
        warnings: [],
      };

      const session = snmp.createSession(this.printerIP, this.snmpCommunity, {
        timeout: 5000,
        retries: 1,
      });

      // OIDs to get
      const oids = [
        SNMP_OIDS.hrPrinterStatus,
        SNMP_OIDS.hrDeviceStatus,
        SNMP_OIDS.prtPrinterDetectedErrorState,
      ];

      session.get(oids, (error, varbinds) => {
        if (error) {
          console.log(`  ⚠️  SNMP query failed: ${error.message}`);
          session.close();
          resolve(null);
          return;
        }

        // Parse responses - only get printer state, ignore unreliable error bitmaps
        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) {
            continue;
          }

          const oid = varbind.oid.toString();
          
          if (oid.includes(SNMP_OIDS.hrPrinterStatus) || oid.includes('25.3.5.1.1')) {
            status.printerState = PRINTER_STATUS[varbind.value] || 'unknown';
          } else if (oid.includes(SNMP_OIDS.hrDeviceStatus) || oid.includes('25.3.2.1.5')) {
            const deviceStatus = DEVICE_STATUS[varbind.value] || 'unknown';
            // Only report if device is actually down, not just "warning"
            if (deviceStatus === 'down') {
              status.errors.push({ code: 'device_down', message: 'Printer is down' });
            }
            // Note: Ignoring 'warning' status as it gives false positives on HP printers
          }
          // Note: Ignoring prtPrinterDetectedErrorState as it gives false positives on HP printers
          // We rely on the alert table (prtAlertDescription) for accurate error reporting
        }

        // Now get ink levels by walking the marker supplies table
        this.walkSNMPTable(session, SNMP_OIDS.prtMarkerSuppliesLevel)
          .then((supplies) => {
            // Walk max capacity
            return this.walkSNMPTable(session, SNMP_OIDS.prtMarkerSuppliesMaxCapacity)
              .then((maxCapacities) => {
                return this.walkSNMPTable(session, SNMP_OIDS.prtMarkerSuppliesDescription)
                  .then((descriptions) => {
                    // Combine into ink levels
                    const colors = ['black', 'cyan', 'magenta', 'yellow'];
                    const colorIndex = {};
                    
                    // Match by index
                    Object.keys(supplies).forEach((key, i) => {
                      const index = key.split('.').pop();
                      const rawLevel = snmpValueToNumber(supplies[key]);
                      const max = snmpValueToNumber(maxCapacities[Object.keys(maxCapacities)[i]]) || 100;
                      const desc = snmpValueToString(descriptions[Object.keys(descriptions)[i]]);
                      
                      // Interpret the SNMP level (handles special values like -3)
                      const levelInfo = interpretSNMPLevel(rawLevel, max);
                      
                      // Try to determine color from description
                      let color = colors[i] || `supply_${index}`;
                      const descLower = desc.toLowerCase();
                      if (descLower.includes('black')) color = 'black';
                      else if (descLower.includes('cyan')) color = 'cyan';
                      else if (descLower.includes('magenta')) color = 'magenta';
                      else if (descLower.includes('yellow')) color = 'yellow';
                      
                      status.ink[color] = {
                        level: levelInfo.level,
                        state: levelInfo.state,
                        display: levelInfo.display,
                        rawValue: rawLevel, // Keep raw value for debugging
                      };
                      
                      // Add warnings/errors for low ink (only if we know the actual level)
                      if (levelInfo.level >= 0) {
                        if (levelInfo.state === 'critical' || levelInfo.state === 'empty') {
                          status.errors.push({
                            code: levelInfo.level === 0 ? 'no_ink' : 'ink_critical',
                            message: `${color.charAt(0).toUpperCase() + color.slice(1)} ink ${levelInfo.level === 0 ? 'empty' : 'critically low'} (${levelInfo.display})`,
                            color,
                            level: levelInfo.level,
                          });
                        } else if (levelInfo.state === 'low') {
                          status.warnings.push({
                            code: 'ink_low',
                            message: `${color.charAt(0).toUpperCase() + color.slice(1)} ink low (${levelInfo.display})`,
                            color,
                            level: levelInfo.level,
                          });
                        }
                      }
                    });

                    // Get paper tray status
                    return this.walkSNMPTable(session, SNMP_OIDS.prtInputCurrentLevel);
                  });
              });
          })
          .then((trayLevels) => {
            return this.walkSNMPTable(session, SNMP_OIDS.prtInputMaxCapacity)
              .then((trayMax) => {
                return this.walkSNMPTable(session, SNMP_OIDS.prtInputDescription)
                  .then((trayDesc) => {
                    // Also get tray status for better detection
                    return this.walkSNMPTable(session, SNMP_OIDS.prtInputStatus)
                      .then((trayStatus) => {
                    
                    // Parse OID to get the actual tray index
                    // OID format: 1.3.6.1.2.1.43.8.2.1.10.1.X where X is the tray index
                    // Index 1 is often "Manual Feed" or similar, actual trays start at higher indices
                    const parseTrayIndex = (oid) => {
                      const parts = oid.split('.');
                      return parseInt(parts[parts.length - 1], 10);
                    };
                    
                    // Build a map of tray data keyed by actual tray index
                    const trayData = new Map();
                    
                    Object.keys(trayLevels).forEach((oid) => {
                      const trayIndex = parseTrayIndex(oid);
                      const rawLevel = snmpValueToNumber(trayLevels[oid]);
                      
                      // Find corresponding data from other tables using matching OID suffix
                      const maxOid = Object.keys(trayMax).find(o => parseTrayIndex(o) === trayIndex);
                      const descOid = Object.keys(trayDesc).find(o => parseTrayIndex(o) === trayIndex);
                      const statusOid = Object.keys(trayStatus).find(o => parseTrayIndex(o) === trayIndex);
                      
                      const max = maxOid ? snmpValueToNumber(trayMax[maxOid]) : -2;
                      const desc = descOid ? snmpValueToString(trayDesc[descOid]) : '';
                      const statusCode = statusOid ? snmpValueToNumber(trayStatus[statusOid]) : 0;
                      
                      trayData.set(trayIndex, { rawLevel, max, desc, statusCode });
                    });
                    
                    // Sort by tray index and filter out non-tray entries
                    const sortedTrays = Array.from(trayData.entries())
                      .sort((a, b) => a[0] - b[0])
                      .filter(([idx, data]) => {
                        // Filter out manual feed slots (usually have specific descriptions)
                        const descLower = data.desc.toLowerCase();
                        const isManualFeed = descLower.includes('manual') || 
                                             descLower.includes('bypass') ||
                                             descLower.includes('mp tray');
                        // Also filter if description doesn't mention "tray" at all and index is suspicious
                        const isTray = descLower.includes('tray') || descLower === '';
                        return !isManualFeed && (isTray || idx > 0);
                      });
                    
                    console.log(`  📊 [SNMP] Found ${trayData.size} input sources, ${sortedTrays.length} are actual trays`);
                    
                    // Process only actual trays, renumber them 1, 2, 3...
                    sortedTrays.forEach(([trayIndex, data], displayIndex) => {
                      const { rawLevel, max, desc, statusCode } = data;
                      
                      // prtInputStatus is a BITMASK (PrtSubUnitStatusTC from RFC 3805):
                      // Bit 0 (1):  Available and Standby
                      // Bit 1 (2):  Available and Active  
                      // Bit 2 (4):  Available and Busy
                      // Bit 3 (8):  Unavailable because OnRequest
                      // Bit 4 (16): Unavailable because Broken
                      // Bit 5 (32): Unknown
                      // Bit 6 (64): Non-Critical Alert (e.g., low paper)
                      // Bit 7 (128): Critical Alert (e.g., empty, jam)
                      
                      const isAvailable = (statusCode & 0x07) !== 0; // bits 0-2 = available states
                      const isUnavailable = (statusCode & 0x18) !== 0; // bits 3-4 = unavailable
                      const isUnknown = (statusCode & 0x20) !== 0; // bit 5 = unknown
                      const hasNonCriticalAlert = (statusCode & 0x40) !== 0; // bit 6 = low paper etc.
                      const hasCriticalAlert = (statusCode & 0x80) !== 0; // bit 7 = empty/jam
                      
                      let statusMeaning = 'ok';
                      if (hasCriticalAlert) statusMeaning = 'critical';
                      else if (hasNonCriticalAlert) statusMeaning = 'low';
                      else if (isUnavailable) statusMeaning = 'unavailable';
                      else if (isUnknown) statusMeaning = 'unknown';
                      else if (isAvailable) statusMeaning = 'ok';
                      
                      // Use display index (1-based) for tray naming
                      const trayNum = displayIndex + 1;
                      const trayLabel = desc || `Tray ${trayNum}`;
                      
                      // Debug: log raw SNMP values with OID index
                      console.log(`  📊 [SNMP] Tray ${trayNum} (OID idx=${trayIndex}): raw=${rawLevel}, max=${max}, status=${statusCode}, desc="${desc}"`);
                      
                      // Interpret the SNMP level (handles special values like -3)
                      let levelInfo = interpretSNMPLevel(rawLevel, max);
                      
                      // For HP printers, the status bitmask is unreliable
                      // We only use the alert table for accurate status
                      // Just show basic OK/present status here, alerts will update if needed
                      if (levelInfo.state === 'present') {
                        levelInfo = { ...levelInfo, display: '✓ OK' };
                      }
                      
                      const trayName = `tray${trayNum}`;
                      
                      status.paper[trayName] = {
                        level: levelInfo.level,
                        description: trayLabel,
                        state: levelInfo.state,
                        display: levelInfo.display,
                        rawValue: rawLevel,
                        oidIndex: trayIndex, // Store OID index for alert matching
                      };
                      
                      // Generate errors ONLY for confirmed empty trays (rawLevel = 0)
                      // This is reliable - other status bitmask interpretations are not
                      if (rawLevel === 0 || levelInfo.state === 'empty') {
                        status.errors.push({
                          code: 'paper_empty',
                          message: `${trayLabel} is empty`,
                          tray: trayName,
                        });
                      }
                    });
                    
                    // Now check alert table for active alerts (like "Paper Low")
                    // Get multiple alert fields to understand which component has the alert
                    return Promise.all([
                      this.walkSNMPTable(session, SNMP_OIDS.prtAlertDescription),
                      this.walkSNMPTable(session, SNMP_OIDS.prtAlertGroup),
                      this.walkSNMPTable(session, SNMP_OIDS.prtAlertGroupIndex),
                      this.walkSNMPTable(session, SNMP_OIDS.prtAlertCode),
                    ]);
                      });
                  });
              });
          })
          .then(([alertDescs, alertGroups, alertGroupIndexes, alertCodes]) => {
            // Process alerts
            const alertDescKeys = Object.keys(alertDescs || {});
            if (alertDescKeys.length > 0) {
              console.log(`  📊 [SNMP] Found ${alertDescKeys.length} active alert(s)`);
              
              alertDescKeys.forEach((oid, i) => {
                const alertDesc = snmpValueToString(alertDescs[oid]);
                const alertGroup = snmpValueToNumber(alertGroups[Object.keys(alertGroups || {})[i]]);
                const alertGroupIdx = snmpValueToNumber(alertGroupIndexes[Object.keys(alertGroupIndexes || {})[i]]);
                const alertCode = snmpValueToNumber(alertCodes[Object.keys(alertCodes || {})[i]]);
                
                // Alert groups: 1=other, 3=hostResourcesMIBStorageTable, 5=generalPrinter,
                // 6=cover, 7=localization, 8=input, 9=output, 10=marker, 11=markerSupplies,
                // 12=markerColorant, 13=mediaPath, 14=channel, 15=interpreter, 16=consoleDisplayBuffer,
                // 17=consoleLights, 18=alert, 19=finDevice, 30=finSupply, 31=finSupplyMediaInput, 32=finAttribute
                const groupNames = {
                  8: 'input',      // Paper trays
                  9: 'output',     // Output trays
                  10: 'marker',    // Print head
                  11: 'supplies',  // Ink/toner
                };
                const groupName = groupNames[alertGroup] || `group${alertGroup}`;
                
                console.log(`  📊 [SNMP] Alert: "${alertDesc}" (group=${alertGroup}/${groupName}, idx=${alertGroupIdx}, code=${alertCode})`);
                
                const alertLower = alertDesc.toLowerCase();
                
                // HP-specific alert codes - decode common ones
                // "singleXTrayLop" = Single Tray Low Paper
                // "genuineHPSupplyFlow" = HP genuine supplies message (ignore)
                const isLowPaper = alertLower.includes('lop') || // HP code: "Lop" = Low Paper
                                   alertLower.includes('low') ||
                                   alertLower.includes('nearly');
                const isEmptyPaper = alertLower.includes('empty') || 
                                     alertLower.includes('out') ||
                                     alertLower.includes('nopaper');
                const isPaperAlert = alertGroup === 8 || // Input group
                                     alertLower.includes('paper') || 
                                     alertLower.includes('tray') ||
                                     isLowPaper || isEmptyPaper;
                
                // Find which tray this alert refers to
                // alertGroupIndex is the OID index that matches status.paper[trayN].oidIndex
                let matchedTrayName = null;
                
                // First try to match by OID index (alertGroupIndex)
                if (alertGroupIdx > 0) {
                  for (const [name, info] of Object.entries(status.paper)) {
                    if (info.oidIndex === alertGroupIdx) {
                      matchedTrayName = name;
                      console.log(`  📊 [SNMP] Alert matched to ${name} by OID index ${alertGroupIdx}`);
                      break;
                    }
                  }
                }
                
                // If no match by OID index, try to match by description text
                if (!matchedTrayName) {
                  const trayMatch = alertLower.match(/tray\s*(\d+)/i);
                  if (trayMatch) {
                    const trayNumFromDesc = parseInt(trayMatch[1], 10);
                    matchedTrayName = `tray${trayNumFromDesc}`;
                    console.log(`  📊 [SNMP] Alert matched to ${matchedTrayName} by description text`);
                  }
                }
                
                // If still no match, DON'T default - just skip this alert for tray matching
                if (!matchedTrayName && isPaperAlert) {
                  console.log(`  📊 [SNMP] Alert "${alertDesc}" is paper-related but couldn't match to specific tray (idx=${alertGroupIdx}) - skipping`);
                }
                
                // Check for paper-related alerts
                if (isPaperAlert && matchedTrayName) {
                  const trayInfo = status.paper[matchedTrayName];
                  const trayLabel = trayInfo?.description || matchedTrayName;
                  
                  if (isLowPaper && !isEmptyPaper) {
                    console.log(`  📊 [SNMP] → Paper LOW detected for ${matchedTrayName} (alertIdx=${alertGroupIdx})`);
                    
                    if (trayInfo) {
                      trayInfo.state = 'low';
                      trayInfo.display = '⚠️ LOW';
                      trayInfo.alertDescription = alertDesc;
                    }
                    
                    // Add warning if not already present
                    if (!status.warnings.some(w => w.code === 'paper_low' && w.tray === matchedTrayName)) {
                      status.warnings.push({
                        code: 'paper_low',
                        message: `${trayLabel} is low on paper`,
                        tray: matchedTrayName,
                      });
                    }
                  } else if (isEmptyPaper) {
                    console.log(`  📊 [SNMP] → Paper EMPTY detected for ${matchedTrayName} (alertIdx=${alertGroupIdx})`);
                    
                    if (trayInfo) {
                      trayInfo.state = 'empty';
                      trayInfo.display = '⚠️ EMPTY';
                      trayInfo.alertDescription = alertDesc;
                    }
                    
                    // Add error if not already present
                    if (!status.errors.some(e => e.code === 'paper_empty' && e.tray === matchedTrayName)) {
                      status.errors.push({
                        code: 'paper_empty',
                        message: `${trayLabel} is empty`,
                        tray: matchedTrayName,
                      });
                    }
                  }
                }
                
                // Check for ink-related alerts (group 11 = supplies)
                const isInkAlert = alertGroup === 11 ||
                                   alertLower.includes('ink') || 
                                   alertLower.includes('cartridge') || 
                                   alertLower.includes('supply');
                
                if (isInkAlert && !alertLower.includes('genuine')) { // Ignore "genuineHPSupply" messages
                  if (alertLower.includes('low')) {
                    if (!status.warnings.some(w => w.message === alertDesc)) {
                      status.warnings.push({
                        code: 'ink_low',
                        message: alertDesc,
                      });
                    }
                  } else if (alertLower.includes('empty') || alertLower.includes('out')) {
                    if (!status.errors.some(e => e.message === alertDesc)) {
                      status.errors.push({
                        code: 'no_ink',
                        message: alertDesc,
                      });
                    }
                  }
                }
              });
            }
            
            session.close();
            resolve(status);
          })
          .catch((err) => {
            console.log(`  ⚠️  SNMP walk error: ${err.message}`);
            session.close();
            resolve(status); // Return partial status
          });
      });
    });
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
   * Parse the prtPrinterDetectedErrorState bitmap
   */
  parseErrorState(value) {
    const errors = [];
    const warnings = [];
    
    // Value can be a Buffer or number
    let flags = 0;
    if (Buffer.isBuffer(value)) {
      if (value.length >= 1) flags |= value[0] << 8;
      if (value.length >= 2) flags |= value[1];
    } else {
      flags = value;
    }

    if (flags & ERROR_STATE_FLAGS.noPaper) {
      errors.push({ code: 'no_paper', message: 'Printer is out of paper' });
    } else if (flags & ERROR_STATE_FLAGS.lowPaper) {
      warnings.push({ code: 'low_paper', message: 'Printer is low on paper' });
    }

    if (flags & ERROR_STATE_FLAGS.noToner) {
      errors.push({ code: 'no_ink', message: 'Printer is out of ink' });
    } else if (flags & ERROR_STATE_FLAGS.lowToner) {
      warnings.push({ code: 'low_ink', message: 'Printer is low on ink' });
    }

    if (flags & ERROR_STATE_FLAGS.doorOpen) {
      errors.push({ code: 'door_open', message: 'Printer door is open' });
    }

    if (flags & ERROR_STATE_FLAGS.jammed) {
      errors.push({ code: 'paper_jam', message: 'Paper jam detected' });
    }

    if (flags & ERROR_STATE_FLAGS.offline) {
      errors.push({ code: 'offline', message: 'Printer is offline' });
    }

    if (flags & ERROR_STATE_FLAGS.serviceRequested) {
      warnings.push({ code: 'service_needed', message: 'Printer needs service' });
    }

    if (flags & ERROR_STATE_FLAGS.inputTrayEmpty) {
      errors.push({ code: 'tray_empty', message: 'Input tray is empty' });
    }

    if (flags & ERROR_STATE_FLAGS.outputFull) {
      errors.push({ code: 'output_full', message: 'Output tray is full' });
    } else if (flags & ERROR_STATE_FLAGS.outputNearFull) {
      warnings.push({ code: 'output_near_full', message: 'Output tray is nearly full' });
    }

    return { errors, warnings };
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

export default PrinterStatusMonitor;
