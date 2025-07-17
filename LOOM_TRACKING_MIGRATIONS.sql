-- ============================================================================
-- LOOM TRACKING & PRODUCTION GRADING SYSTEM MIGRATIONS
-- ============================================================================
-- Enhanced production tracking with loom-level details and quality grading
-- Run these SQL commands in your Supabase SQL Editor
-- ============================================================================

-- 1. Create looms master table
-- ============================================================================
CREATE TABLE IF NOT EXISTS looms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loom_number VARCHAR(50) UNIQUE NOT NULL,
    loom_name VARCHAR(100) NOT NULL,
    loom_type VARCHAR(50) DEFAULT 'weaving' CHECK (loom_type IN ('weaving', 'other')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    specifications JSONB, -- Store technical specs like width, speed, etc.
    installation_date DATE,
    last_maintenance_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for looms
CREATE INDEX IF NOT EXISTS idx_looms_number ON looms(loom_number);
CREATE INDEX IF NOT EXISTS idx_looms_status ON looms(status);
CREATE INDEX IF NOT EXISTS idx_looms_type ON looms(loom_type);

-- 2. Create loom production details table
-- ============================================================================
CREATE TABLE IF NOT EXISTS loom_production_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    loom_id UUID NOT NULL REFERENCES looms(id) ON DELETE CASCADE,
    planned_quantity DECIMAL(10,2) NOT NULL,
    actual_quantity DECIMAL(10,2) DEFAULT 0,
    rolls_produced INTEGER DEFAULT 0,
    production_start_time TIMESTAMPTZ,
    production_end_time TIMESTAMPTZ,
    efficiency_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN planned_quantity > 0 
            THEN ROUND((actual_quantity / planned_quantity) * 100, 2)
            ELSE 0
        END
    ) STORED,
    quality_notes TEXT,
    issues_encountered TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for loom production details
CREATE INDEX IF NOT EXISTS idx_loom_production_order ON loom_production_details(production_order_id);
CREATE INDEX IF NOT EXISTS idx_loom_production_loom ON loom_production_details(loom_id);
CREATE INDEX IF NOT EXISTS idx_loom_production_dates ON loom_production_details(production_start_time, production_end_time);

-- 3. Create loom rolls table (intermediate weaved rolls)
-- ============================================================================
CREATE TABLE IF NOT EXISTS loom_rolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loom_production_detail_id UUID NOT NULL REFERENCES loom_production_details(id) ON DELETE CASCADE,
    roll_number VARCHAR(100) UNIQUE NOT NULL, -- e.g., WEAVING-20241125-001-L01-R001
    roll_length DECIMAL(8,2) NOT NULL,
    roll_weight DECIMAL(8,2), -- Optional weight tracking
    quality_grade VARCHAR(10) DEFAULT 'A' CHECK (quality_grade IN ('A', 'B', 'C')),
    quality_notes TEXT,
    roll_status VARCHAR(20) DEFAULT 'available' CHECK (roll_status IN ('available', 'allocated', 'used', 'damaged')),
    qr_code TEXT NOT NULL, -- JSON string containing QR code data
    produced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for loom rolls
CREATE INDEX IF NOT EXISTS idx_loom_rolls_production_detail ON loom_rolls(loom_production_detail_id);
CREATE INDEX IF NOT EXISTS idx_loom_rolls_number ON loom_rolls(roll_number);
CREATE INDEX IF NOT EXISTS idx_loom_rolls_status ON loom_rolls(roll_status);
CREATE INDEX IF NOT EXISTS idx_loom_rolls_grade ON loom_rolls(quality_grade);

-- 4. Create production completion details table
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_completion_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    production_type VARCHAR(20) NOT NULL CHECK (production_type IN ('weaving', 'coating')),
    planned_quantity DECIMAL(10,2) NOT NULL,
    actual_quantity DECIMAL(10,2) NOT NULL,
    completion_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN planned_quantity > 0 
            THEN ROUND((actual_quantity / planned_quantity) * 100, 2)
            ELSE 0
        END
    ) STORED,
    
    -- Weaving specific fields
    total_looms_used INTEGER DEFAULT 0,
    incomplete_reason TEXT,
    balance_status VARCHAR(20) CHECK (balance_status IN ('in_production', 'cancelled', 'completed')),
    
    -- Coating specific fields
    a_grade_50m_rolls INTEGER DEFAULT 0,
    a_grade_short_rolls INTEGER DEFAULT 0,
    a_grade_short_quantity DECIMAL(10,2) DEFAULT 0,
    bc_grade_rolls INTEGER DEFAULT 0,
    bc_grade_quantity DECIMAL(10,2) DEFAULT 0,
    wastage_quantity DECIMAL(10,2) DEFAULT 0,
    wastage_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN actual_quantity > 0 
            THEN ROUND((wastage_quantity / actual_quantity) * 100, 2)
            ELSE 0
        END
    ) STORED,
    
    -- General fields
    completion_notes TEXT,
    completed_by VARCHAR(100),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for production completion details
