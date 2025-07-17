-- =====================================================
-- Fix RLS Policies for Customer Order Item Audit Table
-- =====================================================

-- Add RLS policies for customer_order_item_audit table
-- Allow all operations for now (you can tighten this later based on your auth requirements)

-- Policy for INSERT operations
CREATE POLICY "Allow insert on customer_order_item_audit" ON customer_order_item_audit
FOR INSERT
WITH CHECK (true);

-- Policy for SELECT operations  
CREATE POLICY "Allow select on customer_order_item_audit" ON customer_order_item_audit
FOR SELECT
USING (true);

-- Policy for UPDATE operations
CREATE POLICY "Allow update on customer_order_item_audit" ON customer_order_item_audit
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Policy for DELETE operations
CREATE POLICY "Allow delete on customer_order_item_audit" ON customer_order_item_audit
FOR DELETE
USING (true);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'customer_order_item_audit'; 