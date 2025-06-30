import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient as supabase } from '@/lib/supabase-client';

// Provide top websites data for the dashboard
export async function GET(request: NextRequest) {
  try {
    // Get JWT token from Authorization header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user's workspace
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (teamError || !teamMember?.workspace_id) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Fetch analytics websites for the workspace
    const { data: websites, error: websitesError } = await supabase
      .from('analytics_websites')
      .select('*')
      .eq('workspace_id', teamMember.workspace_id)
      .order('created_at', { ascending: false });

    if (websitesError) {
      console.error('Error fetching analytics websites:', websitesError);
      return NextResponse.json(
        { error: 'Failed to fetch websites' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      websites: websites || []
    });

  } catch (error) {
    console.error('Error in analytics websites GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 