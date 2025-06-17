import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflow_id');
    const secret = searchParams.get('secret');
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflow_id parameter is required' },
        { status: 400 }
      );
    }

    // Get the raw body for signature verification
    const body = await request.text();
    let parsedBody;
    
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      // If not JSON, treat as plain text
      parsedBody = { data: body, content_type: 'text/plain' };
    }

    // Get workflow configuration to check for secret
    const supabaseAdmin = getSupabaseAdmin();
    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from('automation_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Verify webhook secret if configured
    const webhookConfig = workflow.trigger_config?.webhook;
    if (webhookConfig?.secret) {
      if (!secret) {
        return NextResponse.json(
          { error: 'Secret required for this webhook' },
          { status: 401 }
        );
      }

      // Verify secret (simple comparison for now, could use HMAC)
      if (secret !== webhookConfig.secret) {
        return NextResponse.json(
          { error: 'Invalid secret' },
          { status: 401 }
        );
      }
    }

    // Store webhook data for processing
    const webhookData = {
      workflow_id: workflowId,
      payload: parsedBody,
      headers: Object.fromEntries(request.headers.entries()),
      received_at: new Date().toISOString(),
      processed: false
    };

    const { data: webhookRecord, error: insertError } = await supabaseAdmin
      .from('webhook_logs')
      .insert(webhookData)
      .select()
      .single();

    if (insertError) {
      console.error('Error storing webhook:', insertError);
      return NextResponse.json(
        { error: 'Failed to store webhook data' },
        { status: 500 }
      );
    }

    // Trigger workflow execution (in a real implementation, this would be queued)
    try {
      await triggerWorkflow(workflowId, parsedBody, webhookRecord.id);
    } catch (error) {
      console.error('Error triggering workflow:', error);
      // Don't fail the webhook response, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook received and processed',
      webhook_id: webhookRecord.id,
      workflow_id: workflowId
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflow_id');
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('webhook_logs')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    const { data: webhooks, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch webhook logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      webhooks: webhooks || [],
      count: webhooks?.length || 0
    });

  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function triggerWorkflow(workflowId: string, payload: any, webhookId: string) {
  // This is a simplified workflow trigger
  // In a production system, you'd want to use a queue system like Bull/Redis
  
  try {
    // Get workflow details
    const supabaseAdmin = getSupabaseAdmin();
    const { data: workflow, error } = await supabaseAdmin
      .from('automation_workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error || !workflow) {
      throw new Error('Workflow not found');
    }

    // Create workflow execution record
    const { data: execution, error: executionError } = await supabaseAdmin
      .from('workflow_executions')
      .insert({
        workflow_id: workflowId,
        trigger_type: 'webhook',
        trigger_data: payload,
        webhook_id: webhookId,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (executionError) {
      throw new Error('Failed to create execution record');
    }

    // Mark webhook as processed
    await supabaseAdmin
      .from('webhook_logs')
      .update({ processed: true, execution_id: execution.id })
      .eq('id', webhookId);

    console.log(`Workflow ${workflowId} triggered by webhook ${webhookId}`);

  } catch (error) {
    console.error('Error in triggerWorkflow:', error);
    throw error;
  }
} 