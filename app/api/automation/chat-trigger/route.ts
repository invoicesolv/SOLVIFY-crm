import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
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

// OpenAI client will be created with user's API key from database

export async function POST(request: NextRequest) {
  try {
    const { message, workflowId, userId, context } = await request.json();

    console.log('🤖 Chat trigger received:', { message, workflowId, userId });

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

    const automationConfig = workflow.settings?.automation_config;
    if (!automationConfig) {
      console.error('❌ No automation config found');
      return NextResponse.json({ error: 'No automation configuration' }, { status: 400 });
    }

    // Find chatbot integration node
    const chatbotNode = automationConfig.nodes?.find((node: any) => 
      node.subtype === 'chatbot_integration'
    );

    if (!chatbotNode) {
      console.error('❌ No chatbot integration node found');
      return NextResponse.json({ error: 'No chatbot configuration' }, { status: 400 });
    }

    const config = chatbotNode.data;
    console.log('🔧 Chatbot config:', config);

    // Get user's workspace first
    const { data: userWorkspace, error: workspaceError } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (workspaceError || !userWorkspace?.workspace_id) {
      console.error('❌ Could not find user workspace:', workspaceError);
      return NextResponse.json({ 
        error: 'Could not find user workspace. Please ensure you are part of a workspace.' 
      }, { status: 400 });
    }

    // Get user's API keys from workspace settings
    const { data: workspaceSettings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('openai_api_key, claude_api_key')
      .eq('workspace_id', userWorkspace.workspace_id)
      .single();

    // Determine which model type we're using and validate model names
    let modelName = config.chatbot_model || 'gpt-4o';
    
    // Fix invalid Claude model names for backward compatibility
    const modelMappings: { [key: string]: string } = {
      'claude-4': 'claude-opus-4-20250514',
      'claude-3-7-sonnet': 'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku': 'claude-3-5-haiku-20241022'
    };
    
    if (modelMappings[modelName]) {
      console.log(`🔄 Mapping invalid model name "${modelName}" to "${modelMappings[modelName]}"`);
      modelName = modelMappings[modelName];
    }
    
    const isClaudeModel = modelName.includes('claude');
    const isOpenAIModel = modelName.includes('gpt') || modelName.includes('o1') || modelName.includes('o3');

    if (settingsError || !workspaceSettings) {
      console.error('❌ Error fetching workspace settings:', settingsError);
      return NextResponse.json({ 
        error: 'Could not fetch workspace settings.' 
      }, { status: 400 });
    }

    // Check if we have the required API key for the selected model
    if (isClaudeModel && (!workspaceSettings.claude_api_key)) {
      console.error('❌ No Claude API key found for Claude model');
      return NextResponse.json({ 
        error: 'Claude API key not configured. Please set your Claude API key in Settings to use Claude models.' 
      }, { status: 400 });
    }

    if (isOpenAIModel && (!workspaceSettings.openai_api_key)) {
      console.error('❌ No OpenAI API key found for OpenAI model');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please set your OpenAI API key in Settings.' 
      }, { status: 400 });
    }

    // Create appropriate AI client
    let aiClient: any = null;
    if (isClaudeModel) {
      // Create Anthropic client for Claude models
      console.log('🧠 Using Anthropic client for Claude model:', modelName);
      aiClient = new Anthropic({
        apiKey: workspaceSettings.claude_api_key,
      });
    } else {
      // Create OpenAI client with user's API key
      console.log('🤖 Using OpenAI client for model:', modelName);
      aiClient = new OpenAI({
        apiKey: workspaceSettings.openai_api_key,
      });
    }

    // Build context based on enabled integrations
    let contextData = '';
    
    // Connect to Projects
    if (config.connect_to_projects) {
      const { data: projects } = await supabase
        .from('projects')
        .select(`
          id, name, description, status, progress,
          start_date, end_date, customer_name,
          project_tasks(id, title, description, status, priority, due_date)
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (projects && projects.length > 0) {
        contextData += `\n\nACTIVE PROJECTS:\n`;
        projects.forEach(project => {
          contextData += `- ${project.name} (${project.progress}% complete)\n`;
          contextData += `  Customer: ${project.customer_name}\n`;
          contextData += `  Status: ${project.status}\n`;
          if (project.project_tasks && project.project_tasks.length > 0) {
            contextData += `  Recent Tasks:\n`;
            project.project_tasks.slice(0, 3).forEach((task: any) => {
              contextData += `    • ${task.title} (${task.status})\n`;
            });
          }
        });
      }
    }

    // Connect to Calendar
    if (config.connect_to_calendar) {
      const { data: events } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);

      if (events && events.length > 0) {
        contextData += `\n\nUPCOMING CALENDAR EVENTS:\n`;
        events.forEach(event => {
          const startTime = new Date(event.start_time).toLocaleString();
          contextData += `- ${event.title} at ${startTime}\n`;
          if (event.description) {
            contextData += `  ${event.description}\n`;
          }
        });
      }
    }

    // Connect to AI Reasoning (get recent analysis)
    if (config.connect_to_reasoning) {
      const { data: recentAnalysis } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('event_type', 'ai_reasoning')
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentAnalysis && recentAnalysis.length > 0) {
        contextData += `\n\nRECENT AI ANALYSIS:\n`;
        recentAnalysis.forEach(analysis => {
          contextData += `- ${analysis.message}\n`;
        });
      }

      // Add comprehensive database schema information for AI reasoning
      contextData += `\n\nDATABASE CAPABILITIES & PERMISSIONS:\n`;
      contextData += `You have FULL ADMIN ACCESS to create, read, update, and delete records in:\n`;
      contextData += `\n📅 CALENDAR EVENTS (calendar_events table):\n`;
      contextData += `  - Can create events with: title, description, start_time, end_time, location\n`;
      contextData += `  - Event types: meeting, appointment, reminder, deadline\n`;
      contextData += `  - Automatically includes user_id and workspace_id for proper access\n`;
      contextData += `  - Can sync with Google Calendar if user has integration\n`;
      contextData += `\n📋 PROJECTS (projects table):\n`;
      contextData += `  - Can create/update projects with: name, description, status, progress\n`;
      contextData += `  - Link to customers, set deadlines, assign team members\n`;
      contextData += `  - Track progress percentage and milestones\n`;
      contextData += `\n✅ TASKS (project_tasks table):\n`;
      contextData += `  - Can create tasks within projects\n`;
      contextData += `  - Set priority, due dates, assign to team members\n`;
      contextData += `  - Track status: pending, in_progress, completed\n`;
      contextData += `\n👥 CUSTOMERS (customers table):\n`;
      contextData += `  - Can create customer records with contact info\n`;
      contextData += `  - Link customers to projects and deals\n`;
      contextData += `  - Track customer interactions and history\n`;
      contextData += `\n💰 DEALS (deals table):\n`;
      contextData += `  - Can create sales opportunities\n`;
      contextData += `  - Set deal value, stage, probability\n`;
      contextData += `  - Link to customers and projects\n`;
      contextData += `\n📧 NOTIFICATIONS (notifications table):\n`;
      contextData += `  - Can create system notifications for users\n`;
      contextData += `  - Set priority levels and expiration dates\n`;
      contextData += `\n🔄 AUTOMATION LOGS (automation_logs table):\n`;
      contextData += `  - Can log automation events and AI reasoning\n`;
      contextData += `  - Track workflow executions and results\n`;
      contextData += `\nWhen users request to create events, projects, tasks, or any records:\n`;
      contextData += `1. Extract all relevant details from their message\n`;
      contextData += `2. Use intelligent defaults for missing information\n`;
      contextData += `3. Confirm creation with specific details\n`;
      contextData += `4. The system will handle all database operations automatically\n`;
    }

    // Get user profile for additional context
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name, workspace_id')
      .eq('user_id', userId)
      .single();

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', userProfile?.workspace_id)
      .single();

    // Function to replace template variables in system instructions
    const replaceTemplateVariables = (text: string) => {
      let processedText = text;
      
      // Replace user context variables
      processedText = processedText.replace(/\{\{USER_NAME\}\}/g, userProfile?.name || 'User');
      processedText = processedText.replace(/\{\{CURRENT_DATE\}\}/g, new Date().toLocaleDateString());
      processedText = processedText.replace(/\{\{WORKSPACE_NAME\}\}/g, workspace?.name || 'Your Workspace');
      
      // Replace data source variables with actual data
      if (config.connect_to_projects) {
        const projectsData = contextData.includes('ACTIVE PROJECTS:') 
          ? contextData.split('ACTIVE PROJECTS:')[1]?.split('\n\n')[0] || 'No active projects'
          : 'No active projects';
        processedText = processedText.replace(/\{\{ACTIVE_PROJECTS\}\}/g, projectsData);
        processedText = processedText.replace(/\{\{PROJECT_TASKS\}\}/g, projectsData);
      } else {
        processedText = processedText.replace(/\{\{ACTIVE_PROJECTS\}\}/g, 'Not connected to projects');
        processedText = processedText.replace(/\{\{PROJECT_TASKS\}\}/g, 'Not connected to projects');
      }
      
      if (config.connect_to_calendar) {
        const eventsData = contextData.includes('UPCOMING CALENDAR EVENTS:')
          ? contextData.split('UPCOMING CALENDAR EVENTS:')[1]?.split('\n\n')[0] || 'No upcoming events'
          : 'No upcoming events';
        processedText = processedText.replace(/\{\{UPCOMING_EVENTS\}\}/g, eventsData);
      } else {
        processedText = processedText.replace(/\{\{UPCOMING_EVENTS\}\}/g, 'Not connected to calendar');
      }
      
      if (config.connect_to_reasoning) {
        const reasoningData = contextData.includes('RECENT AI ANALYSIS:')
          ? contextData.split('RECENT AI ANALYSIS:')[1]?.split('\n\n')[0] || 'No recent analysis'
          : 'No recent analysis';
        processedText = processedText.replace(/\{\{RECENT_REASONING\}\}/g, reasoningData);
      } else {
        processedText = processedText.replace(/\{\{RECENT_REASONING\}\}/g, 'Not connected to AI reasoning');
      }
      
      // Default customer data (could be enhanced with actual customer queries)
      processedText = processedText.replace(/\{\{CUSTOMER_DATA\}\}/g, 'Customer data available in system');
      
      return processedText;
    };

    // Prepare system instructions with template variable replacement
    let systemInstructions = config.system_instructions || `
You are a helpful AI assistant integrated with a comprehensive business management system. 
You have access to project data, calendar events, and previous AI analysis.

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
    `;
    
    // Replace template variables in system instructions
    systemInstructions = replaceTemplateVariables(systemInstructions);
    
    // Debug logging for template variable replacement
    console.log('🔧 Template Variables Processed:', {
      originalLength: config.system_instructions?.length || 0,
      processedLength: systemInstructions.length,
      userProfile: userProfile?.name || 'No profile',
      workspace: workspace?.name || 'No workspace',
      hasProjects: config.connect_to_projects,
      hasCalendar: config.connect_to_calendar,
      hasReasoning: config.connect_to_reasoning
    });

    // Get AI response - handle o1 models differently (no system messages)
    const isO1Model = config.chatbot_model?.includes('o1');
    
    let messages;
    if (isO1Model) {
      // o1 models don't support system messages, so include context in user message
      messages = [
        {
          role: 'user',
          content: `Context: ${systemInstructions + contextData}\n\nUser Request: ${message}`
        }
      ];
    } else {
      // Regular models support system messages
      messages = [
        {
          role: 'system',
          content: systemInstructions + contextData
        },
        {
          role: 'user',
          content: message
        }
      ];
    }

    // Generate AI response based on model type
    let completion: any;
    let aiResponse: string;

    if (isClaudeModel) {
      // Anthropic Claude API format
      const claudeMessages = messages.filter((msg: any) => msg.role !== 'system');
      let systemMessage = messages.find((msg: any) => msg.role === 'system')?.content || '';
      
      // Add thinking process instructions for Claude
      const thinkingInstructions = `

**IMPORTANT: SHOW YOUR THINKING PROCESS**

Before providing your final response, please show your reasoning process in a <thinking> section. Include:

1. **Analysis**: What information do I have available?
2. **Context Review**: What data sources are connected and relevant?
3. **Problem Assessment**: What is the user really asking for?
4. **Strategy**: How should I approach this request?
5. **Considerations**: What factors should I consider?
6. **Decision**: What's the best way to help?

Format your response like this:

<thinking>
Let me analyze this request...

**Available Information:**
- [List what data/context you have]

**User's Need:**
- [What they're asking for]

**My Approach:**
- [How I'll help them]

**Key Considerations:**
- [Important factors to consider]
</thinking>

[Your actual helpful response here]

This thinking process helps provide more thoughtful and accurate assistance.
`;
      
      systemMessage += thinkingInstructions;
      
      console.log('🧠 Claude API Request:', {
        model: modelName,
        systemLength: systemMessage.length,
        messageCount: claudeMessages.length,
        contextData: contextData.length,
        hasThinkingInstructions: true
      });
      
      // Use streaming for real-time thinking process
      const stream = await aiClient.messages.create({
        model: modelName,
        max_tokens: 2000, // Increased for thinking process
        temperature: 0.7,
        system: systemMessage,
        messages: claudeMessages,
        stream: true
      });

      // Process the stream and extract thinking process in real-time
      let fullResponse = '';
      let currentThinking = '';
      let isInThinking = false;
      let thinkingBuffer = '';
      
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          const text = chunk.delta.text;
          fullResponse += text;
          
          // Buffer text for thinking detection
          thinkingBuffer += text;
          
          // Check if we're entering thinking mode
          if (thinkingBuffer.includes('<thinking>') && !isInThinking) {
            isInThinking = true;
            const thinkingStart = thinkingBuffer.lastIndexOf('<thinking>') + '<thinking>'.length;
            currentThinking = thinkingBuffer.substring(thinkingStart);
            console.log('🧠 Started thinking process...');
          } 
          // Check if we're exiting thinking mode
          else if (thinkingBuffer.includes('</thinking>') && isInThinking) {
            isInThinking = false;
            const thinkingEnd = thinkingBuffer.lastIndexOf('</thinking>');
            const beforeEnd = thinkingBuffer.substring(0, thinkingEnd);
            const lastThinkingStart = beforeEnd.lastIndexOf('<thinking>') + '<thinking>'.length;
            currentThinking = beforeEnd.substring(lastThinkingStart);
            console.log('🧠 Completed thinking process:', currentThinking.length, 'characters');
          }
          // If we're in thinking mode, accumulate the thinking text
          else if (isInThinking) {
            // Extract only the new thinking content
            const lastThinkingStart = thinkingBuffer.lastIndexOf('<thinking>') + '<thinking>'.length;
            currentThinking = thinkingBuffer.substring(lastThinkingStart);
            
            // Log progressive thinking (for debugging)
            if (currentThinking.length % 50 === 0) { // Log every 50 characters
              console.log('🧠 Thinking progress:', currentThinking.length, 'chars');
            }
          }
          
          // Keep buffer manageable
          if (thinkingBuffer.length > 10000) {
            thinkingBuffer = thinkingBuffer.slice(-5000);
          }
        }
      }
      
      aiResponse = fullResponse;
      
      // Create mock completion object for compatibility
      completion = {
        content: [{ text: fullResponse }],
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };
      
      console.log('🧠 Claude Response Stats:', {
        model: modelName,
        inputTokens: completion.usage?.input_tokens || 0,
        outputTokens: completion.usage?.output_tokens || 0,
        totalTokens: (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0),
        responseLength: aiResponse.length,
        hasThinkingSection: aiResponse.includes('<thinking>'),
        contextIncluded: {
          projects: config.connect_to_projects && contextData.includes('ACTIVE PROJECTS'),
          calendar: config.connect_to_calendar && contextData.includes('UPCOMING CALENDAR EVENTS'),
          reasoning: config.connect_to_reasoning && contextData.includes('RECENT AI ANALYSIS')
        }
      });
      
      console.log('🧠 Claude response generated successfully');
    } else {
      // OpenAI API format
      const apiParams: any = {
        model: config.chatbot_model || 'gpt-4o',
        messages,
      };

      if (isO1Model) {
        // o1 models use different parameters
        apiParams.max_completion_tokens = 4000;
        // Note: o1 models don't support temperature parameter
      } else {
        // Regular models use standard parameters
        apiParams.max_tokens = 1000;
        apiParams.temperature = 0.7;
      }

      completion = await aiClient.chat.completions.create(apiParams);

      // Log the full response for debugging o1 models
      if (isO1Model) {
        console.log('🔍 Full O1 API Response:', JSON.stringify(completion, null, 2));
      }

      aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
      console.log('🤖 OpenAI response generated successfully');
    }
    
    // Log reasoning token usage for o1 models (no artificial reasoning display)
    if (isO1Model && completion.usage?.completion_tokens_details?.reasoning_tokens) {
      const reasoningTokens = completion.usage.completion_tokens_details.reasoning_tokens;
      const totalTokens = completion.usage.completion_tokens;
      const reasoningPercentage = Math.round((reasoningTokens / totalTokens) * 100);
      
      console.log('🧠 O1 Reasoning Stats:', {
        reasoningTokens,
        totalTokens,
        reasoningPercentage: `${reasoningPercentage}%`,
        userMessage: message.substring(0, 100) + '...'
      });
    }

    // Check if user wants to create calendar events
    const wantsCalendarEvent = message.toLowerCase().includes('schedule') || 
                              message.toLowerCase().includes('meeting') || 
                              message.toLowerCase().includes('event') ||
                              message.toLowerCase().includes('appointment') ||
                              message.toLowerCase().includes('confirm');

    let calendarEventCreated = false;
    if (wantsCalendarEvent && config.connect_to_calendar) {
      try {
        // Extract event details from the message
        let eventTitle = 'Scheduled Event';
        let eventTime = new Date();
        
        // Extract title - look for patterns like "call [title]" or text after time/date
        const callMatch = message.match(/call\s+([^.!?]+)/i);
        const nameMatch = message.match(/name it\s+([^.!?]+)/i) || 
                         message.match(/"([^"]+)"/);
        
        if (callMatch) {
          eventTitle = callMatch[1].trim();
        } else if (nameMatch) {
          eventTitle = nameMatch[1].trim();
        }
        
        // Extract date - look for date patterns like "23 june", "june 23", etc.
        const dateMatch = message.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i) ||
                         message.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
        
        // Extract time - look for time patterns
        const timeMatch = message.match(/(\d{1,2})\s*(?:am|pm|AM|PM)/i) ||
                         message.match(/(\d{1,2}):(\d{2})\s*(?:am|pm|AM|PM)/i);
        
        if (timeMatch) {
          const hour = parseInt(timeMatch[1]);
          const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          const isAM = message.toLowerCase().includes('am');
          
          // Set time
          eventTime.setHours(isAM ? hour : (hour === 12 ? 12 : hour + 12), minute, 0, 0);
        } else {
          // Default to 9 AM
          eventTime.setHours(9, 0, 0, 0);
        }
        
        // Set date if found
        if (dateMatch) {
          const day = parseInt(dateMatch[1] || dateMatch[2]);
          const monthName = (dateMatch[2] || dateMatch[1]).toLowerCase();
          const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                         'july', 'august', 'september', 'october', 'november', 'december'];
          const month = months.indexOf(monthName);
          
          if (month !== -1) {
            eventTime.setMonth(month);
            eventTime.setDate(day);
            // If the date is in the past, assume next year
            if (eventTime < new Date()) {
              eventTime.setFullYear(eventTime.getFullYear() + 1);
            }
          }
        } else {
          // Default to tomorrow if no date specified
          eventTime.setDate(eventTime.getDate() + 1);
        }
        
        // Get user's workspace_id for proper event creation
        const { data: profile } = await supabase
          .from('profiles')
          .select('workspace_id')
          .eq('user_id', userId)
          .single();

        const workspaceId = profile?.workspace_id;

        // Create calendar event in database using admin client to bypass RLS
        const { data: newEvent, error: eventError } = await supabase
          .from('calendar_events')
            .insert({
            id: uuidv4(), // Generate UUID for primary key
            user_id: userId,
            workspace_id: workspaceId, // Include workspace_id for proper RLS
            title: eventTitle,
            description: `Created by AI automation from message: "${message}"`,
            start_time: eventTime.toISOString(),
            end_time: new Date(eventTime.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
            event_type: 'meeting'
          })
          .select()
          .single();

        if (!eventError && newEvent) {
          calendarEventCreated = true;
          console.log('📅 Calendar event created:', {
            title: eventTitle,
            time: eventTime.toISOString(),
            extracted_from: message
          });
        } else {
          console.error('❌ Calendar event creation failed:', eventError);
        }
      } catch (calendarError) {
        console.error('❌ Error creating calendar event:', calendarError);
      }
    }

    // Check for project creation nodes in the workflow and execute them
    let projectCreated = false;
    let projectCreationResults: any[] = [];
    
    // Look for project creation nodes in the workflow
    const projectCreationNodes = automationConfig.nodes?.filter((node: any) => 
      node.subtype === 'project_creation'
    ) || [];

    if (projectCreationNodes.length > 0) {
      console.log(`🔧 Found ${projectCreationNodes.length} project creation node(s) in workflow`);
      
      for (const projectNode of projectCreationNodes) {
        try {
          console.log('📋 Executing project creation node:', {
            nodeId: projectNode.id,
            nodeData: projectNode.data
          });

          // Extract project name from message or use node configuration
          let projectName = '';
          const projectNameRegex = /(?:create|new|start|make)\s+(?:a\s+)?project\s+(?:called\s+)?["']?([^"'!\n]+?)["']?(?:\s|!|$)/i;
          const projectMatch = message.match(projectNameRegex);
          
          if (projectMatch) {
            projectName = projectMatch[1].trim();
          } else {
            // Use default name if no project name found in message
            projectName = `Automated Project - ${new Date().toLocaleDateString()}`;
          }

          // Call the project creation API with authentication
          const projectCreationResponse = await fetch(`${request.nextUrl.origin}/api/automation/project-creation`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
              'Authorization': request.headers.get('authorization') || '',
            },
            body: JSON.stringify({
              workflowId: workflowId,
              nodeId: projectNode.id,
              projectName: projectName,
              projectDescription: `Created by automation from message: "${message}"`,
              projectTemplate: projectNode.data?.project_template,
              autoAssign: projectNode.data?.auto_assign !== false,
              userId: userId, // Pass userId directly for authentication
              context: {
                trigger_message: message,
                trigger_type: 'chat_automation',
                user_id: userId
              }
            })
          });

          if (projectCreationResponse.ok) {
            const projectResult = await projectCreationResponse.json();
            projectCreated = true;
            projectCreationResults.push(projectResult);
            
            console.log('✅ Project creation node executed successfully:', {
              projectId: projectResult.project?.id,
              projectName: projectResult.project?.name,
              nodeId: projectNode.id
            });
          } else {
            const errorResult = await projectCreationResponse.text();
            console.error('❌ Project creation node failed:', {
              nodeId: projectNode.id,
              error: errorResult
            });
          }
        } catch (nodeError) {
          console.error('❌ Error executing project creation node:', {
            nodeId: projectNode.id,
            error: nodeError
          });
        }
      }
    }

    // Legacy project creation logic (for backward compatibility with chatbot integration)
    if (!projectCreated && config.connect_to_projects && (
      message.toLowerCase().includes('create project') ||
      message.toLowerCase().includes('new project') ||
      message.toLowerCase().includes('start project') ||
      message.toLowerCase().includes('make project')
    )) {
      try {
        // Extract project name from the message
        const projectNameRegex = /(?:create|new|start|make)\s+(?:a\s+)?project\s+(?:called\s+)?["']?([^"'!\n]+?)["']?(?:\s|!|$)/i;
        const projectMatch = message.match(projectNameRegex);
        
        if (projectMatch) {
          const projectName = projectMatch[1].trim();
          
          // Get user's workspace_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('workspace_id, full_name')
            .eq('user_id', userId)
            .single();

          const workspaceId = profile?.workspace_id;
          
          if (workspaceId) {
            // Create project in database
            const { data: newProject, error: projectError } = await supabase
              .from('projects')
      .insert({
                name: projectName,
                description: `Created by AI automation from message: "${message}"`,
                status: 'active',
        workspace_id: workspaceId,
                user_id: userId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();

            if (!projectError && newProject) {
              projectCreated = true;
              console.log('📋 Legacy project created:', {
                name: projectName,
                id: newProject.id,
                extracted_from: message
              });
            } else {
              console.error('❌ Legacy project creation failed:', projectError);
            }
          }
        }
      } catch (projectError) {
        console.error('❌ Error creating legacy project:', projectError);
      }
    }

    // Extract thinking process from Claude response first
    let thinkingProcess: string | null = null;
    let finalResponse = aiResponse;
    
    if (isClaudeModel && aiResponse.includes('<thinking>')) {
      const thinkingMatch = aiResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
      if (thinkingMatch) {
        thinkingProcess = thinkingMatch[1].trim();
        finalResponse = aiResponse.replace(/<thinking>[\s\S]*?<\/thinking>\s*/, '').trim();
      }
    }

    // Store conversation context in automation memory
    try {
      const conversationEntry = {
        timestamp: new Date().toISOString(),
        user_message: message,
        ai_response: finalResponse, // Use final response without thinking tags
        model: config.chatbot_model,
        calendar_event_created: calendarEventCreated,
        project_created: projectCreated,
        project_creation_results: projectCreationResults,
        thinking_process: thinkingProcess,
        context: {
          projects: config.connect_to_projects,
          calendar: config.connect_to_calendar,
          reasoning: config.connect_to_reasoning
        }
      };

      // Get user's workspace_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('user_id', userId)
        .single();

      if (profile?.workspace_id) {
        // Store in automation memory for conversation context
        const memoryResponse = await fetch(`${request.nextUrl.origin}/api/automation/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: profile.workspace_id,
            workflow_id: workflowId,
            memory_key: 'conversation_context',
            memory_value: conversationEntry,
            operation: 'append', // Append to existing conversation history
            expires_in_hours: 24 // Keep conversation context for 24 hours
          })
        });

        if (memoryResponse.ok) {
          console.log('💾 Conversation context stored in automation memory');
        } else {
          console.error('❌ Failed to store conversation context:', await memoryResponse.text());
        }
      }
    } catch (memoryError) {
      console.error('❌ Error storing conversation context:', memoryError);
    }

    // Log the interaction
    await supabase.from('automation_logs').insert({
      user_id: userId,
      workflow_id: workflowId,
      event_type: 'chatbot_interaction',
      message: `User: ${message}\nAI: ${aiResponse}`,
      metadata: {
        model: config.chatbot_model,
        context_included: {
          projects: config.connect_to_projects,
          calendar: config.connect_to_calendar,
          reasoning: config.connect_to_reasoning
        }
      }
    });

    console.log('✅ Chat response generated successfully');

    // Prepare response data
    const responseData: any = {
      success: true,
      response: finalResponse,
      model: config.chatbot_model,
      calendar_event_created: calendarEventCreated,
      project_created: projectCreated,
      project_creation_results: projectCreationResults,
      thinking_process: thinkingProcess,
      context: {
        projects_connected: config.connect_to_projects,
        calendar_connected: config.connect_to_calendar,
        reasoning_connected: config.connect_to_reasoning
      }
    };

    // Add reasoning info for different model types
    if (isO1Model && completion.usage?.completion_tokens_details?.reasoning_tokens) {
      responseData.reasoning_tokens = completion.usage.completion_tokens_details.reasoning_tokens;
      responseData.total_tokens = completion.usage.completion_tokens;
    } else if (isClaudeModel && completion.usage) {
      responseData.reasoning = {
        model: modelName,
        input_tokens: completion.usage.input_tokens,
        output_tokens: completion.usage.output_tokens,
        total_tokens: completion.usage.input_tokens + completion.usage.output_tokens,
        has_thinking_process: !!thinkingProcess,
        thinking_length: thinkingProcess?.length || 0,
        context_analysis: {
          system_instructions_length: systemInstructions.length,
          context_data_length: contextData.length,
          projects_connected: config.connect_to_projects,
          calendar_connected: config.connect_to_calendar,
          reasoning_connected: config.connect_to_reasoning,
          template_variables_processed: contextData.includes('Kevin Negash'),
          has_active_projects: contextData.includes('ACTIVE PROJECTS'),
          has_calendar_events: contextData.includes('UPCOMING CALENDAR EVENTS'),
          has_ai_analysis: contextData.includes('RECENT AI ANALYSIS')
        }
      };
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Chat trigger error:', error);
    return NextResponse.json({ 
        error: 'Failed to process chat trigger',
        details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Chat Trigger API is running',
    timestamp: new Date().toISOString(),
    available_endpoints: [
      'POST /api/automation/chat-trigger - Process chatbot interactions'
    ]
  });
} 