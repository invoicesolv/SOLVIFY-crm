import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to get chat channels
 * 
 * @param request NextRequest object containing query parameters
 * @returns Promise<NextResponse> with channels array
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    console.log('[Chat Channels GET] Starting channel fetch for user:', user.email);

    // Get user's workspaces for manual filtering (since service role bypasses RLS)
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Chat Channels GET] No workspace access for user');
      return NextResponse.json({ channels: [] });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    console.log('[Chat Channels GET] User workspaces:', workspaceIds);

    // Get workspace ID from query params (optional filter)
    const url = new URL(req.url);
    const requestedWorkspaceId = url.searchParams.get('workspace_id');
    
    // If specific workspace requested, verify user has access
    let filterWorkspaceIds = workspaceIds;
    if (requestedWorkspaceId) {
      if (!workspaceIds.includes(requestedWorkspaceId)) {
        return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
      }
      filterWorkspaceIds = [requestedWorkspaceId];
    }

    // Fetch channels using admin client with manual workspace filtering
    const { data, error } = await supabaseAdmin
      .from("chat_channels")
      .select(`
        *,
        chat_channel_members!inner(user_id)
      `)
      .in("workspace_id", filterWorkspaceIds)
      .eq('chat_channel_members.user_id', user.id) // Only channels user is a member of
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching chat channels:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Chat Channels GET] Found channels:', data?.length || 0);
    return NextResponse.json({ channels: data || [] });
  } catch (error) {
    console.error("Unexpected error fetching chat channels:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

/**
 * API endpoint to create chat channels
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    console.log('[Chat Channels POST] Starting channel creation for user:', user.email);
    
    const body = await req.json();
    
    // Validate required fields
    if (!body.name || !body.workspace_id) {
      return NextResponse.json({ error: 'Name and workspace_id are required' }, { status: 400 });
    }

    // Get user's workspaces for authorization
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    
    if (!workspaceIds.includes(body.workspace_id)) {
      return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
    }
    
    // Create the channel
    const { data: channel, error } = await supabaseAdmin
      .from('chat_channels')
      .insert([{
        name: body.name,
        description: body.description || null,
        workspace_id: body.workspace_id,
        channel_type: body.channel_type || 'public',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select('*')
      .single();
    
    if (error) {
      console.error('Error creating channel:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add creator as first member
    const { error: memberError } = await supabaseAdmin
      .from('chat_channel_members')
      .insert([{
        channel_id: channel.id,
        user_id: user.id,
        role: 'admin',
        joined_at: new Date().toISOString()
      }]);

    if (memberError) {
      console.error('Error adding creator as member:', memberError);
      // Don't fail the request, just log the error
    }
    
    return NextResponse.json({ channel, success: true });

  } catch (error) {
    console.error("Error in chat channels API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
