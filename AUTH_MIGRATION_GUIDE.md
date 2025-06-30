# Auth Function Migration Guide

## Overview
Supabase has restricted access to internal schemas (`auth`, `storage`, `realtime`) to improve platform stability. Your project has a custom function `auth.get_auth_role` that needs to be moved to a schema you own (like `public`) before **July 28th**.

## What You Need to Do

### 1. Inspect Your Current Function
1. Connect to your Supabase database using the SQL Editor in the dashboard
2. Run the queries in `inspect_auth_function.sql` to see what your function does

### 2. Understand Your Function
The `auth.get_auth_role` function likely:
- Returns user role information (admin, user, etc.)
- References `auth.users` table or user metadata
- Is used in Row Level Security (RLS) policies
- Might be called from your application code

### 3. Migration Steps

#### Step A: Create New Function in Public Schema
1. Copy the function definition from step 1
2. Modify the migration file `supabase/migrations/20241229000756_migrate_auth_get_auth_role.sql`
3. Replace the example function with your actual function definition
4. Change the schema from `auth` to `public`

#### Step B: Find All References
Search your codebase for calls to `auth.get_auth_role`:
```bash
# In your project directory
grep -r "auth\.get_auth_role" .
```

#### Step C: Update Application Code
Update any references from:
```sql
-- Old way
SELECT * FROM table WHERE auth.get_auth_role() = 'admin';
```

To:
```sql
-- New way
SELECT * FROM table WHERE public.get_auth_role() = 'admin';
```

#### Step D: Test the Migration
1. Run the migration on your staging/development environment first
2. Test that your application still works correctly
3. Verify RLS policies still function as expected

#### Step E: Deploy to Production
1. Once tested, deploy the migration to production
2. Verify everything works
3. The old function will be automatically removed by Supabase after July 28th

### 4. Common Function Patterns

Your function might look something like:

```sql
-- Example pattern 1: Role from user metadata
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid());
END;
$$;
```

```sql
-- Example pattern 2: Role from custom table
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT role FROM public.user_roles WHERE user_id = auth.uid());
END;
$$;
```

### 5. Alternative: Use Built-in Functions

Consider replacing custom auth functions with Supabase's built-in auth helpers:
- `auth.uid()` - Gets current user ID
- `auth.jwt()` - Gets current user's JWT with metadata
- Custom claims in JWT tokens (recommended for new implementations)

### 6. Timeline
- **Before July 28th**: Complete migration
- **July 28th**: Supabase will automatically move/remove objects in restricted schemas

## Need Help?

If you encounter issues:
1. Check the Supabase documentation on [Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
2. Review [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) docs
3. Contact Supabase support if needed

## Files Created
- `inspect_auth_function.sql` - To examine your current function
- `supabase/migrations/20241229000756_migrate_auth_get_auth_role.sql` - Migration file to move the function
- This guide document
