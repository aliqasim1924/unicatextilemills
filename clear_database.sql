-- Database Clearing Script for Unica Textile Mills
-- WARNING: This will delete ALL transactional data. Use with caution!

-- Disable triggers to avoid foreign key issues during truncation
SET session_replication_role = replica;

-- Delete transactional/stock/order data in proper order
TRUNCATE TABLE
  stock_movements,
  shipment_items,
  shipments,
  customer_order_item_audit,
  customer_order_items,
  customer_order_audit,
  customer_orders,
  production_order_audit,
  production_orders,
  production_batches,
  fabric_rolls,
  loom_rolls,
  wastage_records,
  barcode_scans,
  notification_queue,
  notification_settings
RESTART IDENTITY CASCADE;

-- Reset stock figures for products
UPDATE base_fabrics SET stock_quantity = 0, minimum_stock = 0;
UPDATE finished_fabrics SET stock_quantity = 0, minimum_stock = 0;

-- Reset any other stock tables you might have
-- UPDATE yarn_stock SET stock_quantity_kg = 0, minimum_stock_kg = 0;
-- UPDATE chemical_stock SET stock_quantity_liters = 0, minimum_stock_liters = 0;

-- Clear any cached or temporary data
-- UPDATE system_settings SET value = '0' WHERE key LIKE '%stock%';

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Verify the cleanup
SELECT 
  'customers' as table_name, COUNT(*) as record_count FROM customers
UNION ALL
SELECT 'base_fabrics', COUNT(*) FROM base_fabrics
UNION ALL
SELECT 'finished_fabrics', COUNT(*) FROM finished_fabrics
UNION ALL
SELECT 'looms', COUNT(*) FROM looms
UNION ALL
SELECT 'customer_orders', COUNT(*) FROM customer_orders
UNION ALL
SELECT 'production_orders', COUNT(*) FROM production_orders
UNION ALL
SELECT 'production_batches', COUNT(*) FROM production_batches
UNION ALL
SELECT 'fabric_rolls', COUNT(*) FROM fabric_rolls
UNION ALL
SELECT 'loom_rolls', COUNT(*) FROM loom_rolls
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'stock_movements', COUNT(*) FROM stock_movements
UNION ALL
SELECT 'barcode_scans', COUNT(*) FROM barcode_scans;

-- Show summary of what was cleared vs what remains
SELECT 'SUMMARY: Transactional data cleared, master data preserved' as status; 