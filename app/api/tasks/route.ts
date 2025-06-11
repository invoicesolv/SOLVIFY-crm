import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get request parameters
    const searchParams = req.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId parameter' }, { status: 400 });
    }

    // Fetch tasks from the project_tasks table
    const { data: tasks, error } = await supabase
      .from('project_tasks')
      .select('id, title, status, progress, due_date, deadline, checklist, workspace_id, assigned_to, user_id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    // Transform tasks to match expected interface in dashboard component
    const formattedTasks = tasks?.map(task => ({
      id: task.id,
      title: task.title,
      deadline: task.deadline || task.due_date,
      progress: task.progress || 0,
      status: task.status || 'pending',
      project_id: task.project_id || null,
      checklist: task.checklist || []
    })) || [];

    return NextResponse.json({ tasks: formattedTasks });
  } catch (error) {
    console.error('Error in tasks API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 