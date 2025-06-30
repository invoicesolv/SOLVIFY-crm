import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { getActiveWorkspaceId } from '@/lib/permission';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return null;
  }

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

export async function PUT(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { logoUrl } = await request.json();
    
    if (!logoUrl) {
      return NextResponse.json({ error: 'Logo URL is required' }, { status: 400 });
    }

    const workspaceId = await getActiveWorkspaceId(user.id);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 404 });
    }

    // Update the workspace logo
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    const { error } = await supabaseAdmin
      .from('workspaces')
      .update({ company_logo_url: logoUrl })
      .eq('id', workspaceId);

    if (error) {
      console.error('Error updating workspace logo:', error);
      return NextResponse.json({ error: 'Failed to update workspace logo' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Workspace logo updated successfully' });
  } catch (error) {
    console.error('Error in workspace logo API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = await getActiveWorkspaceId(user.id);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 404 });
    }

    // Get the workspace logo
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .select('company_logo_url')
      .eq('id', workspaceId)
      .single();

    if (error) {
      console.error('Error fetching workspace logo:', error);
      return NextResponse.json({ error: 'Failed to fetch workspace logo' }, { status: 500 });
    }

    return NextResponse.json({ logoUrl: data.company_logo_url });
  } catch (error) {
    console.error('Error in workspace logo API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 