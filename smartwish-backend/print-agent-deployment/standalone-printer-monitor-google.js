#!/usr/bin/env node

import snmp from 'net-snmp';

// --- CONFIGURATION ---
const SNMP_OIDS = {
  hrPrinterStatus: '1.3.6.1.2.1.25.3.5.1.1.1', 
  hrPrinterErrorState: '1.3.6.1.2.1.25.3.5.1.2.1', 

  inkLevel: '1.3.6.1.2.1.43.11.1.1.9',
  inkMax: '1.3.6.1.2.1.43.11.1.1.8',
  inkDesc: '1.3.6.1.2.1.43.11.1.1.6',
  
  paperLevel: '1.3.6.1.2.1.43.8.2.1.10',
  paperMax: '1.3.6.1.2.1.43.8.2.1.9',
  paperDesc: '1.3.6.1.2.1.43.8.2.1.18',
  
  alertCode: '1.3.6.1.2.1.43.18.1.1.7',
  alertDesc: '1.3.6.1.2.1.43.18.1.1.8',
};

// --- HELPER FUNCTIONS ---

function cleanString(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8').replace(/\0/g, '').trim();
  return String(value).trim();
}

function parseNumber(value) {
  if (Buffer.isBuffer(value)) return parseInt(value.toString('hex'), 16);
  return Number(value);
}

// --- MAIN MONITOR CLASS ---

class PrinterMonitor {
  constructor(ip, community, interval) {
    this.ip = ip;
    this.community = community;
    this.interval = interval;
  }

  async walk(session, oid) {
    return new Promise((resolve) => {
      const results = {};
      session.subtree(oid, (varbinds) => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) results[vb.oid.toString()] = vb.value;
        }
      }, () => resolve(results));
    });
  }

  async getStatus() {
    const session = snmp.createSession(this.ip, this.community, { timeout: 5000, retries: 1 });
    
    try {
      const timestamp = new Date().toISOString();

      // 1. GET ALERTS (Needed for logic correction)
      const alerts = await this.walk(session, SNMP_OIDS.alertCode);
      const alertDescs = await this.walk(session, SNMP_OIDS.alertDesc);
      
      const rawAlerts = [];
      Object.keys(alerts).forEach(key => {
          const index = key.split('.').pop();
          const descKey = Object.keys(alertDescs).find(k => k.endsWith(`.${index}`));
          if (descKey) {
            const msg = cleanString(alertDescs[descKey]);
            // Filter out "genuineHP" info messages
            if (!msg.includes("genuineHP")) rawAlerts.push(msg);
          }
      });

      // 2. GET BASIC STATUS
      const basicOids = [SNMP_OIDS.hrPrinterStatus, SNMP_OIDS.hrPrinterErrorState];
      session.get(basicOids, async (err, varbinds) => {
        if (err) {
          console.log(JSON.stringify({ error: "Connection Failed", ip: this.ip }));
          session.close();
          return;
        }

        const stateVal = parseNumber(varbinds[0].value);
        const errorVal = parseNumber(varbinds[1].value); 
        
        // --- LOGIC CORRECTION: FAKE DOOR OPEN ---
        const hasPaperAlert = rawAlerts.some(a => 
            a.toLowerCase().includes('empty') || a.toLowerCase().includes('load')
        );

        // Analyze Flags
        const flags = {
            lowPaper: (errorVal & 1) !== 0,
            noPaper: (errorVal & 2) !== 0,
            doorOpen: (errorVal & 4) !== 0,
            jam: (errorVal & 8) !== 0,
            offline: (errorVal & 16) !== 0,
            service: (errorVal & 32) !== 0
        };

        // Apply Fix: If DoorOpen + PaperAlert, it's actually just NoPaper
        if (flags.doorOpen && hasPaperAlert) {
            flags.doorOpen = false;
            flags.noPaper = true;
        }

        // Determine Human Readable Status
        let displayStatus = "UNKNOWN";
        if (stateVal === 3) displayStatus = "IDLE";
        if (stateVal === 4) displayStatus = "PRINTING";
        if (stateVal === 5) displayStatus = "WARMUP";

        if (flags.jam) displayStatus = "PAUSED (Paper Jam)";
        else if (flags.doorOpen) displayStatus = "PAUSED (Door Open)";
        else if (flags.noPaper) displayStatus = "PAUSED (Load Paper)";
        else if (flags.service) displayStatus = "SERVICE REQUIRED";

        // 3. GET CONSUMABLES
        const inkLevels = await this.walk(session, SNMP_OIDS.inkLevel);
        const inkMax = await this.walk(session, SNMP_OIDS.inkMax);
        const inkDesc = await this.walk(session, SNMP_OIDS.inkDesc);

        const inks = [];
        Object.keys(inkLevels).forEach((key) => {
          const index = key.split('.').pop();
          const descKey = Object.keys(inkDesc).find(k => k.endsWith(`.${index}`));
          const maxKey = Object.keys(inkMax).find(k => k.endsWith(`.${index}`));

          const val = parseNumber(inkLevels[key]);
          const max = maxKey ? parseNumber(inkMax[maxKey]) : 100;
          const name = descKey ? cleanString(inkDesc[descKey]) : "Supply";
          
          let percent = 0;
          if (max > 0 && val >= 0) percent = Math.round((val / max) * 100);

          inks.push({ name, percent, rawValue: val });
        });

        // 4. GET PAPER TRAYS (De-duplicated)
        const paperLevels = await this.walk(session, SNMP_OIDS.paperLevel);
        const paperDesc = await this.walk(session, SNMP_OIDS.paperDesc);
        const trays = [];
        const seenTrays = new Set();

        Object.keys(paperLevels).forEach((key) => {
          const suffix = key.substring(SNMP_OIDS.paperLevel.length); 
          const descOid = SNMP_OIDS.paperDesc + suffix;
          const val = parseNumber(paperLevels[key]);
          const name = paperDesc[descOid] ? cleanString(paperDesc[descOid]) : `Input ${suffix}`;
          
          let status = "UNKNOWN";
          if (val === -3 || val > 0) status = "OK";
          else if (val === 0) status = "EMPTY";
          
          const uniqueId = `${name}-${status}`;
          if (!seenTrays.has(uniqueId)) {
              seenTrays.add(uniqueId);
              trays.push({ name, status, rawValue: val });
          }
        });

        // --- FINAL JSON OUTPUT ---
        const result = {
            meta: {
                ip: this.ip,
                timestamp: timestamp
            },
            status: {
                display: displayStatus,
                code: stateVal,
                errorHex: `0x${errorVal.toString(16)}`
            },
            flags: flags,
            alerts: rawAlerts,
            supplies: {
                ink: inks,
                paper: trays
            }
        };

        console.log(JSON.stringify(result, null, 2));
        
        session.close();
      });

    } catch (e) {
      console.log(JSON.stringify({ error: e.message }));
      session.close();
    }
  }

  start() {
    this.getStatus();
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log(JSON.stringify({ error: "Missing IP argument" }));
  process.exit(1);
}

new PrinterMonitor(args[0], args[1] || 'public', parseInt(args[2]) || 5000).start();