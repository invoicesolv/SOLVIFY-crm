import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to get workspace team members
 */
export async function GET(req: NextRequest, { params }: { params: { workspaceId: string } }) {
  try {
    // Get authenticated user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const workspaceId = params.workspaceId;
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    console.log('[Workspace Members GET] Fetching team members for workspace:', workspaceId, 'user:', user.email);

    // Verify user has access to this workspace
    const { data: teamMember } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!teamMember) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    // Get all team members for this workspace
    const { data: members, error } = await supabaseAdmin
      .from('team_members')
      .select('user_id, name, email, role, is_admin, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching workspace members:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      members: members || [],
      count: members?.length || 0
    });

  } catch (error) {
    console.error("Error in workspace members API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
