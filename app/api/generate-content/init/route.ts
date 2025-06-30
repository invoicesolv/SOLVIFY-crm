import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client with service role key
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Create authenticated Supabase client
function getAuthenticatedSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing required environment variables for authenticated client');
    return null;
  }
  
  const client = createClient(supabaseUrl, supabaseAnonKey);
  
  // Set the auth token
  client.auth.setSession({
    access_token: accessToken,
    refresh_token: '' // Not needed for server-side operations
  });
  
  return client;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the request body
    const body = await request.json();
    const { workspaceId, batchId, title = 'Content Generation' } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    if (!batchId) {
      return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });
    }

    console.log(`Initializing content generation batch ${batchId} for workspace ${workspaceId}`);
    console.log(`User ID: ${user.id}`);
    
    // First try with admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Check if a record already exists for this batch
    const { data: existingRecord, error: checkError } = await supabaseAdmin
      .from('generated_content')
      .select('id')
      .eq('batch_id', batchId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing record:', checkError);
    }

    if (existingRecord?.id) {
      console.log('Record already exists with ID:', existingRecord.id);
      return NextResponse.json({ 
        success: true, 
        recordId: existingRecord.id,
        batchId,
        message: 'Record already exists'
      });
    }

    // Try to create record with admin client first
    console.log('Attempting to create record with admin client...');
    const { data: initialRecord, error: insertError } = await supabaseAdmin
      .from('generated_content')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        title: title,
        content: '',
        status: 'generating',
        generation_progress: 0,
        batch_id: batchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating initial record with admin client:', insertError);
      
      // If admin client fails, try with regular client
      console.log('Trying with regular client...');
      const { data: regularRecord, error: regularError } = await supabase
        .from('generated_content')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          title: title,
          content: '',
          status: 'generating',
          generation_progress: 0,
          batch_id: batchId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
        
      if (regularError) {
        console.error('Error creating initial record with regular client:', regularError);
        return NextResponse.json({ 
          error: 'Failed to initialize content generation',
          details: regularError.message,
          adminError: insertError.message
        }, { status: 500 });
      }
      
      console.log('Created initial record with regular client, ID:', regularRecord.id);
      return NextResponse.json({ 
        success: true, 
        recordId: regularRecord.id,
        batchId,
        message: 'Record created successfully with regular client'
      });
    }

    console.log('Created initial record with admin client, ID:', initialRecord.id);
    return NextResponse.json({ 
      success: true, 
      recordId: initialRecord.id,
      batchId,
      message: 'Record created successfully with admin client'
    });

  } catch (error) {
    console.error('Unexpected error initializing content generation:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      success: false
    }, { status: 500 });
  }
} 