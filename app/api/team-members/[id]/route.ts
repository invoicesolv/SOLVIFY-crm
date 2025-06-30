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

// Update team member
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberId = params.id;
    const body = await request.json();
    const { workspace_id, role, is_admin, permissions } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    console.log('[Team Members PATCH] Updating member:', memberId, 'for user:', user.id);

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify the requesting user is an admin in the workspace
    const { data: requestingMember, error: authError } = await supabaseAdmin
      .from('team_members')
      .select('is_admin')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .single();

    if (authError || !requestingMember?.is_admin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Update the team member
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (is_admin !== undefined) updateData.is_admin = is_admin;
    if (permissions !== undefined) updateData.permissions = permissions;
    updateData.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('team_members')
      .update(updateData)
      .eq('id', memberId)
      .eq('workspace_id', workspace_id);

    if (updateError) {
      console.error('[Team Members PATCH] Error updating member:', updateError);
      return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 });
    }

    console.log('[Team Members PATCH] Successfully updated member:', memberId);

    return NextResponse.json({ 
      success: true,
      message: 'Team member updated successfully'
    });

  } catch (error) {
    console.error('[Team Members PATCH] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete team member
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberId = params.id;
    const body = await request.json();
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    console.log('[Team Members DELETE] Removing member:', memberId, 'for user:', user.id);

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify the requesting user is an admin in the workspace
    const { data: requestingMember, error: authError } = await supabaseAdmin
      .from('team_members')
      .select('is_admin')
      .eq('user_id', user.id)
      .eq('workspace_id', workspace_id)
      .single();

    if (authError || !requestingMember?.is_admin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Don't allow removing yourself
    const { data: memberToRemove, error: memberError } = await supabaseAdmin
      .from('team_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('workspace_id', workspace_id)
      .single();

    if (memberError) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    if (memberToRemove.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself from the workspace' }, { status: 400 });
    }

    // Remove the team member
    const { error: deleteError } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('workspace_id', workspace_id);

    if (deleteError) {
      console.error('[Team Members DELETE] Error removing member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 });
    }

    console.log('[Team Members DELETE] Successfully removed member:', memberId);

    return NextResponse.json({ 
      success: true,
      message: 'Team member removed successfully'
    });

  } catch (error) {
    console.error('[Team Members DELETE] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 