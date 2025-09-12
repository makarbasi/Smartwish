-- Partners Table Migration
-- This script creates a new partners table in the Supabase database
-- Run this in your Supabase SQL Editor

BEGIN;

-- ================================================================
-- PARTNERS TABLE CREATION
-- ================================================================

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address TEXT NOT NULL,
    owner VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(50) NOT NULL,
    pictures TEXT[] DEFAULT '{}', -- Array of image URLs/paths
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);
CREATE INDEX IF NOT EXISTS idx_partners_owner ON partners(owner);
CREATE INDEX IF NOT EXISTS idx_partners_telephone ON partners(telephone);
CREATE INDEX IF NOT EXISTS idx_partners_created_at ON partners(created_at);

-- Add email validation constraint
ALTER TABLE partners 
ADD CONSTRAINT partners_email_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add telephone validation constraint (basic format check)
ALTER TABLE partners 
ADD CONSTRAINT partners_telephone_check 
CHECK (telephone ~ '^[+]?[0-9\s\-\(\)]{7,20}$');

-- Create trigger function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_partners_updated_at_trigger
    BEFORE UPDATE ON partners
    FOR EACH ROW
    EXECUTE FUNCTION update_partners_updated_at();

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Enable RLS on partners table
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read all partners
CREATE POLICY "Authenticated users can view partners" ON partners
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy for authenticated users to insert partners
CREATE POLICY "Authenticated users can create partners" ON partners
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policy for authenticated users to update partners
CREATE POLICY "Authenticated users can update partners" ON partners
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create policy for authenticated users to delete partners
CREATE POLICY "Authenticated users can delete partners" ON partners
    FOR DELETE USING (auth.role() = 'authenticated');

COMMIT;

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify the partners table was created successfully
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'partners'
ORDER BY ordinal_position;

-- Show indexes created for partners table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'partners'
ORDER BY indexname;

-- Insert sample partner data
INSERT INTO partners (owner, address, email, telephone, pictures) VALUES
('El Alba Products Internacionales', '2229 South Main St Harrisonburg VA 22801', 'info@elalbaproducts.com', '+1-540-555-0101', ARRAY['https://example.com/alba1.jpg', 'https://example.com/alba2.jpg']),
('Rocktown Bike', '50 S Mason St Suite 100 Harrisonburg, Virginia, 22801', 'contact@rocktownbike.com', '+1-540-555-0102', ARRAY['https://example.com/rocktown1.jpg', 'https://example.com/rocktown2.jpg']),
('Babylon International Market', '1435 S Main St, Harrisonburg, VA 22801', 'info@babylonmarket.com', '+1-540-555-0103', ARRAY['https://example.com/babylon1.jpg', 'https://example.com/babylon2.jpg']),
('MADRIVER mart & deli', '710 port republic road Harrisonburg Virginia 22801', 'contact@madrivermart.com', '+1-540-555-0104', ARRAY['https://example.com/madriver1.jpg', 'https://example.com/madriver2.jpg']),
('House of Cut Barbershop', '1310 hillside Avenue Harrisonburg VA 22801', 'info@houseofcut.com', '+1-540-555-0105', ARRAY['https://example.com/houseofcut1.jpg', 'https://example.com/houseofcut2.jpg']);