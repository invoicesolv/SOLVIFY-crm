import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// API endpoint to fetch lead folders while bypassing RLS
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
      .from("lead_folders")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching folders:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folders: data || [] });
  } catch (error) {
    console.error("Unexpected error fetching folders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 