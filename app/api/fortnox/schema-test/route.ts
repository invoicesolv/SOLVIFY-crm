import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_SETTINGS_SCHEMA = [
  'id',
  'service_name',
  'user_id',
  'workspace_id', // This might be optional
  'access_token',
  'refresh_token',
  'expires_at',
  'created_at',
  'updated_at'
];

export async function GET(req: NextRequest) {
  console.log('\n=== Fortnox Schema Test ===');
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return NextResponse.json(
      { error: 'Missing Supabase environment variables' }, 
      { status: 500 }
    );
  }
  
  try {
    console.log('Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to get settings table structure
    console.log('Checking settings table structure...');
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying settings table:', error);
      
      // Try creating a minimal settings record for testing
      console.log('Attempting to create settings table if it does not exist...');
      
      // First check if table exists but is empty
      try {
        const { data: emptyCheck, error: emptyError } = await supabase
          .from('settings')
          .select('count(*)', { count: 'exact', head: true });
          
        if (!emptyError) {
          console.log('Settings table exists but is empty or has error in structure');
        } else {
          console.error('Settings table does not exist or cannot be accessed:', emptyError);
          
          // Try creating the table via SQL (might not work with RLS)
          console.log('Checking if we have permission to create the table...');
          const { error: createError } = await supabase.rpc('create_settings_table_if_not_exists');
          
          if (createError) {
            console.error('Cannot create settings table:', createError);
          } else {
            console.log('Settings table created successfully');
          }
        }
      } catch (tableCheckError) {
        console.error('Error checking empty table:', tableCheckError);
      }
      
      return NextResponse.json({
        status: 'error',
        message: 'Settings table error',
        error: error.message,
        suggestion: 'The settings table might not exist. Check the Supabase schema or migrations.'
      });
    }
    
    if (!data || data.length === 0) {
      console.log('Settings table exists but is empty');
      
      // Get the table description anyway
      const { data: tableInfo, error: describeError } = await supabase.rpc('describe_table', { table_name: 'settings' });
      
      if (describeError) {
        console.error('Error describing settings table:', describeError);
      } else {
        console.log('Settings table structure:', tableInfo);
      }
      
      return NextResponse.json({
        status: 'warning',
        message: 'Settings table exists but has no records',
        table_info: tableInfo || null
      });
    }
    
    // Table exists and has data
    console.log('Settings table exists and has data');
    
    // Get actual schema
    const actualSchema = Object.keys(data[0]);
    console.log('Actual schema:', actualSchema);
    
    // Compare with expected schema
    const missingColumns = EXPECTED_SETTINGS_SCHEMA.filter(col => !actualSchema.includes(col));
    const extraColumns = actualSchema.filter(col => !EXPECTED_SETTINGS_SCHEMA.includes(col));
    
    // Check specifically for Fortnox records
    console.log('Checking for Fortnox records...');
    const { data: fortnoxData, error: fortnoxError } = await supabase
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox');
    
    if (fortnoxError) {
      console.error('Error querying Fortnox records:', fortnoxError);
    } else {
      console.log(`Found ${fortnoxData.length} Fortnox records`);
      
      // Sample the first record if exists
      if (fortnoxData.length > 0) {
        const sample = fortnoxData[0];
        console.log('Sample Fortnox record:');
        console.log('- Record ID:', sample.id);
        console.log('- User ID:', sample.user_id);
        console.log('- Has access token:', !!sample.access_token);
        console.log('- Has refresh token:', !!sample.refresh_token);
        console.log('- Expires at:', sample.expires_at);
      }
    }
    
    // Try running a simple update to check permissions
    if (fortnoxData && fortnoxData.length > 0) {
      console.log('Testing update permissions...');
      const testRecord = fortnoxData[0];
      
      const { data: updateResult, error: updateError } = await supabase
        .from('settings')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', testRecord.id)
        .select();
      
      if (updateError) {
        console.error('Update permission test failed:', updateError);
      } else {
        console.log('Update permission test succeeded');
      }
    }
    
    // Return schema comparison
    return NextResponse.json({
      status: 'success',
      schema_check: missingColumns.length === 0 ? 'valid' : 'missing_columns',
      actual_schema: actualSchema,
      missing_columns: missingColumns,
      extra_columns: extraColumns,
      fortnox_records: fortnoxData ? fortnoxData.length : 0,
      sample_record: fortnoxData && fortnoxData.length > 0 ? {
        record_id: fortnoxData[0].id,
        user_id: fortnoxData[0].user_id,
        has_access_token: !!fortnoxData[0].access_token,
        has_refresh_token: !!fortnoxData[0].refresh_token,
        expires_at: fortnoxData[0].expires_at
      } : null
    });
  } catch (e) {
    console.error('Error in schema test:', e);
    return NextResponse.json({
      status: 'error',
      message: 'Error testing schema',
      error: e instanceof Error ? e.message : String(e)
    });
  }
} 