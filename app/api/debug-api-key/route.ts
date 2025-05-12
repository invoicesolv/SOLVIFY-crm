import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase, supabaseAdmin, createServerSupabaseClient, syncSupabaseSession } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';

export const dynamic = 'force-dynamic';

// Debug route that directly shows the results of the API key lookup
export async function GET(req: NextRequest) {
  const debugLog: any[] = [];
  const startTime = Date.now();
  
  // Record all debugging information
  debugLog.push({
    timestamp: new Date().toISOString(),
    step: 'init',
    message: 'Starting API key debug route'
  });
  
  try {
    // Get session
    const session = await getServerSession(authOptions);
    
    debugLog.push({
      timestamp: new Date().toISOString(),
      step: 'session',
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    });
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Unauthorized: User must be logged in',
        debugLog 
      }, { status: 401 });
    }
    
    // CRITICAL: Sync NextAuth session with Supabase to make RLS work
    if ((session as any).access_token) {
      try {
        const supabaseSession = await syncSupabaseSession((session as any).access_token);
        
        debugLog.push({
          timestamp: new Date().toISOString(),
          step: 'supabase_session_sync',
          success: !!supabaseSession,
          userId: supabaseSession?.user?.id,
          email: supabaseSession?.user?.email
        });
      } catch (syncError: any) {
        debugLog.push({
          timestamp: new Date().toISOString(),
          step: 'supabase_session_sync_error',
          error: syncError.message
        });
      }
    } else {
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'no_access_token',
        message: 'No access token in session for Supabase sync'
      });
    }
    
    // Get workspace ID
    let workspaceId: string | undefined;
    
    // Method 1: Try active workspace from user ID
    if (session.user.id) {
      try {
        const activeWorkspace = await getActiveWorkspaceId(session.user.id);
        workspaceId = activeWorkspace || undefined;
        
        debugLog.push({
          timestamp: new Date().toISOString(),
          step: 'workspace_lookup_by_id',
          userId: session.user.id,
          result: workspaceId
        });
      } catch (error: any) {
        debugLog.push({
          timestamp: new Date().toISOString(),
          step: 'workspace_lookup_by_id_error',
          error: error.message
        });
      }
    }
    
    // Method 2: Try by email
    if (!workspaceId && session.user.email) {
      try {
        const { data: teamMemberships, error } = await supabase
          .from('team_members')
          .select('workspace_id')
          .eq('email', session.user.email)
          .order('created_at', { ascending: false })
          .limit(1);
          
        debugLog.push({
          timestamp: new Date().toISOString(),
          step: 'workspace_lookup_by_email',
          userEmail: session.user.email,
          hasResults: teamMemberships && teamMemberships.length > 0,
          error: error?.message
        });
          
        if (teamMemberships && teamMemberships.length > 0) {
          workspaceId = teamMemberships[0].workspace_id;
        }
      } catch (error: any) {
        debugLog.push({
          timestamp: new Date().toISOString(),
          step: 'workspace_lookup_by_email_error',
          error: error.message
        });
      }
    }
    
    // If still no workspace found, return error
    if (!workspaceId) {
      return NextResponse.json({ 
        error: 'No active workspace found',
        debugLog
      }, { status: 403 });
    }
    
    debugLog.push({
      timestamp: new Date().toISOString(),
      step: 'workspace_found',
      workspaceId
    });
    
    // Try fetching API key with client user
    try {
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'fetch_api_key_start',
        workspaceId,
        client: 'regular'
      });
      
      const { data: settings, error: settingsError, status, statusText } = await supabase
        .from('workspace_settings')
        .select('id, openai_api_key, workspace_id, created_at, updated_at')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'fetch_api_key_result',
        status,
        statusText,
        hasData: !!settings,
        hasApiKey: !!settings?.openai_api_key,
        apiKeyLength: settings?.openai_api_key?.length,
        error: settingsError ? {
          message: settingsError.message,
          code: settingsError.code,
          hint: settingsError.hint
        } : null
      });
      
      // Try with a fresh server client to avoid shared auth issues
      const serverClient = createServerSupabaseClient();
      const { data: serverSettings, error: serverError } = await serverClient
        .from('workspace_settings')
        .select('id, openai_api_key, workspace_id')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
        
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'server_client_fetch',
        hasData: !!serverSettings,
        hasApiKey: !!serverSettings?.openai_api_key,
        apiKeyLength: serverSettings?.openai_api_key?.length,
        error: serverError ? serverError.message : null
      });
      
      // Try direct fetch by ID instead of workspace_id
      const { data: directSettings, error: directError } = await supabase
        .from('workspace_settings')
        .select('id, openai_api_key, workspace_id')
        .eq('id', 'ba0a5058-5e09-4e62-8c98-c084488e3f87')
        .maybeSingle();
        
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'direct_id_fetch',
        hasData: !!directSettings,
        hasApiKey: !!directSettings?.openai_api_key,
        apiKeyLength: directSettings?.openai_api_key?.length,
        error: directError ? directError.message : null
      });
      
      // Try admin client to bypass RLS
      const { data: adminSettings, error: adminError } = await supabaseAdmin
        .from('workspace_settings')
        .select('id, openai_api_key, created_at, updated_at')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
        
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'admin_fetch_result',
        hasData: !!adminSettings,
        hasApiKey: !!adminSettings?.openai_api_key,
        apiKeyLength: adminSettings?.openai_api_key?.length,
        error: adminError ? adminError.message : null
      });
      
      // Check RLS permissions
      const { data: userMembership, error: membershipError } = await supabaseAdmin
        .from('team_members')
        .select('user_id, email, permissions, is_admin')
        .or(`user_id.eq.${session.user.id},email.eq.${session.user.email}`)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
        
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'check_permissions',
        hasUserMembership: !!userMembership,
        isAdmin: userMembership?.is_admin,
        hasChatbotPermission: userMembership?.permissions?.use_chatbot,
        error: membershipError ? membershipError.message : null
      });
      
      // Get workspace owner
      const { data: workspace } = await supabaseAdmin
        .from('workspaces')
        .select('owner_id, name')
        .eq('id', workspaceId)
        .maybeSingle();
        
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'check_workspace',
        workspaceName: workspace?.name,
        ownerId: workspace?.owner_id,
        isOwner: workspace?.owner_id === session.user.id
      });
      
      // Check RLS policies
      const { data: policies } = await supabaseAdmin
        .from('pg_policies')
        .select('policyname, schemaname, tablename, cmd, qual')
        .eq('tablename', 'workspace_settings')
        .eq('schemaname', 'public');
        
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'check_policies',
        policies: policies?.map(p => ({
          name: p.policyname,
          command: p.cmd,
          qual: p.qual
        }))
      });
      
      // Check auth status to confirm UID is correctly set
      const { data: authResponse } = await supabase.auth.getUser();
      
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'auth_check',
        hasAuthUser: !!authResponse?.user,
        authUserId: authResponse?.user?.id,
        emailMatches: authResponse?.user?.email === session.user.email,
        idMatches: authResponse?.user?.id === session.user.id
      });
      
      const endTime = Date.now();
      
      return NextResponse.json({
        success: true,
        session: {
          userId: session.user.id,
          email: session.user.email
        },
        workspace: {
          id: workspaceId,
          name: workspace?.name,
          ownerId: workspace?.owner_id,
          isOwner: workspace?.owner_id === session.user.id
        },
        apiKey: {
          exists: !!settings?.openai_api_key,
          length: settings?.openai_api_key?.length || 0,
          settingsId: settings?.id || adminSettings?.id
        },
        permissions: {
          hasUserMembership: !!userMembership,
          isAdmin: !!userMembership?.is_admin,
          hasChatbotPermission: !!userMembership?.permissions?.use_chatbot
        },
        executionTimeMs: endTime - startTime,
        debugLog
      });
    } catch (error: any) {
      debugLog.push({
        timestamp: new Date().toISOString(),
        step: 'error',
        message: error.message,
        stack: error.stack
      });
      
      return NextResponse.json({ 
        error: 'Error fetching API key',
        message: error.message,
        debugLog
      }, { status: 500 });
    }
  } catch (error: any) {
    debugLog.push({
      timestamp: new Date().toISOString(),
      step: 'fatal_error',
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({ 
      error: 'Fatal error in debug route',
      message: error.message,
      debugLog
    }, { status: 500 });
  }
} 