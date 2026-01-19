#!/usr/bin/env node

/**
 * Standalone Printer SNMP Monitor
 * 
 * Monitors a printer via SNMP and reports status changes and errors.
 * 
 * Usage:
 *   node standalone-printer-monitor.js <PRINTER_IP> [COMMUNITY] [INTERVAL_MS]
 * 
 * Example:
 *   node standalone-printer-monitor.js 192.168.1.100 public 10000
 */

import snmp from 'net-snmp';

// SNMP OIDs
const SNMP_OIDS = {
  // Initial status queries
  hrPrinterStatus: '1.3.6.1.2.1.25.3.5.1.1.1',
  hrDeviceStatus: '1.3.6.1.2.1.25.3.2.1.5.1',
  prtPrinterDetectedErrorState: '1.3.6.1.2.1.25.3.5.1.2.1',
  
  // Table walks - Marker Supplies (ink/toner)
  prtMarkerSuppliesLevel: '1.3.6.1.2.1.43.11.1.1.9',
  prtMarkerSuppliesMaxCapacity: '1.3.6.1.2.1.43.11.1.1.8',
  prtMarkerSuppliesDescription: '1.3.6.1.2.1.43.11.1.1.6',
  
  // Table walks - Paper Trays
  prtInputCurrentLevel: '1.3.6.1.2.1.43.8.2.1.10',
  prtInputMaxCapacity: '1.3.6.1.2.1.43.8.2.1.9',
  prtInputDescription: '1.3.6.1.2.1.43.8.2.1.18',
  prtInputStatus: '1.3.6.1.2.1.43.8.2.1.11',
  
  // Table walks - Alerts
  prtAlertDescription: '1.3.6.1.2.1.43.18.1.1.8',
  prtAlertGroup: '1.3.6.1.2.1.43.18.1.1.2',
  prtAlertGroupIndex: '1.3.6.1.2.1.43.18.1.1.3',
  prtAlertCode: '1.3.6.1.2.1.43.18.1.1.7',
  prtAlertSeverityLevel: '1.3.6.1.2.1.43.18.1.1.4',
};

// Printer status codes
const PRINTER_STATUS = {
  1: 'other',
  2: 'unknown',
  3: 'idle',
  4: 'printing',
  5: 'warmup',
};

// Helper functions
function snmpValueToString(value) {
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8').replace(/\0/g, '');
  }
  return String(value);
}

function snmpValueToNumber(value) {
  if (Buffer.isBuffer(value)) {
    return parseInt(value.toString('hex'), 16);
  }
  return Number(value);
}

function interpretSNMPLevel(level, max) {
  if (level === -1) return { level: -1, state: 'other', display: 'Other' };
  if (level === -2) return { level: -1, state: 'unknown', display: 'Unknown' };
  if (level === -3) return { level: -1, state: 'present', display: 'Present' };
  if (max > 0 && level >= 0) {
    const percent = Math.round((level / max) * 100);
    if (level === 0) return { level: 0, state: 'empty', display: '0% (Empty)' };
    if (percent < 20) return { level: percent, state: 'low', display: `${percent}% (Low)` };
    return { level: percent, state: 'ok', display: `${percent}%` };
  }
  return { level: level, state: 'unknown', display: `Raw: ${level}` };
}

/**
 * Walk an SNMP table
 */
function walkSNMPTable(session, baseOid) {
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
        console.error(`  ⚠️  Error walking ${baseOid}: ${error.message}`);
      }
      resolve(results);
    });
  });
}

/**
 * Get initial printer status
 */
