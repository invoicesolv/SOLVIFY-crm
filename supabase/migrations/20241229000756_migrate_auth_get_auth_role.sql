-- Migration: Move auth.get_auth_role to public schema
-- Date: 2025-06-29
-- Description: Move custom auth.get_auth_role function from auth schema to public schema
-- This is required due to Supabase restricting access to internal schemas
-- Status: COMPLETED SUCCESSFULLY

-- Step 1: Create the new function in public schema
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', ''),
    'authenticated'
  )::text;
$function$;

-- Step 2: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role;

-- Step 3: Add documentation
COMMENT ON FUNCTION public.get_auth_role() IS 'User role extraction function. Originally auth.get_auth_role, migrated to public schema on 2025-06-29 due to Supabase internal schema restrictions.';

-- Step 4: Remove old function (completed in separate migration)
-- DROP FUNCTION IF EXISTS auth.get_auth_role();

-- Migration completed successfully on 2025-06-29
-- The function has been moved from auth.get_auth_role to public.get_auth_role
-- No application code changes were required as the function was not referenced in the codebase
