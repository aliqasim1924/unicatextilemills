-- =====================================================
-- DATABASE CLEANUP - RESTORE TO SIMPLE SINGLE-TENANT STATE
-- =====================================================
-- This script removes all multi-tenant complexity and restores
-- the database to the simple state expected by the reverted app
-- =====================================================

-- Step 1: Check current database state
-- =====================================================
SELECT 'Current database state:' as info;

-- Check what tables exist
SELECT 
  table_name,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED'
    ELSE 'RLS DISABLED'
  END as rls_status
FROM information_schema.tables t
JOIN pg_tables pt ON t.table_name = pt.tablename
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd, 
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Step 2: Disable RLS on all tables
-- =====================================================
SELECT 'Disabling RLS on all tables...' as info;

ALTER TABLE IF EXISTS customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS base_fabrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS finished_fabrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS production_batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fabric_rolls DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS loom_rolls DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS looms DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shipment_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_profiles DISABLE ROW LEVEL SECURITY;

-- Step 3: Drop all RLS policies
-- =====================================================
SELECT 'Dropping all RLS policies...' as info;

-- Drop policies from main business tables
DROP POLICY IF EXISTS "tenant access by company" ON customers;
DROP POLICY IF EXISTS "tenant access by company" ON base_fabrics;
DROP POLICY IF EXISTS "tenant access by company" ON finished_fabrics;
DROP POLICY IF EXISTS "tenant access by company" ON customer_orders;
DROP POLICY IF EXISTS "tenant access by company" ON production_orders;
DROP POLICY IF EXISTS "tenant access by company" ON production_batches;
DROP POLICY IF EXISTS "tenant access by company" ON fabric_rolls;
DROP POLICY IF EXISTS "tenant access by company" ON loom_rolls;
DROP POLICY IF EXISTS "tenant access by company" ON looms;
DROP POLICY IF EXISTS "tenant access by company" ON shipments;
DROP POLICY IF EXISTS "tenant access by company" ON shipment_items;

-- Drop policies from auth-related tables
DROP POLICY IF EXISTS "Users can access customers from current company context" ON customers;
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated users to manage customers" ON customers;
DROP POLICY IF EXISTS "Allow authenticated users to manage base_fabrics" ON base_fabrics;
DROP POLICY IF EXISTS "Allow authenticated users to manage finished_fabrics" ON finished_fabrics;
DROP POLICY IF EXISTS "Allow authenticated users to manage customer_orders" ON customer_orders;
DROP POLICY IF EXISTS "Allow authenticated users to manage production_orders" ON production_orders;
DROP POLICY IF EXISTS "Allow authenticated users to manage production_batches" ON production_batches;
DROP POLICY IF EXISTS "Allow authenticated users to manage fabric_rolls" ON fabric_rolls;
DROP POLICY IF EXISTS "Allow authenticated users to manage looms" ON looms;
DROP POLICY IF EXISTS "Allow authenticated users to manage loom_rolls" ON looms;
DROP POLICY IF EXISTS "Allow authenticated users to manage shipments" ON shipments;

-- Drop policies from auth tables
DROP POLICY IF EXISTS "service role full access" ON companies;
DROP POLICY IF EXISTS "service role full access" ON app_users;
DROP POLICY IF EXISTS "service role full access" ON company_profiles;
DROP POLICY IF EXISTS "users can view own user record" ON app_users;
DROP POLICY IF EXISTS "service role can insert users" ON app_users;
DROP POLICY IF EXISTS "service role can update users" ON app_users;
DROP POLICY IF EXISTS "service role can delete users" ON app_users;

-- Step 4: Remove company_id columns from business tables
-- =====================================================
SELECT 'Removing company_id columns from business tables...' as info;

-- Check which tables have company_id columns
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name = 'company_id'
  AND table_name NOT IN ('companies')
ORDER BY table_name;

-- Remove company_id columns (only if they exist)
ALTER TABLE IF EXISTS customers DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS base_fabrics DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS finished_fabrics DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS customer_orders DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS production_orders DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS production_batches DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS fabric_rolls DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS loom_rolls DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS looms DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS shipments DROP COLUMN IF EXISTS company_id;
ALTER TABLE IF EXISTS shipment_items DROP COLUMN IF EXISTS company_id;

-- Step 5: Drop multi-tenant tables and functions
-- =====================================================
SELECT 'Dropping multi-tenant tables and functions...' as info;

-- Drop multi-tenant tables
DROP TABLE IF EXISTS company_profiles CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Drop multi-tenant functions
DROP FUNCTION IF EXISTS public.current_user_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_company_context() CASCADE;
DROP FUNCTION IF EXISTS public.set_current_company_context(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.user_has_section(text) CASCADE;
DROP FUNCTION IF EXISTS public.uid() CASCADE;
DROP FUNCTION IF EXISTS public.role() CASCADE;
DROP FUNCTION IF EXISTS public.email() CASCADE;
DROP FUNCTION IF EXISTS public.jwt() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.register_company_and_profile() CASCADE;
DROP FUNCTION IF EXISTS public.user_exists(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_info(uuid) CASCADE;

-- Step 6: Clean up any remaining multi-tenant triggers
-- =====================================================
SELECT 'Cleaning up multi-tenant triggers...' as info;

-- List all triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Drop specific multi-tenant triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

-- Step 7: Verify cleanup
-- =====================================================
SELECT 'Verifying cleanup...' as info;

-- Check RLS status
SELECT 
  table_name,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED'
    ELSE 'RLS DISABLED'
  END as rls_status
FROM information_schema.tables t
JOIN pg_tables pt ON t.table_name = pt.tablename
WHERE t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check remaining policies
SELECT 
  schemaname, 
  tablename, 
  policyname
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check remaining functions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name LIKE '%company%'
ORDER BY routine_name;

-- Step 8: Final status
-- =====================================================
SELECT 'Database cleanup complete!' as status;
SELECT 'All multi-tenant complexity has been removed.' as info;
SELECT 'The database is now in simple, single-tenant state.' as info;
SELECT 'You should now be able to create customers and use the app normally.' as info;
