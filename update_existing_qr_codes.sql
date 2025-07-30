-- Update existing QR codes with enriched data
-- This script will update QR codes for rolls that are allocated to customer orders

-- First, let's see what we have
SELECT 
  fr.id,
  fr.roll_number,
  fr.batch_id,
  fr.customer_order_id,
  fr.qr_code,
  co.internal_order_number,
  c.name as customer_name
FROM fabric_rolls fr
LEFT JOIN customer_orders co ON fr.customer_order_id = co.id
LEFT JOIN customers c ON co.customer_id = c.id
WHERE fr.archived = false
LIMIT 5;

-- Update QR codes for allocated rolls with customer information
UPDATE fabric_rolls 
SET qr_code = (
  SELECT json_build_object(
    'type', 'fabric_roll',
    'rollNumber', fr.roll_number,
    'batchId', fr.batch_id,
    'fabricType', fr.fabric_type,
    'fabricId', fr.fabric_id,
    'rollLength', fr.roll_length,
    'qrGeneratedAt', fr.created_at,
    'productionPurpose', 'customer_order',
    'customerOrderId', fr.customer_order_id,
    'customerOrderNumber', co.internal_order_number,
    'customerName', c.name,
    'color', COALESCE(fr.customer_color, 'Natural'),
    'allocationStatus', 'Allocated to ' || c.name,
    'detailsUrl', 'https://unicatextilemills.netlify.app/api/rolls/' || fr.id,
    'additionalData', json_build_object('rollId', fr.id)
  )::text
  FROM customer_orders co
  JOIN customers c ON co.customer_id = c.id
  WHERE co.id = fr.customer_order_id
)
WHERE customer_order_id IS NOT NULL 
  AND archived = false;

-- Update QR codes for stock building rolls (not allocated to customer orders)
UPDATE fabric_rolls 
SET qr_code = json_build_object(
  'type', 'fabric_roll',
  'rollNumber', roll_number,
  'batchId', batch_id,
  'fabricType', fabric_type,
  'fabricId', fabric_id,
  'rollLength', roll_length,
  'qrGeneratedAt', created_at,
  'productionPurpose', 'stock_building',
  'color', COALESCE(customer_color, 'Natural'),
  'allocationStatus', 'Available for stock building',
  'detailsUrl', 'https://unicatextilemills.netlify.app/api/rolls/' || id,
  'additionalData', json_build_object('rollId', id)
)::text
WHERE customer_order_id IS NULL 
  AND archived = false; 