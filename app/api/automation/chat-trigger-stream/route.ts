import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
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
    const { message, userId, workflowId } = await request.json();

    console.log('🔄 Streaming chat trigger triggered:', { workflowId, userId, messageLength: message.length });

    const supabase = getSupabaseAdmin();

    // Get workflow configuration
    const { data: workflow, error: workflowError } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error('❌ Workflow not found:', {
        workflowId,
        error: workflowError,
        hasWorkflow: !!workflow
      });
      return NextResponse.json({ 
        error: 'Workflow not found',
        workflowId,
        details: workflowError?.message || 'No workflow data returned'
      }, { status: 404 });
    }
    
    console.log('✅ Found workflow:', {
      id: workflow.id,
      name: workflow.settings?.workflow_data?.name || 'Unnamed',
      status: workflow.status
    });

    const config = workflow.settings?.automation_config || {};
    let modelName = config.chatbot_model || 'claude-3-7-sonnet-20250219';
    
    // Map invalid model names to valid ones
    const modelMapping: { [key: string]: string } = {
      'claude-3-7-sonnet': 'claude-3-7-sonnet-20250219',
      'claude-4': 'claude-3-5-sonnet-20241022',
      'claude-sonnet-4': 'claude-3-5-sonnet-20241022'
    };
    
    if (modelMapping[modelName]) {
      console.log('🔄 Mapping invalid model name "' + modelName + '" to "' + modelMapping[modelName] + '"');
      modelName = modelMapping[modelName];
    }
    
    const isClaudeModel = modelName.includes('claude');

    // Get API keys and user profile
    const [settingsResult, profileResult] = await Promise.all([
      supabase
        .from('workspace_settings')
        .select('openai_api_key, anthropic_api_key')
        .eq('workspace_id', workflow.workspace_id)
        .single(),
      supabase
        .from('profiles')
        .select('workspace_id')
        .eq('user_id', userId)
        .single()
    ]);

    const settings = settingsResult.data;
    const profile = profileResult.data;
    
    const anthropicApiKey = settings?.anthropic_api_key;
    if (isClaudeModel && !anthropicApiKey) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 400 });
    }

    // Get workspace name
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workflow.workspace_id)
      .single();

    const workspaceName = workspace?.name || 'Unknown Workspace';

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial message
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'status', 
            message: 'Starting AI processing...' 
          })}\n\n`));

          if (isClaudeModel) {
            const anthropic = new Anthropic({ apiKey: anthropicApiKey });

            // Build context data
            let contextData = '';
            
            // Add user and workspace info
            const userName = 'User'; // Note: full_name not available in profiles table
            const currentDate = new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            
            contextData += `**Current Context:**\n`;
            contextData += `- User: ${userName}\n`;
            contextData += `- Current Date: ${currentDate}\n`;
            contextData += `- Workspace: ${workspaceName}\n\n`;

            // Template variable replacement function
            const replaceTemplateVariables = (text: string) => {
              return text
                .replace(/\{\{USER_NAME\}\}/g, userName)
                .replace(/\{\{CURRENT_DATE\}\}/g, currentDate)
                .replace(/\{\{WORKSPACE_NAME\}\}/g, workspaceName);
            };

            // Build system instructions with context
            let systemInstructions = config.system_instructions || `
You are a helpful AI assistant integrated with a comprehensive business management system.

AVAILABLE DATA SOURCES:
• Projects: {{ACTIVE_PROJECTS}} with tasks, progress, and deadlines
• Calendar: {{UPCOMING_EVENTS}} for the next 7 days
• Customers: {{CUSTOMER_DATA}} with contact information and project history

CONTEXT VARIABLES:
• Current User: {{USER_NAME}}
• Current Date: {{CURRENT_DATE}}
• Workspace: {{WORKSPACE_NAME}}

RESPONSE FORMATTING GUIDELINES:
Use clean HTML table formatting for professional presentation:

1. Use HTML tables with proper <table>, <th>, and <td> tags
2. Avoid heavy formatting like ## headers and excessive bold text
3. Present project information in clean HTML table format
4. For project confirmations, use this HTML table format:

✅ Project Created: [Project Name]

<table>
<tr><th>Field</th><th>Value</th></tr>
<tr><td>Name</td><td>[Project Name]</td></tr>
<tr><td>Status</td><td>Active</td></tr>
<tr><td>Progress</td><td>0%</td></tr>
<tr><td>Created</td><td>[Date]</td></tr>
<tr><td>Created by</td><td>[User Name]</td></tr>
<tr><td>Workspace</td><td>[Workspace Name]</td></tr>
</table>

