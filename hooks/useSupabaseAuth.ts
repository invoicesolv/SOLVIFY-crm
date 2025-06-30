// Compatibility layer to ease migration from Supabase auth to NextAuth
// This provides the same interface as the old useSupabaseAuth hook

import { useSession } from 'next-auth/react'

export function useAuth() {
  const { data: session, status } = useSession()

  return {
    session: session ? {
      user: session.user,
      access_token: 'nextauth-session', // Placeholder since NextAuth handles tokens differently
      refresh_token: 'nextauth-session',
    } : null,
    isLoading: status === 'loading',
    user: session?.user || null,
    signOut: () => {
      // This will be handled by the signOut button components
      console.log('Use signOut from next-auth/react or useAuth hook')
    }
  }
}
