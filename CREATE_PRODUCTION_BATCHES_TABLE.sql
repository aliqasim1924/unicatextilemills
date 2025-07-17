-- ============================================================================
-- CREATE PRODUCTION BATCHES TABLE
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to create the missing table
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

-- Create updated_at trigger for production_batches
CREATE TRIGGER update_production_batches_updated_at
    BEFORE UPDATE ON production_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for production_batches
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;

-- Create policy for production_batches
CREATE POLICY "Allow authenticated users to manage production_batches" ON production_batches
    FOR ALL USING (auth.role() = 'authenticated');

-- 2. Update fabric_rolls table to reference production_batches
-- ============================================================================
-- Add batch_id column to fabric_rolls if it doesn't exist
ALTER TABLE fabric_rolls 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES production_batches(id) ON DELETE CASCADE;

-- Create index for batch_id in fabric_rolls
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_batch_id ON fabric_rolls(batch_id);

-- 3. Add foreign key relationships to existing tables
-- ============================================================================
-- Add references to base_fabrics and finished_fabrics in production_batches table
ALTER TABLE production_batches 
ADD COLUMN IF NOT EXISTS base_fabric_id UUID REFERENCES base_fabrics(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS finished_fabric_id UUID REFERENCES finished_fabrics(id) ON DELETE SET NULL;

-- Create indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_production_batches_base_fabric ON production_batches(base_fabric_id);
CREATE INDEX IF NOT EXISTS idx_production_batches_finished_fabric ON production_batches(finished_fabric_id);

-- 4. Insert sample data (optional)
-- ============================================================================
-- You can uncomment this section to insert sample data for testing

/*
INSERT INTO production_batches (
    batch_number,
    production_order_id,
    production_type,
    planned_quantity,
    actual_a_grade_quantity,
    batch_status,
    base_fabric_id,
    finished_fabric_id
) VALUES
(
    'BATCH-001',
    (SELECT id FROM production_orders LIMIT 1),
    'weaving',
    1000.00,
    950.00,
    'completed',
    (SELECT id FROM base_fabrics LIMIT 1),
    (SELECT id FROM finished_fabrics LIMIT 1)
);
*/

-- 5. Verify table creation
-- ============================================================================
SELECT 
    'production_batches' as table_name,
    COUNT(*) as record_count
FROM production_batches
UNION ALL
SELECT 
    'fabric_rolls with batch_id' as table_name,
    COUNT(*) as record_count
FROM fabric_rolls
WHERE batch_id IS NOT NULL;

-- Show table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'production_batches' 
    AND table_schema = 'public'
ORDER BY ordinal_position; 