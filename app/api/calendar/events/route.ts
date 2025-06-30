import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserFromToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Calendar Events API] Processing GET request for user:', user.id);

    // Get user's workspace IDs for security
    const { data: teamMemberships } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);

    const userWorkspaceIds = teamMemberships?.map(tm => tm.workspace_id) || [];
    
    if (userWorkspaceIds.length === 0) {
      console.log('[Calendar Events API] User has no workspace memberships');
      return NextResponse.json([]);
    }

    // Use admin client directly to avoid JWT issues
    const { data: events, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .in('workspace_id', userWorkspaceIds)
      .order('start_time', { ascending: true });

    if (error) {
      console.error("[Calendar] Error fetching events:", error);
      throw error;
    }

    return NextResponse.json(events || []);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('[Calendar Events API] Received POST request');
  try {
    const body = await request.json();
    console.log('[Calendar Events API] Request body:', body);
    const { title, start, end } = body;

    // Get the current user from Supabase authentication
    const user = await getUserFromToken(request as NextRequest);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = user.id;
    console.log(`[Calendar Events API] User ID successfully retrieved: ${userId}`);

    // Get user's primary workspace for new event
    const { data: teamMemberships } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);

    const workspaceId = teamMemberships?.[0]?.workspace_id;
    
    if (!workspaceId) {
      console.log('[Calendar Events API] User has no workspace memberships');
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 });
    }

    // Prepare data for insertion
    const eventToInsert = {
          title,
          start_time: start,
          end_time: end,
      user_id: userId,
      workspace_id: workspaceId,
          is_synced: false
    };
    console.log('[Calendar Events API] Event data to insert:', eventToInsert);

    // Use admin client directly
    console.log('[Calendar Events API] Inserting event using admin client...');
    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert([eventToInsert])
      .select()
      .single();

    if (error) {
      console.error("[Calendar Events API] Supabase admin insert error:", error);
      throw new Error(`Supabase error: ${error.message} (Hint: ${error.hint}, Details: ${error.details})`);
    }

    console.log('[Calendar Events API] Event inserted successfully:', data);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Calendar Events API] Error creating event:', error.message || error);
    return NextResponse.json({ error: 'Failed to create event', details: error.message }, { status: 500 });
  }
}

// Add DELETE endpoint to handle event deletion
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const eventId = url.searchParams.get('id');
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }
    
    // Get the current user from Supabase authentication
    const user = await getUserFromToken(request as NextRequest);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = user.id;
    
    // Get user's workspace IDs for security
    const { data: teamMemberships } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', userId);

    const userWorkspaceIds = teamMemberships?.map(tm => tm.workspace_id) || [];
    
    if (userWorkspaceIds.length === 0) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 });
    }
    
    // Use the admin client for direct database access
    const { error } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', userId)
      .in('workspace_id', userWorkspaceIds);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }
} 