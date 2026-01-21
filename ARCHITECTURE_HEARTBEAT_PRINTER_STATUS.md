# Smartwish Architecture: Heartbeat & Printer Health Monitoring

## Overview

The Smartwish system uses two separate monitoring mechanisms:
1. **Kiosk Heartbeat** - Tracks if the kiosk browser is online/active
2. **Printer Health Reports** - Monitors actual printer hardware status (ink, paper, errors)

---

## 1. Kiosk Heartbeat System

### Purpose
Tracks whether the kiosk browser application is running and responsive. This indicates if customers can interact with the kiosk.

### Architecture

```
┌─────────────────┐
│  Kiosk Browser  │  (Frontend React App)
│  (React/Next.js)│
└────────┬────────┘
         │
         │ POST /api/kiosk/heartbeat
         │ Every 60 seconds
         │ { kioskId: "uuid" }
         │
         ▼
┌─────────────────┐
│  Frontend API   │  (Next.js API Route)
│  /api/kiosk/    │
│  heartbeat      │
└────────┬────────┘
         │
         │ Updates kiosk_configs.config.lastHeartbeat
         │
         ▼
┌─────────────────┐
│   Supabase DB   │
│ kiosk_configs   │
│   (JSONB field) │
└─────────────────┘
```

### Implementation Details

**Frontend (KioskContext.tsx):**
- Sends heartbeat every **60 seconds** when kiosk is activated
- Only sends on kiosk pages (not admin/manager pages)
- Includes rate limiting/backoff handling
- Stores heartbeat timestamp in `localStorage` cache

**Backend Endpoint (`/api/kiosk/heartbeat`):**
- Accepts POST request with `kioskId`
- Updates `kiosk_configs.config.lastHeartbeat` timestamp
- Returns success/error response

