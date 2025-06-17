import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' }, 
        { status: 401 }
      );
    }

    // Create admin client for database operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's workspaces, prioritizing admin role and most recent
    const { data: workspaces, error } = await supabase
      .from('team_members')
      .select('workspace_id, role, created_at')
      .eq('user_id', session.user.id)
      .neq('workspace_id', '4251bc40-5a36-493a-9f85-eb728c4d86fa') // Exclude deleted workspace
      .order('role', { ascending: true }) // admin comes before member
      .order('created_at', { ascending: false }); // most recent first

    if (error) {
      console.error('Error fetching user workspaces:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' }, 
        { status: 500 }
      );
    }

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json(
        { error: 'No workspace found for user' }, 
        { status: 404 }
      );
    }

    // Return the first workspace (admin role prioritized, then most recent)
    const activeWorkspace = workspaces[0];
    
    console.log('Active workspace found for user:', {
      userId: session.user.id,
      workspaceId: activeWorkspace.workspace_id,
      role: activeWorkspace.role
    });

    return NextResponse.json({
      workspaceId: activeWorkspace.workspace_id,
      role: activeWorkspace.role,
      isAdmin: activeWorkspace.role === 'admin'
    });

  } catch (error) {
    console.error('Error in active workspace API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 