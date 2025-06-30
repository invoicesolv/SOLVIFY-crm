import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to get project folders
 * 
 * @param request NextRequest object containing query parameters
 * @returns Promise<NextResponse> with folders array
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  try {
    console.log('[Project Folders GET] Starting folder fetch for user:', user.email);

    // Get user's workspaces for manual filtering (since service role bypasses RLS)
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Project Folders GET] No workspace access for user');
      return NextResponse.json({ folders: [] });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    console.log('[Project Folders GET] User workspaces:', workspaceIds);

    // Get workspace ID from query params (optional filter)
    const url = new URL(req.url);
    const requestedWorkspaceId = url.searchParams.get('workspace_id');
    
    // If specific workspace requested, verify user has access
    let filterWorkspaceIds = workspaceIds;
    if (requestedWorkspaceId) {
      if (!workspaceIds.includes(requestedWorkspaceId)) {
        return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
      }
      filterWorkspaceIds = [requestedWorkspaceId];
    }

    // Fetch folders using admin client with manual workspace filtering
    const { data, error } = await supabaseAdmin
      .from("project_folders")
      .select("*")
      .in("workspace_id", filterWorkspaceIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching project folders:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Project Folders GET] Found folders:', data?.length || 0);
    return NextResponse.json({ folders: data || [] });
  } catch (error) {
    console.error("Unexpected error fetching project folders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});

/**
 * API endpoint to create project folders table or add folder
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  try {
    console.log('[Project Folders POST] Starting folder operation for user:', user.email);
    
    const body = await req.json();
    
    // If it's a folder creation request
    if (body.name && body.workspace_id) {
      // Get user's workspaces for authorization
      const { data: userWorkspaces } = await supabaseAdmin
        .from('team_members')
        .select('workspace_id')
        .eq('user_id', user.id);
      
      if (!userWorkspaces || userWorkspaces.length === 0) {
        return NextResponse.json({ error: 'No workspace access' }, { status: 403 });
      }
      
      const workspaceIds = userWorkspaces.map(w => w.workspace_id);
      
      if (!workspaceIds.includes(body.workspace_id)) {
        return NextResponse.json({ error: 'Access denied to workspace' }, { status: 403 });
      }
      
      // Create the folder
      const { data: folder, error } = await supabaseAdmin
        .from('project_folders')
        .insert([{
          name: body.name,
          workspace_id: body.workspace_id,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('*')
        .single();
      
      if (error) {
        console.error('Error creating folder:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json({ folder, success: true });
    }

    // Otherwise, check if the table exists (legacy functionality)
    const { error: checkError } = await supabaseAdmin
      .from('project_folders')
      .select('id')
      .limit(1);

    if (!checkError) {
      return NextResponse.json({ 
        message: 'Project folders table already exists',
        success: true 
      });
    }

    // If table doesn't exist (error code 42P01), provide instructions
    if (checkError.code === '42P01') {
      return NextResponse.json({
        message: 'Project folders table needs to be created',
        needsCreation: true,
        tableSchema: {
          name: 'project_folders',
          sql: `
            CREATE TABLE IF NOT EXISTS public.project_folders (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name TEXT NOT NULL,
              workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
              user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            -- Enable RLS
            ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;

            -- Create policies (Note: these still use auth.uid() as they are database-level policies)
            CREATE POLICY "Users can view folders in their workspace" ON public.project_folders
              FOR SELECT USING (
                EXISTS (
                  SELECT 1 FROM public.team_members tm 
                  WHERE tm.workspace_id = project_folders.workspace_id 
                  AND tm.user_id = auth.uid()
                )
              );

            CREATE POLICY "Users can create folders in their workspace" ON public.project_folders
              FOR INSERT WITH CHECK (
                EXISTS (
                  SELECT 1 FROM public.team_members tm 
                  WHERE tm.workspace_id = project_folders.workspace_id 
                  AND tm.user_id = auth.uid()
                )
              );

            CREATE POLICY "Users can update folders in their workspace" ON public.project_folders
              FOR UPDATE USING (
                EXISTS (
                  SELECT 1 FROM public.team_members tm 
                  WHERE tm.workspace_id = project_folders.workspace_id 
                  AND tm.user_id = auth.uid()
                )
              );

            CREATE POLICY "Users can delete folders in their workspace" ON public.project_folders
              FOR DELETE USING (
                EXISTS (
                  SELECT 1 FROM public.team_members tm 
                  WHERE tm.workspace_id = project_folders.workspace_id 
                  AND tm.user_id = auth.uid()
                )
              );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS project_folders_workspace_id_idx ON public.project_folders(workspace_id);
            CREATE INDEX IF NOT EXISTS project_folders_user_id_idx ON public.project_folders(user_id);
          `
        },
        instructions: 'Please run the provided SQL in your Supabase dashboard to create the project_folders table with proper RLS policies.'
      });
    }

    return NextResponse.json({ 
      error: 'Unexpected error checking table existence',
      details: checkError.message 
    }, { status: 500 });

  } catch (error) {
    console.error("Error in project folders API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