async function getInitialStatus(session) {
  return new Promise((resolve) => {
    const oids = [
      SNMP_OIDS.hrPrinterStatus,
      SNMP_OIDS.hrDeviceStatus,
      SNMP_OIDS.prtPrinterDetectedErrorState,
    ];

    session.get(oids, (error, varbinds) => {
      if (error) {
        console.error(`  ❌ SNMP query failed: ${error.message}`);
        session.close();
        resolve(null);
        return;
      }

      const status = {
        printerState: 'unknown',
        deviceState: 'unknown',
        errorState: null,
        oids: {}, // Store OID values
      };

      for (const varbind of varbinds) {
        if (snmp.isVarbindError(varbind)) continue;

        const oid = varbind.oid.toString();
        const rawValue = Buffer.isBuffer(varbind.value) ? varbind.value.toString('hex') : varbind.value;
        
        if (oid.includes('25.3.5.1.1')) {
          status.printerState = PRINTER_STATUS[varbind.value] || 'unknown';
          status.oids.hrPrinterStatus = { oid, rawValue, interpreted: status.printerState };
        } else if (oid.includes('25.3.2.1.5')) {
          status.deviceState = varbind.value;
          status.oids.hrDeviceStatus = { oid, rawValue, interpreted: varbind.value };
        } else if (oid.includes('25.3.5.1.2')) {
          status.errorState = snmpValueToNumber(varbind.value);
          status.oids.prtPrinterDetectedErrorState = { oid, rawValue, interpreted: `0x${status.errorState.toString(16)}` };
        }
      }

      resolve(status);
    });
  });
}

/**
 * Get detailed ink/toner levels
 */
async function getInkLevels(session) {
  try {
    const levels = await walkSNMPTable(session, SNMP_OIDS.prtMarkerSuppliesLevel);
    const maxCapacities = await walkSNMPTable(session, SNMP_OIDS.prtMarkerSuppliesMaxCapacity);
    const descriptions = await walkSNMPTable(session, SNMP_OIDS.prtMarkerSuppliesDescription);

    const inkLevels = {};
    const colors = ['black', 'cyan', 'magenta', 'yellow'];
    
    Object.keys(levels).forEach((key, i) => {
      const rawLevel = snmpValueToNumber(levels[key]);
      const maxKeys = Object.keys(maxCapacities);
      const descKeys = Object.keys(descriptions);
      const max = maxKeys[i] ? snmpValueToNumber(maxCapacities[maxKeys[i]]) : 100;
      const desc = descKeys[i] ? snmpValueToString(descriptions[descKeys[i]]) : '';
      
      const levelInfo = interpretSNMPLevel(rawLevel, max);
      
      // Try to determine color from description
      let color = colors[i] || `supply_${i}`;
      const descLower = desc.toLowerCase();
      if (descLower.includes('black')) color = 'black';
      else if (descLower.includes('cyan')) color = 'cyan';
      else if (descLower.includes('magenta')) color = 'magenta';
      else if (descLower.includes('yellow')) color = 'yellow';
      
      // Store OID information
      const levelOid = key;
      const maxOid = maxKeys[i] || 'N/A';
      const descOid = descKeys[i] || 'N/A';
      
      inkLevels[color] = {
        ...levelInfo,
        description: desc,
        rawValue: rawLevel,
        oids: {
          level: { oid: levelOid, rawValue: rawLevel },
          maxCapacity: { oid: maxOid, rawValue: max },
          description: { oid: descOid, rawValue: desc },
        },
      };
    });

    return inkLevels;
  } catch (error) {
    console.error(`  ❌ Error getting ink levels: ${error.message}`);
    return {};
  }
}

/**
 * Get paper tray status
 */
