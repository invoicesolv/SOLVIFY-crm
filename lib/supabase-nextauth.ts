import { createClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'

// Custom Supabase client that works with NextAuth sessions
export async function getSupabaseWithAuth() {
  const session = await getServerSession()
  
  // Create Supabase client with service role key for admin operations
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  // If we have a NextAuth session, set the user context for RLS
  if (session?.user?.id) {
    // Set the auth context for RLS policies
    await supabase.rpc('set_auth_context', {
      user_id: session.user.id
    })
  }

  return supabase
}

// Client-side Supabase client that works with NextAuth
export function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Helper function to set auth context in Supabase
export async function setSupabaseAuthContext(supabaseClient: any, userId: string) {
  try {
    await supabaseClient.rpc('set_auth_context', {
      user_id: userId
    })
  } catch (error) {
    console.warn('Could not set auth context:', error)
  }
}
