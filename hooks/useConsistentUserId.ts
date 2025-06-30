import { useSession } from 'next-auth/react';

// Extend the NextAuth user type to include id
interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * A hook to get the consistent user ID.
 * Updated to use NextAuth instead of Supabase Auth.
 */
export function useConsistentUserId() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const user = session?.user as ExtendedUser;

  return { 
    consistentId: user?.id || user?.email || null, 
    isLoading, 
    error: null, // No more mapping errors
    // Provide compatible fields for debugging if needed
    originalId: user?.id || user?.email || null, 
    email: user?.email || null,
    authStatus: session ? 'authenticated' : 'unauthenticated'
  };
}
