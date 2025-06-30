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
    const { workflowId, userId, nodeData, inputData } = await request.json();

    console.log('🧠 AI Reasoning triggered:', { workflowId, userId, nodeData });

    const supabase = getSupabaseAdmin();

    // Get workflow configuration
    const { data: workflow, error: workflowError } = await supabase
      .from('cron_jobs')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError || !workflow) {
      console.error('❌ Workflow not found:', workflowError);
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Get user's workspace for API keys
    const { data: userWorkspace, error: workspaceError } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (workspaceError || !userWorkspace) {
      console.error('❌ User workspace not found:', workspaceError);
      return NextResponse.json({ error: 'User workspace not found' }, { status: 404 });
    }

    // Get workspace settings for API keys
    const { data: workspaceSettings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('openai_api_key, claude_api_key')
      .eq('workspace_id', userWorkspace.workspace_id)
      .single();

    if (settingsError) {
      console.error('❌ Error fetching workspace settings:', settingsError);
      return NextResponse.json({ error: 'Failed to fetch workspace settings' }, { status: 500 });
    }

    const config = nodeData;
    const model = config.reasoning_model || 'gpt-4o';
    const analysisQuestion = config.analysis_question || 'Analyze the provided data and provide insights';
    const contextData = config.context_data || '';

    // Determine if this is a Claude or OpenAI model
    const isClaudeModel = model.includes('claude');
    const isOpenAIModel = model.includes('gpt') || model.includes('o1');

    // Create appropriate AI client
    let aiClient: any = null;
    if (isClaudeModel) {
      if (!workspaceSettings.claude_api_key) {
        return NextResponse.json({ 
          error: 'Claude API key not configured. Please set your Claude API key in Settings.' 
        }, { status: 400 });
      }
      aiClient = new Anthropic({
        apiKey: workspaceSettings.claude_api_key,
      });
    } else if (isOpenAIModel) {
      if (!workspaceSettings.openai_api_key) {
        return NextResponse.json({ 
          error: 'OpenAI API key not configured. Please set your OpenAI API key in Settings.' 
        }, { status: 400 });
      }
      aiClient = new OpenAI({
        apiKey: workspaceSettings.openai_api_key,
      });
    } else {
      return NextResponse.json({ 
        error: 'Unsupported AI model for reasoning' 
      }, { status: 400 });
    }

    // Gather context data from the system
    let systemContext = '';
    
    // Get recent projects
    const { data: projects } = await supabase
      .from('projects')
      .select(`
        id, name, description, status, progress,
        start_date, end_date, customer_name,
        project_tasks(id, title, description, status, priority, due_date)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (projects && projects.length > 0) {
      systemContext += `\n\nRECENT PROJECTS:\n`;
      projects.forEach(project => {
        systemContext += `- ${project.name} (${project.progress}% complete, Status: ${project.status})\n`;
        systemContext += `  Customer: ${project.customer_name}\n`;
        if (project.project_tasks && project.project_tasks.length > 0) {
          systemContext += `  Active Tasks: ${project.project_tasks.length}\n`;
        }
      });
    }

    // Get recent calendar events
    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(10);

    if (events && events.length > 0) {
      systemContext += `\n\nUPCOMING CALENDAR EVENTS:\n`;
      events.forEach(event => {
        const startTime = new Date(event.start_time).toLocaleString();
        systemContext += `- ${event.title} at ${startTime}\n`;
      });
    }

    // Get recent customers and deals
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (customers && customers.length > 0) {
      systemContext += `\n\nRECENT CUSTOMERS:\n`;
      customers.forEach(customer => {
        systemContext += `- ${customer.name} (${customer.email})\n`;
      });
    }

    // Prepare the analysis prompt
    const systemPrompt = `You are an AI reasoning assistant that analyzes business data and provides actionable insights.

ANALYSIS TASK: ${analysisQuestion}

CONTEXT DATA: ${contextData}

AVAILABLE SYSTEM DATA: ${systemContext}

INPUT DATA FROM PREVIOUS WORKFLOW STEP: ${JSON.stringify(inputData, null, 2)}

Please provide:
1. **Key Insights**: What patterns or important information do you see?
2. **Recommendations**: What actions should be taken based on this data?
3. **Risk Assessment**: Are there any potential issues or opportunities?
4. **Next Steps**: What should happen next in the workflow?
5. **Data Quality**: Any concerns about the data or missing information?

Format your response as structured analysis with clear sections.`;

    let completion: any;
    let aiResponse: string;

    if (isClaudeModel) {
      // Use Anthropic Claude API
      completion = await aiClient.messages.create({
        model: model,
        max_tokens: 1500,
        temperature: 0.3, // Lower temperature for more analytical responses
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Please analyze the provided data and answer: ${analysisQuestion}`
          }
        ]
      });
      
      aiResponse = completion.content[0]?.text || 'Unable to generate analysis.';
    } else {
      // Use OpenAI API
      const isO1Model = model.includes('o1');
      const apiParams: any = {
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Please analyze the provided data and answer: ${analysisQuestion}`
          }
        ],
      };

      if (isO1Model) {
        // o1 models use different parameters
        apiParams.max_completion_tokens = 2000;
      } else {
        apiParams.max_tokens = 1500;
        apiParams.temperature = 0.3;
      }

      completion = await aiClient.chat.completions.create(apiParams);
      aiResponse = completion.choices[0]?.message?.content || 'Unable to generate analysis.';
    }

    // Store the reasoning result in automation memory
    await supabase.from('automation_memory').insert({
      workflow_id: workflowId,
      user_id: userId,
      memory_key: `ai_reasoning_${Date.now()}`,
      memory_value: {
        analysis_question: analysisQuestion,
        analysis_result: aiResponse,
        model_used: model,
        input_data: inputData,
        context_data: contextData,
        timestamp: new Date().toISOString()
      },
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });

    // Log the reasoning interaction
    await supabase.from('automation_logs').insert({
      user_id: userId,
      workflow_id: workflowId,
      event_type: 'ai_reasoning',
      message: `AI Reasoning: ${analysisQuestion}`,
      metadata: {
        model: model,
        analysis_question: analysisQuestion,
        response_length: aiResponse.length,
        input_data_size: JSON.stringify(inputData).length
      }
    });

    console.log('✅ AI Reasoning completed successfully');

    return NextResponse.json({
      success: true,
      analysis: aiResponse,
      model: model,
      analysis_question: analysisQuestion,
      context_included: {
        projects: projects?.length || 0,
        calendar_events: events?.length || 0,
        customers: customers?.length || 0
      },
      tokens_used: completion.usage || null
    });

  } catch (error) {
    console.error('❌ AI Reasoning error:', error);
    return NextResponse.json({ 
      error: 'Failed to process AI reasoning',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json({
    message: 'AI Reasoning API is running',
    timestamp: new Date().toISOString(),
    description: 'Provides AI-powered analysis and reasoning for automation workflows',
    supported_models: [
      'gpt-4o',
      'gpt-4o-mini', 
      'o1-preview',
      'o1-mini',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229'
    ]
  });
} 