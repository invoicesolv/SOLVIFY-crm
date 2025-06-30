-- Step 1: Inspect the current auth.get_auth_role function
-- Connect to your database and run this to see the function definition:

SELECT 
    prosrc,
    proname,
    pronamespace::regnamespace as schema_name,
    pg_get_function_result(oid) as return_type,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'get_auth_role' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');

-- Step 2: Get the complete function definition
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'get_auth_role' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');
