import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(async (request: NextRequest, { user }, { params }: { params: { id: string } }) => {
  try {
    const taskId = params.id;
    console.log('[Project Tasks PATCH] Starting task update for task:', taskId, 'user:', user.email);

    // Get user's workspaces for manual filtering (since service role bypasses RLS)
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Project Tasks PATCH] No workspace access for user');
      return NextResponse.json({ 
        error: 'No workspace found' 
      }, { status: 403 });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    console.log('[Project Tasks PATCH] User workspaces:', workspaceIds);

    const body = await request.json();
    console.log('[Project Tasks PATCH] Update data:', body);

    // Update the task with manual workspace authorization
    const { data: updatedTask, error: updateError } = await supabaseAdmin
      .from('project_tasks')
      .update(body)
      .eq('id', taskId)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .select('id, title')
      .single();

    if (updateError) {
      console.error('[Project Tasks PATCH] Error updating task:', updateError);
      return NextResponse.json(
        { error: 'Failed to update task' },
        { status: 500 }
      );
    }

    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Task not found or not authorized' },
        { status: 404 }
      );
    }

    console.log('[Project Tasks PATCH] Successfully updated task:', updatedTask.title);

    return NextResponse.json({
      success: true,
      message: `Task "${updatedTask.title}" updated successfully`,
      task: updatedTask
    });

  } catch (error) {
    console.error('[Project Tasks PATCH] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request: NextRequest, { user }, { params }: { params: { id: string } }) => {
  try {
    const taskId = params.id;
    console.log('[Project Tasks DELETE] Starting task deletion for task:', taskId, 'user:', user.email);

    // Get user's workspaces for manual filtering (since service role bypasses RLS)
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Project Tasks DELETE] No workspace access for user');
      return NextResponse.json({ 
        error: 'No workspace found' 
      }, { status: 403 });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);

    // Get task name for confirmation message with manual workspace filtering
    const { data: task, error: taskError } = await supabaseAdmin
      .from('project_tasks')
      .select('id, title, workspace_id')
      .eq('id', taskId)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .single();

    if (taskError || !task) {
      console.error('[Project Tasks DELETE] Task not found or not authorized:', taskError);
      return NextResponse.json(
        { error: 'Task not found or not authorized' },
        { status: 404 }
      );
    }

    // Delete the task with manual workspace authorization
    const { error: deleteError } = await supabaseAdmin
      .from('project_tasks')
      .delete()
      .eq('id', taskId)
      .in('workspace_id', workspaceIds); // Manual workspace filtering

    if (deleteError) {
      console.error('[Project Tasks DELETE] Error deleting task:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete task' },
        { status: 500 }
      );
    }

    console.log('[Project Tasks DELETE] Successfully deleted task:', task.title);

    return NextResponse.json({
      success: true,
      message: `Task "${task.title}" deleted successfully`
    });

  } catch (error) {
    console.error('[Project Tasks DELETE] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
