import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  console.log('\n=== Supabase Database Connection Check ===');
  
  // Check environment variables first
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'present' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing'
  };
  
  console.log('Environment variables status:');
  console.log(JSON.stringify(envCheck, null, 2));
  
  // If URL is missing, we can't proceed
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('CRITICAL ERROR: Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    return NextResponse.json({
      status: 'error',
      message: 'Missing Supabase URL environment variable',
      env_check: envCheck
    }, { status: 500 });
  }
  
  // Try to use one of the available keys
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseKey) {
    console.error('CRITICAL ERROR: Missing Supabase service role key environment variable');
    return NextResponse.json({
      status: 'error',
      message: 'Missing Supabase service role key environment variable',
      env_check: envCheck
    }, { status: 500 });
  }
  
  try {
    console.log('Initializing Supabase client...');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);
    
    // Test basic connection
    console.log('Testing basic connection...');
    const { data: health, error: healthError } = await supabase.from('_health').select('*').limit(1);
    
    if (healthError) {
      console.error('Basic connection test failed:', healthError);
      return NextResponse.json({
        status: 'error',
        message: 'Failed to connect to Supabase',
        error: healthError.message,
        env_check: envCheck
      }, { status: 500 });
    }
    
    console.log('Basic connection successful');
    
    // Check if 'settings' table exists
    console.log('Checking for settings table...');
    const { data: tablesData, error: tablesError } = await supabase
      .from('_tables')
      .select('*')
      .eq('name', 'settings');
    
    const settingsTableExists = tablesData && tablesData.length > 0;
    
    if (tablesError) {
      console.error('Table check failed:', tablesError);
      // If we can't directly check table existence, try a query to the settings table
      try {
        console.log('Trying direct query to settings table...');
        const { data: settingsData, error: settingsError } = await supabase
          .from('settings')
          .select('count(*)', { count: 'exact', head: true });
          
        if (settingsError) {
          console.error('Settings table query failed:', settingsError);
          return NextResponse.json({
            status: 'error',
            message: 'Settings table does not exist or cannot be accessed',
            connection: 'ok',
            settings_table: 'not_found',
            error: settingsError.message,
            env_check: envCheck
          });
        }
        
        console.log('Settings table exists and query succeeded');
        console.log(`Total settings records: ${(settingsData as any).count || 0}`);
        
        // Now try to get settings schema
        console.log('Checking settings table schema...');
        const { data: sampleData, error: sampleError } = await supabase
          .from('settings')
          .select('*')
          .limit(1);
          
        let schema: string[] = [];
        if (!sampleError && sampleData && sampleData.length > 0) {
          schema = Object.keys(sampleData[0]);
          console.log('Settings table schema:', schema);
        } else {
          console.log('No sample data available, table might be empty');
        }
        
        // Check specifically for the fortnox service
        console.log('Checking for fortnox records...');
        const { data: fortnoxData, error: fortnoxError } = await supabase
          .from('settings')
          .select('*')
          .eq('service_name', 'fortnox');
          
        if (fortnoxError) {
          console.error('Fortnox query failed:', fortnoxError);
        } else {
          console.log(`Found ${fortnoxData.length} Fortnox records`);
          if (fortnoxData.length > 0) {
            fortnoxData.forEach((record, index) => {
              console.log(`Fortnox record #${index + 1}:`);
              console.log(`- User ID: ${record.user_id}`);
              console.log(`- Created at: ${record.created_at}`);
              console.log(`- Has access token: ${!!record.access_token}`);
              console.log(`- Has refresh token: ${!!record.refresh_token}`);
              console.log(`- Expires at: ${record.expires_at}`);
            });
          }
        }
        
        return NextResponse.json({
          status: 'success',
          connection: 'ok',
          settings_table: 'exists',
          total_records: (settingsData as any).count || 0,
          schema: schema,
          fortnox_records: fortnoxData ? fortnoxData.length : 0,
          env_check: envCheck
        });
      } catch (tryError) {
        console.error('Error during table checks:', tryError);
        return NextResponse.json({
          status: 'error',
          message: 'Error checking tables',
          error: tryError instanceof Error ? tryError.message : String(tryError),
          env_check: envCheck
        }, { status: 500 });
      }
    }
    
    console.log(`Settings table exists: ${settingsTableExists}`);
    
    if (settingsTableExists) {
      // Try to query data from the settings table
      console.log('Testing settings table query...');
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('count(*)', { count: 'exact', head: true });
        
      if (settingsError) {
        console.error('Settings table query failed:', settingsError);
        return NextResponse.json({
          status: 'error',
          message: 'Settings table exists but query failed',
          connection: 'ok',
          settings_table: 'exists_but_error',
          error: settingsError.message,
          env_check: envCheck
        });
      }
      
      console.log(`Settings table query succeeded. Total records: ${(settingsData as any).count || 0}`);
      
      return NextResponse.json({
        status: 'success',
        connection: 'ok',
        settings_table: 'exists',
        total_records: (settingsData as any).count || 0,
        env_check: envCheck
      });
    } else {
      console.log('Settings table does not exist');
      return NextResponse.json({
        status: 'warning',
        message: 'Settings table does not exist',
        connection: 'ok',
        settings_table: 'not_found',
        env_check: envCheck
      });
    }
  } catch (e) {
    console.error('Error connecting to Supabase:', e);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to connect to Supabase',
      error: e instanceof Error ? e.message : String(e),
      env_check: envCheck
    }, { status: 500 });
  }
} 