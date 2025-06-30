import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

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

export async function POST(request: NextRequest) {
  try {
    const { 
      workflowId, 
      nodeId, 
      projectName, 
      projectDescription, 
      projectTemplate,
      autoAssign = true,
      context = {},
      userId // Allow passing userId directly from chat trigger
    } = await request.json();

    const supabase = getSupabaseAdmin();
    const session = await getUserFromToken(request);
    
    console.log('🔐 Project creation session check:', {
      hasSession: !!session,
      sessionUserId: session?.id,
      passedUserId: userId,
      userEmail: session?.user?.user_metadata.email
    });
    
    // Use passed userId if available (from automation), otherwise use session userId
    const effectiveUserId = userId || session?.id;
    
    if (!effectiveUserId) {
      console.error('❌ No valid user ID found for project creation');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📋 Project creation automation triggered:', {
      workflowId,
      nodeId,
      projectName,
      autoAssign,
      userId: effectiveUserId
    });

    // Get user's workspace
    console.log('🔍 Fetching workspace for user:', effectiveUserId);
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('user_id', effectiveUserId)
      .single();

    console.log('👤 Profile fetch result:', {
      hasProfile: !!profile,
      workspaceId: profile?.workspace_id,
      error: profileError
    });

    if (!profile?.workspace_id) {
      console.error('❌ No workspace found for user:', effectiveUserId);
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Get workflow configuration to understand the project creation settings
    const { data: workflow } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('id', workflowId)
      .single();

    let nodeConfig: any = {};
    if (workflow?.settings?.automation_config?.nodes) {
      const projectNode = workflow.settings.automation_config.nodes.find(
        (node: any) => node.id === nodeId && node.subtype === 'project_creation'
      );
      nodeConfig = projectNode?.data || {};
    }

    // Merge configuration from node settings and API parameters
    const finalProjectName = projectName || `Automated Project - ${new Date().toLocaleDateString()}`;
    const finalDescription = projectDescription || 
                           projectTemplate || 
                           nodeConfig.project_template || 
                           'Project created by automation workflow';
    const shouldAutoAssign = autoAssign !== undefined ? autoAssign : (nodeConfig.auto_assign || true);

    // Create the project
    const projectData = {
      name: finalProjectName,
      description: finalDescription,
      status: 'active',
      workspace_id: profile.workspace_id,
      user_id: shouldAutoAssign ? effectiveUserId : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('📋 Creating project with data:', projectData);

    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (projectError) {
      console.error('❌ Project creation failed:', projectError);
      return NextResponse.json({ 
        error: 'Failed to create project',
        details: projectError.message 
      }, { status: 500 });
    }

    console.log('✅ Project created successfully:', {
      id: newProject.id,
      name: newProject.name,
      workspace_id: newProject.workspace_id
    });

    // Log the automation event
    await supabase.from('automation_logs').insert({
      user_id: effectiveUserId,
      workflow_id: workflowId,
      event_type: 'project_creation',
      message: `Project "${newProject.name}" created by automation`,
      metadata: {
        project_id: newProject.id,
        project_name: newProject.name,
        node_id: nodeId,
        auto_assigned: shouldAutoAssign,
        workspace_id: profile.workspace_id,
        context
      }
    });

    return NextResponse.json({
      success: true,
      project: {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        status: newProject.status,
        workspace_id: newProject.workspace_id,
        user_id: newProject.user_id,
        created_at: newProject.created_at
      },
      message: `Project "${newProject.name}" created successfully`,
      automation: {
        workflow_id: workflowId,
        node_id: nodeId,
        auto_assigned: shouldAutoAssign
      }
    });

  } catch (error) {
    console.error('❌ Project creation automation error:', error);
    return NextResponse.json({ 
      error: 'Failed to process project creation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Project Creation Automation API is running',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/automation/project-creation - Create projects via automation workflows'
    ]
  });
} 