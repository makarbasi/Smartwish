-- User Events Table Schema for Supabase
-- Simplified table with only essential fields: name, date, and event type

CREATE TABLE user_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  event_type VARCHAR(50) DEFAULT 'general', -- 'general', 'meeting', 'personal', 'work', 'holiday', 'birthday'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_user_events_user_id ON user_events(user_id);
CREATE INDEX idx_user_events_date ON user_events(event_date);
CREATE INDEX idx_user_events_user_date ON user_events(user_id, event_date);
CREATE INDEX idx_user_events_month_year ON user_events(user_id, EXTRACT(YEAR FROM event_date), EXTRACT(MONTH FROM event_date));

-- Add a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_events_updated_at 
BEFORE UPDATE ON user_events 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Example data for testing (uncomment to insert sample data)
/*
INSERT INTO user_events (user_id, name, event_date, event_type) VALUES
  ('your-user-id-here', 'Team Meeting', '2024-01-15', 'meeting'),
  ('your-user-id-here', 'Birthday Party', '2024-01-20', 'birthday'),
  ('your-user-id-here', 'Project Deadline', '2024-01-25', 'work');
*/