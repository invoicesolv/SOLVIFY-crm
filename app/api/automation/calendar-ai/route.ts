import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import OpenAI from 'openai';
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { action, workflowId, userId, data } = await request.json();

    console.log('📅 Smart Calendar AI triggered:', { action, workflowId, userId });

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

    // Find smart calendar node
    const calendarNode = automationConfig.nodes?.find((node: any) => 
      node.subtype === 'smart_calendar'
    );

    if (!calendarNode) {
      console.error('❌ No smart calendar node found');
      return NextResponse.json({ error: 'No calendar configuration' }, { status: 400 });
    }

    const config = calendarNode.data;
    console.log('🔧 Calendar config:', config);

    let result: any = {};

    switch (action) {
      case 'create_event':
        result = await createSmartEvent(config, data, userId, supabase);
        break;
      case 'analyze_schedule':
        result = await analyzeSchedule(config, userId, supabase);
        break;
      case 'suggest_times':
        result = await suggestMeetingTimes(config, data, userId, supabase);
        break;
      case 'reschedule':
        result = await smartReschedule(config, data, userId, supabase);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Log the calendar action
    await supabase.from('automation_logs').insert({
      user_id: userId,
      workflow_id: workflowId,
      event_type: 'smart_calendar',
      message: `Calendar action: ${action}`,
      metadata: {
        action,
        model: config.calendar_ai_model,
        result: result
      }
    });

    console.log('✅ Smart Calendar action completed successfully');

    return NextResponse.json({
      success: true,
      action,
      result
    });

  } catch (error) {
    console.error('❌ Smart Calendar error:', error);
    return NextResponse.json({ 
      error: 'Failed to process calendar action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function createSmartEvent(config: any, data: any, userId: string, supabase: any) {
  const { title, description, date, time, duration } = data;

  // Use AI to enhance event details if needed
  const completion = await openai.chat.completions.create({
    model: config.calendar_ai_model || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a smart calendar assistant. Help create well-structured calendar events with appropriate details, reminders, and categorization.`
      },
      {
        role: 'user',
        content: `Create a calendar event:
Title: ${title}
Description: ${description}
Date: ${date}
Time: ${time}
Duration: ${duration}

Please suggest:
1. An improved title if needed
2. Enhanced description with agenda items
3. Appropriate reminder times
4. Meeting preparation suggestions`
      }
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  const aiSuggestions = completion.choices[0]?.message?.content || '';

  // Create the calendar event
  const eventData = {
    user_id: userId,
    title: title,
    description: `${description}\n\nAI Suggestions:\n${aiSuggestions}`,
    start_time: new Date(`${date} ${time}`).toISOString(),
    end_time: new Date(new Date(`${date} ${time}`).getTime() + (parseInt(duration) * 60 * 1000)).toISOString(),
    created_by_ai: true,
    ai_enhanced: true
  };

  const { data: event, error } = await supabase
    .from('calendar_events')
    .insert(eventData)
    .select()
    .single();

  if (error) {
    console.error('Error creating event:', error);
    throw new Error('Failed to create calendar event');
  }

  return {
    event,
    ai_suggestions: aiSuggestions
  };
}

async function analyzeSchedule(config: any, userId: string, supabase: any) {
  // Get upcoming events
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })
    .limit(20);

  if (!events || events.length === 0) {
    return { analysis: 'No upcoming events found in your calendar.' };
  }

  // Prepare schedule data for AI analysis
  const scheduleData = events.map(event => ({
    title: event.title,
    start: new Date(event.start_time).toLocaleString(),
    end: new Date(event.end_time).toLocaleString(),
    description: event.description
  }));

  const completion = await openai.chat.completions.create({
    model: config.calendar_ai_model || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a productivity and schedule analysis expert. Analyze calendar schedules and provide actionable insights about time management, potential conflicts, and optimization opportunities.`
      },
      {
        role: 'user',
        content: `Analyze this upcoming schedule and provide insights:

${JSON.stringify(scheduleData, null, 2)}

Please provide:
1. Schedule overview and workload assessment
2. Potential conflicts or tight scheduling
3. Gaps that could be used for focused work
4. Recommendations for better time management
5. Stress points and suggested breaks`
      }
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  const analysis = completion.choices[0]?.message?.content || 'Unable to analyze schedule';

  return {
    analysis,
    events_analyzed: events.length,
    schedule_data: scheduleData
  };
}

async function suggestMeetingTimes(config: any, data: any, userId: string, supabase: any) {
  const { participants, duration, preferences } = data;

  // Get user's existing events
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', new Date().toISOString())
    .lte('start_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()) // Next 7 days
    .order('start_time', { ascending: true });

  const completion = await openai.chat.completions.create({
    model: config.calendar_ai_model || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a smart scheduling assistant. Analyze existing calendar events and suggest optimal meeting times considering work hours, existing commitments, and user preferences.`
      },
      {
        role: 'user',
        content: `Suggest meeting times for:
Participants: ${participants?.join(', ') || 'Not specified'}
Duration: ${duration} minutes
Preferences: ${preferences || 'None specified'}

Current schedule:
${events?.map(e => `${new Date(e.start_time).toLocaleString()} - ${e.title}`).join('\n') || 'No existing events'}

Please suggest 3-5 optimal time slots in the next 7 days, considering:
1. Standard business hours (9 AM - 5 PM)
2. Avoiding conflicts with existing events
3. Allowing buffer time between meetings
4. User preferences if specified`
      }
    ],
    max_tokens: 600,
    temperature: 0.7,
  });

  const suggestions = completion.choices[0]?.message?.content || 'Unable to suggest meeting times';

  return {
    suggestions,
    parameters: { participants, duration, preferences },
    existing_events: events?.length || 0
  };
}

async function smartReschedule(config: any, data: any, userId: string, supabase: any) {
  const { eventId, reason, constraints } = data;

  // Get the event to reschedule
  const { data: event } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', eventId)
    .eq('user_id', userId)
    .single();

  if (!event) {
    throw new Error('Event not found');
  }

  // Get other events for context
  const { data: otherEvents } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', new Date().toISOString())
    .neq('id', eventId)
    .order('start_time', { ascending: true })
    .limit(10);

  const completion = await openai.chat.completions.create({
    model: config.calendar_ai_model || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a smart rescheduling assistant. Help find the best alternative time slots for events that need to be moved, considering conflicts, priorities, and constraints.`
      },
      {
        role: 'user',
        content: `Need to reschedule this event:
Title: ${event.title}
Current time: ${new Date(event.start_time).toLocaleString()}
Duration: ${Math.round((new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) / (1000 * 60))} minutes
Reason: ${reason}
Constraints: ${constraints || 'None specified'}

Other upcoming events:
${otherEvents?.map(e => `${new Date(e.start_time).toLocaleString()} - ${e.title}`).join('\n') || 'No other events'}

Please suggest:
1. 3 best alternative time slots
2. Impact analysis of rescheduling
3. Recommendations for communicating the change
4. Priority assessment if multiple events need adjustment`
      }
    ],
    max_tokens: 700,
    temperature: 0.7,
  });

  const rescheduleOptions = completion.choices[0]?.message?.content || 'Unable to provide rescheduling options';

  return {
    original_event: {
      title: event.title,
      original_time: new Date(event.start_time).toLocaleString()
    },
    reschedule_options: rescheduleOptions,
    reason,
    constraints
  };
}

// Test endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Smart Calendar AI API is running',
    timestamp: new Date().toISOString(),
    available_actions: [
      'create_event - Create AI-enhanced calendar events',
      'analyze_schedule - Analyze and optimize calendar schedule',
      'suggest_times - Suggest optimal meeting times',
      'reschedule - Smart rescheduling with conflict resolution'
    ]
  });
} 