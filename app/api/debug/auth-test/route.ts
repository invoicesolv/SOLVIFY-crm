import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log('[Auth Test] User:', user);
    
    // Set RLS context
    await supabaseAdmin.rpc('set_config', {
      setting_name: 'request.jwt.claim.sub',
      setting_value: user.id
    });
    
    await supabaseAdmin.rpc('set_config', {
      setting_name: 'role',
      setting_value: 'authenticated'
    });

    // Check team memberships
    const { data: teamMembers, error: teamError } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id, role, workspaces(id, name)')
      .eq('user_id', user.id);

    console.log('[Auth Test] Team memberships:', teamMembers, teamError);

    // Try to fetch projects with RLS
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id, name, workspace_id')
      .limit(5);

    console.log('[Auth Test] Projects:', projects, projectsError);

    // Check profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, workspace_id')
      .eq('email', user.email)
      .single();

    console.log('[Auth Test] Profile:', profile, profileError);

    return NextResponse.json({
      success: true,
      user,
      teamMembers: teamMembers || [],
      projects: projects || [],
      profile: profile || null,
      errors: {
        teamError: teamError?.message,
        projectsError: projectsError?.message,
        profileError: profileError?.message
      }
    });

  } catch (error) {
    console.error('[Auth Test] Error:', error);
    return NextResponse.json(
      { error: 'Auth test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
