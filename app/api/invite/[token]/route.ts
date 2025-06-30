import { NextResponse } from "next/server"
import { supabaseClient as supabase } from '@/lib/supabase-client'

export async function GET(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    
    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Retrieve the invitation details
    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      console.error('Error fetching invitation:', error);
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Log the invitation data to verify it contains workspace_id
    console.log("Invitation data:", invitation);

    // Check if the invitation has a workspace_id
    if (!invitation.workspace_id) {
      console.error('Error: workspace_id is missing from invitation');
      return NextResponse.json({ error: 'Invalid invitation: missing workspace ID' }, { status: 400 });
    }

    // Check if the invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (expiresAt < now) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // Get workspace information
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', invitation.workspace_id)
      .single();

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError);
      return NextResponse.json({ error: 'Error fetching workspace details' }, { status: 500 });
    }

    // Return the invitation details
    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        workspace_id: invitation.workspace_id,
        workspace_name: workspace?.name || 'Unknown Workspace',
        is_admin: invitation.is_admin,
        expires_at: invitation.expires_at
      }
    });
  } catch (error) {
    console.error('Error verifying invitation:', error);
    return NextResponse.json(
      { error: 'Failed to verify invitation', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 