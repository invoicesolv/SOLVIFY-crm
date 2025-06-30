import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Projects GET] Starting projects fetch for user:', user.email, user.id);

    // NextAuth: No RLS context needed, using manual workspace filtering
    
    // Get user's workspaces for manual filtering and workspace info
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id, workspaces(id, name)')
      .eq('user_id', user.id);
    console.log('[Projects GET] User workspaces:', userWorkspaces);

    // Get query parameters for pagination and filtering
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '1000'); // Large default to show all projects
    const search = searchParams.get('search') || '';
    const orderBy = searchParams.get('orderBy') || 'created_at';
    const orderDir = searchParams.get('orderDir') || 'desc';
    const status = searchParams.get('status') || 'all';
    
    // Calculate offset
    const offset = (page - 1) * pageSize;

    // Since we're using supabaseAdmin (service role), RLS is bypassed
    // We need to manually filter by user's workspace(s)
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Projects GET] No workspace access for user');
      return NextResponse.json({ 
        projects: [],
        success: true 
      });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    const workspaceInfo = userWorkspaces[0]?.workspaces;
    console.log('[Projects GET] Filtering projects by workspace IDs:', workspaceIds, 'Current workspace:', workspaceInfo);
    
    let query = supabaseAdmin
      .from('projects')
      .select(`
        *,
        project_tasks (
          id,
          title,
          status,
          due_date,
          deadline,
          priority,
          checklist,
          progress,
          assigned_to,
          created_at,
          tags,
          estimated_hours,
          actual_hours,
          completion_percentage,
          dependencies,
          attachments
        )
      `, { count: 'exact' })
      .in('workspace_id', workspaceIds); // Manual workspace filtering
    
    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }
    
    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Add ordering and pagination
    query = query.order(orderBy, { ascending: orderDir === 'asc' })
                 .range(offset, offset + pageSize - 1);

    // Execute query
    const { data: projects, error: projectsError, count } = await query;

    if (projectsError) {
      console.error('[Projects GET] Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    console.log('[Projects GET] Found projects:', projects?.length || 0, 'total:', count);
    
    // Debug: Log first project's tasks
    if (projects && projects.length > 0) {
      console.log('[Projects GET] First project tasks sample:', {
        projectName: projects[0].name,
        taskCount: projects[0].project_tasks?.length || 0,
        tasks: projects[0].project_tasks?.slice(0, 2) || []
      });
    }

    // Format the projects data
    const formattedProjects = projects?.map(project => ({
      ...project,
      tasks: project.project_tasks || []
    })) || [];

    console.log('[Projects GET] Formatted projects with tasks:', formattedProjects.length);
    
    // Debug: Log task counts per project
    const taskSummary = formattedProjects.map(p => ({
      name: p.name,
      taskCount: p.tasks?.length || 0
    }));
    console.log('[Projects GET] Task summary per project:', taskSummary);

    return NextResponse.json({ 
      projects: formattedProjects,
      success: true,
      debug: {
        userEmail: user.email,
        userId: user.id,
        projectCount: formattedProjects.length,
        workspaceInfo: workspaceInfo,
        workspaceIds: workspaceIds
      }
    });

  } catch (error) {
    console.error('[Projects GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const PATCH = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Projects PATCH] Starting project update...');

    // NextAuth: No RLS context needed, using manual workspace filtering

    const url = new URL(request.url);
    const projectId = url.searchParams.get('id');
    const body = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    console.log('[Projects PATCH] Updating project:', projectId, 'for user:', user.id, 'with data:', body);

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

    // Update the project with manual workspace authorization
    const { data: updatedProject, error: updateError } = await supabaseAdmin
      .from('projects')
      .update(body)
      .eq('id', projectId)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .select('id, name')
      .single();

    if (updateError) {
      console.error('[Projects PATCH] Error updating project:', updateError);
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      );
    }

    if (!updatedProject) {
      return NextResponse.json(
        { error: 'Project not found or not authorized' },
        { status: 404 }
      );
    }

    console.log('[Projects PATCH] Successfully updated project:', updatedProject.name);

    return NextResponse.json({
      success: true,
      message: `Project "${updatedProject.name}" updated successfully`,
      updatedProject: {
        id: updatedProject.id,
        name: updatedProject.name,
        ...body
      }
    });

  } catch (error) {
    console.error('[Projects PATCH] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Projects POST] Starting project creation for user:', user.email, user.id);

    // NextAuth: No RLS context needed, using manual workspace filtering

    const body = await request.json();
    console.log('[Projects POST] Creating project with data:', body);

    // Get user's workspace from team_members - required for RLS workspace_id field
    // This is not a permission check but data population for RLS policies
    const { data: teamMember, error: teamError } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    // If no workspace found, the user might not be properly set up
    // RLS policies will handle the actual authorization
    if (teamError || !teamMember) {
      console.error('[Projects POST] No workspace found for user:', teamError);
      // Return a more helpful error message instead of blocking
      return NextResponse.json({ 
        error: 'User workspace not found. Please contact your administrator to ensure you are added to a workspace.' 
      }, { status: 403 });
    }

    // Prepare project data with required workspace_id for RLS
    const projectData = {
      ...body,
      user_id: user.id,
      workspace_id: teamMember.workspace_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Create the project - RLS will ensure it's created in the correct workspace
    const { data: newProject, error: createError } = await supabaseAdmin
      .from('projects')
      .insert([projectData])
      .select('*')
      .single();

    if (createError) {
      console.error('[Projects POST] Error creating project:', createError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    console.log('[Projects POST] Successfully created project:', newProject.id);

    return NextResponse.json({
      success: true,
      project: newProject,
      message: `Project "${newProject.name}" created successfully`
    });

  } catch (error) {
    console.error('[Projects POST] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Projects DELETE] Starting project deletion...');

    // NextAuth: No RLS context needed, using manual workspace filtering

    const url = new URL(request.url);
    const projectId = url.searchParams.get('id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    console.log('[Projects DELETE] Deleting project:', projectId, 'for user:', user.id);

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

    // Get project name for confirmation message with manual workspace filtering
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, name, workspace_id')
      .eq('id', projectId)
      .in('workspace_id', workspaceIds) // Manual workspace filtering
      .single();

    if (projectError || !project) {
      console.error('[Projects DELETE] Project not found or not authorized:', projectError);
      return NextResponse.json(
        { error: 'Project not found or not authorized' },
        { status: 404 }
      );
    }

    // Delete project tasks first (due to foreign key constraints)
    // RLS will ensure only tasks in user's workspace are deleted
    const { error: tasksDeleteError } = await supabaseAdmin
      .from('project_tasks')
      .delete()
      .eq('project_id', projectId);

    if (tasksDeleteError) {
      console.error('[Projects DELETE] Error deleting project tasks:', tasksDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete project tasks' },
        { status: 500 }
      );
    }

    // Then delete the project - RLS will ensure user can only delete projects in their workspace
    const { error: projectDeleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (projectDeleteError) {
      console.error('[Projects DELETE] Error deleting project:', projectDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    console.log('[Projects DELETE] Successfully deleted project:', project.name);

    return NextResponse.json({
      success: true,
      message: `Project "${project.name}" deleted successfully`
    });

  } catch (error) {
    console.error('[Projects DELETE] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
