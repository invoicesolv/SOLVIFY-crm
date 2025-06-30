import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseAdmin } from '@/lib/supabase';

// Removed hardcoded ADMIN_USER fallback to enforce proper authentication

// Helper function to get user from Supabase JWT token
export async function getUserFromToken(request: NextRequest) {
  let token: string | null = null;
  
  // First try to get token from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // Removed admin bypass token check to enforce proper authentication
  
  // If no Authorization header, try to get token from cookies
  if (!token) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      // Parse cookies
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      // Try Supabase auth token - check multiple possible cookie names
      const supabaseAuthCookie = cookies['sb-jbspiufukrifntnwlrts-auth-token'] || 
                                 cookies['supabase-auth-token'] ||
                                 cookies['sb-auth-token'];
      if (supabaseAuthCookie) {
        try {
          console.log('[Auth Utils] Found Supabase auth cookie, parsing...');
          const decodedCookie = decodeURIComponent(supabaseAuthCookie);
          const authData = JSON.parse(decodedCookie);
          
          console.log('[Auth Utils] Parsed auth data structure:', {
            isArray: Array.isArray(authData),
            isObject: typeof authData === 'object' && !Array.isArray(authData),
            hasAccessToken: authData.access_token ? 'present' : 'missing'
          });
          
          // Handle both old array format and new object format
          if (Array.isArray(authData) && authData[0]) {
            // Old format: ["access_token", "refresh_token"]
            token = authData[0];
            console.log('[Auth Utils] Using array format token');
          } else if (authData && typeof authData === 'object' && authData.access_token) {
            // New format: {access_token: "...", refresh_token: "...", user: {...}}
            token = authData.access_token;
            console.log('[Auth Utils] Using object format token');
          }
        } catch (error) {
          console.error('[Auth Utils] Error parsing Supabase auth cookie:', error);
        }
      } else {
        console.log('[Auth Utils] No Supabase auth cookie found, available cookies:', Object.keys(cookies));
        
        // Log available cookies for debugging
        console.log('[Auth Utils] No valid Supabase auth found, available cookies:', Object.keys(cookies));
      }
    }
  }
  
  // Removed admin bypass token check to enforce proper authentication
  
  if (!token) {
    console.log('[Auth Utils] No Supabase token found, trying NextAuth session...');
    
    // Try NextAuth session as fallback
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        console.log('[Auth Utils] Found NextAuth session for user:', session.user.id);
        return {
          id: session.user.id,
          email: session.user.email || '',
          user_metadata: {
            name: session.user.name,
            email: session.user.email,
            full_name: session.user.name
          },
          app_metadata: {}
        };
      }
    } catch (sessionError) {
      console.error('[Auth Utils] Error getting NextAuth session:', sessionError);
    }
    
    console.log('[Auth Utils] No authentication found');
    return null; // Return null when no token or session
  }
  
  try {
    // Verify Supabase token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      console.log('[Auth Utils] Invalid Supabase token:', error?.message);
      return null; // Return null for invalid token
    }
    console.log('[Auth Utils] Successfully authenticated user:', user.id);
    return user;
  } catch (error) {
    console.error('Error verifying Supabase token:', error);
    return null; // Return null on error
  }
}
