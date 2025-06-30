-- Get the auth.get_auth_role function definition
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'get_auth_role' 
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');
