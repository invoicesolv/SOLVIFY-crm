import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase, getConsistentUserId, isValidUUID } from '@/lib/supabase';

export async function GET() {
  try {
    // Get the current auth session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({
        error: 'Not authenticated',
        status: 'unauthenticated'
      }, { status: 401 });
    }
    
    // Session data
    const sessionData = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      isUuid: session.user.id ? isValidUUID(session.user.id) : false,
      originalGoogleId: (session.user as any).originalGoogleId || null
    };
    
    // Check Supabase auth session
    const { data: supabaseSession, error: supabaseError } = await supabase.auth.getSession();
    
    // Check profile data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, email, name, created_at, updated_at')
      .eq('email', session.user.email || '')
      .single();
      
    // Check OAuth mapping if using Google
    let oauthMappingData = null;
    let oauthMappingError = null;
    
    if ((session.user as any).originalGoogleId) {
      const { data, error } = await supabase
        .from('oauth_provider_mapping')
        .select('*')
        .eq('provider_id', (session.user as any).originalGoogleId)
        .eq('provider_name', 'google')
        .single();
        
      oauthMappingData = data;
      oauthMappingError = error;
    }
    
    // Get workspace info
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('owner_id', session.user.id)
      .limit(1);
      
    // Get team membership
    const { data: teamData, error: teamError } = await supabase
      .from('team_members')
      .select('workspace_id, email, permissions')
      .eq('user_id', session.user.id)
      .limit(10);
    
    // Assemble response
    const response = {
      status: 'authenticated',
      session: sessionData,
      profile: profileData,
      profileError: profileError ? { 
        code: profileError.code as string, 
        message: profileError.message as string 
      } : null,
      supabaseSession: supabaseSession ? {
        user: supabaseSession.session?.user ? {
          id: supabaseSession.session.user.id,
          email: supabaseSession.session.user.email,
        } : null,
        hasAccessToken: !!supabaseSession.session?.access_token
      } : null,
      supabaseError: supabaseError ? { 
        code: supabaseError.code as string, 
        message: supabaseError.message as string 
      } : null,
      oauthMapping: oauthMappingData,
      oauthMappingError: oauthMappingError ? { 
        code: (oauthMappingError as any).code, 
        message: (oauthMappingError as any).message 
      } : null,
      workspace: workspaceData?.[0] || null,
      workspaceError: workspaceError ? { 
        code: (workspaceError as any).code, 
        message: (workspaceError as any).message 
      } : null,
      teamMemberships: teamData || [],
      teamError: teamError ? { 
        code: (teamError as any).code, 
        message: (teamError as any).message 
      } : null
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Auth Debug] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    }, { status: 500 });
  }
} 