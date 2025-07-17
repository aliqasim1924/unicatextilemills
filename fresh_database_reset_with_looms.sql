-- =====================================================
-- Fresh Database Reset Script for Textiles Stock Management
-- Clears all data and re-adds only the 11 looms (1-11)
-- =====================================================

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- Clear all data in dependency order (most dependent tables first)
-- This ensures we don't hit foreign key constraint violations

-- Level 1: Most dependent tables
TRUNCATE TABLE shipment_items CASCADE;
TRUNCATE TABLE coating_roll_inputs CASCADE;

-- Level 2: Highly dependent tables
TRUNCATE TABLE fabric_rolls CASCADE;
TRUNCATE TABLE loom_rolls CASCADE;
TRUNCATE TABLE shipments CASCADE;

-- Level 3: Production and audit tables
TRUNCATE TABLE loom_production_details CASCADE;
TRUNCATE TABLE production_completion_details CASCADE;
TRUNCATE TABLE wastage_records CASCADE;
TRUNCATE TABLE production_batches CASCADE;
TRUNCATE TABLE barcode_scans CASCADE;
TRUNCATE TABLE customer_order_audit CASCADE;
TRUNCATE TABLE production_order_audit CASCADE;

-- Level 4: Core business tables
TRUNCATE TABLE production_orders CASCADE;
TRUNCATE TABLE customer_orders CASCADE;
TRUNCATE TABLE stock_movements CASCADE;

-- Level 5: Master data tables
TRUNCATE TABLE finished_fabrics CASCADE;
TRUNCATE TABLE base_fabrics CASCADE;
TRUNCATE TABLE customers CASCADE;

-- Level 6: System and configuration tables
TRUNCATE TABLE notification_queue CASCADE;
TRUNCATE TABLE notification_settings CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE yarn_stock CASCADE;
TRUNCATE TABLE chemical_stock CASCADE;

-- Level 7: Equipment tables
TRUNCATE TABLE looms CASCADE;

-- Re-enable foreign key constraints
SET session_replication_role = DEFAULT;

-- =====================================================
-- Re-add the 11 looms in order 1-11
-- =====================================================

INSERT INTO looms (
    loom_number,
    loom_name,
    loom_type,
    status,
    specifications,
    installation_date,
    last_maintenance_date,
    notes,
    created_at,
    updated_at
) VALUES 
('1', 'Loom 1', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('2', 'Loom 2', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('3', 'Loom 3', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('4', 'Loom 4', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('5', 'Loom 5', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('6', 'Loom 6', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('7', 'Loom 7', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('8', 'Loom 8', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('9', 'Loom 9', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('10', 'Loom 10', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW()),
('11', 'Loom 11', 'weaving', 'active', NULL, NULL, NULL, NULL, NOW(), NOW());

-- =====================================================
-- Verification Query - Check that only looms remain
-- =====================================================

-- Verify the looms were added correctly
SELECT 'Looms added:' as status, COUNT(*) as count FROM looms;
SELECT loom_number, loom_name, status FROM looms ORDER BY loom_number::INTEGER;

-- Verify other tables are empty (should all return 0)
SELECT 'Customers:' as table_name, COUNT(*) as count FROM customers
UNION ALL
SELECT 'Base Fabrics:', COUNT(*) FROM base_fabrics
UNION ALL
SELECT 'Finished Fabrics:', COUNT(*) FROM finished_fabrics
UNION ALL
SELECT 'Customer Orders:', COUNT(*) FROM customer_orders
UNION ALL
SELECT 'Production Orders:', COUNT(*) FROM production_orders
UNION ALL
SELECT 'Production Batches:', COUNT(*) FROM production_batches
UNION ALL
SELECT 'Fabric Rolls:', COUNT(*) FROM fabric_rolls
UNION ALL
SELECT 'Stock Movements:', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'Users:', COUNT(*) FROM users
UNION ALL
SELECT 'Yarn Stock:', COUNT(*) FROM yarn_stock
UNION ALL
SELECT 'Chemical Stock:', COUNT(*) FROM chemical_stock
UNION ALL
SELECT 'Shipments:', COUNT(*) FROM shipments;

-- =====================================================
-- Script Summary
-- =====================================================
-- This script has:
-- 1. Cleared ALL data from ALL tables in the database
-- 2. Re-added exactly 11 looms numbered 1-11
-- 3. Verified the reset was successful
-- 
-- The database is now ready for fresh testing with only
-- the essential loom infrastructure in place.
-- ===================================================== 