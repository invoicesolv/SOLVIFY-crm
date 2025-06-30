import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
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

// GET - Fetch all logos for workspace
export async function GET(request: NextRequest) {
  try {
    const session = await getUserFromToken(request);
    
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(session.id);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 404 });
    }

    // Get logos for this workspace
    const { data: logos, error: logosError } = await supabase
      .from('workspace_logos')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (logosError && logosError.code !== 'PGRST116') {
      console.error('Error fetching logos:', logosError);
      return NextResponse.json({ error: 'Failed to fetch logos' }, { status: 500 });
    }

    // Return logos or empty array if table doesn't exist yet
    return NextResponse.json({ logos: logos || [] });

  } catch (error) {
    console.error('Error in logos API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add new logo
export async function POST(request: NextRequest) {
  try {
    const session = await getUserFromToken(request);
    
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(session.id);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 404 });
    }

    const { name, url, width, height, border_radius } = await request.json();

    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    // Insert new logo
    const { data: logo, error: insertError } = await supabase
      .from('workspace_logos')
      .insert({
        workspace_id: workspaceId,
        name,
        url,
        width,
        height,
        border_radius
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting logo:', insertError);
      return NextResponse.json({ error: 'Failed to add logo' }, { status: 500 });
    }

    return NextResponse.json({ logo });

  } catch (error) {
    console.error('Error adding logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove logo
export async function DELETE(request: NextRequest) {
  try {
    const session = await getUserFromToken(request);
    
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(session.id);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const logoId = searchParams.get('id');

    if (!logoId) {
      return NextResponse.json({ error: 'Logo ID is required' }, { status: 400 });
    }

    // Delete logo (only if it belongs to the workspace)
    const { error: deleteError } = await supabase
      .from('workspace_logos')
      .delete()
      .eq('id', logoId)
      .eq('workspace_id', workspaceId);

    if (deleteError) {
      console.error('Error deleting logo:', deleteError);
      return NextResponse.json({ error: 'Failed to delete logo' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Logo deleted successfully' });

  } catch (error) {
    console.error('Error deleting logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 