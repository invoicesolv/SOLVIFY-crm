import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { supabase, isValidUUID } from '@/lib/supabase';

/**
 * Hook to ensure consistent user ID usage in the client
 * Converts Google numeric IDs to Supabase UUIDs where needed
 */
export function useConsistentUserId() {
  const { data: session, status } = useSession();
  const [consistentId, setConsistentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // DEBUG: Log session state changes
  useEffect(() => {
    console.log('[AUTH DEBUG] Session status changed:', status);
    console.log('[AUTH DEBUG] Session data:', session ? {
      userId: session.user?.id,
      email: session.user?.email,
      hasAccessToken: !!session.access_token,
      expires: session.expires,
    } : 'No session');
    
    // Check for authentication storage
    if (typeof window !== 'undefined') {
      // Find the correct key name for Supabase token
      const supabaseStorageKey = findSupabaseStorageKey();
      const supabaseToken = localStorage.getItem(supabaseStorageKey || 'supabase.auth.token');
      console.log('[AUTH DEBUG] Supabase token in localStorage:', supabaseToken ? 'Present' : 'Missing');
      console.log('[AUTH DEBUG] Supabase storage key:', supabaseStorageKey);
      
      if (supabaseToken) {
        try {
          const parsedToken = JSON.parse(supabaseToken);
          console.log('[AUTH DEBUG] Supabase token valid JSON:', !!parsedToken);
          console.log('[AUTH DEBUG] Supabase token expires_at:', new Date(parsedToken.expires_at * 1000).toISOString());
          console.log('[AUTH DEBUG] Supabase token user:', parsedToken.user?.id);
        } catch (e) {
          console.error('[AUTH DEBUG] Failed to parse Supabase token:', e);
        }
      }
      
      // Check if there are any auth-related cookies
      console.log('[AUTH DEBUG] Cookies present:', document.cookie ? 'Yes' : 'No');
      
      // List localStorage keys to find any auth-related items
      const allKeys = Object.keys(localStorage);
      console.log('[AUTH DEBUG] All localStorage keys:', allKeys);
      
      const authKeys = allKeys.filter(key => 
        key.includes('token') || key.includes('auth') || key.includes('session')
      );
      console.log('[AUTH DEBUG] Auth-related localStorage keys:', authKeys);
    }
  }, [session, status]);
  
  // Helper function to find the Supabase storage key
  function findSupabaseStorageKey() {
    if (typeof window === 'undefined') return null;
    
    // Try to find the key based on common patterns
    const allKeys = Object.keys(localStorage);
    // Look for something like sb-abcdefgh-auth-token
    const supabaseKey = allKeys.find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    
    return supabaseKey || null;
  }

  useEffect(() => {
    async function getConsistentId() {
      if (!session?.user?.id) {
        console.log('[AUTH DEBUG] No user ID in session, authentication may have failed');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // If it's already a valid UUID, we can use it directly
        if (isValidUUID(session.user.id)) {
          console.log('[useConsistentUserId] Session ID is already a valid UUID:', session.user.id);
          setConsistentId(session.user.id);
          setIsLoading(false);
          return;
        }
        
        console.log('[useConsistentUserId] Session ID is not a UUID, looking up by email');
        
        // Otherwise, try to find the user by email
        if (session.user.email) {
          // DEBUG: Check Supabase connectivity
          try {
            console.log('[AUTH DEBUG] Testing Supabase connection...');
            const { data: testData, error: testError } = await supabase.from('profiles').select('count').limit(1);
            if (testError) {
              console.error('[AUTH DEBUG] Supabase connection error:', testError);
            } else {
              console.log('[AUTH DEBUG] Supabase connection successful');
            }
          } catch (connErr) {
            console.error('[AUTH DEBUG] Supabase connection test failed:', connErr);
          }
          
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', session.user.email)
            .single();
            
          if (error) {
            console.error('[useConsistentUserId] Error finding profile by email:', error);
            console.log('[AUTH DEBUG] Supabase query failed - this may indicate auth token issues');
            throw new Error('Failed to find user profile');
          }
          
          if (profile) {
            console.log('[useConsistentUserId] Found user ID by email:', profile.id);
            setConsistentId(profile.id);
            setIsLoading(false);
            return;
          }
        }
        
        // If we get here, we failed to find a valid UUID
        console.warn('[useConsistentUserId] Could not find valid UUID for user:', session.user.id);
        console.log('[AUTH DEBUG] Authentication chain broken - profile lookup failed');
        setError(new Error('Could not find valid UUID for current user'));
        setIsLoading(false);
      } catch (err) {
        console.error('[useConsistentUserId] Error:', err);
        console.log('[AUTH DEBUG] Critical error in auth flow:', err instanceof Error ? err.message : String(err));
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
      }
    }

    getConsistentId();
  }, [session?.user?.id, session?.user?.email]);

  return { 
    consistentId, 
    isLoading, 
    error,
    // Include the original session IDs for debugging
    originalId: session?.user?.id,
    email: session?.user?.email,
    authStatus: status
  };
} 