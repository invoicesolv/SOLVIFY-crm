import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
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

export async function POST(request: NextRequest) {
  try {
    const { workflowId, userId } = await request.json();

    console.log('🧪 [CHAT TEST] Starting live chat trigger test...');
    console.log('📋 [CHAT TEST] Workflow ID:', workflowId);
    console.log('👤 [CHAT TEST] User ID:', userId);

    const supabase = getSupabaseAdmin();

    // Get the workflow configuration
    const { data: workflow, error: workflowError } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error('❌ [CHAT TEST] Workflow not found:', workflowError);
      return NextResponse.json({ 
        error: 'Workflow not found',
        details: workflowError?.message 
      }, { status: 404 });
    }

    console.log('✅ [CHAT TEST] Workflow found:', workflow.settings?.workflow_data?.name);

    const automationConfig = workflow.settings?.automation_config;
    if (!automationConfig || !automationConfig.nodes) {
      console.error('❌ [CHAT TEST] No automation configuration found');
      return NextResponse.json({ 
        error: 'No automation configuration found' 
      }, { status: 400 });
    }

    console.log('🔧 [CHAT TEST] Found', automationConfig.nodes.length, 'nodes in workflow');

    // Find the chat trigger and chatbot nodes
    const chatTriggerNode = automationConfig.nodes.find((node: any) => 
      node.subtype === 'chat_message_received' || node.type === 'trigger'
    );
    
    const chatbotNode = automationConfig.nodes.find((node: any) => 
      node.subtype === 'chatbot_integration'
    );

    console.log('🎯 [CHAT TEST] Chat trigger node found:', !!chatTriggerNode);
    console.log('🤖 [CHAT TEST] Chatbot node found:', !!chatbotNode);

    const testResults: Array<{
      step: string;
      node_id: string | undefined;
      result: {
        success: boolean;
        message: string;
        error: string | null;
      };
    }> = [];

    // Test 1: Chat Trigger Activation
    let triggerResult: { success: boolean; message: string; error: string | null } = { 
      success: false, 
      message: '', 
      error: null 
    };
    
    if (chatTriggerNode) {
      try {
        console.log('🚀 [CHAT TEST] Testing chat trigger activation...');
        
        // Simulate trigger conditions
        const triggerConfig = chatTriggerNode.data || {};
        const testMessage = "Test automation workflow";
        
        // Check if trigger would activate
        let shouldTrigger = true;
        let triggerReason = 'Test message received';
        
        // Check platform filter
        if (triggerConfig.chat_platform && triggerConfig.chat_platform !== 'automation_test') {
          shouldTrigger = false;
          triggerReason = `Platform mismatch: expected ${triggerConfig.chat_platform}, got automation_test`;
        }
        
        // Check keyword filter
        if (triggerConfig.message_keywords && shouldTrigger) {
          const keywords = triggerConfig.message_keywords.toLowerCase().split(',').map((k: string) => k.trim());
          const hasKeyword = keywords.some((keyword: string) => testMessage.toLowerCase().includes(keyword));
          if (!hasKeyword) {
            shouldTrigger = false;
            triggerReason = `Keyword mismatch: message "${testMessage}" doesn't contain any of [${keywords.join(', ')}]`;
          }
        }
        
        triggerResult = {
          success: shouldTrigger,
          message: triggerReason,
          error: null
        };
        
        console.log(shouldTrigger ? '✅' : '❌', '[CHAT TEST] Trigger result:', triggerReason);
        
      } catch (error) {
        triggerResult = {
          success: false,
          message: 'Trigger test failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.error('❌ [CHAT TEST] Trigger test error:', error);
      }
    } else {
      triggerResult = {
        success: false,
        message: 'No chat trigger node found in workflow',
        error: 'Missing trigger node'
      };
    }

    testResults.push({
      step: 'chat_trigger',
      node_id: chatTriggerNode?.id,
      result: triggerResult
    });

    // Test 2: Chatbot Integration
    let chatbotResult: { success: boolean; message: string; error: string | null } = { 
      success: false, 
      message: '', 
      error: null 
    };
    
    if (chatbotNode && triggerResult.success) {
      try {
        console.log('🤖 [CHAT TEST] Testing chatbot integration...');
        
        // Test the actual chatbot API
        const chatResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/automation/chat-trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Test automation: Show me my projects and calendar',
            workflowId: workflowId,
            userId: userId,
            context: { 
              test: true,
              platform: 'automation_test'
            }
          }),
        });

        const chatResult = await chatResponse.json();
        
        if (chatResponse.ok && chatResult.success) {
          chatbotResult = {
            success: true,
            message: `AI response generated successfully: "${chatResult.response?.substring(0, 100)}..."`,
            error: null
          };
          console.log('✅ [CHAT TEST] Chatbot integration successful');
        } else {
          chatbotResult = {
            success: false,
            message: 'Chatbot API call failed',
            error: chatResult.error || 'Unknown API error'
          };
          console.error('❌ [CHAT TEST] Chatbot API failed:', chatResult);
        }
        
      } catch (error) {
        chatbotResult = {
          success: false,
          message: 'Chatbot integration test failed',
          error: error instanceof Error ? error.message : 'Network error'
        };
        console.error('❌ [CHAT TEST] Chatbot test error:', error);
      }
    } else if (!chatbotNode) {
      chatbotResult = {
        success: false,
        message: 'No chatbot integration node found in workflow',
        error: 'Missing chatbot node'
      };
    } else {
      chatbotResult = {
        success: false,
        message: 'Skipped due to trigger failure',
        error: 'Trigger did not activate'
      };
    }

    testResults.push({
      step: 'chatbot_integration',
      node_id: chatbotNode?.id,
      result: chatbotResult
    });

    // Log test completion
    await supabase.from('automation_logs').insert({
      user_id: userId,
      workflow_id: workflowId,
      event_type: 'live_test',
      message: `Live chat trigger test completed. Trigger: ${triggerResult.success ? 'SUCCESS' : 'FAILED'}, Chatbot: ${chatbotResult.success ? 'SUCCESS' : 'FAILED'}`,
      metadata: {
        test_results: testResults,
        timestamp: new Date().toISOString()
      }
    });

    const overallSuccess = triggerResult.success && chatbotResult.success;
    
    console.log('🏁 [CHAT TEST] Test completed. Overall result:', overallSuccess ? 'SUCCESS' : 'FAILED');
    
    return NextResponse.json({
      success: overallSuccess,
      message: `Live chat trigger test ${overallSuccess ? 'completed successfully' : 'failed'}`,
      results: testResults,
      workflow: {
        id: workflowId,
        name: workflow.settings?.workflow_data?.name || 'Unknown Workflow',
        nodes_tested: testResults.length
      },
      summary: {
        trigger_activated: triggerResult.success,
        chatbot_responded: chatbotResult.success,
        total_steps: testResults.length,
        successful_steps: testResults.filter(r => r.result.success).length
      }
    });

  } catch (error) {
    console.error('❌ [CHAT TEST] Fatal error:', error);
    return NextResponse.json({ 
      error: 'Live chat trigger test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for API info
export async function GET() {
  return NextResponse.json({
    message: 'Live Chat Trigger Test API',
    description: 'Tests chat automation workflows with real-time feedback',
    timestamp: new Date().toISOString(),
    usage: {
      method: 'POST',
      body: {
        workflowId: 'string - ID of the workflow to test',
        userId: 'string - ID of the user running the test'
      }
    }
  });
} 