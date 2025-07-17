-- ============================================================================
-- CHECK AND CREATE MISSING TABLES
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to check and create missing tables
-- ============================================================================

-- 1. Check which tables exist
-- ============================================================================
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        ) THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM (
    VALUES 
        ('shipments'),
        ('shipment_items'),
        ('production_batches'),
        ('fabric_rolls'),
        ('customer_orders'),
        ('production_orders')
) AS required_tables(table_name)
ORDER BY table_name;

-- 2. Create shipments table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_number VARCHAR(100) UNIQUE NOT NULL,
    customer_order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    shipped_date DATE NOT NULL,
    delivery_date DATE NULL,
    tracking_number VARCHAR(100) NULL,
    shipment_status VARCHAR(20) DEFAULT 'preparing' CHECK (shipment_status IN ('preparing', 'shipped', 'delivered', 'returned')),
    carrier_name VARCHAR(100) NULL,
    carrier_contact VARCHAR(100) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for shipments
CREATE INDEX IF NOT EXISTS idx_shipments_customer_order ON shipments(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(shipment_status);
CREATE INDEX IF NOT EXISTS idx_shipments_shipped_date ON shipments(shipped_date);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);

-- 3. Create shipment_items table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    fabric_roll_id UUID NOT NULL REFERENCES fabric_rolls(id) ON DELETE CASCADE,
    quantity_shipped DECIMAL(8,2) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for shipment_items
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_roll ON shipment_items(fabric_roll_id);

-- 4. Create shipment number generation function
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER;
BEGIN
    -- Get the current date in YYYYMMDD format
    SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') INTO new_number;
    
    -- Get the count of shipments created today
    SELECT COUNT(*) + 1 INTO counter
    FROM shipments
    WHERE DATE(created_at) = CURRENT_DATE;
    
    -- Format: SHIP-YYYYMMDD-XXX
    new_number := 'SHIP-' || new_number || '-' || LPAD(counter::TEXT, 3, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for automatic shipment number generation
-- ============================================================================
CREATE OR REPLACE FUNCTION set_shipment_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.shipment_number IS NULL OR NEW.shipment_number = '' THEN
        NEW.shipment_number := generate_shipment_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_shipment_number ON shipments;
CREATE TRIGGER trigger_set_shipment_number
    BEFORE INSERT ON shipments
    FOR EACH ROW
    EXECUTE FUNCTION set_shipment_number();

-- 6. Update fabric_rolls table to include 'shipped' status
-- ============================================================================
-- Update fabric_rolls table to include 'shipped' status
ALTER TABLE fabric_rolls DROP CONSTRAINT IF EXISTS fabric_rolls_roll_status_check;
ALTER TABLE fabric_rolls ADD CONSTRAINT fabric_rolls_roll_status_check 
CHECK (roll_status IN ('available', 'allocated', 'used', 'damaged', 'quality_hold', 'shipped', 'delivered'));

-- 7. Create RLS policies for shipments
-- ============================================================================
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Create policies for shipments
CREATE POLICY "Allow all operations for authenticated users" ON shipments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON shipment_items
    FOR ALL USING (auth.role() = 'authenticated');

-- 8. Create updated_at triggers
-- ============================================================================
CREATE TRIGGER update_shipments_updated_at
    BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Verify table creation and show sample data counts
-- ============================================================================
SELECT 
    'shipments' as table_name,
    COUNT(*) as record_count
FROM shipments
UNION ALL
SELECT 
    'shipment_items' as table_name,
    COUNT(*) as record_count
FROM shipment_items
UNION ALL
SELECT 
    'production_batches' as table_name,
    COUNT(*) as record_count
FROM production_batches
UNION ALL
SELECT 
    'fabric_rolls' as table_name,
    COUNT(*) as record_count
FROM fabric_rolls;

-- Show table structure for verification
SELECT 
    'shipments' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments' 
    AND table_schema = 'public'
ORDER BY ordinal_position; 