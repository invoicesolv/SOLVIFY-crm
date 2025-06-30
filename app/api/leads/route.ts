import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getUserWorkspaces } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Leads API] Processing GET request');
    console.log(`[Leads API] Authenticated user: ${user.id}`);

    // Get query parameters
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folder_id');
    const requestedWorkspaceId = url.searchParams.get('workspace_id');

    // Get user's workspaces to verify access
    const workspaces = await getUserWorkspaces(user.id);
    
    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ 
        leads: [],
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
        console.warn(`[Leads API] User ${user.id} doesn't have access to workspace ${requestedWorkspaceId}`);
      }
    }
    
    console.log(`[Leads API] Using workspace: ${workspaceId}`);

    // Build query with workspace filtering and include folder data
    let query = supabaseAdmin
      .from('leads')
      .select(`
        *,
        lead_folders:folder_id (
          id,
          name
        )
      `)
      .eq('workspace_id', workspaceId); // Simplified workspace filtering using single workspace ID

    // Apply folder filter if provided
    if (folderId) {
      if (folderId === 'unassigned') {
        query = query.is('folder_id', null);
      } else {
        query = query.eq('folder_id', folderId);
      }
    }

    // Order by created_at descending
    query = query.order('created_at', { ascending: false });

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      console.error('[Leads API] Error fetching leads:', leadsError);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    console.log(`[Leads API] Successfully fetched ${leads?.length || 0} leads`);
    return NextResponse.json({ 
      leads: leads || [],
      workspaceId // Include workspace ID in response for debugging/verification
    });

  } catch (error) {
    console.error('[Leads API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
