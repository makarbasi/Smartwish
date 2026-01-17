-- ============================================================================
-- ADD PRINT MODE TO KIOSK PRINTERS
-- Allows configuration of duplex vs single-sided printing per printer
-- ============================================================================

-- Add print_mode column to kiosk_printers table
-- Values: 'simplex' (single-sided), 'duplex' (double-sided long edge), 
--         'duplexshort' (double-sided short edge)
ALTER TABLE kiosk_printers 
ADD COLUMN IF NOT EXISTS print_mode TEXT DEFAULT 'simplex';

-- Add constraint to ensure valid print mode values
ALTER TABLE kiosk_printers
ADD CONSTRAINT valid_print_mode 
CHECK (print_mode IN ('simplex', 'duplex', 'duplexshort'));

-- Comment for documentation
COMMENT ON COLUMN kiosk_printers.print_mode IS 
'Print mode for this printer: simplex (single-sided), duplex (double-sided long edge), duplexshort (double-sided short edge). Used by local print agent.';

-- Update greeting-card printers to use duplex by default (since they need double-sided printing)
UPDATE kiosk_printers 
SET print_mode = 'duplexshort' 
WHERE printable_type = 'greeting-card' AND print_mode = 'simplex';

-- Stickers should stay as simplex (single-sided on plain paper)
-- No update needed since default is 'simplex'
