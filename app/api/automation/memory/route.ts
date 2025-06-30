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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const workflowId = searchParams.get('workflow_id');
    const memoryKey = searchParams.get('memory_key');
    const testMode = searchParams.get('test');

    // Test endpoint to show all available data values
    if (testMode === 'true') {
      const supabaseAdmin = getSupabaseAdmin();
      
      // Get sample data from various tables to show what's available
      const [
        { data: projects },
        { data: customers },
        { data: calendar_events },
        { data: leads },
        { data: deals },
        { data: team_members },
        { data: invoices },
        { data: memory_data }
      ] = await Promise.all([
        supabaseAdmin.from('projects').select('*').limit(3),
        supabaseAdmin.from('customers').select('*').limit(3),
        supabaseAdmin.from('calendar_events').select('*').limit(3),
        supabaseAdmin.from('leads').select('*').limit(3),
        supabaseAdmin.from('deals').select('*').limit(3),
        supabaseAdmin.from('team_members').select('*').limit(3),
        supabaseAdmin.from('invoices').select('*').limit(3),
        supabaseAdmin.from('automation_memory').select('*').limit(5)
      ]);

      return NextResponse.json({
        success: true,
        status: 200,
        message: "Memory API is working! Here's what data you can access:",
        available_data: {
          projects: {
            description: "Access project data, tasks, progress, deadlines",
            sample_fields: projects?.[0] ? Object.keys(projects[0]) : [],
            sample_data: projects?.[0] || null,
            count: projects?.length || 0
          },
          customers: {
            description: "Access customer information, contact details, history",
            sample_fields: customers?.[0] ? Object.keys(customers[0]) : [],
            sample_data: customers?.[0] || null,
            count: customers?.length || 0
          },
          calendar_events: {
            description: "Access calendar events, meetings, schedules",
            sample_fields: calendar_events?.[0] ? Object.keys(calendar_events[0]) : [],
            sample_data: calendar_events?.[0] || null,
            count: calendar_events?.length || 0
          },
          leads: {
            description: "Access lead information, status, conversion data",
            sample_fields: leads?.[0] ? Object.keys(leads[0]) : [],
            sample_data: leads?.[0] || null,
            count: leads?.length || 0
          },
          deals: {
            description: "Access deal pipeline, values, stages, probabilities",
            sample_fields: deals?.[0] ? Object.keys(deals[0]) : [],
            sample_data: deals?.[0] || null,
            count: deals?.length || 0
          },
          team_members: {
            description: "Access team member info, roles, permissions",
            sample_fields: team_members?.[0] ? Object.keys(team_members[0]) : [],
            sample_data: team_members?.[0] || null,
            count: team_members?.length || 0
          },
          invoices: {
            description: "Access invoice data, amounts, status, dates",
            sample_fields: invoices?.[0] ? Object.keys(invoices[0]) : [],
            sample_data: invoices?.[0] || null,
            count: invoices?.length || 0
          },
          automation_memory: {
            description: "Your stored automation memory data",
            sample_fields: memory_data?.[0] ? Object.keys(memory_data[0]) : [],
            sample_data: memory_data?.[0] || null,
            count: memory_data?.length || 0
          }
        },
        memory_operations: {
          store: "Store any data with key-value pairs",
          retrieve: "Get stored data by key",
          update: "Update existing data",
          delete: "Remove data by key",
          append: "Add to existing arrays/lists",
          clear: "Clear all memory for workflow"
        },
        example_usage: {
          store_customer_preference: {
            key: "customer_123_preferences",
            value: { communication: "email", frequency: "weekly", topics: ["updates", "offers"] }
          },
          store_conversation_context: {
            key: "conversation_abc",
            value: { last_topic: "pricing", user_intent: "purchase", sentiment: "positive" }
          },
          store_workflow_state: {
            key: "workflow_state",
            value: { current_step: 3, completed_actions: ["email_sent", "calendar_created"], next_action: "follow_up" }
          }
        },
        database_schema_access: "Full read/write access to all workspace data",
        timestamp: new Date().toISOString()
      });
    }

    if (!workspaceId || !workflowId) {
      return NextResponse.json(
        { error: 'workspace_id and workflow_id are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('automation_memory')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('workflow_id', workflowId);

    // If specific key requested, filter by it
    if (memoryKey) {
      query = query.eq('memory_key', memoryKey);
    }

    // Filter out expired entries
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching automation memory:', error);
      return NextResponse.json(
        { error: 'Failed to fetch memory data' },
        { status: 500 }
      );
    }

    // If specific key requested, return single value
    if (memoryKey) {
      const memory = data?.[0];
      return NextResponse.json({
        success: true,
        status: 200,
        data: memory ? memory.memory_value : null,
        exists: !!memory,
        metadata: memory ? {
          created_at: memory.created_at,
          updated_at: memory.updated_at,
          expires_at: memory.expires_at
        } : null
      });
    }

    // Return all memory for the workflow
    const memoryMap = data?.reduce((acc, item) => {
      acc[item.memory_key] = item.memory_value;
      return acc;
    }, {} as Record<string, any>) || {};

    return NextResponse.json({
      success: true,
      status: 200,
      data: memoryMap,
      count: data?.length || 0,
      memory_items: data?.map(item => ({
        key: item.memory_key,
        value: item.memory_value,
        created_at: item.created_at,
        updated_at: item.updated_at,
        expires_at: item.expires_at
      })) || []
    });

  } catch (error) {
    console.error('Error in automation memory GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, workflow_id, memory_key, memory_value, expires_in_hours, operation = 'store' } = body;

    if (!workspace_id || !workflow_id || !memory_key) {
      return NextResponse.json(
        { error: 'workspace_id, workflow_id, and memory_key are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Handle different operations
    switch (operation) {
      case 'append':
        // Get existing data and append to it
        const { data: existingData } = await supabaseAdmin
          .from('automation_memory')
          .select('memory_value')
          .eq('workspace_id', workspace_id)
          .eq('workflow_id', workflow_id)
          .eq('memory_key', memory_key)
          .single();

        let appendedValue = memory_value;
        if (existingData?.memory_value) {
          if (Array.isArray(existingData.memory_value)) {
            appendedValue = [...existingData.memory_value, memory_value];
          } else if (typeof existingData.memory_value === 'object') {
            appendedValue = { ...existingData.memory_value, ...memory_value };
          } else {
            appendedValue = [existingData.memory_value, memory_value];
          }
        }

        // Calculate expiration time if provided
        let expiresAt: string | null = null;
        if (expires_in_hours && expires_in_hours > 0) {
          expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString();
        }

        // Upsert the memory entry
        const { data: appendData, error: appendError } = await supabaseAdmin
          .from('automation_memory')
          .upsert({
            workspace_id,
            workflow_id,
            memory_key,
            memory_value: appendedValue,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'workspace_id,workflow_id,memory_key'
          })
          .select()
          .single();

        if (appendError) {
          console.error('Error appending to memory:', appendError);
          return NextResponse.json(
            { error: 'Failed to append to memory data' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          status: 200,
          data: appendData,
          operation: 'append',
          message: 'Data appended to memory successfully'
        });

      case 'store':
      case 'update':
      default:
        if (memory_value === undefined) {
          return NextResponse.json(
            { error: 'memory_value is required for store/update operations' },
            { status: 400 }
          );
        }

        // Calculate expiration time if provided
        let storeExpiresAt: string | null = null;
        if (expires_in_hours && expires_in_hours > 0) {
          storeExpiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString();
        }

        // Upsert the memory entry
        const { data: storeData, error: storeError } = await supabaseAdmin
          .from('automation_memory')
          .upsert({
            workspace_id,
            workflow_id,
            memory_key,
            memory_value,
            expires_at: storeExpiresAt,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'workspace_id,workflow_id,memory_key'
          })
          .select()
          .single();

        if (storeError) {
          console.error('Error storing automation memory:', storeError);
          return NextResponse.json(
            { error: 'Failed to store memory data' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          status: 200,
          data: storeData,
          operation: operation,
          message: 'Memory stored successfully'
        });
    }

  } catch (error) {
    console.error('Error in automation memory POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const workflowId = searchParams.get('workflow_id');
    const memoryKey = searchParams.get('memory_key');

    if (!workspaceId || !workflowId) {
      return NextResponse.json(
        { error: 'workspace_id and workflow_id are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from('automation_memory')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('workflow_id', workflowId);

    // If specific key provided, delete only that key
    if (memoryKey) {
      query = query.eq('memory_key', memoryKey);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting automation memory:', error);
      return NextResponse.json(
        { error: 'Failed to delete memory data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 200,
      operation: 'delete',
      message: memoryKey 
        ? `Memory key '${memoryKey}' deleted successfully`
        : `All memory for workflow '${workflowId}' deleted successfully`
    });

  } catch (error) {
    console.error('Error in automation memory DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 