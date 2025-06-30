import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Tasks GET] Starting tasks fetch for user:', user.email, user.id);

    // Get user's workspaces for manual filtering (since service role bypasses RLS)
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Tasks GET] No workspace access for user');
      return NextResponse.json({ 
        tasks: [],
        success: true 
      });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    console.log('[Tasks GET] Filtering tasks by workspace IDs:', workspaceIds);

    // Fetch tasks from project_tasks table with manual workspace filtering
    const { data: tasks, error } = await supabaseAdmin
      .from('project_tasks')
      .select(`
        id, title, status, progress, due_date, deadline, checklist, 
        workspace_id, assigned_to, user_id, project_id, created_at,
        projects (id, name, customer_name)
      `)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Tasks GET] Error fetching tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    console.log('[Tasks GET] Found tasks:', tasks?.length || 0);

    // Transform tasks to match expected interface in dashboard component
    const formattedTasks = tasks?.map(task => ({
      id: task.id,
      title: task.title,
      deadline: task.deadline || task.due_date,
      progress: task.progress || 0,
      status: task.status || 'pending',
      project_id: task.project_id || null,
      project_name: task.projects?.name || 'Unknown Project',
      customer_name: task.projects?.customer_name || null,
      checklist: task.checklist || [],
      assigned_to: task.assigned_to,
      workspace_id: task.workspace_id
    })) || [];

    console.log('[Tasks GET] Formatted tasks:', formattedTasks.length);

    return NextResponse.json({ 
      tasks: formattedTasks,
      success: true 
    });
  } catch (error) {
    console.error('[Tasks GET] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
});