async function getPaperTrays(session) {
  try {
    const levels = await walkSNMPTable(session, SNMP_OIDS.prtInputCurrentLevel);
    const maxCapacities = await walkSNMPTable(session, SNMP_OIDS.prtInputMaxCapacity);
    const descriptions = await walkSNMPTable(session, SNMP_OIDS.prtInputDescription);
    const statuses = await walkSNMPTable(session, SNMP_OIDS.prtInputStatus);

    const trays = {};
    
    Object.keys(levels).forEach((oid) => {
      const index = oid.split('.').pop();
      const rawLevel = snmpValueToNumber(levels[oid]);
      
      // Find matching entries by index
      const maxOid = Object.keys(maxCapacities).find(o => o.endsWith(`.${index}`));
      const descOid = Object.keys(descriptions).find(o => o.endsWith(`.${index}`));
      const statusOid = Object.keys(statuses).find(o => o.endsWith(`.${index}`));
      
      const max = maxOid ? snmpValueToNumber(maxCapacities[maxOid]) : -2;
      const desc = descOid ? snmpValueToString(descriptions[descOid]) : `Tray ${index}`;
      const statusCode = statusOid ? snmpValueToNumber(statuses[statusOid]) : 0;
      
      const levelInfo = interpretSNMPLevel(rawLevel, max);
      
      // Parse status bitmask (simplified)
      const hasCriticalAlert = (statusCode & 0x80) !== 0;
      const hasNonCriticalAlert = (statusCode & 0x40) !== 0;
      
      if (hasCriticalAlert) levelInfo.state = 'empty';
      else if (hasNonCriticalAlert) levelInfo.state = 'low';
      
      trays[`tray${index}`] = {
        ...levelInfo,
        description: desc,
        rawValue: rawLevel,
        statusCode: statusCode,
        oids: {
          level: { oid: oid, rawValue: rawLevel },
          maxCapacity: { oid: maxOid || 'N/A', rawValue: max },
          description: { oid: descOid || 'N/A', rawValue: desc },
          status: { oid: statusOid || 'N/A', rawValue: statusCode },
        },
      };
    });

    return trays;
  } catch (error) {
    console.error(`  ❌ Error getting paper trays: ${error.message}`);
    return {};
  }
}

/**
 * Get active alerts
 */
async function getAlerts(session) {
  try {
    const descriptions = await walkSNMPTable(session, SNMP_OIDS.prtAlertDescription);
    const groups = await walkSNMPTable(session, SNMP_OIDS.prtAlertGroup);
    const groupIndexes = await walkSNMPTable(session, SNMP_OIDS.prtAlertGroupIndex);
    const codes = await walkSNMPTable(session, SNMP_OIDS.prtAlertCode);
    const severities = await walkSNMPTable(session, SNMP_OIDS.prtAlertSeverityLevel);

    const alerts = [];
    const descKeys = Object.keys(descriptions);
    
    descKeys.forEach((oid, i) => {
      const desc = snmpValueToString(descriptions[oid]);
      const groupKeys = Object.keys(groups);
      const idxKeys = Object.keys(groupIndexes);
      const codeKeys = Object.keys(codes);
      const sevKeys = Object.keys(severities);
      
      const group = groupKeys[i] ? snmpValueToNumber(groups[groupKeys[i]]) : 0;
      const groupIdx = idxKeys[i] ? snmpValueToNumber(groupIndexes[idxKeys[i]]) : 0;
      const code = codeKeys[i] ? snmpValueToNumber(codes[codeKeys[i]]) : 0;
      const severity = sevKeys[i] ? snmpValueToNumber(severities[sevKeys[i]]) : 0;
      
      // Severity: 1=other, 2=critical, 3=warning
      const severityText = severity === 2 ? 'critical' : severity === 3 ? 'warning' : 'info';
      
      alerts.push({
        description: desc,
        group: group,
        groupIndex: groupIdx,
        code: code,
        severity: severityText,
        oids: {
          description: { oid: oid, rawValue: desc },
          group: { oid: groupKeys[i] || 'N/A', rawValue: group },
          groupIndex: { oid: idxKeys[i] || 'N/A', rawValue: groupIdx },
          code: { oid: codeKeys[i] || 'N/A', rawValue: code },
          severity: { oid: sevKeys[i] || 'N/A', rawValue: severity },
        },
      });
    });

    return alerts;
  } catch (error) {
    console.error(`  ❌ Error getting alerts: ${error.message}`);
    return [];
  }
}

/**
 * Monitor printer and report changes
 */
class PrinterMonitor {
  constructor(printerIP, community = 'public', interval = 10000) {
    this.printerIP = printerIP;
    this.community = community;
    this.interval = interval;
    this.lastStatus = null;
    this.lastAlerts = new Set();
    this.running = false;
  }

