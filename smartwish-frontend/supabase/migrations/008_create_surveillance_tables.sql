-- ============================================================================
-- SURVEILLANCE SYSTEM TABLES
-- Tracks people detected by kiosk webcams using YOLO person detection
-- ============================================================================

-- Surveillance detections table
-- Stores individual person detections with local image paths
CREATE TABLE IF NOT EXISTS surveillance_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id TEXT NOT NULL,
  person_track_id INTEGER NOT NULL, -- YOLO tracking ID for this session
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dwell_seconds REAL, -- Time person was visible (NULL if still being tracked)
  was_counted BOOLEAN DEFAULT FALSE, -- True if stayed > threshold (default 8 seconds)
  image_path TEXT, -- Local file path on kiosk computer (served by print agent)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key to kiosk_configs
  CONSTRAINT fk_surveillance_kiosk 
    FOREIGN KEY (kiosk_id) 
    REFERENCES kiosk_configs(kiosk_id) 
    ON DELETE CASCADE
);

-- Daily summary table for quick dashboard queries
-- Aggregated stats per kiosk per day
CREATE TABLE IF NOT EXISTS surveillance_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id TEXT NOT NULL,
  date DATE NOT NULL,
  total_detected INTEGER DEFAULT 0, -- People seen (captured after 10+ frames)
  total_counted INTEGER DEFAULT 0, -- People who stayed > threshold seconds
  peak_hour INTEGER, -- Hour with most traffic (0-23)
  hourly_counts JSONB DEFAULT '{}', -- {"0": 5, "1": 3, ...} for charts
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint on kiosk + date
  CONSTRAINT uq_surveillance_daily_kiosk_date UNIQUE(kiosk_id, date),
  
  -- Foreign key to kiosk_configs
  CONSTRAINT fk_surveillance_daily_kiosk 
    FOREIGN KEY (kiosk_id) 
    REFERENCES kiosk_configs(kiosk_id) 
    ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for fetching detections by kiosk and date (most common query)
CREATE INDEX IF NOT EXISTS idx_surveillance_kiosk_detected 
  ON surveillance_detections(kiosk_id, detected_at DESC);

-- Index for filtering counted-only detections
CREATE INDEX IF NOT EXISTS idx_surveillance_kiosk_counted 
  ON surveillance_detections(kiosk_id, was_counted, detected_at DESC) 
  WHERE was_counted = TRUE;

-- Index for daily stats lookup
CREATE INDEX IF NOT EXISTS idx_surveillance_daily_kiosk_date 
  ON surveillance_daily_stats(kiosk_id, date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE surveillance_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveillance_daily_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access (backend API)
CREATE POLICY "Service role has full access to surveillance_detections"
  ON surveillance_detections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to surveillance_daily_stats"
  ON surveillance_daily_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to read (admin dashboard)
CREATE POLICY "Authenticated users can read surveillance_detections"
  ON surveillance_detections
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read surveillance_daily_stats"
  ON surveillance_daily_stats
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- HELPER FUNCTION: Update daily stats when detection is inserted
-- ============================================================================

CREATE OR REPLACE FUNCTION update_surveillance_daily_stats()
RETURNS TRIGGER AS $$
DECLARE
  detection_date DATE;
  detection_hour INTEGER;
  current_hourly JSONB;
  new_hourly JSONB;
BEGIN
  -- Get the date and hour from the detection
  detection_date := DATE(NEW.detected_at AT TIME ZONE 'UTC');
  detection_hour := EXTRACT(HOUR FROM NEW.detected_at AT TIME ZONE 'UTC');
  
  -- Upsert daily stats
  INSERT INTO surveillance_daily_stats (kiosk_id, date, total_detected, total_counted, hourly_counts, updated_at)
  VALUES (
    NEW.kiosk_id,
    detection_date,
    1,
    CASE WHEN NEW.was_counted THEN 1 ELSE 0 END,
    jsonb_build_object(detection_hour::TEXT, 1),
    NOW()
  )
  ON CONFLICT (kiosk_id, date) DO UPDATE SET
    total_detected = surveillance_daily_stats.total_detected + 1,
    total_counted = surveillance_daily_stats.total_counted + CASE WHEN NEW.was_counted THEN 1 ELSE 0 END,
    hourly_counts = (
      SELECT jsonb_object_agg(
        key,
        COALESCE((surveillance_daily_stats.hourly_counts->>key)::INTEGER, 0) + 
        CASE WHEN key = detection_hour::TEXT THEN 1 ELSE 0 END
      )
      FROM jsonb_each_text(
        surveillance_daily_stats.hourly_counts || jsonb_build_object(detection_hour::TEXT, 0)
      )
    ),
    peak_hour = (
      SELECT (jsonb_each_text.key)::INTEGER
      FROM jsonb_each_text(
        surveillance_daily_stats.hourly_counts || 
        jsonb_build_object(
          detection_hour::TEXT, 
          COALESCE((surveillance_daily_stats.hourly_counts->>detection_hour::TEXT)::INTEGER, 0) + 1
        )
      )
      ORDER BY (jsonb_each_text.value)::INTEGER DESC
      LIMIT 1
    ),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update daily stats
DROP TRIGGER IF EXISTS trigger_update_surveillance_stats ON surveillance_detections;
CREATE TRIGGER trigger_update_surveillance_stats
  AFTER INSERT ON surveillance_detections
  FOR EACH ROW
  EXECUTE FUNCTION update_surveillance_daily_stats();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE surveillance_detections IS 'Individual person detections from kiosk webcams';
COMMENT ON TABLE surveillance_daily_stats IS 'Aggregated daily statistics per kiosk';
COMMENT ON COLUMN surveillance_detections.person_track_id IS 'YOLO tracker ID - unique per tracking session, resets when script restarts';
COMMENT ON COLUMN surveillance_detections.was_counted IS 'True if person stayed longer than dwell threshold (default 8 seconds)';
COMMENT ON COLUMN surveillance_detections.image_path IS 'Local file path on kiosk computer, served via print agent HTTP endpoint';
COMMENT ON COLUMN surveillance_daily_stats.hourly_counts IS 'JSON object with hour (0-23) as key and count as value';
