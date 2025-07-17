-- =====================================================
-- Color Management Migration for Multi-Color Customer Orders
-- Adds support for multiple colors per customer order
-- =====================================================

-- Step 1: Create customer_order_items table for multiple colors per order
CREATE TABLE IF NOT EXISTS customer_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_order_id UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
    finished_fabric_id UUID REFERENCES finished_fabrics(id),
    color VARCHAR NOT NULL,
    quantity_ordered NUMERIC NOT NULL CHECK (quantity_ordered > 0),
    quantity_allocated NUMERIC DEFAULT 0 CHECK (quantity_allocated >= 0),
    unit_price NUMERIC,
    total_price NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_order_items_order_id ON customer_order_items(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_fabric_id ON customer_order_items(finished_fabric_id);
CREATE INDEX IF NOT EXISTS idx_customer_order_items_color ON customer_order_items(color);

-- Step 2: Add color field to fabric_rolls to track customer-specified colors
ALTER TABLE fabric_rolls 
ADD COLUMN IF NOT EXISTS customer_color VARCHAR,
ADD COLUMN IF NOT EXISTS customer_order_item_id UUID REFERENCES customer_order_items(id);

-- Add index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_order_item_id ON fabric_rolls(customer_order_item_id);

-- Step 3: Add color tracking to production_orders
ALTER TABLE production_orders 
ADD COLUMN IF NOT EXISTS customer_color VARCHAR,
ADD COLUMN IF NOT EXISTS customer_order_item_id UUID REFERENCES customer_order_items(id);

-- Add index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_production_orders_order_item_id ON production_orders(customer_order_item_id);

-- Step 4: Add color tracking to production_batches
ALTER TABLE production_batches 
ADD COLUMN IF NOT EXISTS customer_color VARCHAR,
ADD COLUMN IF NOT EXISTS customer_order_item_id UUID REFERENCES customer_order_items(id);

-- Add index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_production_batches_order_item_id ON production_batches(customer_order_item_id);

-- Step 5: Create view for easy color tracking across the production process
CREATE OR REPLACE VIEW production_color_tracking AS
SELECT 
    co.id as customer_order_id,
    co.internal_order_number,
    c.name as customer_name,
    coi.id as order_item_id,
    coi.color as customer_color,
    coi.quantity_ordered,
    coi.quantity_allocated,
    ff.name as finished_fabric_name,
    bf.name as base_fabric_name,
    po.id as production_order_id,
    po.production_type,
    po.production_status,
    pb.batch_number,
    pb.batch_status,
    COUNT(fr.id) as fabric_rolls_count,
    SUM(fr.roll_length) as total_roll_length
FROM customer_orders co
JOIN customers c ON co.customer_id = c.id
JOIN customer_order_items coi ON co.id = coi.customer_order_id
LEFT JOIN finished_fabrics ff ON coi.finished_fabric_id = ff.id
LEFT JOIN base_fabrics bf ON ff.base_fabric_id = bf.id
LEFT JOIN production_orders po ON coi.id = po.customer_order_item_id
LEFT JOIN production_batches pb ON po.id = pb.production_order_id
LEFT JOIN fabric_rolls fr ON coi.id = fr.customer_order_item_id
GROUP BY 
    co.id, co.internal_order_number, c.name, coi.id, coi.color, 
    coi.quantity_ordered, coi.quantity_allocated, ff.name, bf.name,
    po.id, po.production_type, po.production_status, pb.batch_number, pb.batch_status;

-- Step 6: Create trigger to update customer_orders total quantities from items
CREATE OR REPLACE FUNCTION update_customer_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customer_orders 
    SET 
        quantity_ordered = (
            SELECT COALESCE(SUM(quantity_ordered), 0) 
            FROM customer_order_items 
            WHERE customer_order_id = COALESCE(NEW.customer_order_id, OLD.customer_order_id)
        ),
        quantity_allocated = (
            SELECT COALESCE(SUM(quantity_allocated), 0) 
            FROM customer_order_items 
            WHERE customer_order_id = COALESCE(NEW.customer_order_id, OLD.customer_order_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.customer_order_id, OLD.customer_order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for customer_order_items
DROP TRIGGER IF EXISTS trg_update_customer_order_totals_insert ON customer_order_items;
DROP TRIGGER IF EXISTS trg_update_customer_order_totals_update ON customer_order_items;
DROP TRIGGER IF EXISTS trg_update_customer_order_totals_delete ON customer_order_items;

CREATE TRIGGER trg_update_customer_order_totals_insert
    AFTER INSERT ON customer_order_items
    FOR EACH ROW EXECUTE FUNCTION update_customer_order_totals();

CREATE TRIGGER trg_update_customer_order_totals_update
    AFTER UPDATE ON customer_order_items
    FOR EACH ROW EXECUTE FUNCTION update_customer_order_totals();

CREATE TRIGGER trg_update_customer_order_totals_delete
    AFTER DELETE ON customer_order_items
    FOR EACH ROW EXECUTE FUNCTION update_customer_order_totals();

-- Step 7: Add audit trail for customer order items
CREATE TABLE IF NOT EXISTS customer_order_item_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_order_item_id UUID NOT NULL,
    action_type VARCHAR NOT NULL, -- 'create', 'update', 'delete'
    field_changed VARCHAR,
    old_value TEXT,
    new_value TEXT,
    change_description TEXT NOT NULL,
    changed_by VARCHAR DEFAULT 'System',
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy for audit table
ALTER TABLE customer_order_item_audit ENABLE ROW LEVEL SECURITY;

-- Create audit trigger for customer_order_items
CREATE OR REPLACE FUNCTION audit_customer_order_items()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO customer_order_item_audit (
            customer_order_item_id, action_type, change_description
        ) VALUES (
            NEW.id, 'create', 'Customer order item created with color: ' || NEW.color || ', quantity: ' || NEW.quantity_ordered
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for color changes
        IF OLD.color IS DISTINCT FROM NEW.color THEN
            INSERT INTO customer_order_item_audit (
                customer_order_item_id, action_type, field_changed, old_value, new_value, change_description
            ) VALUES (
                NEW.id, 'update', 'color', OLD.color, NEW.color, 'Color changed from ' || COALESCE(OLD.color, 'NULL') || ' to ' || COALESCE(NEW.color, 'NULL')
            );
        END IF;
        
        -- Check for quantity changes
        IF OLD.quantity_ordered IS DISTINCT FROM NEW.quantity_ordered THEN
            INSERT INTO customer_order_item_audit (
                customer_order_item_id, action_type, field_changed, old_value, new_value, change_description
            ) VALUES (
                NEW.id, 'update', 'quantity_ordered', OLD.quantity_ordered::TEXT, NEW.quantity_ordered::TEXT, 'Quantity ordered changed from ' || OLD.quantity_ordered || ' to ' || NEW.quantity_ordered
            );
        END IF;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO customer_order_item_audit (
            customer_order_item_id, action_type, change_description
        ) VALUES (
            OLD.id, 'delete', 'Customer order item deleted - Color: ' || OLD.color || ', Quantity: ' || OLD.quantity_ordered
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger
DROP TRIGGER IF EXISTS trg_audit_customer_order_items ON customer_order_items;
CREATE TRIGGER trg_audit_customer_order_items
    AFTER INSERT OR UPDATE OR DELETE ON customer_order_items
    FOR EACH ROW EXECUTE FUNCTION audit_customer_order_items();

-- =====================================================
-- Migration Summary
-- =====================================================
-- This migration adds:
-- 1. customer_order_items table for multiple colors per order
-- 2. Color tracking fields to fabric_rolls, production_orders, production_batches
-- 3. View for easy color tracking across production process
-- 4. Triggers to maintain customer_orders totals
-- 5. Audit trail for customer order items
-- 
-- Next Steps:
-- 1. Migrate existing single-color orders to new structure
-- 2. Update application logic to use new schema
-- 3. Update UI components
-- ===================================================== 