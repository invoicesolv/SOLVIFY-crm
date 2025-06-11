import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// API endpoint to fetch project folders while bypassing RLS
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID from query params
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Fetch folders using admin client to bypass RLS
    const { data, error } = await supabaseAdmin
      .from("project_folders")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching project folders:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folders: data || [] });
  } catch (error) {
    console.error("Unexpected error fetching project folders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// API endpoint to create project folders table if it doesn't exist
export async function POST(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the table already exists
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

            -- Create policies
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
} 