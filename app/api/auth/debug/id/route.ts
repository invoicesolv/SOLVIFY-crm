import { NextRequest, NextResponse } from 'next/server';
import { supabase, isValidUUID } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

/**
 * Debug endpoint to check user ID consistency and help identify issues
 * with Google numeric IDs vs Supabase UUIDs
 */
export async function GET(request: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id || '';
    
    const result: Record<string, any> = {
      sessionUserId: userId,
      isValidUUID: isValidUUID(userId),
      email: session.user.email,
      provider: (session as any).provider || 'unknown',
      originalGoogleId: (session.user as any).originalGoogleId,
      timestamp: new Date().toISOString()
    };
    
    // Try to find profile by ID
    const { data: profileById, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, created_at')
      .eq('id', userId)
      .single();
      
    result.profileByIdExists = !!profileById;
    result.profileByIdError = profileError?.message;
    
    if (profileById) {
      result.profileById = {
        id: profileById.id,
        email: profileById.email,
        created_at: profileById.created_at
      };
    }
    
    // Try to find profile by email
    if (session.user.email) {
      const { data: profileByEmail, error: emailError } = await supabase
        .from('profiles')
        .select('id, email, created_at')
        .eq('email', session.user.email)
        .single();
        
      result.profileByEmailExists = !!profileByEmail;
      result.profileByEmailError = emailError?.message;
      
      if (profileByEmail) {
        result.profileByEmail = {
          id: profileByEmail.id,
          email: profileByEmail.email,
          created_at: profileByEmail.created_at
        };
        
        // Check if IDs match
        result.profileIdsMatch = profileByEmail.id === userId;
      }
    }
    
    // Check if user ID works with team_members table
    const { data: teamMembers, error: teamError } = await supabase
      .from('team_members')
      .select('id, workspace_id')
      .eq('user_id', userId)
      .limit(1);
      
    result.teamMembersFound = !!teamMembers?.length;
    result.teamMembersError = teamError?.message;
    
    if (teamMembers && teamMembers.length > 0) {
      result.teamMember = {
        id: teamMembers[0].id,
        workspace_id: teamMembers[0].workspace_id
      };
    }
    
    // Check if user ID works with workspaces table
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', userId)
      .limit(1);
      
    result.workspacesFound = !!workspaces?.length;
    result.workspacesError = workspaceError?.message;
    
    if (workspaces && workspaces.length > 0) {
      result.workspace = {
        id: workspaces[0].id,
        name: workspaces[0].name
      };
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug ID endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 