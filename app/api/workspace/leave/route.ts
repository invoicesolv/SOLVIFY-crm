import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
  const user = await getUserFromToken(request);
  
  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { workspace_id } = await request.json();
    
    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if user is a member of this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this workspace' }, { status: 404 });
    }

    // Check if this is the last admin in the workspace
    const { data: adminCount, error: adminCountError } = await supabase
      .from('team_members')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('is_admin', true);

    if (adminCountError) {
      return NextResponse.json({ error: 'Failed to check admin status' }, { status: 500 });
    }

    // If user is admin and the only admin, warn them
    const isLastAdmin = membership.is_admin && adminCount.length === 1;
    
    if (isLastAdmin) {
      // Check if there are other members
      const { data: otherMembers, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('workspace_id', workspace_id)
        .neq('user_id', user.id);

      if (membersError) {
        return NextResponse.json({ error: 'Failed to check workspace members' }, { status: 500 });
      }

      if (otherMembers && otherMembers.length > 0) {
        return NextResponse.json({ 
          error: 'You are the last admin in this workspace. Please transfer admin role to another member first or delete the workspace.',
          isLastAdmin: true,
          otherMembers: otherMembers.length
        }, { status: 400 });
      }
    }

    // Remove user from workspace
    const { error: removeError } = await supabase
      .from('team_members')
      .delete()
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id);

    if (removeError) {
      return NextResponse.json({ error: 'Failed to remove from workspace', details: removeError.message }, { status: 500 });
    }

    // Get workspace name for response
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single();

    return NextResponse.json({ 
      success: true, 
      message: `Successfully left workspace: ${workspace?.name || workspace_id}`,
      workspace_id 
    });

  } catch (error) {
    console.error('Error leaving workspace:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to list current user's workspaces
export async function GET(request: NextRequest) {
  // Try Supabase token first
  let user = await getUserFromToken(request);
  
  // If no Supabase user, try NextAuth session
  if (!user?.id) {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      user = { id: session.user.id, email: session.user.email };
      console.log('[Workspace API] Using NextAuth session for user:', user.id);
    }
  }
  
  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    console.log('[Workspace API] Fetching workspaces for user:', user.id);
    
    const supabase = getSupabaseAdmin();
    
    // Use team_members table instead of workspace_memberships
    // Filter out the deleted workspace
    const { data: memberships, error } = await supabase
      .from('team_members')
      .select(`
        workspace_id,
        is_admin,
        workspaces!inner (
          id,
          name,
          owner_id,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .neq('workspace_id', '4251bc40-5a36-493a-9f85-eb728c4d86fa') // Exclude deleted workspace
      .not('user_id', 'is', null); // Exclude corrupted records

    if (error) {
      console.error('[Workspace API] Error fetching workspaces:', error);
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    // Also check for workspaces the user owns directly
    const { data: ownedWorkspaces, error: ownedError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id, created_at')
      .eq('owner_id', user.id)
      .neq('id', '4251bc40-5a36-493a-9f85-eb728c4d86fa'); // Exclude deleted workspace

    if (ownedError) {
      console.error('[Workspace API] Error fetching owned workspaces:', ownedError);
    }

    // Combine and deduplicate workspaces
    const allWorkspaces = new Map();
    
    // Add team memberships
    memberships?.forEach((m: any) => {
      if (m.workspaces && !allWorkspaces.has(m.workspace_id)) {
        allWorkspaces.set(m.workspace_id, {
          id: m.workspace_id,
          name: m.workspaces.name,
          owner_id: m.workspaces.owner_id,
          role: m.is_admin ? 'admin' : 'member',
          created_at: m.workspaces.created_at
        });
      }
    });
    
    // Add owned workspaces
    ownedWorkspaces?.forEach((w: any) => {
      if (!allWorkspaces.has(w.id)) {
        allWorkspaces.set(w.id, {
          id: w.id,
          name: w.name,
          owner_id: w.owner_id,
          role: 'owner',
          created_at: w.created_at
        });
      }
    });

    const workspaceList = Array.from(allWorkspaces.values());
    console.log('[Workspace API] Returning workspaces:', workspaceList);

    return NextResponse.json({ 
      success: true,
      workspaces: workspaceList
    });

  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 