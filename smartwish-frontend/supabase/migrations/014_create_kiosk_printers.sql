-- ============================================================================
-- KIOSK PRINTERS TABLE
-- Each kiosk can have multiple printers, each designated for a specific type
-- (stickers or greeting cards). Replaces the old single printer approach.
-- ============================================================================

-- Create the kiosk_printers table
CREATE TABLE IF NOT EXISTS kiosk_printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id UUID NOT NULL REFERENCES kiosk_configs(id) ON DELETE CASCADE,
  
  -- Printer identification
  name TEXT NOT NULL,                    -- Display name: "HP OfficeJet Pro 9130"
  printer_name TEXT NOT NULL,            -- Windows printer name for printing
  ip_address TEXT,                       -- For SNMP monitoring (optional)
  
  -- What this printer handles
  printable_type TEXT NOT NULL,          -- 'sticker' or 'greeting-card'
  is_enabled BOOLEAN DEFAULT true,
  
  -- Health tracking (updated by local print agent)
  status TEXT DEFAULT 'unknown',         -- 'online', 'offline', 'error', 'unknown'
  last_seen_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Ink levels (from SNMP monitoring, 0-100 or null if unknown)
  ink_black INTEGER,
  ink_cyan INTEGER,
  ink_magenta INTEGER,
  ink_yellow INTEGER,
  
  -- Paper status
  paper_status TEXT DEFAULT 'unknown',   -- 'ok', 'low', 'empty', 'unknown'
  paper_tray1_state TEXT,
  paper_tray2_state TEXT,
  
  -- Full status JSON (for detailed info from SNMP)
  full_status JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_printable_type CHECK (printable_type IN ('sticker', 'greeting-card'))
);

-- Indexes for efficient queries
CREATE INDEX idx_kiosk_printers_kiosk_id ON kiosk_printers(kiosk_id);
CREATE INDEX idx_kiosk_printers_type ON kiosk_printers(printable_type);
CREATE INDEX idx_kiosk_printers_status ON kiosk_printers(status);

-- Enable RLS
ALTER TABLE kiosk_printers ENABLE ROW LEVEL SECURITY;

-- RLS Policies (similar to kiosk_configs)
CREATE POLICY "Admins can manage kiosk printers"
  ON kiosk_printers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Managers can view printers for their kiosks"
  ON kiosk_printers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kiosk_managers km
      WHERE km.kiosk_id = kiosk_printers.kiosk_id
      AND km.user_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON kiosk_printers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- KIOSK ALERTS TABLE
-- Track printer and kiosk issues for admin/manager notification
-- ============================================================================

CREATE TABLE IF NOT EXISTS kiosk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id UUID NOT NULL REFERENCES kiosk_configs(id) ON DELETE CASCADE,
  printer_id UUID REFERENCES kiosk_printers(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type TEXT NOT NULL,              -- 'printer_offline', 'printer_error', 'ink_low', 'ink_empty', 'paper_low', 'paper_empty', 'kiosk_offline'
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'error', 'critical'
  
  -- Alert metadata
  metadata JSONB DEFAULT '{}',           -- Additional context (ink levels, error codes, etc.)
  
  -- Resolution tracking
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  auto_resolved BOOLEAN DEFAULT false,   -- True if resolved automatically when issue fixed
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_kiosk_alerts_kiosk_id ON kiosk_alerts(kiosk_id);
CREATE INDEX idx_kiosk_alerts_printer_id ON kiosk_alerts(printer_id);
CREATE INDEX idx_kiosk_alerts_unresolved ON kiosk_alerts(kiosk_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_kiosk_alerts_severity ON kiosk_alerts(severity) WHERE resolved_at IS NULL;
CREATE INDEX idx_kiosk_alerts_created ON kiosk_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE kiosk_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage alerts"
  ON kiosk_alerts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Managers can view and acknowledge alerts for their kiosks"
  ON kiosk_alerts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kiosk_managers km
      WHERE km.kiosk_id = kiosk_alerts.kiosk_id
      AND km.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to alerts"
  ON kiosk_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- MIGRATE EXISTING PRINTER CONFIG
-- Move printerName and printerIP from kiosk_configs.config to kiosk_printers
-- ============================================================================

-- This will be run manually or via a separate migration script
-- For now, we just create the tables. Existing kiosks will need to have
-- printers added through the admin UI.

-- Add comment for documentation
COMMENT ON TABLE kiosk_printers IS 'Printers configured for each kiosk. Each printer handles either stickers or greeting cards.';
COMMENT ON TABLE kiosk_alerts IS 'Alerts for kiosk and printer issues. Displayed to admins and managers.';
