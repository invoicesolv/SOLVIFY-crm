import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client at runtime only
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Check for both variable names, preferring the non-public one if both exist
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(req: NextRequest) {
  console.log('\n=== Testing Supabase Connection ===');
  
  // Check environment variables
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
    SUPABASE_KEY_LENGTH: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
                         process.env.SUPABASE_SERVICE_ROLE_KEY.length : 
                         (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? 
                          process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY.length : 0)
  };
  
  console.log('Environment variables check:', envCheck);
  
  // Initialize Supabase client
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { 
        error: 'Supabase initialization failed',
        env_check: envCheck
      }, 
      { status: 500 }
    );
  }
  
  try {
    // Test basic query to validate connection
    console.log('Testing basic query...');
    const { data: healthCheck, error: healthError } = await supabaseAdmin
      .from('settings')
      .select('count(*)', { count: 'exact', head: true });
    
    if (healthError) {
      console.error('Health check query failed:', healthError);
      return NextResponse.json({
        status: 'error',
        connection: 'failed',
        env_check: envCheck,
        error: healthError.message
      });
    }
    
    console.log('Health check successful');
    
    // Check settings table structure
    console.log('Checking settings table structure...');
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('settings')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Table structure check failed:', tableError);
      return NextResponse.json({
        status: 'partial_success',
        connection: 'ok',
        table_check: 'failed',
        env_check: envCheck,
        error: tableError.message
      });
    }
    
    // Return table column names if available
    let columnNames: string[] = [];
    if (tableInfo && tableInfo.length > 0) {
      columnNames = Object.keys(tableInfo[0]);
    }
    
    console.log('Table structure check successful');
    console.log('Table columns:', columnNames.join(', '));
    
    // Count Fortnox tokens
    const { data: fortnoxTokens, error: fortnoxError } = await supabaseAdmin
      .from('settings')
      .select('count(*)', { count: 'exact', head: true })
      .eq('service_name', 'fortnox');
    
    // Return successful response with diagnostic info
    return NextResponse.json({
      status: 'success',
      connection: 'ok',
      table_check: 'ok',
      env_check: envCheck,
      columns: columnNames,
      fortnox_tokens_count: fortnoxError ? 'error' : (fortnoxTokens as any)?.count || 0
    });
  } catch (e) {
    console.error('Error testing Supabase connection:', e);
    return NextResponse.json({
      status: 'error',
      connection: 'failed',
      env_check: envCheck,
      error: e instanceof Error ? e.message : String(e)
    });
  }
} 