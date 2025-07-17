-- ============================================================================
-- INSERT SAMPLE BATCH DATA
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to create sample batch data
-- ============================================================================

-- First, let's check what data we have to work with
SELECT 'Production Orders' as data_type, COUNT(*) as count FROM production_orders
UNION ALL
SELECT 'Base Fabrics' as data_type, COUNT(*) as count FROM base_fabrics
UNION ALL
SELECT 'Finished Fabrics' as data_type, COUNT(*) as count FROM finished_fabrics
UNION ALL
SELECT 'Customers' as data_type, COUNT(*) as count FROM customers;

-- Insert sample batch data
INSERT INTO production_batches (
    batch_number,
    production_order_id,
    production_type,
    planned_quantity,
    actual_a_grade_quantity,
    wastage_quantity,
    wastage_percentage,
    batch_status,
    base_fabric_id,
    finished_fabric_id,
    notes
) 
SELECT 
    'BATCH-' || LPAD(ROW_NUMBER() OVER (ORDER BY po.created_at)::TEXT, 3, '0') as batch_number,
    po.id as production_order_id,
    po.production_type,
    po.planned_quantity,
    CASE 
        WHEN po.production_type = 'weaving' THEN po.planned_quantity * 0.95
        ELSE po.planned_quantity * 0.90
    END as actual_a_grade_quantity,
    CASE 
        WHEN po.production_type = 'weaving' THEN po.planned_quantity * 0.05
        ELSE po.planned_quantity * 0.10
    END as wastage_quantity,
    CASE 
        WHEN po.production_type = 'weaving' THEN 5.0
        ELSE 10.0
    END as wastage_percentage,
    CASE 
        WHEN po.status = 'completed' THEN 'completed'
        WHEN po.status = 'in_progress' THEN 'in_progress'
        ELSE 'quality_check'
    END as batch_status,
    po.base_fabric_id,
    po.finished_fabric_id,
    'Auto-generated batch for production order ' || po.internal_order_number as notes
FROM production_orders po
WHERE po.id NOT IN (
    SELECT DISTINCT production_order_id 
    FROM production_batches 
    WHERE production_order_id IS NOT NULL
)
LIMIT 10;

-- Insert some fabric rolls for the batches
INSERT INTO fabric_rolls (
    roll_number,
    batch_id,
    length,
    width,
    weight,
    quality_grade,
    roll_status,
    qr_code,
    notes
)
SELECT 
    pb.batch_number || '-R' || LPAD(generate_series::TEXT, 3, '0') as roll_number,
    pb.id as batch_id,
    CASE 
        WHEN pb.production_type = 'weaving' THEN 45.0 + (RANDOM() * 10)
        ELSE 48.0 + (RANDOM() * 4)
    END as length,
    2.5 as width,
    CASE 
        WHEN pb.production_type = 'weaving' THEN 25.0 + (RANDOM() * 5)
        ELSE 30.0 + (RANDOM() * 5)
    END as weight,
    CASE 
        WHEN RANDOM() < 0.8 THEN 'A'
        WHEN RANDOM() < 0.95 THEN 'B'
        ELSE 'C'
    END as quality_grade,
    'available' as roll_status,
    jsonb_build_object(
        'batch_number', pb.batch_number,
        'roll_number', pb.batch_number || '-R' || LPAD(generate_series::TEXT, 3, '0'),
        'production_type', pb.production_type,
        'created_at', NOW()
    )::TEXT as qr_code,
    'Sample roll for batch ' || pb.batch_number as notes
FROM production_batches pb
CROSS JOIN generate_series(1, 
    CASE 
        WHEN pb.production_type = 'weaving' THEN 15 + (RANDOM() * 10)::INTEGER
        ELSE 10 + (RANDOM() * 5)::INTEGER
    END
) generate_series
WHERE pb.id NOT IN (
    SELECT DISTINCT batch_id 
    FROM fabric_rolls 
    WHERE batch_id IS NOT NULL
)
LIMIT 100;

-- Verify the inserted data
SELECT 
    'Production Batches' as data_type,
    COUNT(*) as count
FROM production_batches
UNION ALL
SELECT 
    'Fabric Rolls with Batches' as data_type,
    COUNT(*) as count
FROM fabric_rolls fr
WHERE fr.batch_id IS NOT NULL;

-- Show sample batch data
SELECT 
    pb.batch_number,
    pb.production_type,
    pb.planned_quantity,
    pb.actual_a_grade_quantity,
    pb.batch_status,
    po.internal_order_number,
    co.internal_order_number as customer_order,
    c.name as customer_name,
    COUNT(fr.id) as roll_count
FROM production_batches pb
LEFT JOIN production_orders po ON pb.production_order_id = po.id
LEFT JOIN customer_orders co ON po.customer_order_id = co.id
LEFT JOIN customers c ON co.customer_id = c.id
LEFT JOIN fabric_rolls fr ON pb.id = fr.batch_id
GROUP BY pb.id, pb.batch_number, pb.production_type, pb.planned_quantity, 
         pb.actual_a_grade_quantity, pb.batch_status, po.internal_order_number,
         co.internal_order_number, c.name
ORDER BY pb.created_at DESC
LIMIT 5; 