CREATE INDEX IF NOT EXISTS idx_production_completion_order ON production_completion_details(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_completion_type ON production_completion_details(production_type);
CREATE INDEX IF NOT EXISTS idx_production_completion_date ON production_completion_details(completed_at);

-- 5. Create coating roll inputs table (tracks which weaved rolls were used)
-- ============================================================================
CREATE TABLE IF NOT EXISTS coating_roll_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    loom_roll_id UUID NOT NULL REFERENCES loom_rolls(id) ON DELETE CASCADE,
    quantity_used DECIMAL(8,2) NOT NULL,
    processing_order INTEGER NOT NULL, -- Order in which rolls were processed
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for coating roll inputs
CREATE INDEX IF NOT EXISTS idx_coating_inputs_production ON coating_roll_inputs(production_order_id);
CREATE INDEX IF NOT EXISTS idx_coating_inputs_loom_roll ON coating_roll_inputs(loom_roll_id);
CREATE INDEX IF NOT EXISTS idx_coating_inputs_order ON coating_roll_inputs(production_order_id, processing_order);

-- 6. Enhance existing fabric_rolls table with loom traceability
-- ============================================================================
-- Add new columns to fabric_rolls table for enhanced tracking
ALTER TABLE fabric_rolls 
ADD COLUMN IF NOT EXISTS loom_roll_id UUID REFERENCES loom_rolls(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(10) DEFAULT 'A' CHECK (quality_grade IN ('A', 'B', 'C')),
ADD COLUMN IF NOT EXISTS roll_type VARCHAR(20) DEFAULT 'full_50m' CHECK (roll_type IN ('full_50m', 'short', 'wastage')),
ADD COLUMN IF NOT EXISTS source_loom_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS production_sequence INTEGER DEFAULT 1;

-- Create indexes for new fabric_rolls columns
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_loom_roll ON fabric_rolls(loom_roll_id);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_quality_grade ON fabric_rolls(quality_grade);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_roll_type ON fabric_rolls(roll_type);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_source_loom ON fabric_rolls(source_loom_number);

-- 7. Create updated_at triggers for all new tables
-- ============================================================================
CREATE TRIGGER update_looms_updated_at 
    BEFORE UPDATE ON looms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loom_production_details_updated_at 
    BEFORE UPDATE ON loom_production_details 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loom_rolls_updated_at 
    BEFORE UPDATE ON loom_rolls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Create RLS policies for new tables
-- ============================================================================
ALTER TABLE looms ENABLE ROW LEVEL SECURITY;
ALTER TABLE loom_production_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE loom_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_completion_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE coating_roll_inputs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated users to manage looms" ON looms
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage loom_production_details" ON loom_production_details
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage loom_rolls" ON loom_rolls
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage production_completion_details" ON production_completion_details
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to manage coating_roll_inputs" ON coating_roll_inputs
    FOR ALL USING (auth.role() = 'authenticated');

-- 9. Create helpful functions for loom roll number generation
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_loom_roll_number(
    p_batch_number TEXT,
    p_loom_number TEXT,
    p_roll_index INTEGER
) RETURNS TEXT AS $$
BEGIN
    RETURN p_batch_number || '-' || p_loom_number || '-R' || LPAD(p_roll_index::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to get production traceability
CREATE OR REPLACE FUNCTION get_production_traceability(p_fabric_roll_id UUID)
RETURNS TABLE(
    fabric_roll_number TEXT,
    loom_number TEXT,
    loom_roll_number TEXT,
    batch_number TEXT,
    weaving_start_date TIMESTAMPTZ,
    weaving_end_date TIMESTAMPTZ,
    coating_start_date TIMESTAMPTZ,
    coating_end_date TIMESTAMPTZ,
    quality_grade TEXT,
    roll_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.roll_number,
        l.loom_number,
        lr.roll_number,
        pb.batch_number,
        lpd.production_start_time,
        lpd.production_end_time,
        po_coating.actual_start_date,
        po_coating.actual_end_date,
        fr.quality_grade,
        fr.roll_type
    FROM fabric_rolls fr
    LEFT JOIN loom_rolls lr ON fr.loom_roll_id = lr.id
    LEFT JOIN loom_production_details lpd ON lr.loom_production_detail_id = lpd.id
    LEFT JOIN looms l ON lpd.loom_id = l.id
    LEFT JOIN production_batches pb ON fr.batch_id = pb.id
    LEFT JOIN production_orders po_coating ON pb.production_order_id = po_coating.id
    WHERE fr.id = p_fabric_roll_id;
END;
$$ LANGUAGE plpgsql;

-- 10. Insert sample loom data
-- ============================================================================
INSERT INTO looms (loom_number, loom_name, loom_type, status, specifications) VALUES
('L001', 'Loom 1 - Main Production', 'weaving', 'active', '{"width": "2.5m", "speed": "120rpm", "manufacturer": "Textile Corp"}'),
('L002', 'Loom 2 - Main Production', 'weaving', 'active', '{"width": "2.5m", "speed": "120rpm", "manufacturer": "Textile Corp"}'),
('L003', 'Loom 3 - Backup', 'weaving', 'active', '{"width": "2.0m", "speed": "100rpm", "manufacturer": "Weave Tech"}'),
('L004', 'Loom 4 - Backup', 'weaving', 'active', '{"width": "2.0m", "speed": "100rpm", "manufacturer": "Weave Tech"}')
ON CONFLICT (loom_number) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('looms', 'loom_production_details', 'loom_rolls', 'production_completion_details', 'coating_roll_inputs')
ORDER BY table_name; 