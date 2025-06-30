import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Project Tasks POST] Starting task creation for user:', user.email);

    // Get user's workspaces for manual filtering (since service role bypasses RLS)
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Project Tasks POST] No workspace access for user');
      return NextResponse.json({ 
        error: 'No workspace found' 
      }, { status: 403 });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    console.log('[Project Tasks POST] User workspaces:', workspaceIds);

    const body = await request.json();
    console.log('[Project Tasks POST] Task data:', body);

    // Set workspace_id from user's first workspace if not provided
    const taskData = {
      ...body,
      workspace_id: body.workspace_id || workspaceIds[0], // Use user's workspace
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Verify the workspace_id is valid for this user
    if (!workspaceIds.includes(taskData.workspace_id)) {
      return NextResponse.json(
        { error: 'Invalid workspace' },
        { status: 403 }
      );
    }

    // Create the task
    const { data: newTask, error: createError } = await supabaseAdmin
      .from('project_tasks')
      .insert([taskData])
      .select('*')
      .single();

    if (createError) {
      console.error('[Project Tasks POST] Error creating task:', createError);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    if (!newTask) {
      return NextResponse.json(
        { error: 'Task creation failed' },
        { status: 500 }
      );
    }

    console.log('[Project Tasks POST] Successfully created task:', newTask.id);

    return NextResponse.json({
      success: true,
      message: `Task "${newTask.title}" created successfully`,
      task: newTask
    });

  } catch (error) {
    console.error('[Project Tasks POST] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
