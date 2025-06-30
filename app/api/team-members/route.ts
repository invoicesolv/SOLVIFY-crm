import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Team Members GET] Fetching team members for user:', user.id);

    // Get Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get user's workspace(s)
    const { data: teamMemberships, error: teamError } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);

    if (teamError) {
      console.error('[Team Members GET] Error fetching team memberships:', teamError);
      return NextResponse.json({ error: 'Failed to fetch team memberships' }, { status: 500 });
    }

    if (!teamMemberships || teamMemberships.length === 0) {
      console.log('[Team Members GET] No workspaces found for user');
      return NextResponse.json({ members: [] });
    }

    const workspaceIds = teamMemberships.map(tm => tm.workspace_id);
    console.log('[Team Members GET] Found workspaces:', workspaceIds);

    // Fetch all team members from user's workspaces
    const { data: members, error: membersError } = await supabaseAdmin
      .from('team_members')
      .select('*')
      .in('workspace_id', workspaceIds)
      .order('created_at', { ascending: false });

    if (membersError) {
      console.error('[Team Members GET] Error fetching team members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
    }

    console.log('[Team Members GET] Found team members:', members?.length || 0);

    return NextResponse.json({ 
      members: members || [],
      success: true 
    });

  } catch (error) {
    console.error('[Team Members GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 