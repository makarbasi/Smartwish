# SNMP Connection Troubleshooting Guide

## Your Question: Why Does Standalone Code Not Connect via SNMP?

### Short Answer
**YES, both the original and standalone code use SNMP the same way.** The issue is likely:
1. **Windows Firewall** blocking the standalone script
2. **SNMP community string** incorrect ("private" vs "public")
3. **SNMP not enabled** on the printer
4. **Network configuration** difference

---

## Detailed Analysis

### Does Original Code Use SNMP?
**YES!** Both files use identical SNMP approach:

#### Original Code (`printer-status-monitor.js`, line 339-342):
```javascript
const session = snmp.createSession(this.printerIP, this.snmpCommunity, {
  timeout: 5000,
  retries: 1,
});
```

#### Standalone Code (`standalone-printer-monitor.js`, line 308-311):
```javascript
const testSession = snmp.createSession(this.printerIP, this.community, {
  timeout: 10000,
  retries: 2,
});
```

Both use:
- ✅ Same library: `net-snmp` (version 3.11.2)
- ✅ Same method: `snmp.createSession()`
- ✅ Same OIDs for printer status
- ✅ Same approach for walking SNMP tables

### Key Differences

| Aspect | Original | Standalone |
|--------|----------|------------|
| **Timeout** | 5000ms | 10000ms (better) |
| **Retries** | 1 | 2 (better) |
| **Context** | Runs as part of print agent | Runs independently |
| **Integration** | Part of larger system | Standalone utility |

---

## Why Your Standalone Script Fails

### Most Likely Causes (in order of probability):

### 1. **SNMP Community String** ⚠️
You're using `"private"` but most printers default to `"public"`:

```bash
# Try this instead:
node standalone-printer-monitor.js 192.168.1.108 public 10000
```

**Why this matters:**
- SNMP community strings are like passwords
- Most HP printers ship with `"public"` as default read-only community
- `"private"` is typically the read-write community (if enabled at all)

### 2. **Windows Firewall** 🛡️
Windows Firewall may be blocking outbound SNMP (UDP port 161):

**Check firewall:**
```powershell
Get-NetFirewallProfile | Select-Object Name, Enabled
```

**Temporary test - disable firewall:**
```powershell
# Run as Administrator
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False
# Test your script
# Re-enable after test:
Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True
```

**Permanent fix - allow SNMP:**
```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "SNMP Out" -Direction Outbound -Protocol UDP -LocalPort 161 -Action Allow
New-NetFirewallRule -DisplayName "SNMP In" -Direction Inbound -Protocol UDP -LocalPort 161 -Action Allow
```

### 3. **SNMP Not Enabled on Printer** 🖨️
Many printers ship with SNMP disabled by default.

**How to enable on HP printers:**
1. Open browser to: `http://192.168.1.108` (your printer IP)
2. Go to: **Network** → **Network Identification** → **SNMP**
3. Enable: **SNMPv1/v2c Read**
4. Set community: `public` (read-only)
5. Save settings

### 4. **Administrator Privileges** 👑
Some Windows versions require admin rights for SNMP:

```bash
# Run PowerShell as Administrator, then:
node standalone-printer-monitor.js 192.168.1.108 public 10000
```

---

## Diagnostic Steps

### Step 1: Run the Diagnostic Tool
We've created a comprehensive diagnostic tool for you:

```bash
node test-snmp-connection.js 192.168.1.108 public
```

This will test:
- ✅ Network connectivity (ping)
- ✅ HTTP connectivity (printer web interface)
- ✅ SNMP port (UDP 161)
- ✅ SNMP basic query (system description)
- ✅ SNMP printer status
- ✅ SNMP table walks
- ✅ Windows Firewall status

### Step 2: Try Different Community Strings
```bash
# Try public (most common)
node standalone-printer-monitor.js 192.168.1.108 public 10000

# Try private
node standalone-printer-monitor.js 192.168.1.108 private 10000

# Try empty string (some printers)
node standalone-printer-monitor.js 192.168.1.108 "" 10000
```

### Step 3: Check Printer SNMP Settings
1. Open browser: `http://192.168.1.108`
2. Look for: Network → SNMP settings
3. Verify:
   - ✅ SNMP v1/v2 is enabled
   - ✅ Community string is set (note it down)
   - ✅ Read access is enabled

