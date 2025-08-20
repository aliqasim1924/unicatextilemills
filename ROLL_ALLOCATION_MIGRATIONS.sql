-- ============================================================================
-- ROLL ALLOCATION SYSTEM DATABASE MIGRATIONS
-- ============================================================================
-- Run these SQL commands in your Supabase SQL Editor to add roll allocation tracking
-- ============================================================================

-- 1. Add missing fields to fabric_rolls table for roll allocation tracking
-- ============================================================================
-- Add customer_order_id field to track which customer order a roll is allocated to
ALTER TABLE fabric_rolls 
ADD COLUMN IF NOT EXISTS customer_order_id UUID REFERENCES customer_orders(id) ON DELETE SET NULL;

-- Add customer_order_item_id field to track which specific order item a roll is allocated to
ALTER TABLE fabric_rolls 
ADD COLUMN IF NOT EXISTS customer_order_item_id UUID REFERENCES customer_order_items(id) ON DELETE SET NULL;

-- Add customer_color field if it doesn't exist
ALTER TABLE fabric_rolls 
ADD COLUMN IF NOT EXISTS customer_color VARCHAR(50) DEFAULT 'Natural';

-- Add quality_grade field if it doesn't exist
ALTER TABLE fabric_rolls 
ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(1) DEFAULT 'A' CHECK (quality_grade IN ('A', 'B', 'C'));

-- 2. Update roll_status constraint to include new statuses
-- ============================================================================
-- Drop existing constraint if it exists
ALTER TABLE fabric_rolls DROP CONSTRAINT IF EXISTS fabric_rolls_roll_status_check;

-- Add new constraint with all statuses
ALTER TABLE fabric_rolls ADD CONSTRAINT fabric_rolls_roll_status_check 
CHECK (roll_status IN ('available', 'allocated', 'partially_allocated', 'used', 'damaged', 'quality_hold', 'shipped', 'delivered'));

-- 3. Create indexes for better performance
-- ============================================================================
-- Index for customer order allocation queries
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_customer_order ON fabric_rolls(customer_order_id);

-- Index for customer order item allocation queries
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_customer_order_item ON fabric_rolls(customer_order_item_id);

-- Index for color-based queries
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_customer_color ON fabric_rolls(customer_color);

-- Index for quality grade queries
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_quality_grade ON fabric_rolls(quality_grade);

-- Composite index for allocation queries
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_allocation ON fabric_rolls(fabric_id, fabric_type, roll_status, customer_color);

-- 4. Create function to get allocated rolls for a customer order
-- ============================================================================
CREATE OR REPLACE FUNCTION get_allocated_rolls_for_order(order_id UUID)
RETURNS TABLE (
    roll_id UUID,
    roll_number VARCHAR,
    roll_length DECIMAL,
    remaining_length DECIMAL,
    quality_grade VARCHAR,
    customer_color VARCHAR,
    batch_number VARCHAR,
    allocated_quantity DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id as roll_id,
        fr.roll_number,
        fr.roll_length,
        fr.remaining_length,
        fr.quality_grade,
        fr.customer_color,
        pb.batch_number,
        (fr.roll_length - fr.remaining_length) as allocated_quantity
    FROM fabric_rolls fr
    LEFT JOIN production_batches pb ON fr.batch_id = pb.id
    WHERE fr.customer_order_id = order_id
    AND fr.roll_status IN ('allocated', 'partially_allocated', 'shipped', 'delivered')
    ORDER BY fr.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to calculate total allocated quantity for an order
-- ============================================================================
CREATE OR REPLACE FUNCTION get_total_allocated_quantity(order_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_allocated DECIMAL := 0;
BEGIN
    SELECT COALESCE(SUM(fr.roll_length - fr.remaining_length), 0)
    INTO total_allocated
    FROM fabric_rolls fr
    WHERE fr.customer_order_id = order_id
    AND fr.roll_status IN ('allocated', 'partially_allocated', 'shipped', 'delivered');
    
    RETURN total_allocated;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to update order allocation when rolls are allocated
-- ============================================================================
CREATE OR REPLACE FUNCTION update_order_allocation_on_roll_change()
RETURNS TRIGGER AS $$
DECLARE
    order_id UUID;
    total_allocated DECIMAL;
    order_quantity DECIMAL;
    new_status VARCHAR;
BEGIN
    -- Get the order ID (either from NEW or OLD)
    order_id := COALESCE(NEW.customer_order_id, OLD.customer_order_id);
    
    IF order_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get order details
    SELECT quantity_ordered INTO order_quantity
    FROM customer_orders
    WHERE id = order_id;
    
    -- Calculate total allocated
    total_allocated := get_total_allocated_quantity(order_id);
    
    -- Determine new status
    IF total_allocated >= order_quantity THEN
        new_status := 'fully_allocated';
    ELSIF total_allocated > 0 THEN
        new_status := 'partially_allocated';
    ELSE
        new_status := 'pending';
    END IF;
    
    -- Update order allocation
    UPDATE customer_orders 
    SET 
        quantity_allocated = total_allocated,
        order_status = new_status,
        updated_at = NOW()
    WHERE id = order_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_order_allocation ON fabric_rolls;
CREATE TRIGGER trigger_update_order_allocation
    AFTER INSERT OR UPDATE OR DELETE ON fabric_rolls
    FOR EACH ROW EXECUTE FUNCTION update_order_allocation_on_roll_change();

-- 7. Create RLS policies for the new fields
-- ============================================================================
-- Policy for customer order allocation
CREATE POLICY "Users can view rolls allocated to their orders" ON fabric_rolls
    FOR SELECT USING (
        customer_order_id IS NOT NULL
    );

-- Policy for updating roll allocation
CREATE POLICY "Users can update roll allocation" ON fabric_rolls
    FOR UPDATE USING (
        roll_status IN ('available', 'allocated', 'partially_allocated')
    );

-- 8. Add sample data for testing (optional)
-- ============================================================================
-- This section can be commented out in production
/*
-- Example of how to manually allocate a roll to an order
-- UPDATE fabric_rolls 
-- SET 
--     customer_order_id = 'your-order-id-here',
--     customer_order_item_id = 'your-order-item-id-here',
--     roll_status = 'allocated',
--     updated_at = NOW()
-- WHERE id = 'your-roll-id-here';
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- The fabric_rolls table now supports:
-- 1. Customer order allocation tracking
-- 2. Order item allocation tracking  
-- 3. Color-based allocation
-- 4. Quality grade tracking
-- 5. Automatic order status updates
-- 6. Performance optimized queries
-- ============================================================================