  async start() {
    console.log(`\n🖨️  Starting Printer Monitor`);
    console.log(`   Printer IP: ${this.printerIP}`);
    console.log(`   SNMP Community: ${this.community}`);
    console.log(`   Poll Interval: ${this.interval}ms`);
    
    if (this.interval < 5000) {
      console.log(`   ⚠️  Warning: Poll interval is very short (${this.interval}ms). Recommended: 10000ms or more.`);
    }
    console.log('');

    // Test connectivity first
    console.log('Testing SNMP connectivity...');
    const testSession = snmp.createSession(this.printerIP, this.community, {
      timeout: 10000,
      retries: 2,
    });

    const testResult = await new Promise((resolve) => {
      // Try a simple OID first (system description is usually available)
      testSession.get(['1.3.6.1.2.1.1.1.0'], (error, varbinds) => {
        if (error) {
          console.error(`  ❌ Connectivity test failed: ${error.message}`);
          console.error(`  💡 Troubleshooting tips:`);
          console.error(`     - Verify printer IP: ${this.printerIP}`);
          console.error(`     - Check SNMP community string: "${this.community}"`);
          console.error(`     - Ensure SNMP is enabled on the printer`);
          console.error(`     - Check firewall/network connectivity`);
          testSession.close();
          resolve(false);
          return;
        }
        console.log('  ✅ SNMP connectivity OK\n');
        testSession.close();
        resolve(true);
      });
    });

    if (!testResult) {
      console.error('\n❌ Cannot connect to printer. Please check the settings above.');
      process.exit(1);
    }

    this.running = true;
    await this.checkStatus();
    
    // Set up interval monitoring
    this.monitorInterval = setInterval(() => {
      if (this.running) {
        this.checkStatus();
      }
    }, this.interval);
  }

  async stop() {
    this.running = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
    console.log('\n🛑 Monitor stopped');
  }

