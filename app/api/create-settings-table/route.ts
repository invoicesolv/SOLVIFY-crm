import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

export async function POST(req: NextRequest) {
  console.log('\n=== Creating Settings Table ===');
  
  // Check if user is authorized
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
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
    
    // First check if settings table already exists
    console.log('Checking if settings table already exists...');
    let tableExists = false;
    
    try {
      const { data: tableCheck, error: tableError } = await supabase
        .from('settings')
        .select('count(*)', { count: 'exact', head: true });
        
      if (!tableError) {
        tableExists = true;
        console.log('Settings table already exists');
      }
    } catch (e) {
      console.log('Settings table does not exist, will create it');
    }
    
    if (tableExists) {
      return NextResponse.json({
        status: 'warning',
        message: 'Settings table already exists'
      });
    }
    
    // Attempt to create the settings table using SQL
    console.log('Creating settings table...');
    
    // Need to use raw SQL via REST API since Supabase JS client doesn't expose DDL operations
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        service_name TEXT NOT NULL,
        user_id UUID NOT NULL,
        workspace_id UUID,
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(service_name, user_id)
      );
      
      -- Add RLS policies
      ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
      
      -- Create policy for users to read only their own settings
      CREATE POLICY "Users can read their own settings"
        ON public.settings
        FOR SELECT
        USING (auth.uid() = user_id);
      
      -- Create policy for users to insert their own settings
      CREATE POLICY "Users can insert their own settings"
        ON public.settings
        FOR INSERT
        WITH CHECK (auth.uid() = user_id);
      
      -- Create policy for users to update their own settings
      CREATE POLICY "Users can update their own settings"
        ON public.settings
        FOR UPDATE
        USING (auth.uid() = user_id);
    `;
    
    // Since we cannot execute SQL directly via the JS client,
    // we'll need to create a Postgres function and call it via RPC
    
    // First, create a function to execute the DDL
    console.log('Creating function to execute DDL...');
    const { error: funcError } = await supabase.rpc('create_settings_table', { sql: createTableSQL });
    
    if (funcError) {
      console.error('Error creating function:', funcError);
      
      // Try alternative approach using REST API directly if available
      console.log('Trying alternative approach using direct SQL execution...');
      
      // Note: This requires additional setup on the Supabase backend
      // which might not be available in your environment
      
      return NextResponse.json({
        status: 'error',
        message: 'Failed to create settings table',
        error: funcError.message,
        suggestions: [
          'Contact your database administrator to create the settings table',
          'Run the DDL script manually in the Supabase SQL editor'
        ],
        ddl_script: createTableSQL
      });
    }
    
    console.log('Settings table created successfully');
    
    // Verify the table was created
    try {
      const { data: verifyData, error: verifyError } = await supabase
        .from('settings')
        .select('count(*)', { count: 'exact', head: true });
        
      if (verifyError) {
        console.error('Verification failed, table might not exist:', verifyError);
        return NextResponse.json({
          status: 'warning',
          message: 'Table creation reported success but verification failed',
          error: verifyError.message
        });
      }
      
      console.log('Table creation verified');
      
      // Create a test record if needed
      const { data: insertData, error: insertError } = await supabase
        .from('settings')
        .insert({
          service_name: 'test',
          user_id: session.user.id,
          access_token: 'test_token',
          refresh_token: 'test_refresh_token',
          expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 2 months
        })
        .select();
        
      if (insertError) {
        console.error('Error inserting test record:', insertError);
      } else {
        console.log('Test record inserted successfully');
      }
      
      return NextResponse.json({
        status: 'success',
        message: 'Settings table created successfully',
        test_record: insertData && insertData.length > 0 ? insertData[0] : null
      });
    } catch (verifyErr) {
      console.error('Error verifying table creation:', verifyErr);
      return NextResponse.json({
        status: 'error',
        message: 'Error verifying table creation',
        error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr)
      });
    }
  } catch (e) {
    console.error('Error creating settings table:', e);
    return NextResponse.json({
      status: 'error',
      message: 'Error creating settings table',
      error: e instanceof Error ? e.message : String(e)
    });
  }
} 