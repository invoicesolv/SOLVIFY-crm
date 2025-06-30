import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testType } = await request.json();

    console.log('[🧪 PROJECT TRIGGER TEST] Starting test:', {
      testType,
      userId: user.id,
      timestamp: new Date().toISOString()
    });

    // Get user's workspace
    const { data: teamMemberships } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1);

    const workspaceId = teamMemberships?.[0]?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Get or create a test project
    let { data: testProject } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('name', 'Test Project for Triggers')
      .single();

    if (!testProject) {
      console.log('[🧪 PROJECT TRIGGER TEST] Creating test project...');
      
      const { data: newProject, error: createError } = await supabaseAdmin
        .from('projects')
        .insert({
          name: 'Test Project for Triggers',
          workspace_id: workspaceId,
          user_id: user.id,
          customer_name: 'Test Customer',
          status: 'active',
          description: 'This is a test project for trigger testing',
          start_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('[❌ PROJECT TRIGGER TEST] Error creating test project:', createError);
        return NextResponse.json({ error: 'Failed to create test project' }, { status: 500 });
      }

      testProject = newProject;
      console.log('[✅ PROJECT TRIGGER TEST] Test project created:', testProject.id);
    }

    // Create some test tasks if none exist
    const { data: existingTasks } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('project_id', testProject.id);

    if (!existingTasks || existingTasks.length === 0) {
      console.log('[🧪 PROJECT TRIGGER TEST] Creating test tasks...');
      
      const testTasks = [
        {
          title: 'Test Task 1',
          project_id: testProject.id,
          user_id: user.id,
          workspace_id: workspaceId,
          status: 'completed',
          progress: 100,
          description: 'Completed test task',
          created_at: new Date().toISOString()
        },
        {
          title: 'Test Task 2', 
          project_id: testProject.id,
          user_id: user.id,
          workspace_id: workspaceId,
          status: 'in_progress',
          progress: 50,
          description: 'In progress test task',
          created_at: new Date().toISOString()
        },
        {
          title: 'Test Task 3',
          project_id: testProject.id,
          user_id: user.id,
          workspace_id: workspaceId,
          status: 'todo',
          progress: 0,
          description: 'Todo test task',
          created_at: new Date().toISOString()
        },
        {
          title: 'Test Task 4',
          project_id: testProject.id,
          user_id: user.id,
          workspace_id: workspaceId,
          status: 'todo',
          progress: 0,
          description: 'Another todo test task',
          created_at: new Date().toISOString()
        }
      ];

      await supabaseAdmin.from('tasks').insert(testTasks);
      console.log('[✅ PROJECT TRIGGER TEST] Test tasks created');
    }

    let triggerResults: Array<{ type: string; result: any }> = [];

    // Test different trigger types based on testType parameter
    switch (testType) {
      case 'progress_25':
        console.log('[🎯 PROJECT TRIGGER TEST] Testing 25% progress milestone...');
        const progress25Result = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/automation/project-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            projectId: testProject.id,
            triggerType: 'progress_milestone',
            triggerData: { percentage: 25 },
            workspaceId
          })
        });
        
        const progress25Data = await progress25Result.json();
        triggerResults.push({ type: 'progress_25', result: progress25Data });
        break;

      case 'completion':
        console.log('[🎯 PROJECT TRIGGER TEST] Testing project completion...');
        
        // First update project status to completed
        await supabaseAdmin
          .from('projects')
          .update({ 
            status: 'completed',
            end_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', testProject.id);

        const completionResult = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/automation/project-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            projectId: testProject.id,
            triggerType: 'completion',
            triggerData: {},
            workspaceId
          })
        });
        
        const completionData = await completionResult.json();
        triggerResults.push({ type: 'completion', result: completionData });
        break;

      case 'status_change':
        console.log('[🎯 PROJECT TRIGGER TEST] Testing status change...');
        
        const statusChangeResult = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/automation/project-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            projectId: testProject.id,
            triggerType: 'status_change',
            triggerData: { previousStatus: 'active' },
            workspaceId
          })
        });
        
        const statusChangeData = await statusChangeResult.json();
        triggerResults.push({ type: 'status_change', result: statusChangeData });
        break;

      case 'all':
        console.log('[🎯 PROJECT TRIGGER TEST] Testing all trigger types...');
        
        // Test progress milestone
        const allProgress = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/automation/project-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            projectId: testProject.id,
            triggerType: 'progress_milestone',
            triggerData: { percentage: 25 },
            workspaceId
          })
        });
        triggerResults.push({ type: 'progress_25', result: await allProgress.json() });

        // Update to completed and test completion trigger
        await supabaseAdmin
          .from('projects')
          .update({ 
            status: 'completed',
            end_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', testProject.id);

        const allCompletion = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/automation/project-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            projectId: testProject.id,
            triggerType: 'completion',
            triggerData: {},
            workspaceId
          })
        });
        triggerResults.push({ type: 'completion', result: await allCompletion.json() });

        // Test status change
        const allStatusChange = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/automation/project-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('Cookie') || ''
          },
          body: JSON.stringify({
            projectId: testProject.id,
            triggerType: 'status_change',
            triggerData: { previousStatus: 'active' },
            workspaceId
          })
        });
        triggerResults.push({ type: 'status_change', result: await allStatusChange.json() });
        break;

      default:
        return NextResponse.json({ error: 'Invalid test type. Use: progress_25, completion, status_change, or all' }, { status: 400 });
    }

    console.log('[🎉 PROJECT TRIGGER TEST] Test completed!', {
      testType,
      projectId: testProject.id,
      resultsCount: triggerResults.length,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      testType,
      project: {
        id: testProject.id,
        name: testProject.name,
        status: testProject.status
      },
      results: triggerResults,
      message: `Project trigger test completed for: ${testType}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[💥 PROJECT TRIGGER TEST] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run project trigger test',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 