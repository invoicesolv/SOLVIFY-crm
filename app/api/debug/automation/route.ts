import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { supabaseClient } from '@/lib/supabase-client';
import { getActiveWorkspaceId } from '@/lib/permission';
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

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Debug API] Starting automation debug analysis...');
    
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [Debug API] Session user:', user.id, user.email);

    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    console.log('🔍 [Debug API] Using workspace:', workspaceId);

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Get all workflows (note: cron_jobs table doesn't have workspace_id column)
    const { data: allWorkflows, error: workflowsError } = await supabaseAdmin
      .from('cron_jobs')
      .select('*');

    if (workflowsError) {
      console.error('❌ [Debug API] Error fetching workflows:', workflowsError);
    }

    console.log('🔍 [Debug API] Found workflows:', allWorkflows?.length || 0);

    // 2. Filter active workflows
    const activeWorkflows = allWorkflows?.filter(workflow => 
      workflow.status === 'active' || workflow.status === 'enabled'
    ) || [];

    console.log('🔍 [Debug API] Active workflows:', activeWorkflows.length);

    // 3. Analyze each workflow for chatbot integration (using same logic as chat API)
    const workflowDebugInfo = activeWorkflows.map(workflow => {
      let hasChatbotNode = false;
      let chatbotConfig = null;

      try {
        // Use same logic as chat API: check automation_config.nodes or workflow_data.nodes
        const nodes = workflow.settings?.automation_config?.nodes || workflow.settings?.workflow_data?.nodes || [];
        
        // Look for chatbot_integration nodes (using subtype like chat API)
        const chatbotNodes = nodes.filter((node: any) => 
          node.subtype === 'chatbot_integration'
        );

        if (chatbotNodes.length > 0) {
          hasChatbotNode = true;
          chatbotConfig = chatbotNodes[0].data || {};
          console.log('✅ [Debug API] Found chatbot node in workflow:', workflow.id, workflow.settings?.workflow_data?.name || 'Unnamed');
        }
      } catch (error) {
        console.error('❌ [Debug API] Error parsing workflow settings:', workflow.id, error);
      }

      return {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        job_type: workflow.job_type,
        settings: workflow.settings,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
        hasChatbotNode,
        chatbotConfig
      };
    });

    // 4. Filter workflows with chatbot nodes
    const chatbotWorkflows = workflowDebugInfo.filter(w => w.hasChatbotNode);
    console.log('🔍 [Debug API] Chatbot workflows:', chatbotWorkflows.length);

    // 5. Check API keys
    const { data: workspaceSettings, error: settingsError } = await supabaseAdmin
      .from('workspace_settings')
      .select('openai_api_key, claude_api_key')
      .eq('workspace_id', workspaceId)
      .single();

    if (settingsError) {
      console.error('❌ [Debug API] Error fetching workspace settings:', settingsError);
    }

    const apiKeys = {
      openai: !!(workspaceSettings?.openai_api_key && workspaceSettings.openai_api_key.trim() !== ''),
      claude: !!(workspaceSettings?.claude_api_key && workspaceSettings.claude_api_key.trim() !== '')
    };

    console.log('🔍 [Debug API] API keys status:', apiKeys);

    // 6. Test chat API detection logic (simulate what the chat API does)
    let chatApiTest: any = null;
    try {
      // Simulate the logic from chat API
      const workflowJobs = activeWorkflows.filter(job => job.job_type === 'workflow');
      console.log('🔍 [Debug API] Workflow jobs found:', workflowJobs.length);

      const chatbotEnabledWorkflows = workflowJobs.filter(job => {
        try {
          const nodes = job.settings?.automation_config?.nodes || job.settings?.workflow_data?.nodes || [];
          return nodes.some((node: any) => node.subtype === 'chatbot_integration');
        } catch (error) {
          console.error('❌ [Debug API] Error parsing job settings:', error);
          return false;
        }
      });

      chatApiTest = {
        totalActiveWorkflows: activeWorkflows.length,
        workflowTypeJobs: workflowJobs.length,
        chatbotEnabledWorkflows: chatbotEnabledWorkflows.length,
        detectedChatbotWorkflows: chatbotEnabledWorkflows.map(w => ({
          id: w.id,
          name: w.name,
          status: w.status
        }))
      };

      console.log('🔍 [Debug API] Chat API simulation result:', chatApiTest);
    } catch (error) {
      console.error('❌ [Debug API] Error in chat API simulation:', error);
      chatApiTest = { error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // 7. Prepare response
    const debugData = {
      workspaceId,
      activeWorkflows: workflowDebugInfo,
      chatbotWorkflows,
      apiKeys,
      chatApiTest,
      automationApiTest: null, // Could add more tests here
      totalWorkflows: allWorkflows?.length || 0,
      summary: {
        hasActiveWorkflows: activeWorkflows.length > 0,
        hasChatbotWorkflows: chatbotWorkflows.length > 0,
        hasRequiredApiKeys: apiKeys.openai || apiKeys.claude,
        readyForAutomation: chatbotWorkflows.length > 0 && (apiKeys.openai || apiKeys.claude)
      }
    };

    console.log('✅ [Debug API] Debug analysis complete:', {
      totalWorkflows: debugData.totalWorkflows,
      activeWorkflows: debugData.activeWorkflows.length,
      chatbotWorkflows: debugData.chatbotWorkflows.length,
      readyForAutomation: debugData.summary.readyForAutomation
    });

    return NextResponse.json(debugData);

  } catch (error) {
    console.error('❌ [Debug API] Error in automation debug:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 