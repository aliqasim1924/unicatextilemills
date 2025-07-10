-- ============================================================================
-- DATABASE MIGRATIONS FOR QR CODE SYSTEM AND PRODUCTION COMPLETION
-- ============================================================================
-- Run these SQL commands in your Supabase SQL Editor
-- Project ID: wcnwltnzhirzimkyngms
-- ============================================================================

-- 1. Create production_batches table
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    production_type VARCHAR(20) NOT NULL CHECK (production_type IN ('weaving', 'coating')),
    planned_quantity DECIMAL(10,2) NOT NULL,
    actual_a_grade_quantity DECIMAL(10,2) DEFAULT 0,
    wastage_quantity DECIMAL(10,2) DEFAULT 0,
    wastage_percentage DECIMAL(5,2) DEFAULT 0,
    batch_status VARCHAR(20) DEFAULT 'in_progress' CHECK (batch_status IN ('in_progress', 'completed', 'quality_check', 'approved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for production_batches
CREATE INDEX IF NOT EXISTS idx_production_batches_order_id ON production_batches(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_batch_number ON production_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_production_batches_status ON production_batches(batch_status);
CREATE INDEX IF NOT EXISTS idx_production_batches_created_at ON production_batches(created_at);

-- 2. Create fabric_rolls table
-- ============================================================================
CREATE TABLE IF NOT EXISTS fabric_rolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_number VARCHAR(100) UNIQUE NOT NULL,
    batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    fabric_type VARCHAR(20) NOT NULL CHECK (fabric_type IN ('base_fabric', 'finished_fabric')),
    fabric_id UUID NOT NULL,
    roll_length DECIMAL(8,2) NOT NULL,
    remaining_length DECIMAL(8,2) NOT NULL,
    roll_status VARCHAR(20) DEFAULT 'available' CHECK (roll_status IN ('available', 'allocated', 'used', 'damaged', 'quality_hold')),
    qr_code TEXT NOT NULL, -- JSON string containing QR code data
    location VARCHAR(100) DEFAULT 'warehouse',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Create indexes for fabric_rolls
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_batch_id ON fabric_rolls(batch_id);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_roll_number ON fabric_rolls(roll_number);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_fabric_type_id ON fabric_rolls(fabric_type, fabric_id);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_status ON fabric_rolls(roll_status);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_created_at ON fabric_rolls(created_at);

-- 3. Create barcode_scans table for QR code tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS barcode_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    barcode_data TEXT NOT NULL, -- JSON string of the QR code data
    scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('issue', 'receive', 'move', 'audit', 'quality_check')),
    scanned_by VARCHAR(100) NOT NULL,
    scan_location VARCHAR(100) NOT NULL,
    reference_id UUID NULL, -- Can reference orders, production orders, etc.
    reference_type VARCHAR(50) NULL, -- Type of reference (order, production_order, etc.)
    scan_timestamp TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Create indexes for barcode_scans
CREATE INDEX IF NOT EXISTS idx_barcode_scans_timestamp ON barcode_scans(scan_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_type ON barcode_scans(scan_type);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_reference ON barcode_scans(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_location ON barcode_scans(scan_location);
CREATE INDEX IF NOT EXISTS idx_barcode_scans_barcode_data ON barcode_scans USING gin(to_tsvector('english', barcode_data));

-- 4. Create wastage_records table for tracking production waste
-- ============================================================================
CREATE TABLE IF NOT EXISTS wastage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
    wastage_type VARCHAR(20) NOT NULL CHECK (wastage_type IN ('production', 'cutting', 'quality', 'handling', 'other')),
    wastage_reason TEXT NOT NULL,
    wastage_quantity DECIMAL(8,2) NOT NULL,
    recorded_by VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Create indexes for wastage_records
CREATE INDEX IF NOT EXISTS idx_wastage_records_batch_id ON wastage_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_wastage_records_type ON wastage_records(wastage_type);
CREATE INDEX IF NOT EXISTS idx_wastage_records_recorded_at ON wastage_records(recorded_at);

-- 5. Add foreign key constraints for fabric_rolls
-- ============================================================================
-- Note: We can't create foreign keys to multiple tables directly, so we'll use triggers for validation

-- 6. Create audit triggers for all new tables
-- ============================================================================
-- Enable updated_at trigger for production_batches
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_production_batches_updated_at 
    BEFORE UPDATE ON production_batches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fabric_rolls_updated_at 
    BEFORE UPDATE ON fabric_rolls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Create RLS (Row Level Security) policies
-- ============================================================================
-- Enable RLS on all new tables
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabric_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcode_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE wastage_records ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (adjust as needed for your auth setup)
CREATE POLICY "Allow authenticated users to manage production_batches" ON production_batches
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage fabric_rolls" ON fabric_rolls
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage barcode_scans" ON barcode_scans
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage wastage_records" ON wastage_records
    FOR ALL USING (auth.role() = 'authenticated');

-- 8. Create helpful database functions
-- ============================================================================

-- Function to generate batch numbers (replaces the missing RPC)
CREATE OR REPLACE FUNCTION generate_batch_number(p_production_type TEXT)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    date_str TEXT;
    sequence_num INTEGER;
    batch_number TEXT;
BEGIN
    -- Set prefix based on production type
    prefix := UPPER(p_production_type);
    
    -- Get date string (YYYYMMDD)
    date_str := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get next sequence number for today
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(batch_number FROM LENGTH(prefix || '-' || date_str || '-') + 1) 
            AS INTEGER
        )
    ), 0) + 1
    INTO sequence_num
    FROM production_batches 
    WHERE batch_number LIKE prefix || '-' || date_str || '-%';
    
    -- Generate the batch number
    batch_number := prefix || '-' || date_str || '-' || LPAD(sequence_num::TEXT, 3, '0');
    
    RETURN batch_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate wastage percentage
CREATE OR REPLACE FUNCTION calculate_wastage_percentage(planned_qty DECIMAL, actual_qty DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    IF planned_qty = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND(((planned_qty - actual_qty) / planned_qty) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- 9. Insert sample data for testing (optional)
-- ============================================================================
-- Uncomment the following lines if you want to insert test data

/*
-- Sample production batch
INSERT INTO production_batches (
    batch_number, 
    production_order_id, 
    production_type, 
    planned_quantity, 
    actual_a_grade_quantity,
    batch_status
) 
SELECT 
    'WEAVING-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-001',
    id,
    production_type,
    quantity_required,
    0,
    'in_progress'
FROM production_orders 
WHERE production_type = 'weaving'
LIMIT 1;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Check that all tables were created successfully
SELECT 
    tablename,
    schemaname,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE tablename IN ('production_batches', 'fabric_rolls', 'barcode_scans', 'wastage_records')
    AND schemaname = 'public';

-- Display table counts
SELECT 
    'production_batches' as table_name, COUNT(*) as record_count FROM production_batches
UNION ALL
SELECT 
    'fabric_rolls' as table_name, COUNT(*) as record_count FROM fabric_rolls
UNION ALL
SELECT 
    'barcode_scans' as table_name, COUNT(*) as record_count FROM barcode_scans
UNION ALL
SELECT 
    'wastage_records' as table_name, COUNT(*) as record_count FROM wastage_records;

-- ============================================================================
-- POST-MIGRATION NOTES:
-- 
-- 1. All tables are created with proper indexes and constraints
-- 2. Row Level Security (RLS) is enabled with basic policies
-- 3. Triggers are set up for automatic updated_at timestamps
-- 4. The generate_batch_number function replaces the missing RPC
-- 5. QR code data is stored as JSON text in the qr_code column
-- 6. Barcode scans are tracked with full audit trail
-- 7. Wastage tracking is built into the system
-- 
-- TESTING:
-- - Try completing a production order after running this migration
-- - Check that QR codes are generated for fabric rolls
-- - Test QR code scanning functionality
-- - Verify that all data is properly stored and retrievable
-- ============================================================================ 