import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to assign/unassign projects to users
 * 
 * @param request NextRequest object containing assignment data
 * @returns Promise<NextResponse> with assignment result
 */
export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  try {
    console.log('[Project Assignments PATCH] Starting project assignment for user:', user.email);
    
    const body = await req.json();
    const { project_id, assigned_to } = body;
    
    if (!project_id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    console.log('[Project Assignments PATCH] Assigning project:', project_id, 'to user:', assigned_to);
    
    // Get user's workspaces for manual filtering (since service role bypasses RLS)
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      return NextResponse.json(
        { error: 'User not found in any workspace' },
        { status: 403 }
      );
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    
    // Verify the project exists and user has access to it
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, workspace_id')
      .eq('id', project_id)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .single();
    
    if (projectError || !project) {
      console.error('[Project Assignments PATCH] Project not found or not authorized:', projectError);
      return NextResponse.json(
        { error: 'Project not found or not authorized' },
        { status: 404 }
      );
    }
    
    // If assigning to a user, verify they exist in the same workspace
    if (assigned_to) {
      const { data: targetUser, error: targetUserError } = await supabaseAdmin
        .from('team_members')
        .select('user_id')
        .eq('user_id', assigned_to)
        .eq('workspace_id', project.workspace_id)
        .single();
      
      if (targetUserError || !targetUser) {
        return NextResponse.json(
          { error: 'Target user not found in project workspace' },
          { status: 400 }
        );
      }
    }
    
    // Update the project assignment
    const { data: updatedProject, error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ assigned_to: assigned_to || null })
      .eq('id', project_id)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .select('id, name, assigned_to')
      .single();
    
    if (updateError) {
      console.error('[Project Assignments PATCH] Error updating project assignment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update project assignment' },
        { status: 500 }
      );
    }
    
    if (!updatedProject) {
      return NextResponse.json(
        { error: 'Project not found or not authorized' },
        { status: 404 }
      );
    }
    
    console.log('[Project Assignments PATCH] Successfully updated project assignment:', updatedProject.name);
    
    return NextResponse.json({
      success: true,
      message: assigned_to 
        ? `Project "${updatedProject.name}" assigned successfully` 
        : `Project "${updatedProject.name}" unassigned successfully`,
      project: {
        id: updatedProject.id,
        name: updatedProject.name,
        assigned_to: updatedProject.assigned_to
      }
    });
    
  } catch (error) {
    console.error('[Project Assignments PATCH] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * API endpoint to get project assignment information
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Project Assignments GET] Getting assignment info for user:', user.email);
    
    const url = new URL(request.url);
    const projectId = url.searchParams.get('project_id');
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }
    
    // Get user's workspaces for manual filtering
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      return NextResponse.json(
        { error: 'User not found in any workspace' },
        { status: 403 }
      );
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    
    // Get project assignment info
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, assigned_to')
      .eq('id', projectId)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .single();
    
    if (projectError || !project) {
      console.error('[Project Assignments GET] Project not found or not authorized:', projectError);
      return NextResponse.json(
        { error: 'Project not found or not authorized' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        assigned_to: project.assigned_to
      }
    });
    
  } catch (error) {
    console.error('[Project Assignments GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
