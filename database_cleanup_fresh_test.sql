-- =========================================
-- FRESH DATABASE CLEANUP FOR TESTING
-- Keep only 4 master data types: looms, customers, base_fabrics, finished_fabrics
-- Clear all transactional data and reset stock quantities
-- =========================================

-- Start cleanup (foreign key constraints will be handled by proper order of deletion)

-- Clear all transactional data (production and orders) - only if tables exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
        DELETE FROM stock_movements;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fabric_rolls') THEN
        DELETE FROM fabric_rolls;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'coating_roll_inputs') THEN
        DELETE FROM coating_roll_inputs;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loom_rolls') THEN
        DELETE FROM loom_rolls;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loom_production_details') THEN
        DELETE FROM loom_production_details;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_completion_details') THEN
        DELETE FROM production_completion_details;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_batches') THEN
        DELETE FROM production_batches;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_orders') THEN
        DELETE FROM production_orders;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_orders') THEN
        DELETE FROM customer_orders;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shipment_items') THEN
        DELETE FROM shipment_items;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shipments') THEN
        DELETE FROM shipments;
    END IF;
END $$;

-- Clear any other transactional tables that might exist (only if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'qr_codes') THEN
        DELETE FROM qr_codes;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        DELETE FROM notifications;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        DELETE FROM audit_logs;
    END IF;
END $$;

-- Transactional data cleanup complete

-- Reset stock quantities to zero for fresh testing (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'base_fabrics') THEN
        UPDATE base_fabrics SET stock_quantity = 0, updated_at = NOW();
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'finished_fabrics') THEN
        UPDATE finished_fabrics SET stock_quantity = 0, updated_at = NOW();
    END IF;
END $$;

-- Ensure looms table has all required looms (1-11)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'looms') THEN
        DELETE FROM looms;
        INSERT INTO looms (loom_number, loom_name, loom_type, status, created_at, updated_at) VALUES
          ('1', 'Loom 1', 'weaving', 'active', NOW(), NOW()),
          ('2', 'Loom 2', 'weaving', 'active', NOW(), NOW()),
          ('3', 'Loom 3', 'weaving', 'active', NOW(), NOW()),
          ('4', 'Loom 4', 'weaving', 'active', NOW(), NOW()),
          ('5', 'Loom 5', 'weaving', 'active', NOW(), NOW()),
          ('6', 'Loom 6', 'weaving', 'active', NOW(), NOW()),
          ('7', 'Loom 7', 'weaving', 'active', NOW(), NOW()),
          ('8', 'Loom 8', 'weaving', 'active', NOW(), NOW()),
          ('9', 'Loom 9', 'weaving', 'active', NOW(), NOW()),
          ('10', 'Loom 10', 'weaving', 'active', NOW(), NOW()),
          ('11', 'Loom 11', 'weaving', 'active', NOW(), NOW());
    END IF;
END $$;

-- Reset sequences for clean numbering (only if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'customer_orders_id_seq') THEN
        PERFORM setval('customer_orders_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'production_orders_id_seq') THEN
        PERFORM setval('production_orders_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'production_batches_id_seq') THEN
        PERFORM setval('production_batches_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'fabric_rolls_id_seq') THEN
        PERFORM setval('fabric_rolls_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'loom_rolls_id_seq') THEN
        PERFORM setval('loom_rolls_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'stock_movements_id_seq') THEN
        PERFORM setval('stock_movements_id_seq', 1, false);
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'shipments_id_seq') THEN
        PERFORM setval('shipments_id_seq', 1, false);
    END IF;
END $$;

-- Verification queries - safely check table counts
DO $$
BEGIN
    -- Show table counts
    RAISE NOTICE 'DATABASE CLEANUP VERIFICATION:';
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers') THEN
        RAISE NOTICE 'CUSTOMERS: % rows', (SELECT COUNT(*) FROM customers);
    ELSE
        RAISE NOTICE 'CUSTOMERS: table does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'base_fabrics') THEN
        RAISE NOTICE 'BASE_FABRICS: % rows', (SELECT COUNT(*) FROM base_fabrics);
    ELSE
        RAISE NOTICE 'BASE_FABRICS: table does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'finished_fabrics') THEN
        RAISE NOTICE 'FINISHED_FABRICS: % rows', (SELECT COUNT(*) FROM finished_fabrics);
    ELSE
        RAISE NOTICE 'FINISHED_FABRICS: table does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'looms') THEN
        RAISE NOTICE 'LOOMS: % rows', (SELECT COUNT(*) FROM looms);
    ELSE
        RAISE NOTICE 'LOOMS: table does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_orders') THEN
        RAISE NOTICE 'CUSTOMER_ORDERS: % rows', (SELECT COUNT(*) FROM customer_orders);
    ELSE
        RAISE NOTICE 'CUSTOMER_ORDERS: table does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_orders') THEN
        RAISE NOTICE 'PRODUCTION_ORDERS: % rows', (SELECT COUNT(*) FROM production_orders);
    ELSE
        RAISE NOTICE 'PRODUCTION_ORDERS: table does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fabric_rolls') THEN
        RAISE NOTICE 'FABRIC_ROLLS: % rows', (SELECT COUNT(*) FROM fabric_rolls);
    ELSE
        RAISE NOTICE 'FABRIC_ROLLS: table does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
        RAISE NOTICE 'STOCK_MOVEMENTS: % rows', (SELECT COUNT(*) FROM stock_movements);
    ELSE
        RAISE NOTICE 'STOCK_MOVEMENTS: table does not exist';
    END IF;
    
    RAISE NOTICE 'CLEANUP COMPLETE - Database ready for fresh testing!';
END $$; 