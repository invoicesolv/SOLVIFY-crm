import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';


export const dynamic = 'force-dynamic';

// Create a new workspace
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {

    const body = await request.json();
    const { name, owner_id } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    if (owner_id !== user.id) {
      return NextResponse.json({ error: 'Can only create workspaces for yourself' }, { status: 403 });
    }

    console.log('[Workspaces POST] Creating workspace for user:', user.id);


    // Create the workspace
    const { data: newWorkspace, error: createError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: name.trim(),
        owner_id: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('[Workspaces POST] Error creating workspace:', createError);
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }

    console.log('[Workspaces POST] Created workspace:', newWorkspace.id);

    // Add the user as an admin team member
    const { error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        user_id: user.id,
        workspace_id: newWorkspace.id,
        role: 'admin',
        is_admin: true,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        email: user.email,
        permissions: {
          // Full admin permissions
          view_dashboard: true,
          view_dashboard_analytics: true,
          view_projects: true,
          edit_projects: true,
          view_tasks: true,
          edit_tasks: true,
          view_customers: true,
          edit_customers: true,
          view_leads: true,
          edit_leads: true,
          view_sales: true,
          edit_sales: true,
          view_gmail_hub: true,
          edit_gmail_hub: true,
          view_invoices: true,
          edit_invoices: true,
          view_recurring_invoices: true,
          edit_recurring_invoices: true,
          view_invoice_reminders: true,
          edit_invoice_reminders: true,
          view_marketing: true,
          edit_marketing: true,
          view_email_marketing: true,
          edit_email_marketing: true,
          view_social_media: true,
          edit_social_media: true,
          view_analytics: true,
          view_search_console: true,
          edit_search_console: true,
          view_domains: true,
          edit_domains: true,
          view_content_generator: true,
          edit_content_generator: true,
          view_calendar: true,
          edit_calendar: true,
          view_notifications: true,
          edit_notifications: true,
          view_chat: true,
          edit_chat: true,
          use_chatbot: true,
          view_automation: true,
          edit_automation: true,
          view_scheduled_tasks: true,
          edit_scheduled_tasks: true,
          view_profile: true,
          edit_profile: true,
          view_settings: true,
          edit_settings: true,
          admin: true,
          canInviteUsers: true,
          canManageWorkspace: true
        },
        created_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('[Workspaces POST] Error adding team member:', memberError);
      // Don't fail the request if team member creation fails
    } else {
      console.log('[Workspaces POST] Successfully added user to workspace team');
    }

    return NextResponse.json({ 
      workspace: newWorkspace,
      success: true 
    });

  } catch (error) {
    console.error('[Workspaces POST] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Get workspaces for the current user
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {

    console.log('[Workspaces GET] Fetching workspaces for user:', user.id);


    // Get user's workspace memberships
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('team_members')
      .select(`
        workspace_id,
        is_admin,
        workspaces!inner (
          id,
          name,
          owner_id,
          created_at
        )
      `)
      .eq('user_id', user.id);

    if (membershipError) {
      console.error('[Workspaces GET] Error fetching workspace memberships:', membershipError);
      return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
    }

    // Transform the data
    const workspaces = (memberships || []).map((m: any) => ({
      id: m.workspace_id,
      name: m.workspaces.name,
      owner_id: m.workspaces.owner_id,
      created_at: m.workspaces.created_at,
      role: m.is_admin ? 'admin' : 'member'
    }));

    console.log('[Workspaces GET] Found workspaces:', workspaces.length);

    return NextResponse.json(workspaces);

  } catch (error) {
    console.error('[Workspaces GET] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