### Step 4: Compare with Working Original
If the original works but standalone doesn't:

```bash
# From the print-agent-deployment directory:
# Run the full print agent (which works)
node local-print-agent.js

# In another terminal, check if SNMP monitoring works
# Look for logs like: "📊 [SNMP] Found X input sources"
```

---

## Common HP Printer SNMP Settings

### HP OfficeJet Pro Series
- **Default Community:** `public` (read-only)
- **Web Interface:** Enabled by default
- **SNMP:** Enabled by default
- **Port:** UDP 161 (standard)

### HP LaserJet Series
- **Default Community:** `public` (read-only)
- **Web Interface:** Enabled by default
- **SNMP:** May need manual enable in EWS (Embedded Web Server)
- **Port:** UDP 161 (standard)

---

## Quick Fixes

### Fix 1: Try with Administrator Rights
```bash
# Right-click PowerShell → "Run as Administrator"
cd "d:\Projects\Smartwish\Code\Smartwish\smartwish-backend\print-agent-deployment"
node standalone-printer-monitor.js 192.168.1.108 public 10000
```

### Fix 2: Increase Timeout
Edit `standalone-printer-monitor.js` line 309:
```javascript
// Change from:
timeout: 10000,

// To:
timeout: 20000,  // 20 seconds
```

### Fix 3: Use SNMPv1 Explicitly
Edit `standalone-printer-monitor.js` line 308-311:
```javascript
const testSession = snmp.createSession(this.printerIP, this.community, {
  timeout: 10000,
  retries: 2,
  version: snmp.Version1,  // Add this line
});
```

---

## Verification Checklist

Before running the standalone script, verify:

- [ ] Printer is powered on
- [ ] Printer is connected to network (WiFi or Ethernet)
- [ ] Computer can ping printer: `ping 192.168.1.108`
- [ ] Printer web interface accessible: `http://192.168.1.108`
- [ ] SNMP enabled on printer (check web interface)
- [ ] Correct community string (try `public` first)
- [ ] Windows Firewall allows SNMP (UDP 161)
- [ ] Running with Administrator privileges
- [ ] No VPN or proxy interfering

---

## Expected Output (When Working)

```
🖨️  Starting Printer Monitor
   Printer IP: 192.168.1.108
   SNMP Community: public
   Poll Interval: 10000ms

Testing SNMP connectivity...
  ✅ SNMP connectivity OK

[12:34:56] Checking printer status...
  📊 Printer State: idle
  📊 Device State: 2
  📊 Error State: 0x0

  🖨️  Ink/Toner Levels:
    🟢 BLACK: 75% (HP 910 Black)
    🟢 CYAN: 82% (HP 910 Cyan)
    🟢 MAGENTA: 68% (HP 910 Magenta)
    🟢 YELLOW: 91% (HP 910 Yellow)

  📄 Paper Trays:
    🟢 tray1: ✓ OK (Tray 1)

  ⚠️  Active Alerts:
    ✅ No active alerts
```

---

## Still Not Working?

If none of the above works, check:

1. **Printer Model Compatibility**
   - Some very old printers don't support SNMP
   - Some very new printers only support SNMPv3 (requires auth)

2. **Network Issues**
   - Computer and printer on same subnet?
   - Any VLAN isolation?
   - Router/switch blocking SNMP?

3. **Antivirus Software**
   - Some antivirus blocks SNMP
   - Temporarily disable to test

4. **Try from Different Computer**
   - Rules out computer-specific issues

---

## Getting Help

If you're still stuck, run this and share the output:

```bash
# Full diagnostic
node test-snmp-connection.js 192.168.1.108 public > diagnostic.log 2>&1

# Also get printer info
ping 192.168.1.108
nslookup 192.168.1.108

# Share the diagnostic.log file
```

---

## Summary

**The standalone code DOES use SNMP correctly** - it's identical to the original code. The connection issue is most likely:

1. 🔑 **Wrong community string** → Try `"public"` instead of `"private"`
2. 🛡️ **Windows Firewall** → Allow UDP port 161
3. 🖨️ **SNMP not enabled** → Enable in printer web interface
4. 👑 **Needs admin rights** → Run as Administrator

Run the diagnostic tool first:
```bash
node test-snmp-connection.js 192.168.1.108 public
```

This will identify the exact issue.
