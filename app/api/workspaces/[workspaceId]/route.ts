import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to get workspace details
 */
export const GET = withAuth(async (req: NextRequest, { user }, { params }: { params: { workspaceId: string } }) => {
  try {
    const workspaceId = params.workspaceId;
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    console.log('[Workspace GET] Fetching workspace details for:', workspaceId, 'user:', user.email);

    // Set auth context for RLS
    await supabaseAdmin.rpc('set_config', {
      setting_name: 'request.jwt.claim.sub',
      setting_value: user.id
    });
    
    await supabaseAdmin.rpc('set_config', {
      setting_name: 'role',
      setting_value: 'authenticated'
    });

    // Verify user has access to this workspace using admin client with manual filtering
    const { data: teamMember } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (!teamMember) {
      console.log('[Workspace GET] Access denied. User is not a member of workspace:', workspaceId);
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }

    console.log('[Workspace GET] Access verified. User is a member of workspace.');

    // Get workspace details
    const { data: workspace, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, created_at, updated_at')
      .eq('id', workspaceId)
      .single();

    if (error) {
      console.error('Error fetching workspace details:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ workspace });

  } catch (error) {
    console.error("Error in workspace details API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
