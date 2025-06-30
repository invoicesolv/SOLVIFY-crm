import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { getUserFromToken } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectNumber: string } }
) {
  console.log(`\n=== Looking up project by Fortnox number: ${params.projectNumber} ===`);
  
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use user.id instead of session?.user?.id
    const userId = user.id;
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize Supabase client' }, { status: 500 });
    }
    
    // Look up the project by fortnox_project_number
    const { data: project, error } = await supabase
      .from('projects')
      .select('id, name, description, status, customer_name, workspace_id')
      .eq('fortnox_project_number', params.projectNumber)
      .maybeSingle();
    
    if (error) {
      console.error('Error looking up project:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!project) {
      return NextResponse.json({
        message: 'No matching project found',
        project: null
      }, { status: 404 });
    }
    
    return NextResponse.json({
      project: project
    });
  } catch (error) {
    console.error('Error processing project lookup request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 