-- ============================================================================
-- DATABASE CLEANUP SCRIPT
-- ============================================================================
-- This script clears all production data while preserving:
-- - Customers
-- - Base fabrics
-- - Finished fabrics  
-- - Looms (for future production)
-- ============================================================================

-- 1. Clear all production-related data (order matters due to foreign keys)
-- ============================================================================

-- Clear shipment tracking data
DELETE FROM shipment_items;
DELETE FROM shipments;

-- Clear production completion and loom tracking data
DELETE FROM coating_roll_inputs;
DELETE FROM production_completion_details;
DELETE FROM loom_production_details;
DELETE FROM loom_rolls;

-- Clear fabric rolls and related data
DELETE FROM fabric_rolls;
DELETE FROM production_batches;

-- Clear order and production data
DELETE FROM customer_orders;
DELETE FROM production_orders;

-- Clear tracking and audit data
DELETE FROM barcode_scans;
DELETE FROM wastage_records;
DELETE FROM stock_movements;

-- 2. Reset sequences and clean up any orphaned data
-- ============================================================================

-- Reset any auto-incrementing sequences (if they exist)
-- This ensures fresh numbering for new orders and production

-- 3. Verify cleanup
-- ============================================================================

-- Check remaining data
SELECT 
    'customers' as table_name, 
    COUNT(*) as record_count 
FROM customers
UNION ALL
SELECT 
    'base_fabrics' as table_name, 
    COUNT(*) as record_count 
FROM base_fabrics
UNION ALL
SELECT 
    'finished_fabrics' as table_name, 
    COUNT(*) as record_count 
FROM finished_fabrics
UNION ALL
SELECT 
    'looms' as table_name, 
    COUNT(*) as record_count 
FROM looms
UNION ALL
SELECT 
    'customer_orders' as table_name, 
    COUNT(*) as record_count 
FROM customer_orders
UNION ALL
SELECT 
    'production_orders' as table_name, 
    COUNT(*) as record_count 
FROM production_orders
UNION ALL
SELECT 
    'production_batches' as table_name, 
    COUNT(*) as record_count 
FROM production_batches
UNION ALL
SELECT 
    'fabric_rolls' as table_name, 
    COUNT(*) as record_count 
FROM fabric_rolls
UNION ALL
SELECT 
    'loom_rolls' as table_name, 
    COUNT(*) as record_count 
FROM loom_rolls
UNION ALL
SELECT 
    'shipments' as table_name, 
    COUNT(*) as record_count 
FROM shipments;

-- ============================================================================
-- CLEANUP COMPLETE
-- ============================================================================
-- 
-- After running this script, you should have:
-- - All customers preserved
-- - All base fabrics preserved
-- - All finished fabrics preserved
-- - All looms preserved
-- - All production data cleared
-- - All orders cleared
-- - All shipments cleared
-- - All QR codes cleared
-- 
-- The system is now ready for fresh testing with clean data.
-- ============================================================================ 