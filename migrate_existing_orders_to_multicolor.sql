-- =====================================================
-- Data Migration Script: Convert Existing Orders to Multi-Color Structure
-- Migrates existing customer_orders to customer_order_items
-- =====================================================

-- First, run the COLOR_MANAGEMENT_MIGRATIONS.sql before running this script

-- Step 1: Migrate existing customer orders to customer_order_items
INSERT INTO customer_order_items (
    customer_order_id,
    finished_fabric_id,
    color,
    quantity_ordered,
    quantity_allocated,
    notes,
    created_at,
    updated_at
)
SELECT 
    co.id as customer_order_id,
    co.finished_fabric_id,
    COALESCE(co.color, 'Natural') as color, -- Use existing color or default to 'Natural'
    co.quantity_ordered,
    co.quantity_allocated,
    'Migrated from single-color order' as notes,
    co.created_at,
    co.updated_at
FROM customer_orders co
WHERE NOT EXISTS (
    SELECT 1 FROM customer_order_items coi 
    WHERE coi.customer_order_id = co.id
);

-- Step 2: Update production_orders to link to customer_order_items
-- First, add customer_order_item_id and customer_color to existing production orders
UPDATE production_orders po
SET 
    customer_order_item_id = (
        SELECT coi.id 
        FROM customer_order_items coi 
        WHERE coi.customer_order_id = po.customer_order_id 
        LIMIT 1
    ),
    customer_color = (
        SELECT coi.color 
        FROM customer_order_items coi 
        WHERE coi.customer_order_id = po.customer_order_id 
        LIMIT 1
    )
WHERE po.customer_order_item_id IS NULL;

-- Step 3: Update production_batches to include color information
UPDATE production_batches pb
SET 
    customer_color = (
        SELECT po.customer_color 
        FROM production_orders po 
        WHERE po.id = pb.production_order_id
    ),
    customer_order_item_id = (
        SELECT po.customer_order_item_id 
        FROM production_orders po 
        WHERE po.id = pb.production_order_id
    )
WHERE pb.customer_color IS NULL;

-- Step 4: Update fabric_rolls to include customer color information
UPDATE fabric_rolls fr
SET 
    customer_color = (
        SELECT pb.customer_color 
        FROM production_batches pb 
        WHERE pb.id = fr.batch_id
    ),
    customer_order_item_id = (
        SELECT pb.customer_order_item_id 
        FROM production_batches pb 
        WHERE pb.id = fr.batch_id
    )
WHERE fr.customer_color IS NULL AND fr.batch_id IS NOT NULL;

-- Step 5: For fabric_rolls directly linked to customer_orders (without batches)
UPDATE fabric_rolls fr
SET 
    customer_color = (
        SELECT coi.color 
        FROM customer_order_items coi 
        WHERE coi.customer_order_id = fr.customer_order_id
        LIMIT 1
    ),
    customer_order_item_id = (
        SELECT coi.id 
        FROM customer_order_items coi 
        WHERE coi.customer_order_id = fr.customer_order_id
        LIMIT 1
    )
WHERE fr.customer_color IS NULL AND fr.customer_order_id IS NOT NULL;

-- Step 6: Verify migration results
SELECT 'Migration Results' as status;

-- Check customer_order_items created
SELECT 'Customer Order Items Created:' as status, COUNT(*) as count 
FROM customer_order_items;

-- Check production_orders updated
SELECT 'Production Orders with Color:' as status, COUNT(*) as count 
FROM production_orders 
WHERE customer_color IS NOT NULL;

-- Check production_batches updated  
SELECT 'Production Batches with Color:' as status, COUNT(*) as count 
FROM production_batches 
WHERE customer_color IS NOT NULL;

-- Check fabric_rolls updated
SELECT 'Fabric Rolls with Customer Color:' as status, COUNT(*) as count 
FROM fabric_rolls 
WHERE customer_color IS NOT NULL;

-- Sample data from the new color tracking view
SELECT 'Sample Color Tracking Data:' as status;
SELECT * FROM production_color_tracking LIMIT 5;

-- =====================================================
-- Migration Complete
-- =====================================================
-- This script has:
-- 1. Migrated existing customer orders to customer_order_items
-- 2. Updated production_orders to include customer colors
-- 3. Updated production_batches with color information  
-- 4. Updated fabric_rolls to track customer colors
-- 5. Provided verification queries
-- 
-- All existing data should now properly track customer colors
-- throughout the production process.
-- ===================================================== 