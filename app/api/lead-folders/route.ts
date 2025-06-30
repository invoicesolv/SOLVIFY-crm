import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserWorkspaces } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Lead Folders API] Processing GET request');
    console.log(`[Lead Folders API] Authenticated user: ${user.id}`);

    // Get query parameters
    const url = new URL(request.url);
    const requestedWorkspaceId = url.searchParams.get('workspace_id');

    // Get user's workspaces to verify access
    const workspaces = await getUserWorkspaces(user.id);
    
    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ 
        folders: [],
        error: 'No active workspace found for user'
      }, { status: 200 });
    }

    // Use requested workspace if provided and user has access, otherwise use first workspace
    let workspaceId = workspaces[0].id;
    if (requestedWorkspaceId) {
      const hasAccess = workspaces.some(ws => ws.id === requestedWorkspaceId);
      if (hasAccess) {
        workspaceId = requestedWorkspaceId;
      } else {
        console.warn(`[Lead Folders API] User ${user.id} doesn't have access to workspace ${requestedWorkspaceId}`);
      }
    }
    
    console.log(`[Lead Folders API] Using workspace: ${workspaceId}`);

    // Fetch folders with workspace filtering
    const { data: folders, error: foldersError } = await supabaseAdmin
      .from('lead_folders')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (foldersError) {
      console.error('[Lead Folders API] Error fetching folders:', foldersError);
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }

    console.log(`[Lead Folders API] Successfully fetched ${folders?.length || 0} folders`);
    return NextResponse.json({ 
      folders: folders || [],
      workspaceId // Include workspace ID in response for debugging/verification
    });

  } catch (error) {
    console.error('[Lead Folders API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
