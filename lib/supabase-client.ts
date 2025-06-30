// This file has been deprecated in favor of NextAuth
// Use supabaseDb from '@/lib/supabase-database' for database operations
// Use NextAuth for authentication

import { supabaseDb } from '@/lib/supabase-database';

// Legacy export for compatibility during migration
export const supabaseClient = supabaseDb;
export default supabaseDb;

// Note: This client no longer includes authentication
// Use NextAuth hooks and components for authentication instead
