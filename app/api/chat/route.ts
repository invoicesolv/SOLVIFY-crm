import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from 'next-auth/next'; // Import getServerSession
import authOptions from '@/lib/auth'; // Import your authOptions
import { createClient } from '@supabase/supabase-js'; // Import Supabase client
import { Session } from 'next-auth'; // Import Session type
import { getActiveWorkspaceId } from '@/lib/permission'; // Import workspace helper
import { supabase, supabaseAdmin } from '@/lib/supabase'; // Import supabase clients

export const dynamic = 'force-dynamic';

// Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local
// These are still needed for basic client configuration, but auth will use the user's token.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Check if Supabase environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is not set in environment variables.');
  // Optionally throw an error or handle this case appropriately
}

export async function POST(req: NextRequest) {
  // Get session from NextAuth
  const session = await getServerSession(authOptions);
  
  console.log('[Chat API] Session check', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
  });
  
  if (!session || !session.user) {
    console.error('[Chat API] No session or user');
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // IMPORTANT: Sync NextAuth session with Supabase
  // This ensures RLS policies work correctly
  try {
    // Create server supabase client with admin rights to get all workspace settings
    const adminSettings = await supabaseAdmin
      .from('workspace_settings')
      .select('id, openai_api_key, workspace_id')
      .maybeSingle();
      
    if ((session as any).access_token) {
      // Authenticate with Supabase using the token from NextAuth
      const { error: authError } = await supabase.auth.setSession({
        access_token: (session as any).access_token,
        refresh_token: (session as any).refresh_token || "",
      });
      
      if (authError) {
        console.error('[Chat API] Failed to sync Supabase session:', authError);
        
        // If token is invalid, try getting user by email as fallback
        if (authError.message?.includes('Invalid JWT') || authError.message?.includes('JWT expired')) {
          console.log('[Chat API] JWT invalid, using email-based fallback');
        }
      } else {
        console.log('[Chat API] Successfully synced Supabase session');
  
        // Verify session sync worked by checking user
        const { data: { user } } = await supabase.auth.getUser();
        console.log('[Chat API] Auth user check:', {
          hasUser: !!user,
          authUserId: user?.id,
          matchesSession: user?.id === session.user.id
        });
      }
    } else {
      console.log('[Chat API] No access token in session, using alternative authentication');
    }
  } catch (syncError) {
    console.error('[Chat API] Error syncing session:', syncError);
  }
  
  // Get active workspace ID (potentially modified from original code)
  let workspaceId: string | null = null;
  try {
  if (session.user.id) {
      workspaceId = await getActiveWorkspaceId(session.user.id);
    } else {
      console.log('[Chat API] No user ID available in session');
    }
  } catch (error) {
    console.error('[Chat API] Error getting active workspace ID:', error);
  }
  
  // --- Debug Logging ---
  console.log(`[API Chat] Active workspace ID: ${workspaceId}`);
  
  const activeWsId = workspaceId; // Keep original for logging
  
  // Fallback to looking up workspace by email if no active workspace found
  if (!workspaceId && session.user.email) {
    const { data: emailMemberships } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('email', session.user.email)
      .limit(1);
    console.log(`[API Chat] Result from email lookup: ${emailMemberships?.[0]?.workspace_id}`);
    
    // Set workspaceId from the lookup
    if (emailMemberships && emailMemberships.length > 0) {
      workspaceId = emailMemberships[0].workspace_id;
    }
  }
  // --- End Logging ---
  
  // If still no workspace found, return error
  if (!workspaceId) {
    console.error('[Chat API] No active workspace found', {
      userId: session.user.id,
      userEmail: session.user.email,
      activeWorkspaceResult: activeWsId 
    });
    return NextResponse.json({ error: 'No active workspace found. Please create or join a workspace first.' }, { status: 403 });
  }
  
  try {
    const { messages } = await req.json(); // Removed apiKey extraction
    
    console.log('[Chat API] Processing request for workspace', {
      workspaceId,
      messageCount: messages?.length || 0
    });
    
    // Special case for API key check only requests
    const isApiKeyCheckOnly = messages.length === 1 && 
                            messages[0].role === 'system' && 
                            messages[0].content === 'API_KEY_CHECK_ONLY';
    
    if (isApiKeyCheckOnly) {
      console.log('[Chat API] Processing API key check only request');
    }
    
    // --- Fetch API key from Database ---
    console.log('[Chat API] Fetching API key from workspace_settings');
    
    // RELIABLE METHOD: Use admin client to bypass RLS issues
    console.log('[Chat API] Using admin client for API key lookup');
    const { data: adminSettings, error: adminError } = await supabaseAdmin
      .from('workspace_settings')
      .select('id, openai_api_key, workspace_id, created_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
      
    console.log('[Chat API] Admin client result:', {
      hasData: !!adminSettings,
      hasKey: !!adminSettings?.openai_api_key,
      keyLength: adminSettings?.openai_api_key?.length || 0,
      error: adminError ? adminError.message : null
    });
    
    if (adminError) {
      console.error('[Chat API] Admin client error:', adminError);
      return NextResponse.json({ 
        error: 'Database error: Could not retrieve workspace settings.',
        details: adminError,
        code: 'DB_SETTINGS_ERROR'
      }, { status: 500 });
    }
    
    if (!adminSettings?.openai_api_key) {
      console.error('[Chat API] No API key found for workspace', { 
        workspaceId,
        hasSettings: !!adminSettings
      });
      return NextResponse.json({ 
        error: 'OpenAI API key not set for this workspace. Please configure it in settings.',
        code: 'API_KEY_MISSING',
        workspaceId: workspaceId 
      }, { status: 400 });
    }
    
    const dbApiKey = adminSettings.openai_api_key;
    console.log('[Chat API] API key status', {
      workspaceId,
      keyExists: !!dbApiKey,
      keyLength: dbApiKey ? dbApiKey.length : 0,
      keyStartsWith: dbApiKey ? dbApiKey.substring(0, 3) : 'N/A'
    });

    if (!dbApiKey) {
      console.error('[Chat API] No API key found for workspace', { 
        workspaceId,
        settings: adminSettings
      });
      return NextResponse.json({ 
        error: 'OpenAI API key not set for this workspace. Please configure it in settings.',
        code: 'API_KEY_MISSING',
        workspaceId: workspaceId 
      }, { status: 400 });
    }
    
    // Check if it's either a standard API key (sk-...) or a project-scoped key (sk-proj-...)
    const isValidKeyFormat = 
      (dbApiKey.startsWith('sk-') && dbApiKey.length >= 30) || 
      (dbApiKey.startsWith('sk-proj-') && dbApiKey.length >= 40) ||
      (dbApiKey.startsWith('sk-org-') && dbApiKey.length >= 40);
      
    if (!isValidKeyFormat) {
      console.error('[Chat API] Invalid API key format', {
        workspaceId,
        keyStartsWith: dbApiKey.substring(0, 7),
        keyLength: dbApiKey.length
      });
      return NextResponse.json({ 
        error: 'Invalid OpenAI API key format. API keys should start with "sk-", "sk-proj-", or "sk-org-" and be properly formatted.',
        code: 'API_KEY_INVALID_FORMAT',
        workspaceId: workspaceId
      }, { status: 400 });
    }
    
    // For API key check only requests, return success now - no need to call OpenAI
    if (isApiKeyCheckOnly) {
      return NextResponse.json({ 
        message: 'API key exists and has valid format',
        status: 'success'
      }, { status: 200 });
    }
    // --- End Fetch API Key ---
    
    console.log('[Chat API] Creating OpenAI client');
    const openai = new OpenAI({
      apiKey: dbApiKey, // Use key fetched from DB
    });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [
        {
          role: 'system',
          content: 'You are Axel, an assistant for a CRM and invoicing application. Always greet the user by name when starting a conversation. Help users manage customers, projects, and invoices.\n\n' +
          'You can help users with the following actions:\n' +
          '- Search for projects by name or client name\n' +
          '- Search for customers by name\n' +
          '- Search for tasks in project_tasks by project name or get all tasks for a specific project\n' +
          '- Create new tasks in projects (just ask for task title, project, and optional status/due date)\n' +
          '- Create new projects (just ask for project name and optional client/description)\n\n' + 
          'Before calling a function to search or create database records, briefly explain what you are looking for and why. Always format your responses with dark mode in mind, using high contrast text that is visible on dark backgrounds. Use markdown formatting for better readability.',
        },
        // Add a greeting message if this is the start of a conversation
        ...(messages.length === 1 && messages[0].role === 'user' ? [{
          role: 'assistant',
          content: `Hello ${session.user.name || 'there'}! I'm Axel, your CRM assistant. How can I help you today?`
        }] : []),
        ...messages,
      ],
      functions: [
        {
          name: 'getWorkspace',
          description: 'Get information about the current workspace',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'searchProjects',
          description: 'Search for projects in the workspace',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query for finding projects by name'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'searchTasks',
          description: 'Search for tasks in project_tasks table',
          parameters: {
            type: 'object',
            properties: {
              projectId: {
                type: 'string',
                description: 'The project ID to search tasks in (if known)'
              },
              projectName: {
                type: 'string',
                description: 'The project name to search tasks in (will be used to find projectId)'
              },
              query: {
                type: 'string',
                description: 'The search query for finding tasks by title. Used if no projectId/projectName is provided.'
              }
            },
            required: []
          }
        },
        {
          name: 'createTask',
          description: 'Create a new task in a project',
          parameters: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'The title of the task'
              },
              projectId: {
                type: 'string',
                description: 'The ID of the project to create the task in (if known)'
              },
              projectName: {
                type: 'string',
                description: 'The name of the project to create the task in (will be used to find projectId)'
              },
              status: {
                type: 'string',
                description: 'The status of the task (e.g., "To Do", "In Progress", "Completed")',
                enum: ['To Do', 'In Progress', 'Completed', 'Pending', 'pending', 'completed', 'to_do', 'in_progress']
              },
              dueDate: {
                type: 'string',
                description: 'Due date for the task in YYYY-MM-DD format'
              }
            },
            required: ['title']
          }
        },
        {
          name: 'createProject',
          description: 'Create a new project in the workspace',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name of the project'
              },
              customerName: {
                type: 'string',
                description: 'Optional client/customer name for the project'
              },
              description: {
                type: 'string',
                description: 'Optional description of the project'
              },
              status: {
                type: 'string',
                description: 'The status of the project (e.g., "Active", "Completed", "On Hold")'
              }
            },
            required: ['name']
          }
        },
        {
          name: 'searchCustomers',
          description: 'Search for customers in the database',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
            },
            required: ['query'],
          },
        },
      ],
    });
    
    // Create a ReadableStream from the OpenAI response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        // Process the response
        try {
          for await (const chunk of response) {
            // Check if this is a function call
            if (chunk.choices[0]?.delta?.function_call) {
              const functionCall = chunk.choices[0].delta.function_call;
              
              // If this is the beginning of a function call, capture the name
              if (functionCall.name) {
                // Handle the complete function call when finished
                if (functionCall.name === 'searchProjects') {
                  // --- Fetch Projects from Supabase ---
                  console.log('[Chat API] Searching for projects with query:', JSON.parse(functionCall.arguments || '{}').query);
                  
                  // Use admin client to bypass RLS
                  const { data: projects, error: projectError } = await supabaseAdmin
                    .from('projects')
                    .select('id, name, customer_name, status, description')
                    .eq('workspace_id', workspaceId) // Filter by current workspace
                    .or(`name.ilike.%${JSON.parse(functionCall.arguments || '{}').query || ''}%,customer_name.ilike.%${JSON.parse(functionCall.arguments || '{}').query || ''}%`) // Match name OR customer_name
                    .limit(10); // Limit results
                    
                  console.log('[Chat API] Projects search result:', {
                    query: JSON.parse(functionCall.arguments || '{}').query,
                    foundCount: projects?.length || 0,
                    error: projectError?.message
                  });

                  if (projectError) {
                    console.error('Supabase project search error:', projectError);
                    controller.enqueue(encoder.encode('Error searching projects.'));
                    continue;
                  }

                  let responseText = 'No projects found matching your query.';
                  if (projects && projects.length > 0) {
                    responseText = `Here are the projects matching your query:\n\n`;
                    const formattedList = projects.map(p => `- **${p.name}** ${p.customer_name ? `(Client: ${p.customer_name})` : ''}\n  ${p.status ? `Status: ${p.status}` : ''} ${p.description ? `\n  ${p.description.substring(0, 100)}${p.description.length > 100 ? '...' : ''}` : ''}`).join('\n\n');
                    responseText += formattedList;
                  }
                  controller.enqueue(encoder.encode(responseText));
                  continue; // Skip normal processing
                  // --- End Supabase Project Fetch ---
                }
                
                if (functionCall.name === 'searchTasks') {
                  // --- Fetch Tasks from Supabase ---
                  const args = JSON.parse(functionCall.arguments || '{}');
                  console.log('[Chat API] Searching for tasks with args:', args);
                  
                  // Prepare for project search if needed
                  let projectId = args.projectId;
                  let projectName = args.projectName || '';
                  
                  // Define interface for our combined task type
                  interface CombinedTask {
                    id: string;
                    title: string;
                    status: string;
                    due_date?: string;
                    progress?: number;
                    checklist?: any[];
                    created_at: string;
                    project_id?: string;
                    project_name?: string;
                    description?: string;
                    source: 'Project Tasks';
                  }
                  
                  // If projectName is provided but not projectId, search for the project first
                  if (!projectId && projectName) {
                    console.log('[Chat API] Looking up project by name:', projectName);
                    const { data: projects } = await supabaseAdmin
                      .from('projects')
                      .select('id, name')
                      .eq('workspace_id', workspaceId)
                      .ilike('name', `%${projectName}%`)
                      .limit(1);
                      
                    if (projects && projects.length > 0) {
                      projectId = projects[0].id;
                      console.log('[Chat API] Found project:', projects[0].name, 'ID:', projectId);
                    }
                  }
                  
                  // Get tasks (only from project_tasks table)
                  let allTasks: CombinedTask[] = [];
                  let errorMessages: string[] = [];
                  
                  // Query the project_tasks table
                  console.log('[Chat API] Querying project_tasks table');
                  let projectTasksQuery = supabaseAdmin
                    .from('project_tasks')
                    .select('id, title, status, due_date, progress, checklist, created_at, project_id, projects(name)');
                    
                  // Log queries and structure for debugging
                  console.log('[Chat API] DEBUG: Query structure:', projectTasksQuery.toString());
                    
                  // Apply filters based on what was provided
                  if (projectId) {
                    projectTasksQuery = projectTasksQuery.eq('project_id', projectId);
                  } else if (args.query) {
                    projectTasksQuery = projectTasksQuery.ilike('title', `%${args.query}%`);
                  }
                  
                  const { data: projectTasks, error: projectTasksError } = await projectTasksQuery
                    .limit(20)
                    .order('created_at', { ascending: false });
                  
                  // Debug output
                  console.log('[Chat API] DEBUG: Project tasks result:', {
                    found: projectTasks?.length || 0,
                    error: projectTasksError?.message || null,
                    firstTask: projectTasks?.[0] || null
                  });

                  if (projectTasksError) {
                    console.error('Supabase project_tasks search error:', projectTasksError);
                    errorMessages.push(`Error searching project_tasks: ${projectTasksError.message}`);
                  } else if (projectTasks) {
                    console.log(`[Chat API] Found ${projectTasks.length} tasks in project_tasks`);
                    
                    // Format project tasks
                    const formattedProjectTasks = projectTasks.map(t => ({
                      id: t.id,
                      title: t.title,
                      status: t.status || 'Not set',
                      due_date: t.due_date,
                      progress: t.progress || 0,
                      checklist: t.checklist,
                      created_at: t.created_at,
                      project_id: t.project_id,
                      project_name: t.projects?.name || null,
                      source: 'Project Tasks'
                    }));
                    
                    allTasks = [...allTasks, ...formattedProjectTasks];
                  }
                  
                  console.log('[Chat API] Tasks search result:', {
                    projectId,
                    projectName,
                    query: args.query,
                    foundCount: allTasks.length,
                    errors: errorMessages.length > 0 ? errorMessages : null
                  });

                  if (errorMessages.length > 0) {
                    controller.enqueue(encoder.encode('Encountered errors while searching tasks: ' + errorMessages.join(', ')));
                    continue;
                  }

                  // Handle the response formatting
                  if (allTasks.length === 0) {
                    // No tasks found
                    const noTasksMsg = projectName 
                      ? `No tasks found for project "${projectName}".` 
                      : args.query 
                        ? `No tasks found matching "${args.query}".`
                        : "No tasks found. Your task list is empty.";
                        
                    controller.enqueue(encoder.encode(noTasksMsg));
                  } else {
                    // Format and return tasks
                    const title = projectName 
                      ? `**${projectName}**` 
                      : projectId ? '**this project**' : 'your workspace';
                    
                    // Generate formatting options to show the user
                    
                    // Option 1: Enhanced Markdown with Emojis and Progress Bars
                    let responseText = `Here are the tasks for ${title}:\n\n`;
                    
                    const formattedList = allTasks.map(t => {
                      // Format progress bar with 10 characters if progress is set
                      const progressBar = t.progress !== undefined && t.progress > 0 ? 
                        `[${'█'.repeat(Math.floor(t.progress/10))}${' '.repeat(10-Math.floor(t.progress/10))}] ${t.progress}%` :
                        '';
                      
                      // Get status emoji
                      const statusEmoji = 
                        t.status?.toLowerCase().includes('complete') ? '✅' :
                        t.status?.toLowerCase().includes('progress') ? '🔄' :
                        t.status?.toLowerCase().includes('pending') ? '⏳' :
                        t.status?.toLowerCase().includes('to do') ? '📋' : '🔶';
                      
                      // Format checklist items if they exist
                      let checklistText = '';
                      if (t.checklist && Array.isArray(t.checklist) && t.checklist.length > 0) {
                        const completedItems = t.checklist.filter(item => item.checked).length;
                        checklistText = `\n  📋 Checklist: ${completedItems}/${t.checklist.length} completed`;
                      }
                      
                      // Format due date if it exists
                      const dueDate = t.due_date ? `\n  📅 Due: ${new Date(t.due_date).toLocaleDateString()}` : '';
                      
                      // Include project name if we're not filtered to a specific project
                      const projectInfo = (!projectId && t.project_name) ? `\n  🏢 Project: ${t.project_name}` : '';
                      
                      return `- ${statusEmoji} **${t.title}**\n  Status: ${t.status} ${progressBar}${dueDate}${projectInfo}${checklistText}`;
                    }).join('\n\n');
                    
                    responseText += formattedList;
                    
                    // Add a summary of task statuses with emojis
                    const statusCounts: Record<string, number> = allTasks.reduce((acc: Record<string, number>, task) => {
                      const status = task.status || 'Not set';
                      acc[status] = (acc[status] || 0) + 1;
                      return acc;
                    }, {});
                    
                    responseText += '\n\n**Summary:**\n';
                    for (const [status, count] of Object.entries(statusCounts)) {
                      // Get emoji for status
                      const statusEmoji = 
                        status.toLowerCase().includes('complete') ? '✅' :
                        status.toLowerCase().includes('progress') ? '🔄' :
                        status.toLowerCase().includes('pending') ? '⏳' :
                        status.toLowerCase().includes('to do') ? '📋' : '🔶';
                      
                      responseText += `- ${statusEmoji} ${status}: ${count} task${count > 1 ? 's' : ''}\n`;
                    }
                    
                    // Option 2: Table format
                    responseText += '\n\n**Alternative Table Format:**\n\n';
                    responseText += '| Status | Task | Progress | Project |\n';
                    responseText += '|--------|------|----------|--------|\n';
                    
                    allTasks.slice(0, 5).forEach(t => {
                      const statusEmoji = 
                        t.status?.toLowerCase().includes('complete') ? '✅' :
                        t.status?.toLowerCase().includes('progress') ? '🔄' :
                        t.status?.toLowerCase().includes('pending') ? '⏳' :
                        t.status?.toLowerCase().includes('to do') ? '📋' : '🔶';
                        
                      const progress = t.progress !== undefined ? `${t.progress}%` : '-';
                      const project = t.project_name || '-';
                      
                      responseText += `| ${statusEmoji} ${t.status} | ${t.title} | ${progress} | ${project} |\n`;
                    });
                    if (allTasks.length > 5) {
                      responseText += '| ... | ... | ... | ... |\n';
                    }
                    
                    // Option 3: Card-like format
                    responseText += '\n\n**Card Format Example:**\n\n';
                    
                    // Show first 3 tasks in card format
                    allTasks.slice(0, 3).forEach(t => {
                      const statusEmoji = 
                        t.status?.toLowerCase().includes('complete') ? '✅' :
                        t.status?.toLowerCase().includes('progress') ? '🔄' :
                        t.status?.toLowerCase().includes('pending') ? '⏳' :
                        t.status?.toLowerCase().includes('to do') ? '📋' : '🔶';
                        
                      responseText += `┌─────────────────────────────┐\n`;
                      responseText += `│ ${statusEmoji} ${t.title.padEnd(24).substring(0, 24)} │\n`;
                      responseText += `├─────────────────────────────┤\n`;
                      responseText += `│ Status: ${t.status.padEnd(19).substring(0, 19)} │\n`;
                      if (t.progress !== undefined) {
                        responseText += `│ Progress: ${t.progress}%${' '.repeat(17 - String(t.progress).length)} │\n`;
                      }
                      if (t.project_name) {
                        responseText += `│ Project: ${t.project_name.padEnd(18).substring(0, 18)} │\n`;
                      }
                      responseText += `└─────────────────────────────┘\n\n`;
                    });
                    
                    // Add note about which format the user prefers
                    responseText += '\nYou can ask me to show your tasks in any of these formats, or I can create a custom view based on what information is most important to you.';
                    
                    controller.enqueue(encoder.encode(responseText));
                  }
                  continue;
                  // --- End Supabase Task Fetch ---
                }
                
                if (functionCall.name === 'searchCustomers') {
                  // --- Fetch Customers from Supabase ---
                  console.log('[Chat API] Searching for customers with query:', JSON.parse(functionCall.arguments || '{}').query);
                  
                  // Use admin client to bypass RLS
                  const { data: customers, error: customerError } = await supabaseAdmin
                    .from('customers')
                    .select('id, name, created_at')
                    .eq('workspace_id', workspaceId) // Filter by current workspace
                    .ilike('name', `%${JSON.parse(functionCall.arguments || '{}').query || ''}%`) // Use query from function call
                    .limit(10); // Limit results

                  console.log('[Chat API] Customers search result:', {
                    query: JSON.parse(functionCall.arguments || '{}').query,
                    foundCount: customers?.length || 0,
                    error: customerError?.message
                  });

                  if (customerError) {
                    console.error('Supabase customer search error:', customerError);
                    controller.enqueue(encoder.encode('Error searching customers.'));
                    continue;
                  }

                  let responseText = 'No customers found matching your query.';
                  if (customers && customers.length > 0) {
                    responseText = `Here are the customers matching your query:\n\n`;
                    const formattedList = customers.map(c => `- **${c.name}**\n  Added: ${new Date(c.created_at).toLocaleDateString()}`).join('\n\n');
                    responseText += formattedList;
                  }
                  controller.enqueue(encoder.encode(responseText));
                  continue; // Skip normal processing
                  // --- End Supabase Customer Fetch ---
                }
                
                if (functionCall.name === 'createTask') {
                  // --- Create Task in Supabase ---
                  let args;
                  // Capture the raw arguments string for debugging
                  const rawArgString = functionCall.arguments || '';
                  console.log('[Chat API] Raw function arguments:', rawArgString);
                  
                  // Initialize variables for extraction
                  let taskTitle = '';
                  let projectName = '';
                  
                  // Try parsing arguments normally first
                  try {
                    args = JSON.parse(rawArgString || '{}');
                    console.log('[Chat API] Parsed args object:', JSON.stringify(args));
                    
                    // Check if we have a title directly from the parsed JSON
                    if (args.title) {
                      taskTitle = args.title.trim();
                      console.log('[Chat API] Title from parsed JSON:', taskTitle);
                    }
                    
                    // Check if we have a project name
                    if (args.projectName) {
                      projectName = args.projectName.trim();
                    } else if (args.projectId) {
                      projectName = 'project with ID ' + args.projectId;
                    }
                  } catch (e) {
                    console.error('[Chat API] Error parsing function arguments:', e);
                    args = {};
                  }
                  
                  // Try to extract from the user's message directly
                  if (!taskTitle) {
                    try {
                      // Check if we can get the last user message
                      const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content;
                      console.log('[Chat API] Last user message:', lastUserMsg);
                      
                      if (lastUserMsg) {
                        // Try to extract title from direct user message
                        const msgTitleMatches = [
                          lastUserMsg.match(/titled\s+["']?([^"'\n]+?)["']?\s+in\s+project/i),
                          lastUserMsg.match(/create\s+a\s+task\s+titled\s+["']?([^"'\n]+?)["']?\s+/i),
                          lastUserMsg.match(/task\s+titled\s+["']?([^"'\n]+?)["']?/i),
                          lastUserMsg.match(/title\s+is\s+["']?([^"'\n]+?)["']?/i),
                          lastUserMsg.match(/Task Title[:]?\s+([^\n,]+)/)
                        ];
                        
                        // Use the first successful match
                        for (const match of msgTitleMatches) {
                          if (match && match[1]) {
                            taskTitle = match[1].trim();
                            console.log('[Chat API] Title extracted from user message:', taskTitle);
                            break;
                          }
                        }
                        
                        // Also try to extract project name
                        if (!projectName) {
                          const projectMatches = [
                            lastUserMsg.match(/in\s+project\s+["']?([^"'\n]+?)["']?/i),
                            lastUserMsg.match(/for\s+["']?([^"'\n]+?)["']?/i),
                            lastUserMsg.match(/Project[:]?\s+([^\n,]+)/)
                          ];
                          
                          for (const pMatch of projectMatches) {
                            if (pMatch && pMatch[1]) {
                              projectName = pMatch[1].trim();
                              console.log('[Chat API] Project extracted from user message:', projectName);
                              break;
                            }
                          }
                        }
                        
                        // Specific case for common titles mentioned
                        if (!taskTitle) {
                          if (lastUserMsg.includes('Google Ads Campagin')) {
                            taskTitle = 'Google Ads Campagin';
                          } else if (lastUserMsg.includes('Google Ads Campaign')) {
                            taskTitle = 'Google Ads Campaign';
                          } else if (lastUserMsg.includes('Google Ads')) {
                            taskTitle = 'Google Ads';
                          }
                        }
                        
                        // Also check for specific projects
                        if (!projectName) {
                          if (lastUserMsg.includes('Solvify')) {
                            projectName = 'Solvify';
                          }
                        }
                      }
                    } catch (e) {
                      console.error('[Chat API] Error checking user messages:', e);
                    }
                  }
                  
                  // Try to extract from function arguments as last resort
                  if (!taskTitle) {
                    // Try various regex patterns to extract the title from raw arguments
                    const argTitleMatches = [
                      rawArgString.match(/"title"\s*:\s*"([^"]+)"/),
                      rawArgString.match(/title['"]?\s*:\s*['"]([^'"]+)['"]/),
                      rawArgString.match(/Title is "(.*?)"/),
                      rawArgString.match(/Task Title[:]?\s+([^\n,]+)/),
                      // More patterns
                      rawArgString.match(/titled\s+["']?([^"'\n]+?)["']?\s+in\s+project/i),
                      rawArgString.match(/create\s+a\s+task\s+titled\s+["']?([^"'\n]+?)["']?\s+/i),
                      rawArgString.match(/task\s+titled\s+["']?([^"'\n]+?)["']?/i)
                    ];
                    
                    // Use the first successful match
                    for (const match of argTitleMatches) {
                      if (match && match[1]) {
                        taskTitle = match[1].trim();
                        console.log('[Chat API] Title extracted from function args:', taskTitle);
                        break;
                      }
                    }
                  }
                  
                  // Check if we have a project name
                  if (rawArgString.includes('projectName')) {
                    projectName = rawArgString.match(/projectName\s*:\s*["']?([^"'\n]+?)["']?/i)?.[1].trim() || '';
                  } else if (rawArgString.includes('projectId')) {
                    projectName = 'project with ID ' + rawArgString.match(/projectId\s*:\s*["']?([^"'\n]+?)["']?/i)?.[1].trim();
                  }
                  
                  // Set the args object with our extracted values
                  if (taskTitle && !args.title) {
                    if (typeof args !== 'object') args = {};
                    args.title = taskTitle;
                  }
                  
                  if (projectName && !args.projectName) {
                    if (typeof args !== 'object') args = {};
                    args.projectName = projectName;
                  }
                  
                  // Debug what we have so far
                  console.log('[Chat API] Task creation with enhanced extraction:', {
                    extractedTitle: taskTitle,
                    extractedProject: projectName,
                    finalArgs: args
                  });
                  
                  // Validate required fields
                  if (!args.title || args.title.trim() === '') {
                    console.log('[Chat API] Task creation missing title after all extraction attempts');
                    controller.enqueue(encoder.encode('Sorry, I could not determine the task title. Please specify the task title clearly by saying something like "Create a task titled X in project Y."'));
                    continue;
                  }
                  
                  let projectId = args.projectId;
                  let errorMessage = '';
                  
                  // If projectName is provided but not projectId, search for the project first
                  if (!projectId && projectName) {
                    console.log('[Chat API] Looking up project by name:', projectName);
                    const { data: projects } = await supabaseAdmin
                      .from('projects')
                      .select('id, name')
                      .eq('workspace_id', workspaceId)
                      .ilike('name', `%${projectName}%`)
                      .limit(1);
                      
                    if (projects && projects.length > 0) {
                      projectId = projects[0].id;
                      console.log('[Chat API] Found project:', projects[0].name, 'ID:', projectId);
                    } else {
                      errorMessage = `Could not find a project matching "${projectName}". Please try again with a different project name or create the project first.`;
                    }
                  }
                  
                  // No project specified, find if there's a default one
                  if (!projectId && !projectName) {
                    const { data: defaultProject } = await supabaseAdmin
                    .from('projects')
                      .select('id, name')
                      .eq('workspace_id', workspaceId)
                      .limit(1);
                      
                    if (defaultProject && defaultProject.length > 0) {
                      projectId = defaultProject[0].id;
                      projectName = defaultProject[0].name;
                      console.log('[Chat API] Using default project:', defaultProject[0].name);
                    } else {
                      errorMessage = 'No project specified and no projects found in workspace. Please create a project first or specify a project name.';
                    }
                  }
                  
                  if (errorMessage) {
                    controller.enqueue(encoder.encode(errorMessage));
                    continue;
                  }

                  // Format status correctly
                  let status = args.status || 'To Do';
                  if (status.toLowerCase() === 'to do') status = 'to_do';
                  if (status.toLowerCase() === 'in progress') status = 'in_progress';
                  
                  // Format due date if provided in non-standard format
                  let dueDate = args.dueDate;
                  if (dueDate && dueDate.includes('/')) {
                    // Convert from YYYY/MM/DD to YYYY-MM-DD
                    dueDate = dueDate.replace(/\//g, '-');
                  }
                  
                  // Debug task data
                  const taskData = {
                    title: args.title.trim(),
                    project_id: projectId,
                    workspace_id: workspaceId,
                    status: status.toLowerCase(),
                    due_date: dueDate || null,
                    created_at: new Date().toISOString(),
                    progress: 0
                  };
                  
                  console.log('[Chat API] Task data to insert:', taskData);
                  
                  // Create the task
                  const { data: newTask, error: createError } = await supabaseAdmin
                    .from('project_tasks')
                    .insert(taskData)
                    .select('id, title')
                    .single();
                    
                  if (createError) {
                    console.error('[Chat API] Error creating task:', createError);
                    controller.enqueue(encoder.encode(`Error creating task: ${createError.message}`));
                    continue;
                  }

                  // Success response
                  controller.enqueue(encoder.encode(`✅ Task "${newTask.title}" created successfully in project "${projectName || 'Unknown'}".\n\nYou may need to refresh the page to see the new task in your project view. The task has been saved to the database and will appear in your task list.`));
                  continue;
                  // --- End Create Task ---
                }
                
                if (functionCall.name === 'createProject') {
                  // --- Create Project in Supabase ---
                  let args;
                  try {
                    args = JSON.parse(functionCall.arguments || '{}');
                    console.log('[Chat API] Creating project with args:', args);
                  } catch (e) {
                    console.error('[Chat API] Error parsing function arguments:', e);
                    controller.enqueue(encoder.encode('Error parsing project data. Please try again with valid information.'));
                    continue;
                  }

                  // Validate required fields
                  if (!args.name || args.name.trim() === '') {
                    controller.enqueue(encoder.encode('Error: Project name is required. Please provide a name for the project.'));
                    continue;
                  }

                  // Debug project data
                  const projectData = {
                    name: args.name.trim(),
                    customer_name: args.customerName || null,
                    description: args.description || null,
                    status: args.status || 'Active',
                    workspace_id: workspaceId,
                    created_at: new Date().toISOString(),
                  };
                  
                  console.log('[Chat API] Project data to insert:', projectData);
                  
                  // Create the project
                  const { data: newProject, error: createError } = await supabaseAdmin
                    .from('projects')
                    .insert(projectData)
                    .select('id, name')
                    .single();
                    
                  if (createError) {
                    console.error('[Chat API] Error creating project:', createError);
                    controller.enqueue(encoder.encode(`Error creating project: ${createError.message}`));
                    continue;
                  }
                  
                  // Success response
                  controller.enqueue(encoder.encode(`✅ Project "${newProject.name}" created successfully. You can now add tasks to this project.\n\nYou may need to refresh the page to see the new project in your projects view. The project has been saved to the database and will appear in your project list.`));
                  continue;
                  // --- End Create Project ---
                }
              }
            }
            
            // Regular content processing
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error) {
          console.error('Error processing stream:', error);
          controller.error(error);
        }
        
        controller.close();
      }
    });
    
    return new Response(stream);
  } catch (error) {
    console.error('[CHAT ERROR]', error);
    return NextResponse.json({ error: 'An error occurred during the request.' }, { status: 500 });
  }
} 