**Status Calculation:**
- Device is considered **online** if heartbeat was received within:
  - **2 minutes** (if there's an active user session)
  - **90 seconds** (if no active session)
- Device is **offline** if no heartbeat received beyond threshold

### Data Storage
- Stored in: `kiosk_configs.config` (JSONB field)
- Field: `lastHeartbeat` (ISO timestamp string)
- Example: `{ "lastHeartbeat": "2026-01-21T08:45:30.123Z" }`

---

## 2. Printer Health Reporting System

### Purpose
Monitors actual printer hardware status (ink levels, paper, errors, connectivity) and reports to the cloud for admin visibility.

### Architecture

```
┌─────────────────────────┐
│  Local Print Agent      │  (Node.js script running on kiosk PC)
│  printer-status-monitor │
└────────────┬────────────┘
             │
             │ Polls printer via SNMP/Windows APIs
             │ Every 30 seconds
             │
             ▼
┌─────────────────────────┐
│  HP Printer Hardware     │
│  (SNMP, Windows APIs)    │
└─────────────────────────┘
             │
             │ Status data:
             │ - Online/offline
             │ - Ink levels (black, cyan, magenta, yellow)
             │ - Paper levels (tray1, tray2)
             │ - Errors (paper jam, door open, etc.)
             │ - Warnings (low ink, low paper)
             │
             ▼
┌─────────────────────────┐
│  Local Print Agent       │
│  reportStatus()          │
└────────────┬────────────┘
             │
             │ POST /kiosk/printer-status
             │ Every 60 seconds (or on significant change)
             │ { kioskId, status: {...} }
             │
             ▼
┌─────────────────────────┐
│  Backend API            │  (NestJS)
│  POST /kiosk/printer-   │
│  status                 │
└────────────┬────────────┘
             │
             │ Updates database
             │ Creates/resolves alerts
             │
             ▼
┌─────────────────────────┐
│   Database              │
│   - kiosk_printers      │  (printer status)
│   - kiosk_alerts        │  (critical issues)
└─────────────────────────┘
```

### Implementation Details

**Local Print Agent (`printer-status-monitor.js`):**

1. **Status Collection:**
   - Uses SNMP to query printer (if network printer)
   - Uses Windows print queue APIs
   - Checks connectivity via ping
   - Polls every **30 seconds**

2. **Status Reporting:**
   - Reports to cloud every **60 seconds** (or immediately on errors)
   - Only reports if status changed significantly OR if errors/warnings exist
   - Skips redundant reports when status is stable

3. **Multi-Printer Support:**
   - `MultiPrinterMonitor` class handles multiple printers per kiosk
   - Reports all printers in batch via `PUT /local-agent/printer-status`

**Backend Endpoints:**

1. **Single Printer Status:**
   - `POST /kiosk/printer-status` - Single printer report
   - Stores in `kiosk_configs.config.printerStatus`

2. **Multi-Printer Status:**
   - `PUT /local-agent/printer-status` - Batch printer reports
   - Updates `kiosk_printers` table with individual printer statuses

**Status Data Structure:**
```typescript
{
  timestamp: string;
  online: boolean;
  printerState: 'idle' | 'printing' | 'warmup' | 'unknown';
  printerIP?: string;
  printerName?: string;
  ink: {
    black?: { level: number; state: string };
    cyan?: { level: number; state: string };
    magenta?: { level: number; state: string };
    yellow?: { level: number; state: string };
  };
  paper: {
    tray1?: { level: number; description: string; state: string };
    tray2?: { level: number; description: string; state: string };
  };
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  printQueue: {
    jobCount: number;
    jobs: Array<{ id: number; status: string; name?: string }>;
  };
}
```

---

## 3. Alert System

### Purpose
Automatically creates and resolves alerts based on printer status changes.

### Alert Types

1. **PRINTER_OFFLINE** (ERROR)
   - Triggered when `status.online === false`
   - Auto-resolved when printer comes back online

2. **INK_EMPTY** (CRITICAL)
   - Triggered when any ink level = 0%
   - Auto-resolved when ink level > 0%

3. **INK_LOW** (WARNING)
   - Triggered when any ink level < 20%
   - Auto-resolved when ink level >= 20%

4. **PAPER_EMPTY** (CRITICAL)
   - Triggered when paper tray is empty
   - Auto-resolved when paper is refilled

5. **PAPER_LOW** (WARNING)
   - Triggered when paper is low
   - Auto-resolved when paper is refilled

### Alert Flow

```
Printer Status Report
         │
         ▼
Backend receives status
         │
         ▼
handlePrinterAlerts()
         │
         ├─► Check for issues
         │   ├─► Offline? → Create PRINTER_OFFLINE alert
         │   ├─► Ink empty? → Create INK_EMPTY alert
         │   ├─► Ink low? → Create INK_LOW alert
         │   ├─► Paper empty? → Create PAPER_EMPTY alert
         │   └─► Paper low? → Create PAPER_LOW alert
         │
         └─► Check for resolved issues
             ├─► Online now? → Resolve PRINTER_OFFLINE
             ├─► Ink OK? → Resolve INK alerts
             └─► Paper OK? → Resolve PAPER alerts
```

### Alert Storage
- Table: `kiosk_alerts`
- Fields: `id`, `kioskId`, `printerId`, `alertType`, `message`, `severity`, `resolvedAt`, `metadata`
- Unresolved alerts have `resolvedAt = null`

---

## 4. Frontend Display

### Admin Dashboard

**PrinterAlertBanner Component:**
- Polls `/api/admin/alerts` every **60 seconds**
- Displays critical/error/warning alerts
- Shows flash animation for new alerts
- Links to kiosk detail page

**Real-Time Updates (SSE - Currently Disabled):**
- Endpoint: `/admin/printer-status/stream`
- Streams critical alerts every 5 seconds
- Currently disabled due to rate limiting issues
- Falls back to polling

**Kiosk Status Display:**
- Shows device online/offline status (from heartbeat)
- Shows printer status (from printer health reports)
- Displays ink/paper levels
- Shows active alerts

---

## 5. Complete Data Flow

### Kiosk Browser → Backend
```
Kiosk Browser (React)
    │
    ├─► Heartbeat (every 60s)
    │   └─► POST /api/kiosk/heartbeat
    │       └─► Updates kiosk_configs.config.lastHeartbeat
    │
    └─► Fetch Config (on load/update)
        └─► GET /kiosk/config/:id
            └─► Returns kiosk config + printer status
```

### Print Agent → Backend
```
Local Print Agent (Node.js)
    │
    ├─► Poll Printer (every 30s)
    │   └─► SNMP/Windows APIs
    │       └─► Collects status
    │
    └─► Report Status (every 60s or on change)
        └─► POST /kiosk/printer-status
            └─► Updates kiosk_configs.config.printerStatus
                └─► Creates/resolves alerts in kiosk_alerts
```

### Admin Dashboard → Backend
```
Admin Dashboard (React)
    │
    ├─► Poll Alerts (every 60s)
    │   └─► GET /api/admin/alerts
    │       └─► Returns unresolved alerts
    │
    ├─► Get Printer Statuses
    │   └─► GET /admin/kiosks/all-printer-statuses
    │       └─► Returns all kiosk printer statuses
    │
    └─► View Kiosk Details
        └─► GET /admin/kiosks/:kioskId
            └─► Returns kiosk config + printer status + alerts
```

---

## 6. Key Differences: Heartbeat vs Printer Status

| Aspect | Heartbeat | Printer Status |
|--------|-----------|----------------|
| **Source** | Kiosk Browser (React) | Local Print Agent (Node.js) |
| **Frequency** | Every 60 seconds | Every 60 seconds (or on change) |
| **Purpose** | Track browser/app online | Track printer hardware health |
| **Data** | Timestamp only | Full printer status (ink, paper, errors) |
| **Storage** | `kiosk_configs.config.lastHeartbeat` | `kiosk_configs.config.printerStatus` + `kiosk_printers` |
| **Indicates** | Can customers use kiosk? | Is printer working? |
| **Failure Meaning** | Browser closed/crashed | Printer hardware issue |

---

## 7. Configuration

### Local Print Agent Config (`config.json`)
```json
{
  "cloudServerUrl": "https://smartwish.onrender.com",
  "pollInterval": 10000,
  "surveillance": {
    "enabled": false,
    "kioskId": "",
    "apiKey": ""
  }
}
```

### Polling Intervals Summary
- **Kiosk Heartbeat**: 60 seconds
- **Printer Status Poll**: 30 seconds (local agent)
- **Printer Status Report**: 60 seconds (to cloud)
- **Admin Alert Poll**: 60 seconds
- **Admin Status Poll**: Variable (on-demand)

---

## 8. Troubleshooting

### Kiosk Shows Offline
1. Check if browser is open on kiosk
2. Check `kiosk_configs.config.lastHeartbeat` timestamp
3. Verify network connectivity
4. Check browser console for heartbeat errors

### Printer Status Not Updating
1. Check if local print agent is running
2. Verify printer IP/name configuration
3. Check SNMP connectivity (for network printers)
4. Review print agent logs for errors
5. Verify API key is correct

### Alerts Not Appearing
1. Check `kiosk_alerts` table for unresolved alerts
2. Verify printer status reports are being received
3. Check alert severity thresholds
4. Verify alert auto-resolution logic

---

## 9. Database Schema

### kiosk_configs
- `id` (UUID)
- `kiosk_id` (string)
- `config` (JSONB) - Contains:
  - `lastHeartbeat` (timestamp)
  - `printerStatus` (object) - Legacy single printer status

### kiosk_printers
- `id` (UUID)
- `kiosk_id` (string)
- `name` (string)
- `printer_name` (string)
- `status` (enum: ONLINE, OFFLINE)
- `ink_black`, `ink_cyan`, `ink_magenta`, `ink_yellow` (numbers)
- `paper_status` (enum: OK, LOW, EMPTY)
- `paper_tray1_state`, `paper_tray2_state` (strings)
- `last_error` (string)
- `full_status` (JSONB)

### kiosk_alerts
- `id` (UUID)
- `kiosk_id` (string)
- `printer_id` (UUID, nullable)
- `alert_type` (enum)
- `message` (string)
- `severity` (enum: INFO, WARNING, ERROR, CRITICAL)
- `resolved_at` (timestamp, nullable)
- `auto_resolved` (boolean)
- `metadata` (JSONB)

---

## Summary

The system uses **two independent monitoring mechanisms**:

1. **Heartbeat** = Browser/app health (customer-facing)
2. **Printer Status** = Hardware health (operational)

Both systems work together to provide complete visibility:
- **Heartbeat offline** = Customers can't use kiosk (browser issue)
- **Printer offline** = Customers can't print (hardware issue)
- **Both online** = System fully operational

The alert system automatically surfaces issues to admins/managers, ensuring quick response to problems.
