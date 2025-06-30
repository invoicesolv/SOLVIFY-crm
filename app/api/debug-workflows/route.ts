import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { getUserFromToken } from '@/lib/auth-utils';
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

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Debug API] Starting debug analysis...');
    
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 Debug: Checking workflows for user:', user.id);

    const supabase = getSupabaseAdmin();

    // Get all cron jobs for the user
    const { data: allJobs, error } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Error fetching cron jobs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('📋 Total cron jobs found:', allJobs?.length || 0);

    // Group by job_type
    const jobsByType = allJobs?.reduce((acc: any, job: any) => {
      const type = job.job_type || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push({
        id: job.id,
        status: job.status,
        hasAutomationConfig: !!job.settings?.automation_config,
        hasWorkflowData: !!job.settings?.workflow_data,
        automationConfigNodes: job.settings?.automation_config?.nodes?.length || 0,
        workflowDataNodes: job.settings?.workflow_data?.nodes?.length || 0,
        name: job.settings?.workflow_data?.name || job.settings?.name || 'Unnamed'
      });
      return acc;
    }, {}) || {};

    // Check specifically for chatbot workflows
    const workflowJobs = allJobs?.filter(job => job.job_type === 'workflow') || [];
    const chatbotWorkflows = workflowJobs.filter(job => {
      const configNodes = job.settings?.automation_config?.nodes || [];
      const workflowNodes = job.settings?.workflow_data?.nodes || [];
      const nodes = configNodes.length > 0 ? configNodes : workflowNodes;
      
      const hasChatbotNode = nodes.some((node: any) => node.subtype === 'chatbot_integration');
      const hasTriggerNode = nodes.some((node: any) => node.subtype === 'chat_message_received');
      
      return hasChatbotNode && hasTriggerNode;
    });

    console.log('🤖 Chatbot workflows found:', chatbotWorkflows.length);

    return NextResponse.json({
      success: true,
      summary: {
        totalJobs: allJobs?.length || 0,
        jobsByType,
        workflowJobs: workflowJobs.length,
        chatbotWorkflows: chatbotWorkflows.length
      },
      allJobs: allJobs?.map(job => ({
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        name: job.settings?.workflow_data?.name || job.settings?.name || 'Unnamed',
        hasAutomationConfig: !!job.settings?.automation_config,
        hasWorkflowData: !!job.settings?.workflow_data,
        nodes: {
          automationConfig: job.settings?.automation_config?.nodes?.map((n: any) => n.subtype) || [],
          workflowData: job.settings?.workflow_data?.nodes?.map((n: any) => n.subtype) || []
        }
      })),
      chatbotWorkflows: chatbotWorkflows.map(job => ({
        id: job.id,
        name: job.settings?.workflow_data?.name || job.settings?.name || 'Unnamed',
        status: job.status,
        nodes: {
          automationConfig: job.settings?.automation_config?.nodes?.map((n: any) => ({ subtype: n.subtype, title: n.title })) || [],
          workflowData: job.settings?.workflow_data?.nodes?.map((n: any) => ({ subtype: n.subtype, title: n.title })) || []
        }
      }))
    });

  } catch (error) {
    console.error('❌ Debug API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 