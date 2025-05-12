import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

export async function GET(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const batchId = url.searchParams.get('batchId');
    const recordId = url.searchParams.get('recordId');
    
    if (!batchId && !recordId) {
      return NextResponse.json({ error: 'Either batchId or recordId is required' }, { status: 400 });
    }
    
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Failed to initialize Supabase admin client' }, { status: 500 });
    }
    
    // Query the database for the record
    let query = supabaseAdmin.from('generated_content').select('*');
    
    if (recordId) {
      query = query.eq('id', recordId);
    } else if (batchId) {
      query = query.eq('batch_id', batchId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error querying database:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No records found' }, { status: 404 });
    }
    
    // Check if there's any progress
    const records = data.map(record => ({
      id: record.id,
      title: record.title,
      status: record.status,
      progress: record.generation_progress || 0,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      timeSinceUpdate: record.updated_at ? 
        Math.floor((new Date().getTime() - new Date(record.updated_at).getTime()) / 1000) + ' seconds ago' : 
        'never'
    }));
    
    // Manually update progress to 10% to test if updates are working
    if (recordId) {
      const testProgress = Math.floor(Math.random() * 90) + 10; // Random progress between 10-99%
      
      const { error: updateError } = await supabaseAdmin
        .from('generated_content')
        .update({ 
          generation_progress: testProgress,
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId);
      
      if (updateError) {
        return NextResponse.json({ 
          records,
          testUpdateError: updateError.message,
          message: 'Found records but test update failed'
        });
      }
      
      return NextResponse.json({ 
        records,
        testUpdateSuccess: true,
        newProgress: testProgress,
        message: 'Found records and successfully tested update'
      });
    }
    
    return NextResponse.json({ 
      records,
      message: 'Found records'
    });
    
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 