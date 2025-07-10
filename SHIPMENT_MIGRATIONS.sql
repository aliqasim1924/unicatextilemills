-- ============================================================================
-- SHIPMENT TRACKING SYSTEM DATABASE MIGRATIONS
-- ============================================================================
-- Run these SQL commands in your Supabase SQL Editor to add shipment tracking
-- ============================================================================

-- 1. Create shipments table
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

-- 2. Create shipment_items table (junction table for shipments and fabric_rolls)
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

-- 3. Add new roll status for shipped items
-- ============================================================================
-- Update fabric_rolls table to include 'shipped' status
ALTER TABLE fabric_rolls DROP CONSTRAINT IF EXISTS fabric_rolls_roll_status_check;
ALTER TABLE fabric_rolls ADD CONSTRAINT fabric_rolls_roll_status_check 
CHECK (roll_status IN ('available', 'allocated', 'used', 'damaged', 'quality_hold', 'shipped', 'delivered'));

-- 4. Create function to generate shipment numbers
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_shipment_number() RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    year_suffix TEXT;
    shipment_num TEXT;
BEGIN
    -- Get current year last 2 digits
    year_suffix := EXTRACT(YEAR FROM NOW())::TEXT;
    year_suffix := RIGHT(year_suffix, 2);
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(shipment_number FROM 4 FOR 4) AS INTEGER)), 0) + 1 
    INTO next_num
    FROM shipments 
    WHERE shipment_number LIKE 'SH' || year_suffix || '%';
    
    -- Format as SH{YY}{NNNN}
    shipment_num := 'SH' || year_suffix || LPAD(next_num::TEXT, 4, '0');
    
    RETURN shipment_num;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for automatic shipment number generation
-- ============================================================================
CREATE OR REPLACE FUNCTION set_shipment_number() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.shipment_number IS NULL OR NEW.shipment_number = '' THEN
        NEW.shipment_number := generate_shipment_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_shipment_number 
    BEFORE INSERT ON shipments 
    FOR EACH ROW EXECUTE FUNCTION set_shipment_number();

-- 6. Create trigger to update roll status when shipped
-- ============================================================================
CREATE OR REPLACE FUNCTION update_roll_status_on_shipment() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Update roll status to 'shipped' when added to shipment
        UPDATE fabric_rolls 
        SET roll_status = 'shipped', updated_at = NOW()
        WHERE id = NEW.fabric_roll_id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Revert roll status to 'allocated' when removed from shipment
        UPDATE fabric_rolls 
        SET roll_status = 'allocated', updated_at = NOW()
        WHERE id = OLD.fabric_roll_id;
        
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_roll_status_on_shipment 
    AFTER INSERT OR DELETE ON shipment_items 
    FOR EACH ROW EXECUTE FUNCTION update_roll_status_on_shipment();

-- 7. Create trigger to update roll status when delivery is confirmed
-- ============================================================================
CREATE OR REPLACE FUNCTION update_roll_status_on_delivery() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.shipment_status = 'delivered' AND OLD.shipment_status != 'delivered' THEN
        -- Update all rolls in this shipment to 'delivered'
        UPDATE fabric_rolls 
        SET roll_status = 'delivered', updated_at = NOW()
        WHERE id IN (
            SELECT fabric_roll_id 
            FROM shipment_items 
            WHERE shipment_id = NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_roll_status_on_delivery 
    AFTER UPDATE ON shipments 
    FOR EACH ROW EXECUTE FUNCTION update_roll_status_on_delivery();

-- 8. Create view for shipment summary
-- ============================================================================
CREATE OR REPLACE VIEW shipment_summary AS
SELECT 
    s.id,
    s.shipment_number,
    s.customer_order_id,
    s.shipped_date,
    s.delivery_date,
    s.shipment_status,
    s.tracking_number,
    co.internal_order_number as order_number,
    c.name as customer_name,
    c.email as customer_email,
    c.phone as customer_phone,
    COUNT(si.id) as total_rolls,
    SUM(si.quantity_shipped) as total_quantity,
    STRING_AGG(DISTINCT fr.roll_number, ', ') as roll_numbers
FROM shipments s
JOIN customer_orders co ON s.customer_order_id = co.id
JOIN customers c ON co.customer_id = c.id
LEFT JOIN shipment_items si ON s.id = si.shipment_id
LEFT JOIN fabric_rolls fr ON si.fabric_roll_id = fr.id
GROUP BY s.id, s.shipment_number, s.customer_order_id, s.shipped_date, s.delivery_date, 
         s.shipment_status, s.tracking_number, co.internal_order_number, c.name, c.email, c.phone;

-- 9. Enable Row Level Security (RLS) for shipment tables
-- ============================================================================
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;

-- Create policies for shipments (allow all operations for authenticated users)
CREATE POLICY "Allow all operations for authenticated users" ON shipments
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users" ON shipment_items
    FOR ALL USING (auth.role() = 'authenticated');

-- 10. Sample data for testing (optional)
-- ============================================================================
-- Uncomment the following lines to add sample data for testing

-- INSERT INTO shipments (shipment_number, customer_order_id, shipped_date, shipment_status, tracking_number, notes)
-- SELECT 
--     'SH24001',
--     co.id,
--     CURRENT_DATE - INTERVAL '5 days',
--     'delivered',
--     'TRK123456789',
--     'Sample shipment for testing'
-- FROM customer_orders co
-- LIMIT 1;

-- INSERT INTO shipment_items (shipment_id, fabric_roll_id, quantity_shipped)
-- SELECT 
--     s.id,
--     fr.id,
--     fr.roll_length
-- FROM shipments s
-- CROSS JOIN fabric_rolls fr
-- WHERE s.shipment_number = 'SH24001'
-- LIMIT 3;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After running these migrations, you'll have:
-- 1. Full shipment tracking system
-- 2. Automatic roll status management
-- 3. Shipment number generation
-- 4. Delivery confirmation tracking
-- 5. Summary views for reporting
-- ============================================================================ 