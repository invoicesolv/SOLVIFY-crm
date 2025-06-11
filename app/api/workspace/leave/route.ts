import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { workspace_id } = await request.json();
    
    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Check if user is a member of this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_memberships')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('workspace_id', workspace_id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this workspace' }, { status: 404 });
    }

    // Check if this is the last admin in the workspace
    const { data: adminCount, error: adminCountError } = await supabase
      .from('workspace_memberships')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('role', 'admin');

    if (adminCountError) {
      return NextResponse.json({ error: 'Failed to check admin status' }, { status: 500 });
    }

    // If user is admin and the only admin, warn them
    const isLastAdmin = membership.role === 'admin' && adminCount.length === 1;
    
    if (isLastAdmin) {
      // Check if there are other members
      const { data: otherMembers, error: membersError } = await supabase
        .from('workspace_memberships')
        .select('*')
        .eq('workspace_id', workspace_id)
        .neq('user_id', session.user.id);

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
      .from('workspace_memberships')
      .delete()
      .eq('user_id', session.user.id)
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
export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { data: memberships, error } = await supabase
      .from('workspace_memberships')
      .select(`
        workspace_id,
        role,
        workspaces!inner (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', session.user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      workspaces: memberships?.map((m: any) => ({
        id: m.workspace_id,
        name: m.workspaces?.name,
        role: m.role,
        created_at: m.workspaces?.created_at
      })) || []
    });

  } catch (error) {
    console.error('Error fetching workspaces:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 