  async checkStatus() {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n[${timestamp}] Checking printer status...`);

    // Create a new session for each check (like the original code does)
    // Note: Some printers may need longer timeout or more retries
    const session = snmp.createSession(this.printerIP, this.community, {
      timeout: 10000,  // Increased from 5000 to 10000ms
      retries: 2,      // Increased from 1 to 2 retries
    });

    let sessionClosed = false;

    try {
      // Get initial status
      const initialStatus = await getInitialStatus(session);
      if (!initialStatus) {
        console.log('  ⚠️  Could not get initial status');
        if (!sessionClosed) {
          session.close();
          sessionClosed = true;
        }
        return;
      }

      console.log(`  📊 Printer State: ${initialStatus.printerState}`);
      if (initialStatus.oids.hrPrinterStatus) {
        console.log(`     OID: ${initialStatus.oids.hrPrinterStatus.oid} = ${initialStatus.oids.hrPrinterStatus.rawValue} (${initialStatus.oids.hrPrinterStatus.interpreted})`);
      }
      
      console.log(`  📊 Device State: ${initialStatus.deviceState}`);
      if (initialStatus.oids.hrDeviceStatus) {
        console.log(`     OID: ${initialStatus.oids.hrDeviceStatus.oid} = ${initialStatus.oids.hrDeviceStatus.rawValue}`);
      }
      
      if (initialStatus.errorState !== null) {
        console.log(`  📊 Error State: 0x${initialStatus.errorState.toString(16)}`);
        if (initialStatus.oids.prtPrinterDetectedErrorState) {
          console.log(`     OID: ${initialStatus.oids.prtPrinterDetectedErrorState.oid} = ${initialStatus.oids.prtPrinterDetectedErrorState.rawValue} (${initialStatus.oids.prtPrinterDetectedErrorState.interpreted})`);
        }
      }

      // Get detailed info
      console.log('\n  🖨️  Ink/Toner Levels:');
      const inkLevels = await getInkLevels(session);
      for (const [color, info] of Object.entries(inkLevels)) {
        const icon = info.state === 'empty' ? '🔴' : info.state === 'low' ? '🟡' : '🟢';
        console.log(`    ${icon} ${color.toUpperCase()}: ${info.display} ${info.description ? `(${info.description})` : ''}`);
        if (info.oids) {
          console.log(`       Level OID: ${info.oids.level.oid} = ${info.oids.level.rawValue}`);
          console.log(`       Max OID: ${info.oids.maxCapacity.oid} = ${info.oids.maxCapacity.rawValue}`);
          console.log(`       Desc OID: ${info.oids.description.oid} = "${info.oids.description.rawValue}"`);
        }
      }

      console.log('\n  📄 Paper Trays:');
      const trays = await getPaperTrays(session);
      for (const [trayName, info] of Object.entries(trays)) {
        const icon = info.state === 'empty' ? '🔴' : info.state === 'low' ? '🟡' : '🟢';
        console.log(`    ${icon} ${trayName}: ${info.display} (${info.description})`);
        if (info.oids) {
          console.log(`       Level OID: ${info.oids.level.oid} = ${info.oids.level.rawValue}`);
          console.log(`       Max OID: ${info.oids.maxCapacity.oid} = ${info.oids.maxCapacity.rawValue}`);
          console.log(`       Status OID: ${info.oids.status.oid} = ${info.oids.status.rawValue} (0x${info.oids.status.rawValue.toString(16)})`);
          console.log(`       Desc OID: ${info.oids.description.oid} = "${info.oids.description.rawValue}"`);
        }
      }

      // Get alerts
      console.log('\n  ⚠️  Active Alerts:');
      const alerts = await getAlerts(session);
      
      if (alerts.length === 0) {
        console.log('    ✅ No active alerts');
      } else {
        const currentAlertKeys = new Set();
        
        alerts.forEach(alert => {
          const key = `${alert.description}-${alert.groupIndex}`;
          currentAlertKeys.add(key);
          
          // Check if this is a new alert
          if (!this.lastAlerts.has(key)) {
            const severityIcon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️';
            console.log(`    ${severityIcon} [NEW] ${alert.severity.toUpperCase()}: ${alert.description}`);
            console.log(`       Group: ${alert.group}, Index: ${alert.groupIndex}, Code: ${alert.code}`);
            if (alert.oids) {
              console.log(`       Desc OID: ${alert.oids.description.oid} = "${alert.oids.description.rawValue}"`);
              console.log(`       Group OID: ${alert.oids.group.oid} = ${alert.oids.group.rawValue}`);
              console.log(`       GroupIdx OID: ${alert.oids.groupIndex.oid} = ${alert.oids.groupIndex.rawValue}`);
              console.log(`       Code OID: ${alert.oids.code.oid} = ${alert.oids.code.rawValue}`);
              console.log(`       Severity OID: ${alert.oids.severity.oid} = ${alert.oids.severity.rawValue}`);
            }
          } else {
            const severityIcon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️';
            console.log(`    ${severityIcon} ${alert.severity.toUpperCase()}: ${alert.description}`);
            if (alert.oids) {
              console.log(`       Desc OID: ${alert.oids.description.oid} = "${alert.oids.description.rawValue}"`);
            }
          }
        });
        
        // Check for resolved alerts
        this.lastAlerts.forEach(key => {
          if (!currentAlertKeys.has(key)) {
            console.log(`    ✅ [RESOLVED] Alert: ${key.split('-')[0]}`);
          }
        });
        
        this.lastAlerts = currentAlertKeys;
      }

      // Store status for comparison
      this.lastStatus = {
        printerState: initialStatus.printerState,
        inkLevels,
        trays,
        alerts,
      };

    } catch (error) {
      console.error(`  ❌ Error checking status: ${error.message}`);
      if (!sessionClosed && session) {
        session.close();
        sessionClosed = true;
      }
    } finally {
      // Close the session after each check (like the original code does)
      if (!sessionClosed && session) {
        session.close();
      }
    }
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: node standalone-printer-monitor.js <PRINTER_IP> [COMMUNITY] [INTERVAL_MS]');
  console.error('Example: node standalone-printer-monitor.js 192.168.1.100 public 10000');
  process.exit(1);
}

const printerIP = args[0];
const community = args[1] || 'public';
const interval = parseInt(args[2] || '10000', 10);

const monitor = new PrinterMonitor(printerIP, community, interval);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down...');
  await monitor.stop();
  process.exit(0);
});

// Start monitoring
monitor.start().catch(error => {
  console.error(`❌ Failed to start monitor: ${error.message}`);
  process.exit(1);
});
