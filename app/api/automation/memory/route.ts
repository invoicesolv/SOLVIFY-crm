import { NextRequest, NextResponse } from 'next/server';
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
        data: memory ? memory.memory_value : null,
        exists: !!memory
      });
    }

    // Return all memory for the workflow
    const memoryMap = data?.reduce((acc, item) => {
      acc[item.memory_key] = item.memory_value;
      return acc;
    }, {} as Record<string, any>) || {};

    return NextResponse.json({
      success: true,
      data: memoryMap,
      count: data?.length || 0
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
    const { workspace_id, workflow_id, memory_key, memory_value, expires_in_hours } = body;

    if (!workspace_id || !workflow_id || !memory_key || memory_value === undefined) {
      return NextResponse.json(
        { error: 'workspace_id, workflow_id, memory_key, and memory_value are required' },
        { status: 400 }
      );
    }

    // Calculate expiration time if provided
    let expiresAt: string | null = null;
    if (expires_in_hours && expires_in_hours > 0) {
      expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000).toISOString();
    }

    // Upsert the memory entry
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('automation_memory')
      .upsert({
        workspace_id,
        workflow_id,
        memory_key,
        memory_value,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,workflow_id,memory_key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing automation memory:', error);
      return NextResponse.json(
        { error: 'Failed to store memory data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Memory stored successfully'
    });

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