What would you like to do next?
• Add project description
• Set deadlines and milestones
• Assign team members
• Create initial tasks
• Schedule related meetings

5. For lists of items, use HTML tables:

<table>
<tr><th>Project</th><th>Status</th><th>Progress</th><th>Due Date</th></tr>
<tr><td>Project A</td><td>Active</td><td>75%</td><td>Jan 15</td></tr>
<tr><td>Project B</td><td>On Hold</td><td>30%</td><td>Feb 20</td></tr>
</table>

6. Use HTML tables for any structured data presentation
7. Keep table headers simple and clear
8. Use emojis sparingly for visual breaks
9. Focus on clean, professional HTML table layouts

Always use HTML tables to present structured information clearly and professionally.

Please show your thinking process using <thinking> tags.

<thinking>
Available Information:
- [What data you have access to]

User's Need:
- [What they're asking for]

My Approach:
- [How you'll help them]

Key Considerations:
- [Important factors to consider]
</thinking>

[Your actual helpful response here]
`;

            // Replace template variables in system instructions
            systemInstructions = replaceTemplateVariables(systemInstructions);
            
            console.log('🧠 Streaming API Request:', {
              model: modelName,
              systemLength: systemInstructions.length,
              messageLength: message.length,
              hasThinkingInstructions: systemInstructions.includes('<thinking>')
            });

            const claudeStream = await anthropic.messages.create({
              model: modelName,
              max_tokens: 2000,
              temperature: 0.7,
              system: systemInstructions,
              messages: [{ role: "user", content: message }],
              stream: true
            });

            let fullResponse = '';
            let currentThinking = '';
            let isInThinking = false;
            let thinkingBuffer = '';
            let lastSentThinking = '';

            for await (const chunk of claudeStream) {
              if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
                const text = chunk.delta.text;
                fullResponse += text;
                thinkingBuffer += text;

                // Check if we're entering thinking mode
                if (thinkingBuffer.includes('<thinking>') && !isInThinking) {
                  isInThinking = true;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'thinking_start',
                    message: 'Claude is thinking...' 
                  })}\n\n`));
                }

                // If we're in thinking mode, extract and stream thinking content
                if (isInThinking && !thinkingBuffer.includes('</thinking>')) {
                  const thinkingStart = thinkingBuffer.lastIndexOf('<thinking>') + '<thinking>'.length;
                  currentThinking = thinkingBuffer.substring(thinkingStart);
                  
                  // Only send new thinking content
                  if (currentThinking.length > lastSentThinking.length) {
                    const newThinking = currentThinking.substring(lastSentThinking.length);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'thinking_delta',
                      content: newThinking,
                      full_thinking: currentThinking
                    })}\n\n`));
                    lastSentThinking = currentThinking;
                  }
                }

                // Check if we're exiting thinking mode
                if (thinkingBuffer.includes('</thinking>') && isInThinking) {
                  isInThinking = false;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: 'thinking_complete',
                    message: 'Generating response...' 
                  })}\n\n`));
                }

                // If we're past thinking mode, stream the response
                if (!isInThinking && thinkingBuffer.includes('</thinking>')) {
                  const responseStart = thinkingBuffer.lastIndexOf('</thinking>') + '</thinking>'.length;
                  const responseContent = thinkingBuffer.substring(responseStart).trim();
                  
                  if (responseContent) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'response_delta',
                      content: responseContent
                    })}\n\n`));
                  }
                }

                // Keep buffer manageable
                if (thinkingBuffer.length > 10000) {
                  thinkingBuffer = thinkingBuffer.slice(-5000);
                }
              }
            }

            // Send completion
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete',
              full_response: fullResponse,
              thinking_process: currentThinking
            })}\n\n`));

          } else {
            // Handle OpenAI models (non-streaming for now)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'error',
              message: 'Streaming only supported for Claude models currently'
            })}\n\n`));
          }

        } catch (error) {
          console.error('❌ Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ Stream setup error:', error);
    return NextResponse.json({ 
      error: 'Failed to setup stream',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Chat Trigger Streaming API is running',
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'POST /api/automation/chat-trigger-stream - Stream chatbot interactions with real-time thinking'
    ]
  });
} 