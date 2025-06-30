import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSupabaseWithAuth, setSupabaseAuthContext } from '@/lib/supabase-nextauth'
import { AuthFlowDebugger, visualizeToken, visualizeCookies } from '@/lib/auth-debug'

// Removed hardcoded ADMIN_USER fallback to enforce proper authentication


/**
 * Global NextAuth session handler for all API routes
 * Maps NextAuth users to their Supabase profiles and workspaces
 */
export async function getAuthenticatedUser(request?: NextRequest) {
  try {
    const session = await getServerSession()
    
    if (!session?.user?.email) {
      return null
    }

    // Find user profile in Supabase
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, workspace_id')
      .eq('email', session.user.email)
      .single()
      
    if (!profileError && profile?.id) {
      // Get user's workspace from team_members
      const { data: membership } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id, workspaces(name)')
        .eq('user_id', profile.id)
        .limit(1)
        .single();

      return {
        id: profile.id,
        email: profile.email,
        name: profile.name || session.user.name,
        workspaceId: membership?.workspace_id || profile.workspace_id,
        workspaceName: membership?.workspaces?.name || null
      }
    }

    // Return null if no valid profile found to enforce proper user management
    console.error('No valid profile found for user:', session.user.email);
    return null;

    // Return session user as-is if no mapping found
    return session.user
  } catch (error) {
    console.error('Error getting authenticated user:', error)
    return null
  }
}

/**
 * Authentication middleware for API routes
 * Returns user or sends 401 if not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
  }

  return { user, response: null }
}

/**
 * Optional authentication for API routes
 * Returns user or null without throwing error
 */
export async function optionalAuth(request?: NextRequest) {
  return await getAuthenticatedUser(request)
}

/**
 * Check if user has permission for workspace operations
 */
export async function checkWorkspacePermission(userId: string, workspaceId?: string) {
  if (!workspaceId) return true // No workspace restriction

  try {
    const { data: membership, error } = await supabaseAdmin
      .from('team_members')
      .select('role, workspace_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !membership) {
      return false
    }

    return true // User is a member of the workspace
  } catch (error) {
    console.error('Error checking workspace permission:', error)
    return false
  }
}

/**
 * Get user's workspaces
 */
export async function getUserWorkspaces(userId: string) {
  try {
    const { data: memberships, error } = await supabaseAdmin
      .from('team_members')
      .select(`
        workspace_id,
        role,
        workspaces:workspace_id (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching user workspaces:', error)
      return []
    }

    return memberships?.map(m => ({
      id: m.workspace_id,
      role: m.role,
      ...m.workspaces
    })) || []
  } catch (error) {
    console.error('Error getting user workspaces:', error)
    return []
  }
}

/**
 * API route wrapper that automatically handles authentication
 * Usage: export const GET = withAuth(async (request, { user }) => { ... })
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, context: { user: any }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const routeName = request.nextUrl.pathname;
    
    // Debug: Log request start
    AuthFlowDebugger.logStep(`🚀 API Route: ${routeName}`, true, {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });
    
    // Debug: Analyze cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean);
    console.log(visualizeCookies(cookies));
    
    AuthFlowDebugger.logStep(`🍪 Cookie Analysis`, true, { cookieCount: cookies.length, cookies });
    
    const { user, response } = await requireAuth(request)
    
    if (response) {
      AuthFlowDebugger.logStep(`❌ Authentication Failed: ${routeName}`, false, undefined, 'No valid session found');
      return response // Return 401 if not authenticated
    }
    
    AuthFlowDebugger.logStep(`✅ Authentication Success: ${routeName}`, true, {
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.name
    });

    try {
      const result = await handler(request, { user }, ...args);
      
      AuthFlowDebugger.logStep(`✅ Handler Success: ${routeName}`, true, {
        status: result.status,
        statusText: result.statusText
      });
      
      return result;
    } catch (error) {
      console.error('API handler error:', error)
      
      AuthFlowDebugger.logStep(`❌ Handler Error: ${routeName}`, false, undefined, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * API route wrapper that allows optional authentication
 * Usage: export const GET = withOptionalAuth(async (request, { user }) => { ... })
 */
export function withOptionalAuth<T extends any[]>(
  handler: (request: NextRequest, context: { user: any | null }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const user = await optionalAuth(request)

    try {
      return await handler(request, { user }, ...args)
    } catch (error) {
      console.error('API handler error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Page-level authentication helper
 * Use in page components to get authenticated user
 */
export async function getPageAuth() {
  return await getAuthenticatedUser()
}

/**
 * React hook for client-side authentication
 * Integrates with NextAuth useSession
 */
export { useAuth } from '@/lib/auth-client'
