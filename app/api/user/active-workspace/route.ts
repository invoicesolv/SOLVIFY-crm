import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {

    // Get user's workspaces, prioritizing admin role and most recent
    const { data: workspaces, error } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id, role, created_at')
      .eq('user_id', user.id)
      .neq('workspace_id', '4251bc40-5a36-493a-9f85-eb728c4d86fa') // Exclude deleted workspace
      .order('role', { ascending: true }) // admin comes before member
      .order('created_at', { ascending: false }); // most recent first

    if (error) {
      console.error('Error fetching user workspaces:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' }, 
        { status: 500 }
      );
    }

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json(
        { error: 'No workspace found for user' }, 
        { status: 404 }
      );
    }

    // Return the first workspace (admin role prioritized, then most recent)
    const activeWorkspace = workspaces[0];
    
    console.log('Active workspace found for user:', {
      userId: user.id,
      workspaceId: activeWorkspace.workspace_id,
      role: activeWorkspace.role
    });

    return NextResponse.json({
      workspaceId: activeWorkspace.workspace_id,
      role: activeWorkspace.role,
      isAdmin: activeWorkspace.role === 'admin'
    });

  } catch (error) {
    console.error('Error in active workspace API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
});
